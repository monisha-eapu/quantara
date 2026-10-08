import { signingMessage } from "../crypto/canonical.js";
import { getSigner, signWith, verifyWith } from "../crypto/keystore.js";
import { getScheme, isPostQuantum } from "../crypto/schemes.js";
import { db, transaction } from "../db.js";
import { logAudit } from "./audit.js";
import { badRequest, notFound } from "./errors.js";
import { appendBlock, verifyChain } from "./ledger.js";
import { getRecordRow, recordAsEntity, toSummary, verifyRecord, type RecordRow } from "./records.js";
import { verifyEntity } from "./verification.js";

export function migrationOverview() {
  const rows = (db.prepare(`SELECT * FROM records WHERE algorithm != 'ML-DSA-65' OR legacy_signature IS NOT NULL ORDER BY created_at`).all() as unknown as RecordRow[]).map((r) => ({ ...r }));
  const counts = db.prepare(`SELECT
      SUM(CASE WHEN algorithm = 'ML-DSA-65' THEN 1 ELSE 0 END) AS pqc,
      SUM(CASE WHEN algorithm != 'ML-DSA-65' THEN 1 ELSE 0 END) AS legacy,
      SUM(CASE WHEN legacy_signature IS NOT NULL THEN 1 ELSE 0 END) AS hybrid
    FROM records`).get() as { pqc: number; legacy: number; hybrid: number };
  const events = (db.prepare("SELECT COUNT(*) AS n FROM supply_chain_events WHERE algorithm = 'ML-DSA-65'").get() as { n: number }).n;
  return {
    candidates: rows.filter((r) => !isPostQuantum(r.algorithm)).map((r) => toSummary(r)),
    migrated: rows.filter((r) => r.legacy_signature !== null).map((r) => ({ ...toSummary(r), legacyAlgorithm: r.legacy_algorithm })),
    counts: { pqcRecords: counts.pqc + events, legacyRecords: counts.legacy, hybridRecords: counts.hybrid },
  };
}

function bench(fn: () => void, iterations: number): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return Math.round(((performance.now() - start) / iterations) * 1000) / 1000;
}

/**
 * Live side-by-side: signs the selected record's real signing message with a classical key and
 * with ML-DSA, verifies both, and reports measured sizes and timings. Nothing is persisted.
 */
export function compareSchemes(recordId: string) {
  const row = getRecordRow(recordId);
  if (!row) throw notFound(`Record ${recordId}`);
  const message = signingMessage(row.record_type, row.id, row.data_hash);
  const pqcSignerId = isPostQuantum(row.algorithm) ? row.signer_id : "revenue-ap";
  const iterations = 25;
  const result = (signerId: string) => {
    const signer = getSigner(signerId);
    const scheme = getScheme(signer.algorithm);
    const { signature } = signWith(signerId, message);
    const keyPair = scheme.generateKeyPair();
    return {
      algorithm: scheme.id,
      displayName: scheme.displayName,
      family: scheme.family,
      standard: scheme.standard,
      securityNote: scheme.securityNote,
      signer: signer.name,
      publicKeyBytes: (keyPair.publicKey.export({ type: "spki", format: "der" }) as Buffer).length,
      signatureBytes: Buffer.from(signature, "base64").length,
      signaturePreview: signature.slice(0, 88),
      verified: verifyWith(signerId, scheme.id, message, signature),
      signMs: bench(() => signWith(signerId, message), iterations),
      verifyMs: bench(() => verifyWith(signerId, scheme.id, message, signature), iterations),
      keygenMs: bench(() => scheme.generateKeyPair(), 5),
    };
  };
  logAudit({ actor: "Demo User", action: "PQC_COMPARISON", recordId, result: "INFO", hash: row.data_hash, details: "Live classical vs ML-DSA signing benchmark (not persisted)" });
  return { recordId, message: message.toString("utf8"), iterations, legacy: result("legacy-ca"), pqc: result(pqcSignerId) };
}

/**
 * Real migration of a legacy-signed record:
 *   1. verify the existing classical signature, hash and ledger anchor (refuse if anything fails)
 *   2. sign the same content hash with ML-DSA
 *   3. keep the classical signature as a co-signature (hybrid) and append a MIGRATE ledger block
 */
export function migrateRecord(recordId: string, targetSignerId = "revenue-ap", actor = "Migration Service") {
  const row = getRecordRow(recordId);
  if (!row) throw notFound(`Record ${recordId}`);
  if (isPostQuantum(row.algorithm)) throw badRequest(`${recordId} is already protected by ${row.algorithm}`);
  const target = getSigner(targetSignerId);
  if (!isPostQuantum(target.algorithm)) throw badRequest(`${target.name} does not hold a post-quantum key`);
  const pre = verifyEntity(recordAsEntity(row), verifyChain());
  if (pre.verdict === "TAMPERED") {
    logAudit({ actor, action: "PQC_MIGRATION", recordId, result: "FAILED", hash: pre.computedHash, details: "Refused: legacy record failed verification before migration" });
    throw badRequest("Migration refused: the legacy record does not verify. Investigate before re-signing.");
  }
  const message = signingMessage(row.record_type, row.id, row.data_hash);
  const { signature, algorithm } = signWith(targetSignerId, message);
  const block = transaction(() => {
    const b = appendBlock({ recordId, recordType: row.record_type, action: "MIGRATE", dataHash: row.data_hash, signature, algorithm, signerId: targetSignerId });
    db.prepare(`UPDATE records SET legacy_signature = signature, legacy_signer_id = signer_id, legacy_algorithm = algorithm,
      signature = ?, signer_id = ?, algorithm = ?, block_index = ? WHERE id = ?`).run(signature, targetSignerId, algorithm, b.index, recordId);
    logAudit({ actor, action: "PQC_MIGRATION", recordId, result: "SUCCESS", hash: row.data_hash,
      details: `${row.algorithm} -> ${algorithm} (hybrid, legacy co-signature retained); block #${b.index}` });
    return b;
  });
  const after = verifyRecord(recordId, "Migration Service");
  return { before: pre, after, block, signatureBytes: Buffer.from(signature, "base64").length };
}
