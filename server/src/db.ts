import { DatabaseSync } from "node:sqlite";
import { paths } from "./config.js";

export const db = new DatabaseSync(paths.db);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS signers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  organization  TEXT NOT NULL,
  algorithm     TEXT NOT NULL,
  public_key    TEXT NOT NULL,          -- SPKI PEM (public only; private keys live in data/keys)
  fingerprint   TEXT NOT NULL,          -- SHA-256 of SPKI DER
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id                 TEXT PRIMARY KEY,
  record_type        TEXT NOT NULL,     -- LAND_RECORD | SUPPLY_PRODUCT
  title              TEXT NOT NULL,
  data               TEXT NOT NULL,     -- canonical JSON of the record body
  data_hash          TEXT NOT NULL,     -- SHA-256 hex of canonical data
  signature          TEXT NOT NULL,     -- base64 signature over the signing message
  signer_id          TEXT NOT NULL REFERENCES signers(id),
  algorithm          TEXT NOT NULL,
  legacy_signature   TEXT,              -- retained classical signature after PQC migration (hybrid)
  legacy_signer_id   TEXT REFERENCES signers(id),
  legacy_algorithm   TEXT,
  block_index        INTEGER NOT NULL,  -- ledger block anchoring the current signature
  integrity_status   TEXT NOT NULL DEFAULT 'UNVERIFIED', -- VERIFIED | TAMPERED | LEGACY | UNVERIFIED
  last_verified_at   TEXT,
  original_snapshot  TEXT,              -- demo-only: original row values saved by "Simulate tampering"
  featured           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_type ON records(record_type, created_at);
CREATE INDEX IF NOT EXISTS idx_records_status ON records(integrity_status);

CREATE TABLE IF NOT EXISTS supply_chain_events (
  id                   TEXT PRIMARY KEY,
  product_id           TEXT NOT NULL REFERENCES records(id),
  sequence             INTEGER NOT NULL,
  event_type           TEXT NOT NULL,
  actor                TEXT NOT NULL,
  location             TEXT NOT NULL,
  metadata             TEXT NOT NULL,
  data                 TEXT NOT NULL,   -- canonical JSON (includes previousEventHash)
  data_hash            TEXT NOT NULL,
  previous_event_hash  TEXT NOT NULL,
  signature            TEXT NOT NULL,
  signer_id            TEXT NOT NULL REFERENCES signers(id),
  algorithm            TEXT NOT NULL,
  block_index          INTEGER NOT NULL,
  integrity_status     TEXT NOT NULL DEFAULT 'UNVERIFIED',
  original_snapshot    TEXT,
  timestamp            TEXT NOT NULL,
  UNIQUE(product_id, sequence)
);

CREATE TABLE IF NOT EXISTS ledger_blocks (
  block_index        INTEGER PRIMARY KEY,
  timestamp          TEXT NOT NULL,
  record_id          TEXT NOT NULL,
  record_type        TEXT NOT NULL,     -- GENESIS | LAND_RECORD | SUPPLY_PRODUCT | SUPPLY_EVENT
  action             TEXT NOT NULL,     -- GENESIS | CREATE | EVENT | MIGRATE
  data_hash          TEXT NOT NULL,
  signature          TEXT NOT NULL,
  algorithm          TEXT NOT NULL,
  signer_id          TEXT NOT NULL,
  signer_name        TEXT NOT NULL,
  previous_hash      TEXT NOT NULL,
  block_hash         TEXT NOT NULL,
  original_snapshot  TEXT               -- demo-only: used by ledger tamper simulation
);
CREATE INDEX IF NOT EXISTS idx_blocks_record ON ledger_blocks(record_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT NOT NULL,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  record_id  TEXT,
  result     TEXT NOT NULL,             -- SUCCESS | VALID | INVALID | DETECTED | RESTORED | FAILED | INFO
  hash       TEXT,
  details    TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(id DESC);

CREATE TABLE IF NOT EXISTS system_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

let txDepth = 0;

/** Runs fn atomically. Nested calls join the outermost transaction. */
export function transaction<T>(fn: () => T): T {
  if (txDepth > 0) return fn();
  db.exec("BEGIN");
  txDepth++;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    txDepth--;
  }
}

export function getState<T>(key: string): T | undefined {
  const row = db.prepare("SELECT value FROM system_state WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setState(key: string, value: unknown): void {
  db.prepare("INSERT INTO system_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}
