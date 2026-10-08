import { db } from "../db.js";

export type AuditResult = "SUCCESS" | "VALID" | "INVALID" | "DETECTED" | "RESTORED" | "FAILED" | "INFO" | "WARNING";

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  recordId: string | null;
  result: AuditResult;
  hash: string | null;
  details: string | null;
}

const insert = db.prepare(
  "INSERT INTO audit_logs(timestamp, actor, action, record_id, result, hash, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
);

export function logAudit(e: {
  actor: string;
  action: string;
  recordId?: string | null;
  result: AuditResult;
  hash?: string | null;
  details?: string | null;
  timestamp?: string;
}): void {
  insert.run(e.timestamp ?? new Date().toISOString(), e.actor, e.action, e.recordId ?? null, e.result, e.hash ?? null, e.details ?? null);
}

interface AuditRow {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  record_id: string | null;
  result: AuditResult;
  hash: string | null;
  details: string | null;
}

const toEntry = (r: AuditRow): AuditEntry => ({
  id: r.id,
  timestamp: r.timestamp,
  actor: r.actor,
  action: r.action,
  recordId: r.record_id,
  result: r.result,
  hash: r.hash,
  details: r.details,
});

export function listAudit(opts: { limit?: number; offset?: number; action?: string; result?: string; q?: string }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.action) { where.push("action = ?"); params.push(opts.action); }
  if (opts.result) { where.push("result = ?"); params.push(opts.result); }
  if (opts.q) {
    where.push("(record_id LIKE ? OR actor LIKE ? OR action LIKE ? OR details LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const rows = db.prepare(`SELECT * FROM audit_logs ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as unknown as AuditRow[];
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM audit_logs ${clause}`).get(...params) as { total: number };
  const actions = (db.prepare("SELECT DISTINCT action FROM audit_logs ORDER BY action").all() as { action: string }[]).map((r) => r.action);
  return { entries: rows.map(toEntry), total, actions };
}

export function auditForRecord(recordId: string, limit = 25): AuditEntry[] {
  return (db.prepare("SELECT * FROM audit_logs WHERE record_id = ? ORDER BY id DESC LIMIT ?").all(recordId, limit) as unknown as AuditRow[]).map(toEntry);
}
