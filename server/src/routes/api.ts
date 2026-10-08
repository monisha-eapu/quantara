import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { listSigners } from "../crypto/keystore.js";
import { DEFAULT_ALGORITHM, listSchemes } from "../crypto/schemes.js";
import { listAudit, logAudit } from "../services/audit.js";
import { dashboard, runIntegrityScan } from "../services/integrity.js";
import { createLandRecord, LAND_STATUSES, PROPERTY_TYPES } from "../services/land.js";
import { inspectBlock, listBlocks, restoreBlock, tamperBlock, verifyChain } from "../services/ledger.js";
import { compareSchemes, migrateRecord, migrationOverview } from "../services/migration.js";
import { getRecordDetail, getRecordRow, listRecords, restoreRecord, tamperRecord, verifyRecord } from "../services/records.js";
import { addEvent, createProduct, getProduct, listProducts, restoreEvent, tamperEvent, verifyProduct } from "../services/supplyChain.js";
import { listCertificates, issueCertificate, getCertificate } from "../services/certificates.js";
import { clearDemoData, seedDemoData, DEMO_RECORD_ID } from "../seed.js";
import { notFound } from "../services/errors.js";

export const api = Router();

const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
const str = (v: unknown) => (typeof v === "string" && v.length ? v : undefined);
type Handler = (req: Request, res: Response) => unknown;
const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out);
  } catch (err) {
    next(err);
  }
};
const param = (req: Request, key: string) => String(req.params[key]);

api.get("/health", h(() => ({ ok: true, algorithm: DEFAULT_ALGORITHM, openssl: process.versions.openssl, node: process.version })));
api.get("/dashboard", h(() => dashboard()));

// ---- Records ---------------------------------------------------------------
api.get("/records", h((req) => listRecords({
  type: str(req.query.type), status: str(req.query.status), propertyType: str(req.query.propertyType), year: str(req.query.year), q: str(req.query.q),
  limit: num(req.query.limit), offset: num(req.query.offset), featuredFirst: req.query.featuredFirst === "true",
})));
api.get("/records/meta", h(() => ({ propertyTypes: PROPERTY_TYPES, statuses: LAND_STATUSES, demoRecordId: DEMO_RECORD_ID,
  landSigners: listSigners().filter((s) => s.role === "LAND_REGISTRAR").map(({ id, name, organization }) => ({ id, name, organization })) })));
api.post("/records", h((req, res) => {
  const result = createLandRecord(req.body);
  res.status(201);
  return result;
}));
api.get("/records/:id", h((req) => getRecordDetail(param(req, "id"))));
api.post("/records/:id/verify", h((req) => verifyRecord(param(req, "id"), "Verifier", undefined, { passive: req.query.passive === "1" })));
const tamperSchema = z.object({ field: z.string().min(1), value: z.string().trim().min(1).max(200), mode: z.enum(["FIELD_ONLY", "FIELD_AND_HASH"]).default("FIELD_ONLY") });
api.post("/records/:id/tamper", h((req) => tamperRecord(param(req, "id"), tamperSchema.parse(req.body))));
api.post("/records/:id/restore", h((req) => restoreRecord(param(req, "id"))));

// ---- Ledger ----------------------------------------------------------------
api.get("/ledger", h((req) => listBlocks({ limit: num(req.query.limit), before: num(req.query.before), recordId: str(req.query.recordId) })));
api.get("/ledger/verify", h(() => {
  const report = verifyChain({ signatures: true });
  logAudit({ actor: "Verifier", action: "VERIFY_LEDGER", result: report.valid ? "VALID" : "INVALID",
    hash: report.tipHash, details: report.valid ? `${report.totalBlocks} blocks, hashes, links and signatures verified in ${report.durationMs} ms` : `${report.issues.length} issue(s); first at block #${report.firstInvalidIndex}` });
  return report;
}));
api.get("/ledger/blocks/:index", h((req) => {
  const out = inspectBlock(Number(req.params.index));
  if (!out) throw notFound(`Block #${req.params.index}`);
  return out;
}));
const blockTamperSchema = z.object({ mode: z.enum(["EDIT_ONLY", "EDIT_AND_REHASH"]).default("EDIT_ONLY") });
api.post("/ledger/blocks/:index/tamper", h((req) => {
  const index = Number(req.params.index);
  const { mode } = blockTamperSchema.parse(req.body ?? {});
  const block = tamperBlock(index, mode);
  logAudit({ actor: "Demo User", action: "LEDGER_TAMPER_ATTEMPT", recordId: block.recordId, result: "WARNING", hash: block.dataHash,
    details: `Demo simulation: block #${index} data hash overwritten in the database (${mode === "EDIT_AND_REHASH" ? "block hash recomputed" : "block hash left stale"})` });
  return inspectBlock(index);
}));
api.post("/ledger/blocks/:index/restore", h((req) => {
  const index = Number(req.params.index);
  const block = restoreBlock(index);
  logAudit({ actor: "Demo User", action: "RESTORE_ORIGINAL", recordId: block.recordId, result: "RESTORED", hash: block.dataHash, details: `Demo reset: block #${index} restored` });
  return inspectBlock(index);
}));

