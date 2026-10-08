import { hashCanonical, signingMessage } from "../crypto/canonical.js";
import { getSigner, verifyWith } from "../crypto/keystore.js";
import { getScheme, isPostQuantum } from "../crypto/schemes.js";
import { getBlockRow, type ChainReport } from "./ledger.js";

export type CheckStatus = "pass" | "fail" | "warn";
export type CheckId = "hash" | "signature" | "algorithm" | "anchor" | "chain" | "legacy" | "eventLink";

export interface VerificationCheck {
  id: CheckId;
  label: string;
  status: CheckStatus;
  summary: string;
  detail: string;
  expected?: string;
  actual?: string;
}

export type Verdict = "AUTHENTIC" | "AUTHENTIC_LEGACY" | "TAMPERED";

export interface SignedEntity {
  entityType: string;
  entityId: string;
  data: string;
  storedHash: string;
  signature: string;
  signerId: string;
  algorithm: string;
  blockIndex: number;
  legacySignature?: string | null;
  legacySignerId?: string | null;
  legacyAlgorithm?: string | null;
}

export interface EntityVerification {
  entityId: string;
  entityType: string;
  verdict: Verdict;
  checks: VerificationCheck[];
  computedHash: string | null;
  storedHash: string;
  anchoredHash: string | null;
  algorithm: string;
  algorithmFamily: "POST_QUANTUM" | "CLASSICAL";
  signer: { id: string; name: string; organization: string; fingerprint: string };
  block: { index: number; blockHash: string; previousHash: string; timestamp: string } | null;
  verifiedAt: string;
  durationMs: number;
}

/**
 * Independent verification of one signed entity. Nothing here trusts a stored "status" flag:
 * every check recomputes from the current bytes in the database.
 *   1. hash      - SHA-256(canonical(current data)) equals the stored content hash
 *   2. signature - signature verifies over the CURRENT content's hash with the signer's registered public key
 *   3. algorithm - signature scheme is post-quantum (ML-DSA) or legacy classical
 *   4. anchor    - the ledger block for this entity commits to the same hash and signature
 *   5. chain     - the ledger's hash chain is intact (provided by the caller, computed once per request)
 */
