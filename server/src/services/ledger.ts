import { canonicalize, hashCanonical, signingMessage } from "../crypto/canonical.js";
import { getSigner, signWith, verifyWith } from "../crypto/keystore.js";
import { db } from "../db.js";

export const GENESIS_PREVIOUS_HASH = "0".repeat(64);

export interface BlockRow {
  block_index: number;
  timestamp: string;
  record_id: string;
  record_type: string;
  action: string;
  data_hash: string;
  signature: string;
  algorithm: string;
  signer_id: string;
  signer_name: string;
  previous_hash: string;
  block_hash: string;
  original_snapshot: string | null;
}

export interface Block {
  index: number;
  timestamp: string;
  recordId: string;
  recordType: string;
  action: string;
  dataHash: string;
  signature: string;
  algorithm: string;
  signerId: string;
  signer: string;
  previousHash: string;
  blockHash: string;
  demoTampered: boolean;
}

export const toBlock = (r: BlockRow): Block => ({
  index: r.block_index,
  timestamp: r.timestamp,
  recordId: r.record_id,
  recordType: r.record_type,
  action: r.action,
  dataHash: r.data_hash,
  signature: r.signature,
  algorithm: r.algorithm,
  signerId: r.signer_id,
  signer: r.signer_name,
  previousHash: r.previous_hash,
  blockHash: r.block_hash,
  demoTampered: r.original_snapshot !== null,
});

/** Everything that defines a block except its own hash. The block hash commits to all of it. */
export function blockHeader(r: Omit<BlockRow, "block_hash" | "original_snapshot">) {
  return {
    index: r.block_index,
    timestamp: r.timestamp,
    recordId: r.record_id,
    recordType: r.record_type,
    action: r.action,
    dataHash: r.data_hash,
    signature: r.signature,
    algorithm: r.algorithm,
    signerId: r.signer_id,
    signer: r.signer_name,
    previousHash: r.previous_hash,
  };
}

export function computeBlockHash(r: Omit<BlockRow, "block_hash" | "original_snapshot">): string {
  return hashCanonical(blockHeader(r));
}

