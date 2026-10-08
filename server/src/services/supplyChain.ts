import { z } from "zod";
import { canonicalize, hashCanonical, signingMessage } from "../crypto/canonical.js";
import { getSigner, signWith } from "../crypto/keystore.js";
import { db, transaction } from "../db.js";
import { auditForRecord, logAudit } from "./audit.js";
import { badRequest, notFound } from "./errors.js";
import { appendBlock, toBlock, verifyChain, type BlockRow, type ChainReport } from "./ledger.js";
import { createSignedRecord, getRecordRow, recordAsEntity, toSummary, type RecordRow } from "./records.js";
import { diffData, verdictToStatus, verifyEntity, type EntityVerification, type VerificationCheck } from "./verification.js";

export const EVENT_TYPES = ["MANUFACTURED", "QUALITY_CHECK", "WAREHOUSE", "TRANSPORT", "DISTRIBUTOR", "RETAILER"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Each lifecycle stage is signed by the party accountable for it. */
export const EVENT_SIGNER: Record<EventType, string> = {
  MANUFACTURED: "producer",
  QUALITY_CHECK: "qc-lab",
  WAREHOUSE: "warehouse",
  TRANSPORT: "logistics",
  DISTRIBUTOR: "distributor",
  RETAILER: "retailer",
};

const STATUS_AFTER: Record<EventType, string> = {
  MANUFACTURED: "Manufactured",
  QUALITY_CHECK: "QC Released",
  WAREHOUSE: "In Storage",
  TRANSPORT: "In Transit",
  DISTRIBUTOR: "At Distributor",
  RETAILER: "Available at Retail",
};

export const productSchema = z.object({
  productId: z.string().trim().min(3).max(40),
  productName: z.string().trim().min(2).max(120),
  batchId: z.string().trim().regex(/^[A-Z0-9]+(-[A-Z0-9]+)+$/, "Batch ID must look like PHARMA-BT-9921"),
  manufacturer: z.string().trim().min(2).max(120),
  origin: z.string().trim().min(2).max(120),
  certification: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60).default("Pharmaceutical"),
  initialLocation: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(240).optional(),
});

export const eventSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  location: z.string().trim().min(2).max(120),
  custodian: z.string().trim().min(2).max(120),
  metadata: z.record(z.string(), z.string().max(200)).default({}),
});

interface EventRow {
  id: string;
  product_id: string;
  sequence: number;
  event_type: EventType;
  actor: string;
  location: string;
  metadata: string;
  data: string;
  data_hash: string;
  previous_event_hash: string;
  signature: string;
  signer_id: string;
  algorithm: string;
  block_index: number;
  integrity_status: string;
  original_snapshot: string | null;
  timestamp: string;
}

export interface EventData {
  eventId: string;
  productId: string;
  sequence: number;
  eventType: EventType;
  actor: string;
  actorOrganization: string;
  custodian: string;
  location: string;
  status: string;
  timestamp: string;
  metadata: Record<string, string>;
  previousEventHash: string;
}

function eventsFor(productId: string): EventRow[] {
  return (db.prepare("SELECT * FROM supply_chain_events WHERE product_id = ? ORDER BY sequence").all(productId) as unknown as EventRow[]).map((r) => ({ ...r }));
}

function requireProduct(id: string): RecordRow {
  const row = getRecordRow(id);
  if (!row || row.record_type !== "SUPPLY_PRODUCT") throw notFound(`Product ${id}`);
  return row;
}

export function createProduct(raw: unknown, opts: { timestamp?: string; custodian?: string; metadata?: Record<string, string> } = {}) {
  const input = productSchema.parse(raw);
  const { initialLocation, notes, ...fields } = input;
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const data = { recordType: "SUPPLY_PRODUCT", ...fields, registeredAt: timestamp };
  return transaction(() => {
    const created = createSignedRecord({
      id: input.batchId,
      recordType: "SUPPLY_PRODUCT",
      title: `${input.productName} · ${input.batchId}`,
      data,
      signerId: EVENT_SIGNER.MANUFACTURED,
      timestamp,
      actor: getSigner(EVENT_SIGNER.MANUFACTURED).name,
    });
    const event = addEvent(input.batchId, {
      eventType: "MANUFACTURED",
      location: initialLocation,
      custodian: opts.custodian ?? input.manufacturer,
      metadata: opts.metadata ?? (notes ? { notes } : { notes: "Batch manufactured and sealed" }),
    }, { timestamp });
    return { product: created.record, trace: created.trace, firstEvent: event };
  });
}

