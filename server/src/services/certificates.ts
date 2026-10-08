import { z } from "zod";
import { canonicalize, hashCanonical, signingMessage } from "../crypto/canonical.js";
import { getSigner, signWith } from "../crypto/keystore.js";
import { db } from "../db.js";
import { appendBlock } from "./ledger.js";
import { logAudit } from "./audit.js";
import { notFound } from "./errors.js";

export const CERTIFICATE_TYPES = [
  "B.Tech Degree (Computer Science & Engineering)",
  "Executive Diploma (Quantum Cybersecurity)",
  "AP Pattadar Passbook (Land Title Deed)",
  "Accredited Skill Certificate (QML Specialist)",
] as const;

export interface CertificateRecord {
  id: string;
  recipientName: string;
  recipientId: string;
  institution: string;
  certificateType: string;
  issueDate: string;
  gradeOrStatus: string;
  dataHash: string;
  algorithm: string;
  signature: string;
  signerId: string;
  blockIndex: number;
  createdAt: string;
}

export function listCertificates(): CertificateRecord[] {
  const rows = db.prepare(`
    SELECT id, data, data_hash, algorithm, signature, signer_id, block_index, created_at
    FROM records WHERE record_type = 'CERTIFICATE'
    ORDER BY created_at DESC
  `).all() as Array<{
    id: string; data: string; data_hash: string; algorithm: string; signature: string;
    signer_id: string; block_index: number; created_at: string;
  }>;

  return rows.map((r) => {
    let d: any = {};
    try {
      d = JSON.parse(r.data);
    } catch {
      d = {};
    }
    return {
      id: r.id,
      recipientName: d.recipientName ?? "Unknown Recipient",
      recipientId: d.recipientId ?? "N/A",
      institution: d.institution ?? "Centurion University of Technology and Management",
      certificateType: d.certificateType ?? "Degree Certificate",
      issueDate: d.issueDate ?? r.created_at.slice(0, 10),
      gradeOrStatus: d.gradeOrStatus ?? "First Class",
      dataHash: r.data_hash,
      algorithm: r.algorithm,
      signature: r.signature,
      signerId: r.signer_id,
      blockIndex: r.block_index,
      createdAt: r.created_at,
    };
  });
}

const issueSchema = z.object({
  id: z.string().min(3),
  recipientName: z.string().min(2),
  recipientId: z.string().min(2),
  institution: z.string().min(2),
  certificateType: z.string().min(2),
  issueDate: z.string(),
  gradeOrStatus: z.string().min(1),
  signerId: z.string().default("centurion-univ"),
});

export function issueCertificate(input: unknown): CertificateRecord {
  const parsed = issueSchema.parse(input);
  const signer = getSigner(parsed.signerId);

  const payload = {
    certificateId: parsed.id,
    recipientName: parsed.recipientName,
    recipientId: parsed.recipientId,
    institution: parsed.institution,
    certificateType: parsed.certificateType,
    issueDate: parsed.issueDate,
    gradeOrStatus: parsed.gradeOrStatus,
  };

  const canonical = canonicalize(payload);
  const dataHash = hashCanonical(payload);
  const message = signingMessage("CERTIFICATE", parsed.id, dataHash);
  const { signature, algorithm } = signWith(signer.id, message);

  const now = new Date().toISOString();

  // Commit to ledger
  const block = appendBlock({
    recordId: parsed.id,
    recordType: "CERTIFICATE",
    action: "CREATE",
    dataHash,
    algorithm,
    signature,
    signerId: signer.id,
    timestamp: now,
  });

  db.prepare(`
    INSERT INTO records(id, record_type, title, data, data_hash, algorithm, signature, signer_id, block_index, integrity_status, created_at, updated_at)
    VALUES (?, 'CERTIFICATE', ?, ?, ?, ?, ?, ?, ?, 'AUTHENTIC', ?, ?)
  `).run(
    parsed.id,
    parsed.certificateType,
    canonical,
    dataHash,
    algorithm,
    signature,
    signer.id,
    block.index,
    now,
    now
  );

  logAudit({
    actor: signer.name,
    action: "ISSUE_CERTIFICATE",
    recordId: parsed.id,
    result: "SUCCESS",
    hash: dataHash,
    details: `ML-DSA-65 certificate issued to ${parsed.recipientName} (${parsed.certificateType}); anchored in block #${block.index}`
  });

  return {
    id: parsed.id,
    ...payload,
    dataHash,
    algorithm,
    signature,
    signerId: signer.id,
    blockIndex: block.index,
    createdAt: now,
  };
}

export function getCertificate(id: string): CertificateRecord {
  const row = db.prepare(`
    SELECT id, data, data_hash, algorithm, signature, signer_id, block_index, created_at
    FROM records WHERE id = ? AND record_type = 'CERTIFICATE'
  `).get(id) as { id: string; data: string; data_hash: string; algorithm: string; signature: string; signer_id: string; block_index: number; created_at: string; } | undefined;

  if (!row) throw notFound(`Certificate ${id}`);
  const d = JSON.parse(row.data);
  return {
    id: row.id,
    recipientName: d.recipientName,
    recipientId: d.recipientId,
    institution: d.institution,
    certificateType: d.certificateType,
    issueDate: d.issueDate,
    gradeOrStatus: d.gradeOrStatus,
    dataHash: row.data_hash,
    algorithm: row.algorithm,
    signature: row.signature,
    signerId: row.signer_id,
    blockIndex: row.block_index,
    createdAt: row.created_at,
  };
}
