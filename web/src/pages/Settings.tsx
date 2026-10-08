import { Cpu, Fingerprint, Hash as HashIcon, KeyRound, RefreshCcw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button, Card, ErrorState, Hash, InlineError, KV, Loading, Modal, PageHeader, Pill } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface CryptoInfo {
  defaultAlgorithm: string;
  runtime: { node: string; openssl: string };
  schemes: { id: string; displayName: string; family: string; standard: string; securityNote: string }[];
  signers: { id: string; name: string; role: string; organization: string; algorithm: string; fingerprint: string; createdAt: string; publicKeyPem: string; publicKeyBytes: number }[];
  hashing: { algorithm: string; canonicalization: string; signingMessage: string };
  keyCustody: string;
}

export default function Settings() {
  const { data, error, loading, reload } = useApi(() => api.get<CryptoInfo>("/crypto"));
  const [pem, setPem] = useState<CryptoInfo["signers"][number] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const reset = useAction(async () => { await api.post("/admin/reset"); setConfirm(false); window.location.assign("/"); });

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error("No data")} onRetry={reload} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Cryptography & configuration" description="What protects each record, which keys exist, and the limits of this prototype." actions={<Button variant="danger" onClick={() => setConfirm(true)} icon={<RefreshCcw className="h-4 w-4" />}>Reset demo data</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Signature algorithms" icon={<KeyRound className="h-4 w-4" />} className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            {data.schemes.map((s) => (
              <div key={s.id} className={s.family === "POST_QUANTUM" ? "rounded-xl border border-brand-500/30 bg-brand-500/[0.06] p-4" : "rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4"}>
                <div className="flex items-center justify-between"><span className="text-base font-semibold text-white">{s.displayName}</span><Pill tone={s.family === "POST_QUANTUM" ? "blue" : "amber"}>{s.family === "POST_QUANTUM" ? "Post-quantum" : "Classical · legacy only"}</Pill></div>
                <div className="mt-2 text-xs text-slate-300">{s.standard}</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.securityNote}</p>
                {s.id === data.defaultAlgorithm && <div className="mt-3"><Pill tone="green">Default for all new signatures</Pill></div>}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Runtime" icon={<Cpu className="h-4 w-4" />}>
          <div className="space-y-4">
            <KV label="Implementation">Node.js <span className="font-mono">{data.runtime.node}</span> crypto, backed by OpenSSL <span className="font-mono">{data.runtime.openssl}</span> (native ML-DSA provider)</KV>
            <KV label="Content hash"><span className="flex items-center gap-1.5"><HashIcon className="h-3.5 w-3.5 text-slate-500" />{data.hashing.algorithm}</span></KV>
            <KV label="Canonicalisation">{data.hashing.canonicalization}</KV>
            <KV label="Signed message" mono>{data.hashing.signingMessage}</KV>
          </div>
        </Card>
      </div>

      <Card title="Signer registry" subtitle="Public keys only. Private keys never leave the server and are never sent to the browser." className="mt-6" icon={<Fingerprint className="h-4 w-4" />} bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="label px-5 py-3">Signer</th><th className="label px-3 py-3">Role</th><th className="label px-3 py-3">Algorithm</th><th className="label px-3 py-3">Public key</th><th className="label px-3 py-3">SPKI fingerprint (SHA-256)</th><th className="px-5 py-3" /></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {data.signers.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3"><div className="font-medium text-white">{s.name}</div><div className="text-[11px] text-slate-500">{s.organization}</div></td>
                  <td className="px-3 py-3 font-mono text-[11px] text-slate-300">{s.role}</td>
                  <td className="px-3 py-3"><Pill tone={s.algorithm.startsWith("ML-DSA") ? "blue" : "amber"}>{s.algorithm}</Pill></td>
                  <td className="px-3 py-3 text-xs text-slate-300">{s.publicKeyBytes.toLocaleString()} bytes</td>
                  <td className="px-3 py-3"><Hash value={s.fingerprint} n={8} /></td>
                  <td className="px-5 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setPem(s)}>View PEM</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Key custody" icon={<KeyRound className="h-4 w-4" />}><p className="text-sm leading-relaxed text-slate-300">{data.keyCustody}</p></Card>
        <Card title="Prototype limitations" icon={<ShieldAlert className="h-4 w-4 text-amber-400" />}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Single-node ledger: no distributed consensus or replication.</li>
            <li>No user authentication or role-based access control.</li>
            <li>Keys stored as files, not in an HSM or KMS; no rotation or revocation.</li>
            <li>No trusted timestamping authority; timestamps come from the server clock.</li>
            <li>Not independently security-reviewed. All data is fictional.</li>
          </ul>
        </Card>
      </div>

      <Modal open={!!pem} onClose={() => setPem(null)} title={`${pem?.name} · public key`} wide>
        {pem && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">{pem.algorithm} · registered {formatDateTime(pem.createdAt)}</div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-ink-950/70 p-3 font-mono text-[10.5px] text-slate-300">{pem.publicKeyPem}</pre>
          </div>
        )}
      </Modal>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" tone="red">
        <p className="text-sm text-slate-300">Deletes all records, ledger blocks and audit entries, then re-seeds the fictional dataset (2,481 signed entities). Signer keys are kept. This takes a few seconds.</p>
        <InlineError error={reset.error} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" loading={reset.pending} onClick={() => reset.run()}>Reset &amp; re-seed</Button></div>
      </Modal>
    </div>
  );
}