function allowedNext(last: EventType | undefined): EventType[] {
  if (!last) return ["MANUFACTURED"];
  const i = EVENT_TYPES.indexOf(last);
  const next = EVENT_TYPES.slice(i + 1) as EventType[];
  return last === "TRANSPORT" ? ["TRANSPORT", ...next] : next;
}

/**
 * Appends a provenance event. Its hash commits to the previous event's hash (or the product's
 * genesis hash), forming a per-product hash chain on top of the global ledger.
 */
export function addEvent(productId: string, raw: unknown, opts: { timestamp?: string } = {}) {
  const product = requireProduct(productId);
  const input = eventSchema.parse(raw);
  const existing = eventsFor(productId);
  const last = existing.at(-1);
  const allowed = allowedNext(last?.event_type);
  if (!allowed.includes(input.eventType)) {
    throw badRequest(`${input.eventType} cannot follow ${last?.event_type ?? "product registration"}. Allowed next: ${allowed.join(", ") || "none (lifecycle complete)"}`);
  }
  const signerId = EVENT_SIGNER[input.eventType];
  const signer = getSigner(signerId);
  const sequence = (last?.sequence ?? 0) + 1;
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const eventId = `${productId}-E${String(sequence).padStart(2, "0")}`;
  const data: EventData = {
    eventId,
    productId,
    sequence,
    eventType: input.eventType,
    actor: signer.name,
    actorOrganization: signer.organization,
    custodian: input.custodian,
    location: input.location,
    status: STATUS_AFTER[input.eventType],
    timestamp,
    metadata: input.metadata,
    previousEventHash: last ? last.data_hash : product.data_hash,
  };
  const dataHash = hashCanonical(data);
  const { signature, algorithm } = signWith(signerId, signingMessage("SUPPLY_EVENT", eventId, dataHash));
  return transaction(() => {
    const block = appendBlock({ recordId: eventId, recordType: "SUPPLY_EVENT", action: "EVENT", dataHash, signature, algorithm, signerId, timestamp });
    db.prepare(`INSERT INTO supply_chain_events(id, product_id, sequence, event_type, actor, location, metadata, data, data_hash,
      previous_event_hash, signature, signer_id, algorithm, block_index, integrity_status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?)`)
      .run(eventId, productId, sequence, input.eventType, signer.name, input.location, JSON.stringify(input.metadata), canonicalize(data),
        dataHash, data.previousEventHash, signature, signerId, algorithm, block.index, timestamp);
    logAudit({ actor: signer.name, action: "SUPPLY_EVENT", recordId: eventId, result: "SUCCESS", hash: dataHash,
      details: `${input.eventType} at ${input.location}; linked to ${last ? last.id : productId}; block #${block.index}`, timestamp });
    return { eventId, dataHash, signatureBytes: Buffer.from(signature, "base64").length, algorithm, block, previousEventHash: data.previousEventHash };
  });
}

export interface EventVerification extends EntityVerification {
  changedFields: ReturnType<typeof diffData>;
}

export interface ProductVerification {
  productId: string;
  verdict: "AUTHENTIC" | "TAMPERED";
  product: EntityVerification;
  events: EventVerification[];
  chain: Pick<ChainReport, "valid" | "totalBlocks" | "firstInvalidIndex">;
  verifiedAt: string;
}

