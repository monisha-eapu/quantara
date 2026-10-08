import { config } from "../config.js";
import { db, getState, setState, transaction } from "../db.js";
import { assertPqcAvailable } from "../crypto/schemes.js";
import { logAudit, listAudit } from "./audit.js";
import { tamperedBlockIndexes, verifyChain, getLatestBlockRow } from "./ledger.js";
import { listRecords, recordAsEntity, type RecordRow } from "./records.js";
import { verifyProductChain } from "./supplyChain.js";
import { verdictToStatus, verifyEntity } from "./verification.js";

export interface ScanSummary {
  at: string;
  durationMs: number;
  entities: number;
  verified: number;
  tampered: number;
  legacy: number;
  chainValid: boolean;
  blocks: number;
  signaturesVerified: number;
}

/** Full re-verification of every record, event, and block signature. Updates stored statuses. */
export function runIntegrityScan(actor = "System"): ScanSummary {
  const started = performance.now();
  const chain = verifyChain({ signatures: true });
  const prevStatus = new Map<string, string>([
    ...(db.prepare("SELECT id, integrity_status FROM records").all() as { id: string; integrity_status: string }[]).map((r) => [r.id, r.integrity_status] as const),
    ...(db.prepare("SELECT id, integrity_status FROM supply_chain_events").all() as { id: string; integrity_status: string }[]).map((r) => [r.id, r.integrity_status] as const),
  ]);
  let verified = 0, tampered = 0, legacy = 0, entities = 0;
  const newlyTampered: string[] = [];
  const tally = (id: string, status: string) => {
    entities++;
    if (status === "VERIFIED") verified++;
    else if (status === "TAMPERED") tampered++;
    else legacy++;
    if (status === "TAMPERED" && prevStatus.get(id) !== "TAMPERED") newlyTampered.push(id);
  };
  transaction(() => {
    const now = new Date().toISOString();
    const update = db.prepare("UPDATE records SET integrity_status = ?, last_verified_at = ? WHERE id = ?");
    const lands = (db.prepare("SELECT * FROM records WHERE record_type = 'LAND_RECORD'").all() as unknown as RecordRow[]);
    for (const r of lands) {
      const status = verdictToStatus(verifyEntity(recordAsEntity({ ...r }), chain).verdict);
      update.run(status, now, r.id);
      tally(r.id, status);
    }
    const products = db.prepare("SELECT id FROM records WHERE record_type = 'SUPPLY_PRODUCT'").all() as { id: string }[];
    for (const p of products) {
      const res = verifyProductChain(p.id, chain, { persist: true });
      tally(p.id, verdictToStatus(res.product.verdict));
      for (const e of res.events) tally(e.entityId, verdictToStatus(e.verdict));
    }
  });
  for (const id of newlyTampered) {
    logAudit({ actor: "System", action: "TAMPER_DETECTED", recordId: id, result: "DETECTED", details: "Detected by full integrity scan" });
  }
  const summary: ScanSummary = {
    at: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    entities, verified, tampered, legacy,
    chainValid: chain.valid,
    blocks: chain.totalBlocks,
    signaturesVerified: entities + chain.totalBlocks,
  };
  setState("lastScan", summary);
  logAudit({ actor, action: "INTEGRITY_SCAN", result: tampered || !chain.valid ? "DETECTED" : "VALID",
    details: `${entities} entities, ${chain.totalBlocks} blocks, ${summary.signaturesVerified} ML-DSA/legacy signature checks in ${summary.durationMs} ms; ${tampered} tampered; ledger ${chain.valid ? "intact" : "BROKEN"}` });
  return summary;
}

