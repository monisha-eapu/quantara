import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Award, ShieldCheck, Plus, ExternalLink } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, Empty, PageHeader, Pill } from "../components/ui";

interface Certificate {
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
  blockIndex: number;
  createdAt: string;
}

export default function Certificates() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({
    id: `CUTM-CERT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    recipientName: "Sai Kiran Varma",
    recipientId: "CUTM-220101-089",
    institution: "Centurion University of Technology and Management, Vizianagaram",
    certificateType: "B.Tech Degree (Computer Science & Engineering)",
    issueDate: new Date().toISOString().slice(0, 10),
    gradeOrStatus: "First Class with Distinction",
  });

  const load = () => {
    setLoading(true);
    api.get<{ certificates: Certificate[] }>("/certificates")
      .then((res) => setCerts(res.certificates ?? []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/certificates", form);
      setIssuing(false);
      load();
    } catch (err) {
      alert("Failed to issue certificate: " + (err as Error).message);
    }
  };

  const filtered = certs.filter(
    (c) =>
      c.recipientName.toLowerCase().includes(filter.toLowerCase()) ||
      c.id.toLowerCase().includes(filter.toLowerCase()) ||
      c.certificateType.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Centurion University of Technology and Management (CUTM) · Vizianagaram"
        title="Quantum-Safe Certificates"
        description="Tamper-proof educational, institutional and land credentials signed with ML-DSA-65 (NIST FIPS 204) and anchored to the DLT ledger."
        actions={
          <Button variant="primary" onClick={() => setIssuing(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Issue Credential
          </Button>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-paper border-line-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-mute">Total Credentials</div>
          <div className="mt-2 text-2xl font-bold text-ink">{certs.length}</div>
          <div className="mt-1 text-xs text-faint">ML-DSA-65 signed & anchored</div>
        </Card>
        <Card className="p-4 bg-paper border-line-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-mute">Issuing Authority</div>
          <div className="mt-2 text-lg font-bold text-ink truncate">Centurion University / AP Govt</div>
          <div className="mt-1 text-xs text-faint">Vizianagaram Campus CA</div>
        </Card>
        <Card className="p-4 bg-paper border-line-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-mute">PQC Standard</div>
          <div className="mt-2 flex items-center gap-2 text-ok font-bold text-lg">
            <ShieldCheck className="h-5 w-5" /> NIST FIPS 204
          </div>
          <div className="mt-1 text-xs text-faint">Post-Quantum Lattice Signature</div>
        </Card>
      </div>

      {/* Issue Modal */}
      {issuing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 ">
          <div className="w-full max-w-lg rounded border border-line-4 bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line-2 pb-3">
              <div className="flex items-center gap-2 text-lg font-bold text-ink">
                <Award className="h-5 w-5 text-ink" /> Issue Post-Quantum Certificate
              </div>
              <button type="button" onClick={() => setIssuing(false)} className="text-mute hover:text-ink">✕</button>
            </div>
            <form onSubmit={handleIssue} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-body">Certificate / Roll ID</label>
                <input className="input mt-1 w-full" value={form.id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, id: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-medium text-body">Recipient Full Name</label>
                <input className="input mt-1 w-full" value={form.recipientName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, recipientName: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-medium text-body">Student / Citizen ID</label>
                <input className="input mt-1 w-full" value={form.recipientId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, recipientId: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-medium text-body">Institution / Issuing Body</label>
                <input className="input mt-1 w-full" value={form.institution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, institution: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-medium text-body">Credential / Degree Title</label>
                <input className="input mt-1 w-full" value={form.certificateType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, certificateType: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-body">Issue Date</label>
                  <input type="date" className="input mt-1 w-full" value={form.issueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, issueDate: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-body">Award / Grade</label>
                  <input className="input mt-1 w-full" value={form.gradeOrStatus} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, gradeOrStatus: e.target.value })} required />
                </div>
              </div>
              <div className="rounded border border-line-4 bg-hov p-3 text-xs text-ink">
                Signing with Registrar ML-DSA-65 keypair. An immutable commitment block will be anchored to the ledger.
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setIssuing(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Sign & Anchor</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center justify-between gap-4">
        <input
          placeholder="Filter by recipient name, credential ID, or degree title..."
          value={filter}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          className="input max-w-md w-full"
        />
        <div className="text-xs text-mute">Showing {filtered.length} credentials</div>
      </div>

      {/* Certificates List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-mute">Loading verified credentials...</div>
      ) : filtered.length === 0 ? (
        <Empty
          title="No Certificates Found"
          description="Issue the first quantum-safe certificate above or clear search filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cert) => (
            <Card key={cert.id} className="p-5 border-line-2 bg-paper hover:border-line-2 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink font-semibold">{cert.id}</span>
                    <Pill tone="green">ML-DSA-65</Pill>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-ink">{cert.recipientName}</h3>
                  <div className="text-xs text-mute">{cert.certificateType}</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded bg-hov text-ink">
                  <Award className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-line-2 pt-3 text-mute">
                <div><span className="text-faint">Institution:</span> <span className="text-body truncate block">{cert.institution}</span></div>
                <div><span className="text-faint">Student ID:</span> <span className="text-body block">{cert.recipientId}</span></div>
                <div><span className="text-faint">Issue Date:</span> <span className="text-body block">{cert.issueDate}</span></div>
                <div><span className="text-faint">Ledger Block:</span> <span className="text-body block">#{cert.blockIndex}</span></div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line-2 pt-3">
                <span className="font-mono text-[10px] text-faint truncate max-w-[200px]">
                  Hash: {cert.dataHash.slice(0, 18)}…
                </span>
                <Link
                  to={`/app/verify/${cert.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-ink"
                >
                  Verify Live <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
