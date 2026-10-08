import { canonicalize, hashCanonical, signingMessage } from "../crypto/canonical.js";
import { getSigner, signWith } from "../crypto/keystore.js";
import { getScheme, isPostQuantum } from "../crypto/schemes.js";
import { db, transaction } from "../db.js";
import { auditForRecord, logAudit } from "./audit.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { appendBlock, getBlockRow, toBlock, verifyChain, type Block, type ChainReport } from "./ledger.js";
import { diffData, verdictToStatus, verifyEntity, type EntityVerification } from "./verification.js";

export type RecordType = "LAND_RECORD" | "SUPPLY_PRODUCT";
export type IntegrityStatus = "VERIFIED" | "TAMPERED" | "LEGACY" | "UNVERIFIED";

export interface RecordRow {
  id: string;
  record_type: RecordType;
  title: string;
  data: string;
  data_hash: string;
  signature: string;
  signer_id: string;
  algorithm: string;
  legacy_signature: string | null;
  legacy_signer_id: string | null;
  legacy_algorithm: string | null;
  block_index: number;
  integrity_status: IntegrityStatus;
  last_verified_at: string | null;
  original_snapshot: string | null;
  featured: number;
  created_at: string;
}

export interface RecordSummary {
  id: string;
  recordType: RecordType;
  title: string;
  dataHash: string;
  algorithm: string;
  signerName: string;
  blockIndex: number;
  integrityStatus: IntegrityStatus;
  lastVerifiedAt: string | null;
  demoTampered: boolean;
  featured: boolean;
  createdAt: string;
  data: Record<string, unknown>;
}

export function getRecordRow(id: string): RecordRow | undefined {
  const row = db.prepare("SELECT * FROM records WHERE id = ?").get(id) as RecordRow | undefined;
  return row ? { ...row } : undefined;
}

function requireRecord(id: string): RecordRow {
  const row = getRecordRow(id);
  if (!row) throw notFound(`Record ${id}`);
  return row;
}

const signerNames = () => new Map((db.prepare("SELECT id, name FROM signers").all() as { id: string; name: string }[]).map((s) => [s.id, s.name]));

export function toSummary(r: RecordRow, names = signerNames()): RecordSummary {
  return {
    id: r.id,
    recordType: r.record_type,
    title: r.title,
    dataHash: r.data_hash,
    algorithm: r.algorithm,
    signerName: names.get(r.signer_id) ?? r.signer_id,
    blockIndex: r.block_index,
    integrityStatus: r.integrity_status,
    lastVerifiedAt: r.last_verified_at,
    demoTampered: r.original_snapshot !== null,
    featured: r.featured === 1,
    createdAt: r.created_at,
    data: JSON.parse(r.data) as Record<string, unknown>,
  };
}

export interface SigningTrace {
  canonical: string;
  canonicalBytes: number;
  dataHash: string;
  signingMessage: string;
  algorithm: string;
  signatureBytes: number;
  signaturePreview: string;
  signer: { id: string; name: string; organization: string; fingerprint: string };
  block: Block;
  timingsMs: { canonicalize: number; hash: number; sign: number; ledger: number };
}

/**
 * The core write path shared by land records and products:
 * canonicalise -> SHA-256 -> sign (ML-DSA by default) -> store -> append ledger block.
 */