export function verifyEntity(e: SignedEntity, chain: ChainReport): EntityVerification {
  const started = performance.now();
  const checks: VerificationCheck[] = [];
  const signer = getSigner(e.signerId);
  const scheme = getScheme(e.algorithm);

  // 1. Content hash
  let computedHash: string | null = null;
  try {
    computedHash = hashCanonical(JSON.parse(e.data));
  } catch {
    computedHash = null;
  }
  const hashOk = computedHash !== null && computedHash === e.storedHash;
  checks.push({
    id: "hash",
    label: "Record Integrity",
    status: hashOk ? "pass" : "fail",
    summary: hashOk ? "Hash matches" : computedHash === null ? "Record data is unreadable" : "Hash mismatch",
    detail: hashOk
      ? "SHA-256 of the canonicalised record equals the content hash recorded at signing time."
      : "SHA-256 of the current record content differs from the content hash recorded at signing time. The record was modified after it was signed.",
    expected: e.storedHash,
    actual: computedHash ?? "unreadable",
  });

  // 2. Signature over the current content
  const sigOk = computedHash !== null && verifyWith(e.signerId, e.algorithm, signingMessage(e.entityType, e.entityId, computedHash), e.signature);
  checks.push({
    id: "signature",
    label: "Digital Signature",
    status: sigOk ? "pass" : "fail",
    summary: sigOk ? "Signature valid" : "Signature invalid",
    detail: sigOk
      ? `${scheme.displayName} signature verified against the registered public key of ${signer.name} (${signer.organization}).`
      : `The ${scheme.displayName} signature does not verify for the current content. Whoever changed this record did not hold ${signer.name}'s private key.`,
    actual: `${Buffer.from(e.signature, "base64").length} bytes`,
  });

  // 3. Algorithm
  const pq = isPostQuantum(e.algorithm);
  checks.push({
    id: "algorithm",
    label: "Post-Quantum Algorithm",
    status: pq ? "pass" : "warn",
    summary: pq ? scheme.displayName : `${scheme.displayName} — migration recommended`,
    detail: pq ? `${scheme.standard}. ${scheme.securityNote}` : `${scheme.securityNote} Migrate this record to ML-DSA.`,
  });

  // 4. Ledger anchor
  const block = getBlockRow(e.blockIndex);
  const anchorProblems: string[] = [];
  if (!block) anchorProblems.push(`ledger block #${e.blockIndex} is missing`);
  else {
    if (block.record_id !== e.entityId) anchorProblems.push(`block #${block.block_index} belongs to ${block.record_id}`);
    if (block.data_hash !== computedHash) anchorProblems.push("current content hash differs from the hash anchored on the ledger");
    if (block.signature !== e.signature) anchorProblems.push("stored signature differs from the signature anchored on the ledger");
    if (block.algorithm !== e.algorithm) anchorProblems.push("algorithm differs from the ledger anchor");
  }
  checks.push({
    id: "anchor",
    label: "Ledger Anchor",
    status: anchorProblems.length === 0 ? "pass" : "fail",
    summary: anchorProblems.length === 0 ? `Anchored in block #${e.blockIndex}` : "Does not match ledger anchor",
    detail: anchorProblems.length === 0
      ? `Block #${e.blockIndex} commits to exactly this content hash and signature.`
      : `Mismatch: ${anchorProblems.join("; ")}.`,
    expected: block?.data_hash,
    actual: computedHash ?? undefined,
  });

  // 5. Chain integrity
  const firstIssue = chain.issues[0];
  checks.push({
    id: "chain",
    label: "Ledger Integrity",
    status: chain.valid ? "pass" : "fail",
    summary: chain.valid ? "Previous block verified" : `Chain broken at block #${chain.firstInvalidIndex}`,
    detail: chain.valid
      ? `All ${chain.totalBlocks.toLocaleString()} block hashes recomputed and every previous-hash link verified.`
      : `${chain.issues.length} ledger integrity issue(s). ${firstIssue?.message ?? ""}`,
  });

  // 6. Optional legacy co-signature (hybrid records after migration)
  if (e.legacySignature && e.legacySignerId && e.legacyAlgorithm) {
    const legacyOk = computedHash !== null &&
      verifyWith(e.legacySignerId, e.legacyAlgorithm, signingMessage(e.entityType, e.entityId, computedHash), e.legacySignature);
    checks.push({
      id: "legacy",
      label: "Legacy Co-Signature",
      status: legacyOk ? "pass" : "fail",
      summary: legacyOk ? "Classical signature retained & valid" : "Legacy signature invalid",
      detail: `Hybrid record: the original ${getScheme(e.legacyAlgorithm).displayName} signature is kept for backward compatibility. Security now rests on the ML-DSA signature.`,
    });
  }

  const failed = checks.some((c) => c.status === "fail");
  return {
    entityId: e.entityId,
    entityType: e.entityType,
    verdict: failed ? "TAMPERED" : pq ? "AUTHENTIC" : "AUTHENTIC_LEGACY",
    checks,
    computedHash,
    storedHash: e.storedHash,
    anchoredHash: block?.data_hash ?? null,
    algorithm: e.algorithm,
    algorithmFamily: scheme.family,
    signer: { id: signer.id, name: signer.name, organization: signer.organization, fingerprint: signer.fingerprint },
    block: block ? { index: block.block_index, blockHash: block.block_hash, previousHash: block.previous_hash, timestamp: block.timestamp } : null,
    verifiedAt: new Date().toISOString(),
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  };
}

export function verdictToStatus(v: Verdict): "VERIFIED" | "TAMPERED" | "LEGACY" {
  return v === "AUTHENTIC" ? "VERIFIED" : v === "TAMPERED" ? "TAMPERED" : "LEGACY";
}

export interface ChangedField {
  field: string;
  original: unknown;
  current: unknown;
}

export function diffData(originalJson: string, currentJson: string): ChangedField[] {
  const a = JSON.parse(originalJson) as Record<string, unknown>;
  const b = JSON.parse(currentJson) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ field: k, original: a[k], current: b[k] }));
}