/** Verifies the product record, every event signature, and every provenance link. */
export function verifyProductChain(productId: string, chain: ChainReport = verifyChain(), opts: { persist?: boolean } = { persist: true }): ProductVerification {
  const product = requireProduct(productId);
  const productReport = verifyEntity(recordAsEntity(product), chain);
  let previousHash = productReport.computedHash; // what the first event must point at
  let previousLabel = `product registration (${productId})`;
  const events = eventsFor(productId).map((row) => {
    const report = verifyEntity({
      entityType: "SUPPLY_EVENT", entityId: row.id, data: row.data, storedHash: row.data_hash, signature: row.signature,
      signerId: row.signer_id, algorithm: row.algorithm, blockIndex: row.block_index,
    }, chain);
    let claimedPrev: string | null = null;
    try { claimedPrev = (JSON.parse(row.data) as EventData).previousEventHash; } catch { /* unreadable data already fails the hash check */ }
    const linkOk = claimedPrev !== null && claimedPrev === previousHash;
    const link: VerificationCheck = {
      id: "eventLink",
      label: "Provenance Link",
      status: linkOk ? "pass" : "fail",
      summary: linkOk ? `Linked to ${previousLabel}` : `Broken link to ${previousLabel}`,
      detail: linkOk
        ? "previousEventHash equals the recomputed hash of the preceding step."
        : "previousEventHash does not equal the recomputed hash of the preceding step: the earlier step was altered or the chain was spliced.",
      expected: previousHash ?? undefined,
      actual: claimedPrev ?? undefined,
    };
    report.checks.splice(4, 0, link);
    if (!linkOk) report.verdict = "TAMPERED";
    previousHash = report.computedHash;
    previousLabel = `step ${row.sequence} (${row.event_type})`;
    return {
      ...report,
      changedFields: row.original_snapshot ? diffData((JSON.parse(row.original_snapshot) as { data: string }).data, row.data) : [],
    };
  });
  const verdict = productReport.verdict === "TAMPERED" || events.some((e) => e.verdict === "TAMPERED") ? "TAMPERED" : "AUTHENTIC";
  if (opts.persist) {
    const now = new Date().toISOString();
    db.prepare("UPDATE records SET integrity_status = ?, last_verified_at = ? WHERE id = ?").run(verdictToStatus(productReport.verdict), now, productId);
    const upd = db.prepare("UPDATE supply_chain_events SET integrity_status = ? WHERE id = ?");
    for (const e of events) upd.run(verdictToStatus(e.verdict), e.entityId);
  }
  return {
    productId,
    verdict,
    product: productReport,
    events,
    chain: { valid: chain.valid, totalBlocks: chain.totalBlocks, firstInvalidIndex: chain.firstInvalidIndex },
    verifiedAt: new Date().toISOString(),
  };
}

export function verifyProduct(productId: string, actor = "Verifier", opts: { passive?: boolean } = {}) {
  const result = verifyProductChain(productId);
  if (opts.passive) return result;
  const failedSteps = result.events.filter((e) => e.verdict === "TAMPERED").map((e) => e.entityId);
  logAudit({
    actor,
    action: "VERIFY_PROVENANCE",
    recordId: productId,
    result: result.verdict === "TAMPERED" ? "INVALID" : "VALID",
    hash: result.product.computedHash,
    details: result.verdict === "TAMPERED"
      ? `Provenance chain invalid${failedSteps.length ? `: ${failedSteps.join(", ")}` : ""}`
      : `${result.events.length} events verified with ML-DSA; provenance links intact`,
  });
  if (result.verdict === "TAMPERED") {
    logAudit({ actor: "System", action: "TAMPER_DETECTED", recordId: productId, result: "DETECTED", details: `Supply-chain integrity violation in ${failedSteps.join(", ") || productId}` });
  }
  return result;
}

function eventDto(row: EventRow) {
  const data = JSON.parse(row.data) as EventData;
  return {
    id: row.id,
    sequence: row.sequence,
    eventType: row.event_type,
    data,
    dataHash: row.data_hash,
    previousEventHash: row.previous_event_hash,
    signatureBytes: Buffer.from(row.signature, "base64").length,
    signaturePreview: row.signature.slice(0, 64),
    algorithm: row.algorithm,
    signerId: row.signer_id,
    blockIndex: row.block_index,
    integrityStatus: row.integrity_status,
    demoTampered: row.original_snapshot !== null,
    timestamp: row.timestamp,
  };
}

export function listProducts() {
  const rows = (db.prepare("SELECT * FROM records WHERE record_type = 'SUPPLY_PRODUCT' ORDER BY created_at DESC").all() as unknown as RecordRow[]).map((r) => ({ ...r }));
  return rows.map((r) => {
    const events = eventsFor(r.id);
    const last = events.at(-1);
    const lastData = last ? (JSON.parse(last.data) as EventData) : null;
    return {
      ...toSummary(r),
      eventCount: events.length,
      stages: events.map((e) => e.event_type),
      currentState: lastData ? { custodian: lastData.custodian, location: lastData.location, status: lastData.status, updatedAt: lastData.timestamp } : null,
      eventIntegrity: events.some((e) => e.integrity_status === "TAMPERED") ? "TAMPERED" : "VERIFIED",
    };
  });
}