export async function quantumServiceStatus(): Promise<{ online: boolean; ibmConfigured?: boolean; detail?: string }> {
  try {
    const res = await fetch(`${config.quantumServiceUrl}/status`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { online: false, detail: `HTTP ${res.status}` };
    const body = (await res.json()) as { ibm?: { configured?: boolean } };
    return { online: true, ibmConfigured: Boolean(body.ibm?.configured) };
  } catch {
    return { online: false, detail: "Quantum service not reachable" };
  }
}

export async function dashboard() {
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const recordCounts = db.prepare(`SELECT record_type, integrity_status, COUNT(*) AS n FROM records GROUP BY record_type, integrity_status`).all() as { record_type: string; integrity_status: string; n: number }[];
  const eventCounts = db.prepare(`SELECT integrity_status, COUNT(*) AS n FROM supply_chain_events GROUP BY integrity_status`).all() as { integrity_status: string; n: number }[];
  const byStatus: Record<string, number> = { VERIFIED: 0, TAMPERED: 0, LEGACY: 0, UNVERIFIED: 0 };
  for (const r of recordCounts) byStatus[r.integrity_status] = (byStatus[r.integrity_status] ?? 0) + r.n;
  for (const e of eventCounts) byStatus[e.integrity_status] = (byStatus[e.integrity_status] ?? 0) + e.n;
  const landRecords = recordCounts.filter((r) => r.record_type === "LAND_RECORD").reduce((a, r) => a + r.n, 0);
  const products = recordCounts.filter((r) => r.record_type === "SUPPLY_PRODUCT").reduce((a, r) => a + r.n, 0);
  const events = eventCounts.reduce((a, r) => a + r.n, 0);

  const chain = verifyChain(); // hash-chain walk on every dashboard load: cheap and always live
  let cryptoOnline = true;
  try { assertPqcAvailable(); } catch { cryptoOnline = false; }
  const quantum = await quantumServiceStatus();
  const tip = getLatestBlockRow();

  const alerts = [
    ...(db.prepare("SELECT id, title, record_type AS type, last_verified_at AS at FROM records WHERE integrity_status = 'TAMPERED' ORDER BY last_verified_at DESC LIMIT 10").all() as Record<string, unknown>[]),
    ...(db.prepare("SELECT id, event_type || ' · ' || product_id AS title, 'SUPPLY_EVENT' AS type, timestamp AS at FROM supply_chain_events WHERE integrity_status = 'TAMPERED' LIMIT 10").all() as Record<string, unknown>[]),
  ].map((a) => ({ ...a }));
  for (const i of chain.issues.slice(0, 5)) alerts.unshift({ id: `BLOCK-${i.index}`, title: i.message, type: "LEDGER_BLOCK", at: chain.checkedAt });

  const activity = (db.prepare(`SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS n FROM ledger_blocks
      WHERE timestamp >= ? GROUP BY day ORDER BY day`).all(new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)) as { day: string; n: number }[]).map((r) => ({ ...r }));

  return {
    metrics: {
      totalRecords: landRecords + products + events,
      landRecords, products, events,
      verified: byStatus.VERIFIED,
      tamperAlerts: byStatus.TAMPERED + chain.issues.length,
      tamperedEntities: byStatus.TAMPERED,
      legacy: byStatus.LEGACY,
      unverified: byStatus.UNVERIFIED,
      ledgerBlocks: chain.totalBlocks,
      pqcSigned: count("SELECT COUNT(*) AS n FROM records WHERE algorithm = 'ML-DSA-65'") + count("SELECT COUNT(*) AS n FROM supply_chain_events WHERE algorithm = 'ML-DSA-65'"),
    },
    system: {
      cryptoEngine: { online: cryptoOnline, detail: `ML-DSA-65 (FIPS 204) via OpenSSL ${process.versions.openssl}` },
      ledgerIntegrity: { valid: chain.valid, detail: chain.valid ? `${chain.totalBlocks} blocks · tip #${chain.tipIndex}` : `Broken at block #${chain.firstInvalidIndex}`, tamperedBlocks: tamperedBlockIndexes() },
      pqcVerification: { online: cryptoOnline, detail: "Signature verification service" },
      auditSystem: { online: true, detail: `${count("SELECT COUNT(*) AS n FROM audit_logs").toLocaleString()} entries` },
      quantumService: quantum,
    },
    ledger: { tipIndex: tip?.block_index ?? null, tipHash: tip?.block_hash ?? null, tipAt: tip?.timestamp ?? null, checkMs: chain.durationMs },
    recent: listRecords({ limit: 8 }).records,
    alerts: alerts.slice(0, 8),
    recentAudit: listAudit({ limit: 8 }).entries,
    activity,
    lastScan: getState<ScanSummary>("lastScan") ?? null,
  };
}
