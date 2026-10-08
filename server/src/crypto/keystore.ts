import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { paths } from "../config.js";
import { db } from "../db.js";
import { sha256Hex } from "./canonical.js";
import { getScheme, type AlgorithmId } from "./schemes.js";

export interface SignerIdentity {
  id: string;
  name: string;
  role: string;
  organization: string;
  algorithm: AlgorithmId;
}

export interface SignerRow extends SignerIdentity {
  public_key: string;
  fingerprint: string;
  created_at: string;
}

/**
 * Demo key custody: private keys are PEM files under server/data/keys (mode 0600) and are
 * never returned by any API. A production deployment would hold them in an HSM / cloud KMS
 * and sign via that service.
 */
export const SIGNERS: SignerIdentity[] = [
  { id: "revenue-ap", name: "Revenue Officer", role: "LAND_REGISTRAR", organization: "Revenue Department, Andhra Pradesh (fictional demo)", algorithm: "ML-DSA-65" },
  { id: "subregistrar-ts", name: "Sub-Registrar", role: "LAND_REGISTRAR", organization: "Registration & Stamps Department, Telangana (fictional demo)", algorithm: "ML-DSA-65" },
  { id: "land-registry-ka", name: "Land Records Officer", role: "LAND_REGISTRAR", organization: "Survey Settlement & Land Records, Karnataka (fictional demo)", algorithm: "ML-DSA-65" },
  { id: "producer", name: "Production QA Officer", role: "MANUFACTURER", organization: "Registered manufacturer / producer (fictional)", algorithm: "ML-DSA-65" },
  { id: "qc-lab", name: "Quality Control Analyst", role: "QUALITY_CONTROL", organization: "Accredited QC Laboratory (fictional)", algorithm: "ML-DSA-65" },
  { id: "warehouse", name: "Warehouse Supervisor", role: "WAREHOUSE", organization: "Coastal Bonded Warehousing (fictional)", algorithm: "ML-DSA-65" },
  { id: "logistics", name: "Logistics Operator", role: "TRANSPORT", organization: "Deccan Cold-Chain Logistics (fictional)", algorithm: "ML-DSA-65" },
  { id: "distributor", name: "Distributor", role: "DISTRIBUTOR", organization: "Southern Medical Distributors (fictional)", algorithm: "ML-DSA-65" },
  { id: "retailer", name: "Retail Pharmacist", role: "RETAILER", organization: "Licensed dispensing pharmacy (fictional)", algorithm: "ML-DSA-65" },
  { id: "centurion-univ", name: "Registrar / Controller of Examinations", role: "CERTIFICATE_AUTHORITY", organization: "Centurion University of Technology and Management (CUTM), Vizianagaram", algorithm: "ML-DSA-65" },
  { id: "ledger-node", name: "Ledger Node", role: "LEDGER", organization: "QuantumShield permissioned ledger", algorithm: "ML-DSA-65" },
  { id: "legacy-ca", name: "Legacy Registry CA (2019)", role: "LEGACY_SIGNER", organization: "Pre-migration digitisation system (fictional)", algorithm: "ECDSA-P256-SHA256" },
];

const keyCache = new Map<string, { privateKey: KeyObject; publicKey: KeyObject }>();
const publicKeyCache = new Map<string, KeyObject>();

function keyPath(id: string): string {
  return resolve(paths.keys, `${id}.pem`);
}

export function spkiFingerprint(publicKey: KeyObject): string {
  return sha256Hex(publicKey.export({ type: "spki", format: "der" }));
}

/** Creates (once) the key pair for each signer and registers its public key. */
export function ensureSigners(): void {
  publicKeyCache.clear();
  const upsert = db.prepare(`INSERT INTO signers(id, name, role, organization, algorithm, public_key, fingerprint, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, organization=excluded.organization,
      algorithm=excluded.algorithm, public_key=excluded.public_key, fingerprint=excluded.fingerprint`);
  for (const s of SIGNERS) {
    const file = keyPath(s.id);
    let privateKey: KeyObject;
    if (existsSync(file)) {
      privateKey = createPrivateKey(readFileSync(file, "utf8"));
    } else {
      privateKey = getScheme(s.algorithm).generateKeyPair().privateKey;
      writeFileSync(file, privateKey.export({ type: "pkcs8", format: "pem" }) as string, { mode: 0o600 });
    }
    const publicKey = createPublicKey(privateKey);
    keyCache.set(s.id, { privateKey, publicKey });
    const existing = db.prepare("SELECT created_at FROM signers WHERE id = ?").get(s.id) as { created_at: string } | undefined;
    upsert.run(s.id, s.name, s.role, s.organization, s.algorithm,
      publicKey.export({ type: "spki", format: "pem" }) as string, spkiFingerprint(publicKey),
      existing?.created_at ?? new Date().toISOString());
  }
}

export function getSigner(id: string): SignerRow {
  const row = db.prepare("SELECT * FROM signers WHERE id = ?").get(id) as SignerRow | undefined;
  if (!row) throw new Error(`Unknown signer: ${id}`);
  return { ...row };
}

export function listSigners(): SignerRow[] {
  return (db.prepare("SELECT * FROM signers ORDER BY rowid").all() as unknown as SignerRow[]).map((r) => ({ ...r }));
}

/** Public key comes from the DB registry (what a verifier would trust), not from the private key file. */
export function getPublicKey(signerId: string): KeyObject {
  let key = publicKeyCache.get(signerId);
  if (!key) {
    key = createPublicKey(getSigner(signerId).public_key);
    publicKeyCache.set(signerId, key);
  }
  return key;
}

export function signWith(signerId: string, message: Buffer): { signature: string; algorithm: AlgorithmId } {
  const signer = getSigner(signerId);
  const keys = keyCache.get(signerId);
  if (!keys) throw new Error(`Private key for ${signerId} not loaded`);
  return { signature: getScheme(signer.algorithm).sign(message, keys.privateKey).toString("base64"), algorithm: signer.algorithm };
}

export function verifyWith(signerId: string, algorithm: string, message: Buffer, signatureB64: string): boolean {
  const signer = getSigner(signerId);
  if (signer.algorithm !== algorithm) return false;
  return getScheme(algorithm).verify(message, Buffer.from(signatureB64, "base64"), getPublicKey(signerId));
}