const insertBlock = db.prepare(`INSERT INTO ledger_blocks(block_index, timestamp, record_id, record_type, action, data_hash,
  signature, algorithm, signer_id, signer_name, previous_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

export function getLatestBlockRow(): BlockRow | undefined {
  const row = db.prepare("SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT 1").get() as BlockRow | undefined;
  return row ? { ...row } : undefined;
}

export function getBlockRow(index: number): BlockRow | undefined {
  const row = db.prepare("SELECT * FROM ledger_blocks WHERE block_index = ?").get(index) as BlockRow | undefined;
  return row ? { ...row } : undefined;
}

export function ensureGenesis(timestamp: string): void {
  if (getLatestBlockRow()) return;
  const dataHash = hashCanonical({ network: "QuantumShield permissioned ledger", purpose: "Hackathon prototype genesis", createdAt: timestamp });
  const { signature, algorithm } = signWith("ledger-node", signingMessage("GENESIS", "GENESIS", dataHash));
  const base = {
    block_index: 0, timestamp, record_id: "GENESIS", record_type: "GENESIS", action: "GENESIS", data_hash: dataHash,
    signature, algorithm, signer_id: "ledger-node", signer_name: getSigner("ledger-node").name, previous_hash: GENESIS_PREVIOUS_HASH,
  };
  insertBlock.run(base.block_index, base.timestamp, base.record_id, base.record_type, base.action, base.data_hash,
    base.signature, base.algorithm, base.signer_id, base.signer_name, base.previous_hash, computeBlockHash(base));
}

/** Append-only: the only write path for new blocks. Each block links to the hash of the current tip. */
export function appendBlock(input: {
  recordId: string;
  recordType: string;
  action: string;
  dataHash: string;
  signature: string;
  algorithm: string;
  signerId: string;
  timestamp?: string;
}): Block {
  const tip = getLatestBlockRow();
  if (!tip) throw new Error("Ledger has no genesis block");
  let timestamp = input.timestamp ?? new Date().toISOString();
  if (timestamp < tip.timestamp) timestamp = tip.timestamp; // timestamps never go backwards along the chain
  const base = {
    block_index: tip.block_index + 1, timestamp, record_id: input.recordId, record_type: input.recordType, action: input.action,
    data_hash: input.dataHash, signature: input.signature, algorithm: input.algorithm, signer_id: input.signerId,
    signer_name: getSigner(input.signerId).name, previous_hash: tip.block_hash,
  };
  const blockHash = computeBlockHash(base);
  insertBlock.run(base.block_index, base.timestamp, base.record_id, base.record_type, base.action, base.data_hash,
    base.signature, base.algorithm, base.signer_id, base.signer_name, base.previous_hash, blockHash);
  return toBlock({ ...base, block_hash: blockHash, original_snapshot: null });
}

export type ChainIssueKind = "BLOCK_HASH_MISMATCH" | "BROKEN_LINK" | "INDEX_GAP" | "INVALID_SIGNATURE";

export interface ChainIssue {
  index: number;
  kind: ChainIssueKind;
  message: string;
}

export interface ChainReport {
  valid: boolean;
  totalBlocks: number;
  tipIndex: number | null;
  tipHash: string | null;
  signaturesChecked: boolean;
  issues: ChainIssue[];
  firstInvalidIndex: number | null;
  checkedAt: string;
  durationMs: number;
}

/**
 * Walks the whole chain: recomputes every block hash, checks each previousHash link and
 * (optionally) re-verifies every block's signature against the signer's registered public key.
 */
export function verifyChain(opts: { signatures?: boolean } = {}): ChainReport {
  const started = performance.now();
  const rows = db.prepare("SELECT * FROM ledger_blocks ORDER BY block_index ASC").all() as unknown as BlockRow[];
  const issues: ChainIssue[] = [];
  let prev: BlockRow | undefined;
  for (const row of rows) {
    const expectedPrev = prev ? prev.block_hash : GENESIS_PREVIOUS_HASH;
    if (prev && row.block_index !== prev.block_index + 1) {
      issues.push({ index: row.block_index, kind: "INDEX_GAP", message: `Block #${row.block_index} follows #${prev.block_index}: blocks are missing.` });
    }
    const recomputed = computeBlockHash(row);
    if (recomputed !== row.block_hash) {
      issues.push({ index: row.block_index, kind: "BLOCK_HASH_MISMATCH", message: `Block #${row.block_index} contents do not match its recorded block hash.` });
    }
    if (row.previous_hash !== expectedPrev) {
      issues.push({ index: row.block_index, kind: "BROKEN_LINK", message: `Block #${row.block_index} previousHash does not equal the hash of block #${prev ? prev.block_index : "genesis"}.` });
    }
    if (opts.signatures) {
      const entity = row.record_type === "GENESIS" ? "GENESIS" : row.record_type;
      if (!verifyWith(row.signer_id, row.algorithm, signingMessage(entity, row.record_id, row.data_hash), row.signature)) {
        issues.push({ index: row.block_index, kind: "INVALID_SIGNATURE", message: `Block #${row.block_index} signature does not verify for ${row.signer_name}.` });
      }
    }
    prev = row;
  }
  const tip = rows.at(-1);
  return {
    valid: issues.length === 0,
    totalBlocks: rows.length,
    tipIndex: tip?.block_index ?? null,
    tipHash: tip?.block_hash ?? null,
    signaturesChecked: Boolean(opts.signatures),
    issues,
    firstInvalidIndex: issues.length ? Math.min(...issues.map((i) => i.index)) : null,
    checkedAt: new Date().toISOString(),
    durationMs: Math.round((performance.now() - started) * 10) / 10,
  };
}

