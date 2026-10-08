import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import { Button, Section, ErrorState, Hash, InlineError, KV, Loading, Modal, PageHeader, Pill } from "../components/ui";
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
      <PageHeader title="Cryptography & configuration" description="What protects each record, which keys exist, and the limits of this prototype." actions={<Button variant="danger" onClick={() => setConfirm(true)} icon={<RefreshCcw className="h-4 w-4" />}>Reset demo data</Button>} />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-3">
        <Section title="Signature algorithms" className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            {data.schemes.map((s) => (
              <div key={s.id} className={s.family === "POST_QUANTUM" ? "rounded-lg border border-brand-500/40 bg-brand-500/[0.05] p-4" : "rounded-lg border border-ink-700 p-4"}>
                <div className="flex items-center justify-between"><span className="text-base font-semibold text-white">{s.displayName}</span><Pill tone={s.family === "POST_QUANTUM" ? "blue" : "amber"}>{s.family === "POST_QUANTUM" ? "Post-quantum" : "Classical · legacy only"}</Pill></div>
                <div className="mt-2 text-xs text-slate-300">{s.standard}</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.securityNote}</p>
                {s.id === data.defaultAlgorithm && <div className="mt-3"><Pill tone="green">Default for all new signatures</Pill></div>}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Runtime">
          <div className="space-y-4">
            <KV label="Implementation">Node.js <span className="font-mono">{data.runtime.node}</span> crypto, backed by OpenSSL <span className="font-mono">{data.runtime.openssl}</span> (native ML-DSA provider)</KV>
            <KV label="Content hash">{data.hashing.algorithm}</KV>
            <KV label="Canonicalisation">{data.hashing.canonicalization}</KV>
            <KV label="Signed message" mono>{data.hashing.signingMessage}</KV>
          </div>
        </Section>
      </div>

      <Section title="Signer registry" description="Public keys only. Private keys never leave the server and are never sent to the browser." className="mt-12">
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th">Signer</th><th className="th">Role</th><th className="th">Algorithm</th><th className="th">Public key</th><th className="th">SPKI fingerprint (SHA-256)</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-ink-800">
              {data.signers.map((s) => (
                <tr key={s.id}>
                  <td className="td"><div className="font-medium text-white">{s.name}</div><div className="text-[11px] text-slate-500">{s.organization}</div></td>
                  <td className="td font-mono text-[11px] text-slate-300">{s.role}</td>
                  <td className="px-3 py-3"><Pill tone={s.algorithm.startsWith("ML-DSA") ? "blue" : "amber"}>{s.algorithm}</Pill></td>
                  <td className="td text-xs text-slate-300">{s.publicKeyBytes.toLocaleString()} bytes</td>
                  <td className="px-3 py-3"><Hash value={s.fingerprint} n={8} /></td>
                  <td className="td text-right"><Button size="sm" variant="ghost" onClick={() => setPem(s)}>View PEM</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section title="Key custody"><p className="text-sm leading-relaxed text-slate-300">{data.keyCustody}</p></Section>
        <Section title="Prototype limitations">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Single-node ledger: no distributed consensus or replication.</li>
            <li>No user authentication or role-based access control.</li>
            <li>Keys stored as files, not in an HSM or KMS; no rotation or revocation.</li>
            <li>No trusted timestamping authority; timestamps come from the server clock.</li>
            <li>Not independently security-reviewed. All data is fictional.</li>
          </ul>
        </Section>
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