// ---- Supply chain ------------------------------------------------------------
api.get("/supply-chain/products", h(() => ({ products: listProducts() })));
api.post("/supply-chain/products", h((req, res) => {
  const out = createProduct(req.body);
  res.status(201);
  return out;
}));
api.get("/supply-chain/products/:id", h((req) => getProduct(param(req, "id"))));
api.post("/supply-chain/products/:id/events", h((req, res) => {
  const out = addEvent(param(req, "id"), req.body);
  res.status(201);
  return out;
}));
api.post("/supply-chain/products/:id/verify", h((req) => verifyProduct(param(req, "id"), "Verifier", { passive: req.query.passive === "1" })));
const eventTamperSchema = z.object({ field: z.string().min(1), value: z.string().trim().min(1).max(200) });
api.post("/supply-chain/events/:id/tamper", h((req) => tamperEvent(param(req, "id"), eventTamperSchema.parse(req.body))));
api.post("/supply-chain/events/:id/restore", h((req) => restoreEvent(param(req, "id"))));

// ---- Certificates ------------------------------------------------------------
api.get("/certificates", h(() => ({ certificates: listCertificates() })));
api.post("/certificates", h((req, res) => {
  const out = issueCertificate(req.body);
  res.status(201);
  return out;
}));
api.get("/certificates/:id", h((req) => getCertificate(param(req, "id"))));
api.post("/certificates/:id/verify", h((req) => verifyRecord(param(req, "id"), "Verifier")));

// ---- Audit, crypto, migration, integrity ----------------------------------------
api.get("/audit", h((req) => listAudit({ limit: num(req.query.limit), offset: num(req.query.offset), action: str(req.query.action), result: str(req.query.result), q: str(req.query.q) })));
api.get("/crypto", h(() => ({
  defaultAlgorithm: DEFAULT_ALGORITHM,
  runtime: { node: process.version, openssl: process.versions.openssl },
  schemes: listSchemes().map(({ id, displayName, family, standard, securityNote }) => ({ id, displayName, family, standard, securityNote })),
  signers: listSigners().map(({ id, name, role, organization, algorithm, fingerprint, public_key, created_at }) => ({
    id, name, role, organization, algorithm, fingerprint, createdAt: created_at,
    publicKeyPem: public_key, publicKeyBytes: Buffer.from(public_key.replace(/-----[^-]+-----|\s/g, ""), "base64").length,
  })),
  hashing: { algorithm: "SHA-256", canonicalization: "Sorted-key JSON (RFC 8785 style)", signingMessage: "QuantumShield/v1|<entityType>|<entityId>|<sha256-hex>" },
  keyCustody: "Prototype: private keys are PEM files on the server (data/keys, mode 0600) and never leave it. Production: HSM / cloud KMS.",
})));
api.get("/migration", h(() => migrationOverview()));
api.post("/migration/:id/compare", h((req) => compareSchemes(param(req, "id"))));
api.post("/migration/:id/migrate", h((req) => migrateRecord(param(req, "id"), str((req.body as { signerId?: string } | undefined)?.signerId) ?? "revenue-ap")));
api.post("/integrity/scan", h(() => runIntegrityScan("Verifier")));
api.get("/lookup/:id", h((req) => {
  const id = param(req, "id").trim().toUpperCase();
  const row = getRecordRow(id) ?? getRecordRow(`LAND-${id}`);
  if (!row) throw notFound(`Record ${id}`);
  return { id: row.id, recordType: row.record_type };
}));
api.post("/admin/reset", h(() => {
  clearDemoData();
  seedDemoData(() => undefined);
  return { ok: true };
}));