export function getProduct(id: string) {
  const row = requireProduct(id);
  const events = eventsFor(id).map(eventDto);
  const last = events.at(-1);
  const blocks = (db.prepare(`SELECT * FROM ledger_blocks WHERE record_id = ? OR record_id IN (SELECT id FROM supply_chain_events WHERE product_id = ?) ORDER BY block_index`)
    .all(id, id) as unknown as BlockRow[]).map((b) => toBlock({ ...b }));
  return {
    product: toSummary(row),
    signer: getSigner(row.signer_id),
    events,
    currentState: last ? { custodian: last.data.custodian, location: last.data.location, status: last.data.status, updatedAt: last.data.timestamp } : null,
    allowedNextEvents: allowedNext(last?.eventType),
    eventTypes: EVENT_TYPES,
    eventSigners: Object.fromEntries(EVENT_TYPES.map((t) => [t, getSigner(EVENT_SIGNER[t]).name])),
    blocks,
    audit: auditForRecord(id, 10),
  };
}

const TAMPERABLE_EVENT_FIELDS = ["custodian", "location", "status", "actor", "timestamp"];

/** DEMO ONLY: edits one provenance event in the database without re-signing it. */
export function tamperEvent(eventId: string, input: { field: string; value: string }, actor = "Demo User") {
  const row = db.prepare("SELECT * FROM supply_chain_events WHERE id = ?").get(eventId) as EventRow | undefined;
  if (!row) throw notFound(`Event ${eventId}`);
  const data = JSON.parse(row.data) as EventData & Record<string, unknown>;
  if (input.field.startsWith("metadata.")) {
    const key = input.field.slice("metadata.".length);
    if (!key) throw badRequest("Metadata key required");
    data.metadata = { ...data.metadata, [key]: input.value };
  } else if (TAMPERABLE_EVENT_FIELDS.includes(input.field)) {
    if (String(data[input.field]) === input.value) throw badRequest("The new value is identical to the current value");
    data[input.field] = input.value;
  } else {
    throw badRequest(`Field "${input.field}" cannot be tampered. Use one of: ${TAMPERABLE_EVENT_FIELDS.join(", ")}, metadata.<key>`);
  }
  const snapshot = row.original_snapshot ?? JSON.stringify({ data: row.data });
  db.prepare("UPDATE supply_chain_events SET data = ?, original_snapshot = ? WHERE id = ?").run(canonicalize(data), snapshot, eventId);
  logAudit({ actor, action: "TAMPER_ATTEMPT", recordId: eventId, result: "WARNING", hash: hashCanonical(data),
    details: `Demo simulation: provenance field "${input.field}" changed to "${input.value}" without re-signing` });
  return getProduct(row.product_id);
}

export function restoreEvent(eventId: string, actor = "Demo User") {
  const row = db.prepare("SELECT * FROM supply_chain_events WHERE id = ?").get(eventId) as EventRow | undefined;
  if (!row) throw notFound(`Event ${eventId}`);
  if (!row.original_snapshot) throw badRequest(`Event ${eventId} has no tampering to undo`);
  const original = JSON.parse(row.original_snapshot) as { data: string };
  db.prepare("UPDATE supply_chain_events SET data = ?, original_snapshot = NULL, integrity_status = 'UNVERIFIED' WHERE id = ?").run(original.data, eventId);
  logAudit({ actor, action: "RESTORE_ORIGINAL", recordId: eventId, result: "RESTORED", hash: row.data_hash, details: "Demo reset: original event restored" });
  // Downstream events were flagged via broken provenance links; refresh every status in the chain.
  verifyProductChain(row.product_id);
  return getProduct(row.product_id);
}

export function allEventRows(): EventRow[] {
  return (db.prepare("SELECT * FROM supply_chain_events").all() as unknown as EventRow[]).map((r) => ({ ...r }));
}