/** Checks one block in isolation: its own hash and its links to the neighbouring blocks. */
export function inspectBlock(index: number) {
  const row = getBlockRow(index);
  if (!row) return null;
  const prev = index > 0 ? getBlockRow(index - 1) : undefined;
  const next = getBlockRow(index + 1);
  const recomputedHash = computeBlockHash(row);
  const entity = row.record_type === "GENESIS" ? "GENESIS" : row.record_type;
  return {
    block: toBlock(row),
    header: blockHeader(row),
    canonicalHeader: canonicalize(blockHeader(row)),
    recomputedHash,
    checks: {
      blockHashValid: recomputedHash === row.block_hash,
      previousLinkValid: index === 0 ? row.previous_hash === GENESIS_PREVIOUS_HASH : prev?.block_hash === row.previous_hash,
      nextLinkValid: next ? next.previous_hash === row.block_hash : null,
      signatureValid: verifyWith(row.signer_id, row.algorithm, signingMessage(entity, row.record_id, row.data_hash), row.signature),
    },
    previousBlock: prev ? { index: prev.block_index, blockHash: prev.block_hash } : null,
    nextBlock: next ? { index: next.block_index, previousHash: next.previous_hash } : null,
    signatureBytes: Buffer.from(row.signature, "base64").length,
  };
}

export function listBlocks(opts: { limit?: number; before?: number; recordId?: string }) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  const params: (string | number)[] = [];
  const where: string[] = [];
  if (opts.before !== undefined) { where.push("block_index < ?"); params.push(opts.before); }
  if (opts.recordId) { where.push("record_id = ?"); params.push(opts.recordId); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = (db.prepare(`SELECT * FROM ledger_blocks ${clause} ORDER BY block_index DESC LIMIT ?`).all(...params, limit) as unknown as BlockRow[]).map((r) => ({ ...r }));
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM ledger_blocks").get() as { total: number };
  // Per-block integrity flags, recomputed server-side for every listed block.
  const blocks = rows.map((r) => {
    const prev = r.block_index > 0 ? getBlockRow(r.block_index - 1) : undefined;
    return {
      ...toBlock(r),
      hashValid: computeBlockHash(r) === r.block_hash,
      linkValid: r.block_index === 0 ? r.previous_hash === GENESIS_PREVIOUS_HASH : prev?.block_hash === r.previous_hash,
    };
  });
  return { blocks, total };
}

export type BlockTamperMode = "EDIT_ONLY" | "EDIT_AND_REHASH";

/**
 * DEMO ONLY. Simulates an insider editing a ledger row directly in the database, bypassing the
 * append-only API. EDIT_ONLY changes the data hash but leaves the block hash stale; EDIT_AND_REHASH
 * also recomputes this block's hash, which then breaks the link stored in the NEXT block.
 */
export function tamperBlock(index: number, mode: BlockTamperMode): Block {
  const row = getBlockRow(index);
  if (!row) throw new Error(`Block #${index} not found`);
  if (index === 0) throw new Error("The genesis block cannot be used for the tamper demo");
  const snapshot = row.original_snapshot ?? JSON.stringify({ data_hash: row.data_hash, block_hash: row.block_hash });
  const forgedDataHash = hashCanonical({ forged: true, of: row.data_hash, at: Date.now() });
  const forged = { ...row, data_hash: forgedDataHash };
  const blockHash = mode === "EDIT_AND_REHASH" ? computeBlockHash(forged) : row.block_hash;
  db.prepare("UPDATE ledger_blocks SET data_hash = ?, block_hash = ?, original_snapshot = ? WHERE block_index = ?")
    .run(forgedDataHash, blockHash, snapshot, index);
  return toBlock(getBlockRow(index)!);
}

export function restoreBlock(index: number): Block {
  const row = getBlockRow(index);
  if (!row) throw new Error(`Block #${index} not found`);
  if (!row.original_snapshot) throw new Error(`Block #${index} has not been tampered with`);
  const original = JSON.parse(row.original_snapshot) as { data_hash: string; block_hash: string };
  db.prepare("UPDATE ledger_blocks SET data_hash = ?, block_hash = ?, original_snapshot = NULL WHERE block_index = ?")
    .run(original.data_hash, original.block_hash, index);
  return toBlock(getBlockRow(index)!);
}

export function tamperedBlockIndexes(): number[] {
  return (db.prepare("SELECT block_index FROM ledger_blocks WHERE original_snapshot IS NOT NULL ORDER BY block_index").all() as { block_index: number }[])
    .map((r) => r.block_index);
}
