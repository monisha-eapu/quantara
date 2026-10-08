export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the QuantumShield API. Is the server running (npm run dev)?");
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    const d = (data ?? {}) as { message?: string; detail?: string | { msg: string }[]; error?: string };
    const detail = Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join("; ") : d.detail;
    throw new ApiError(res.status, d.message ?? detail ?? `Request failed (${res.status})`, d.error);
  }
  return data as T;
}

export const api = {
  get: <T,>(p: string) => request<T>("GET", p),
  post: <T,>(p: string, body: unknown = {}) => request<T>("POST", p, body),
  del: <T,>(p: string) => request<T>("DELETE", p),
};

// ---- Shared types (mirror the server responses) --------------------------------
export type IntegrityStatus = "VERIFIED" | "TAMPERED" | "LEGACY" | "UNVERIFIED";
export type CheckStatus = "pass" | "fail" | "warn";
export type Verdict = "AUTHENTIC" | "AUTHENTIC_LEGACY" | "TAMPERED";

export interface RecordSummary {
  id: string;
  recordType: "LAND_RECORD" | "SUPPLY_PRODUCT";
  title: string;
  dataHash: string;
  algorithm: string;
  signerName: string;
  blockIndex: number;
  integrityStatus: IntegrityStatus;
  lastVerifiedAt: string | null;
  demoTampered: boolean;
  featured: boolean;
  createdAt: string;
  data: Record<string, unknown>;
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

export interface VerificationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  detail: string;
  expected?: string;
  actual?: string;
}

export interface ChangedField { field: string; original: unknown; current: unknown }

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
  changedFields?: ChangedField[];
  demoTampered?: boolean;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  recordId: string | null;
  result: string;
  hash: string | null;
  details: string | null;
}

export interface RecordDetail {
  record: RecordSummary;
  signature: string;
  signatureBytes: number;
  canonical: string;
  signingMessage: string;
  signer: { id: string; name: string; role: string; organization: string; fingerprint: string; algorithm: string };
  legacy: { algorithm: string; signerId: string; signatureBytes: number } | null;
  block: Block | null;
  ledgerHistory: Block[];
  tamper: { active: boolean; changedFields: ChangedField[] };
  audit: AuditEntry[];
}

export interface SigningTrace {
  canonical: string;
  canonicalBytes: number;
  dataHash: string;
  signingMessage: string;
  algorithm: string;
  signatureBytes: number;
  signaturePreview: string;
  signer: { id: string; name: string; organization: string; fingerprint: string };
  block: Block;
  timingsMs: { canonicalize: number; hash: number; sign: number; ledger: number };
}

export interface ChainReport {
  valid: boolean;
  totalBlocks: number;
  tipIndex: number | null;
  tipHash: string | null;
  signaturesChecked: boolean;
  issues: { index: number; kind: string; message: string }[];
  firstInvalidIndex: number | null;
  checkedAt: string;
  durationMs: number;
}