export function createSignedRecord(input: {
  id: string;
  recordType: RecordType;
  title: string;
  data: Record<string, unknown>;
  signerId: string;
  featured?: boolean;
  timestamp?: string;
  actor?: string;
}): { record: RecordSummary; trace: SigningTrace } {
  if (getRecordRow(input.id)) throw conflict(`Record ${input.id} already exists`);
  const signer = getSigner(input.signerId);
  const createdAt = input.timestamp ?? new Date().toISOString();

  const t0 = performance.now();
  const canonical = canonicalize(input.data);
  const t1 = performance.now();
  const dataHash = hashCanonical(input.data);
  const t2 = performance.now();
  const message = signingMessage(input.recordType, input.id, dataHash);
  const { signature, algorithm } = signWith(input.signerId, message);
  const t3 = performance.now();

  const block = transaction(() => {
    const b = appendBlock({ recordId: input.id, recordType: input.recordType, action: "CREATE", dataHash, signature, algorithm, signerId: input.signerId, timestamp: createdAt });
    db.prepare(`INSERT INTO records(id, record_type, title, data, data_hash, signature, signer_id, algorithm, block_index,
      integrity_status, featured, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.id, input.recordType, input.title, canonical, dataHash, signature, input.signerId, algorithm, b.index,
        isPostQuantum(algorithm) ? "VERIFIED" : "LEGACY", input.featured ? 1 : 0, createdAt);
    logAudit({ actor: input.actor ?? signer.name, action: "CREATE_RECORD", recordId: input.id, result: "SUCCESS", hash: dataHash,
      details: `${algorithm} signature anchored in block #${b.index}`, timestamp: createdAt });
    return b;
  });
  const t4 = performance.now();

  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    record: toSummary(getRecordRow(input.id)!),
    trace: {
      canonical,
      canonicalBytes: Buffer.byteLength(canonical),
      dataHash,
      signingMessage: message.toString("utf8"),
      algorithm,
      signatureBytes: Buffer.from(signature, "base64").length,
      signaturePreview: signature.slice(0, 96),
      signer: { id: signer.id, name: signer.name, organization: signer.organization, fingerprint: signer.fingerprint },
      block,
      timingsMs: { canonicalize: round(t1 - t0), hash: round(t2 - t1), sign: round(t3 - t2), ledger: round(t4 - t3) },
    },
  };
}

