import { createHash } from "node:crypto";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Deterministic JSON serialisation (JCS-style, RFC 8785 subset): object keys sorted
 * lexicographically at every level, no insignificant whitespace, undefined dropped.
 * The same logical record always yields the same bytes, so its hash is stable.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite numbers cannot be canonicalized");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

/**
 * The exact message that gets signed for any record or event. Domain-separated so a
 * signature for one entity type/id can never be replayed as a signature for another.
 */
export function signingMessage(entityType: string, entityId: string, dataHash: string): Buffer {
  return Buffer.from(`QuantumShield/v1|${entityType}|${entityId}|${dataHash}`, "utf8");
}