export function listRecords(opts: { type?: string; status?: string; propertyType?: string; year?: string; q?: string; limit?: number; offset?: number; featuredFirst?: boolean }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.type) { where.push("record_type = ?"); params.push(opts.type); }
  if (opts.status) { where.push("integrity_status = ?"); params.push(opts.status); }
  // Record data is stored as canonical (space-free) JSON, so exact key/value fragments are safe to match.
  if (opts.propertyType && /^[A-Za-z ]+$/.test(opts.propertyType)) { where.push("data LIKE ?"); params.push(`%"propertyType":"${opts.propertyType}"%`); }
  if (opts.year && /^\d{4}$/.test(opts.year)) { where.push("data LIKE ?"); params.push(`%"registrationDate":"${opts.year}-%`); }
  if (opts.q) {
    where.push("(id LIKE ? OR title LIKE ? OR data LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const order = opts.featuredFirst ? "featured DESC, created_at DESC" : "created_at DESC";
  const rows = db.prepare(`SELECT * FROM records ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as unknown as RecordRow[];
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM records ${clause}`).get(...params) as { total: number };
  const names = signerNames();
  return { records: rows.map((r) => toSummary({ ...r }, names)), total };
}

export function getRecordDetail(id: string) {
  const row = requireRecord(id);
  const signer = getSigner(row.signer_id);
  const block = getBlockRow(row.block_index);
  const history = (db.prepare("SELECT * FROM ledger_blocks WHERE record_id = ? ORDER BY block_index").all(id) as unknown as Parameters<typeof toBlock>[0][]).map((b) => toBlock({ ...b }));
  return {
    record: toSummary(row),
    signature: row.signature,
    signatureBytes: Buffer.from(row.signature, "base64").length,
    canonical: row.data,
    signingMessage: signingMessage(row.record_type, row.id, row.data_hash).toString("utf8"),
    signer: { id: signer.id, name: signer.name, role: signer.role, organization: signer.organization, fingerprint: signer.fingerprint, algorithm: signer.algorithm },
    legacy: row.legacy_signature
      ? { algorithm: row.legacy_algorithm, signerId: row.legacy_signer_id, signatureBytes: Buffer.from(row.legacy_signature, "base64").length }
      : null,
    block: block ? toBlock(block) : null,
    ledgerHistory: history,
    tamper: row.original_snapshot ? { active: true, changedFields: diffData((JSON.parse(row.original_snapshot) as { data: string }).data, row.data) } : { active: false, changedFields: [] },
    audit: auditForRecord(id, 20),
  };
}

export function recordAsEntity(row: RecordRow) {
  return {
    entityType: row.record_type,
    entityId: row.id,
    data: row.data,
    storedHash: row.data_hash,
    signature: row.signature,
    signerId: row.signer_id,
    algorithm: row.algorithm,
    blockIndex: row.block_index,
    legacySignature: row.legacy_signature,
    legacySignerId: row.legacy_signer_id,
    legacyAlgorithm: row.legacy_algorithm,
  };
}

export interface RecordVerification extends EntityVerification {
  changedFields: ReturnType<typeof diffData>;
  demoTampered: boolean;
}

export function verifyRecord(id: string, actor = "Verifier", chain?: ChainReport, opts: { passive?: boolean } = {}): RecordVerification {
  const row = requireRecord(id);
  const report = verifyEntity(recordAsEntity(row), chain ?? verifyChain());
  const status = verdictToStatus(report.verdict);
  db.prepare("UPDATE records SET integrity_status = ?, last_verified_at = ? WHERE id = ?").run(status, report.verifiedAt, id);
  const failed = report.checks.filter((c) => c.status === "fail").map((c) => c.label);
  if (!opts.passive) {
    logAudit({
      actor,
      action: "VERIFY_RECORD",
      recordId: id,
      result: report.verdict === "TAMPERED" ? "INVALID" : "VALID",
      hash: report.computedHash,
      details: report.verdict === "TAMPERED" ? `Failed: ${failed.join(", ")}` : `${report.algorithm} signature valid; ledger anchor block #${row.block_index}`,
    });
    if (report.verdict === "TAMPERED") {
      logAudit({ actor: "System", action: "TAMPER_DETECTED", recordId: id, result: "DETECTED", hash: report.computedHash, details: `Integrity violation: ${failed.join(", ")}` });
    }
  }
  return {
    ...report,
    demoTampered: row.original_snapshot !== null,
    changedFields: row.original_snapshot ? diffData((JSON.parse(row.original_snapshot) as { data: string }).data, row.data) : [],
  };
}

export type TamperMode = "FIELD_ONLY" | "FIELD_AND_HASH";

/**
 * DEMO ONLY - controlled simulation of an unauthorised database edit. It changes record content
 * WITHOUT touching the legitimate signature or ledger; the original row is snapshotted so the
 * demo can be reset. FIELD_AND_HASH models a smarter attacker who also recomputes the stored hash.
 */
export function tamperRecord(id: string, input: { field: string; value: string; mode: TamperMode }, actor = "Demo User") {
  const row = requireRecord(id);
  const data = JSON.parse(row.data) as Record<string, unknown>;
  if (!(input.field in data) || input.field === "recordType") throw badRequest(`Field "${input.field}" cannot be tampered on this record`);
  if (String(data[input.field]) === input.value) throw badRequest("The new value is identical to the current value");
  const snapshot = row.original_snapshot ?? JSON.stringify({ data: row.data, data_hash: row.data_hash });
  data[input.field] = input.value;
  const forgedData = canonicalize(data);
  const forgedHash = input.mode === "FIELD_AND_HASH" ? hashCanonical(data) : row.data_hash;
  db.prepare("UPDATE records SET data = ?, data_hash = ?, original_snapshot = ? WHERE id = ?").run(forgedData, forgedHash, snapshot, id);
  logAudit({
    actor,
    action: "TAMPER_ATTEMPT",
    recordId: id,
    result: "WARNING",
    hash: hashCanonical(data),
    details: `Demo simulation: "${input.field}" changed directly in the database (${input.mode === "FIELD_AND_HASH" ? "attacker also recomputed the stored hash" : "content only"}); signature and ledger untouched`,
  });
  return getRecordDetail(id);
}

export function restoreRecord(id: string, actor = "Demo User") {
  const row = requireRecord(id);
  if (!row.original_snapshot) throw badRequest(`Record ${id} has no tampering to undo`);
  const original = JSON.parse(row.original_snapshot) as { data: string; data_hash: string };
  db.prepare("UPDATE records SET data = ?, data_hash = ?, original_snapshot = NULL, integrity_status = 'UNVERIFIED' WHERE id = ?")
    .run(original.data, original.data_hash, id);
  logAudit({ actor, action: "RESTORE_ORIGINAL", recordId: id, result: "RESTORED", hash: original.data_hash, details: "Demo reset: original record content restored from snapshot" });
  return getRecordDetail(id);
}

export function describeAlgorithm(id: string) {
  const s = getScheme(id);
  return { id: s.id, displayName: s.displayName, family: s.family, standard: s.standard, securityNote: s.securityNote };
}
