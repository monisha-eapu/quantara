import { Btn, cx, ErrorState, InlineError, Loading, PageTitle, SectionHead, Status, TableCard, theadCls, rowCls, type Tone } from "../components/ui";
import { api, type RecordSummary } from "../lib/api";
import { useNavigate } from "react-router";
import { useAction, useApi } from "../lib/hooks";
import { useState } from "react";

interface Overview { candidates: RecordSummary[]; migrated: (RecordSummary & { legacyAlgorithm: string })[]; counts: { pqcRecords: number; legacyRecords: number; hybridRecords: number } }

const SCHEMES: { name: string; std: string; prob: string; q: string; tone: Tone; role: string }[] = [
  { name: "RSA-2048", std: "PKCS #1", prob: "Integer factorisation", q: "Broken by Shor's algorithm", tone: "bad", role: "Legacy records only" },
  { name: "ECDSA P-256", std: "FIPS 186-5", prob: "Elliptic-curve discrete log", q: "Broken by Shor's algorithm", tone: "bad", role: "Legacy records only" },
  { name: "ML-DSA-65", std: "FIPS 204", prob: "Module lattices (MLWE/MSIS)", q: "No known quantum attack", tone: "ok", role: "Primary signature on records and blocks" },
  { name: "SLH-DSA-128s", std: "FIPS 205", prob: "Hash-function security", q: "No known quantum attack", tone: "ok", role: "Fallback, not yet enabled" },
  { name: "SHA-256", std: "FIPS 180-4", prob: "Preimage / collision resistance", q: "Grover reduces to ~128-bit", tone: "warn", role: "Fingerprints and hash chain" },
];
const algo = (a: string) => (a.startsWith("ECDSA") ? "ECDSA P-256" : a);

export default function PostQuantum() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<Overview>("/migration"));
  const [busy, setBusy] = useState<string | null>(null);
  const resign = useAction(async (id: string) => { setBusy(id); try { await api.post(`/migration/${id}/migrate`); await reload(); } finally { setBusy(null); } });

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Post-Quantum" sub="Which primitives the registry depends on, how each fares against a large quantum computer, and which records still need migrating." />
      <TableCard min={860}>
        <thead className={theadCls}><tr><th className="th">Primitive</th><th className="th">Standard</th><th className="th">Hard problem</th><th className="th">Quantum status</th><th className="th">Role here</th></tr></thead>
        <tbody>
          {SCHEMES.map((s) => (
            <tr key={s.name} className={rowCls}>
              <td className="td font-mono text-[13px] font-medium">{s.name}</td><td className="td text-mute">{s.std}</td><td className="td">{s.prob}</td>
              <td className="td"><Status tone={s.tone}>{s.q}</Status></td><td className="td text-body">{s.role}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] gap-10">
        <div className="flex flex-col">
          <SectionHead title="Size cost of ML-DSA-65" />
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-7 gap-y-3 py-4 text-[14px]">
            <span /><span className="eyebrow text-right text-faint">Public key</span><span className="eyebrow text-right text-faint">Signature</span>
            {[["ECDSA P-256", "64 B", "64 B", false], ["RSA-2048", "256 B", "256 B", false], ["ML-DSA-65", "1,952 B", "3,309 B", true]].map(([n, k, s, b]) => (
              <div key={n as string} className="contents"><span className={cx(b && "font-medium")}>{n}</span><span className={cx("text-right font-mono", b && "font-medium")}>{k}</span><span className={cx("text-right font-mono", b && "font-medium")}>{s}</span></div>
            ))}
          </div>
          <p className="m-0 border-t border-line-2 pt-3.5 text-[14px] leading-[1.7] text-body">Signatures are about 50 times larger than ECDSA. For registry records that are written once and read for decades, the storage cost is small next to the integrity gain.</p>
        </div>

        <div className="flex flex-col">
          <SectionHead title="Migration queue" sub="Records still carrying a classical signature" />
          <InlineError error={resign.error} />
          {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
            <>
              {data?.candidates.length === 0 && data.migrated.length === 0 && <p className="m-0 py-4 text-[14px] text-mute">No legacy-signed records.</p>}
              {data?.candidates.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 border-b border-line-2 py-3.5">
                  <div className="flex min-w-0 flex-col gap-[3px]"><button onClick={() => nav(`/app/records/${r.id}`)} className="w-fit cursor-pointer border-0 bg-transparent p-0 font-mono text-[13px] hover:underline">{r.id}</button><span className="truncate text-[13px] text-mute">{String((r.data as Record<string, unknown>).ownerName)} · {algo(r.algorithm)}</span></div>
                  <Btn variant="outline" size="sm" loading={busy === r.id} disabled={busy !== null} onClick={() => resign.run(r.id)}>Re-sign</Btn>
                </div>
              ))}
              {data?.migrated.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 border-b border-line-2 py-3.5">
                  <div className="flex min-w-0 flex-col gap-[3px]"><button onClick={() => nav(`/app/records/${r.id}`)} className="w-fit cursor-pointer border-0 bg-transparent p-0 font-mono text-[13px] hover:underline">{r.id}</button><span className="truncate text-[13px] text-mute">{String((r.data as Record<string, unknown>).ownerName)} · {algo(r.legacyAlgorithm)} → {r.algorithm}</span></div>
                  <span className="whitespace-nowrap text-[13px] text-ok">Re-signed · {r.algorithm}</span>
                </div>
              ))}
              {data && <p className="m-0 mt-4 text-[13px] leading-relaxed text-mute">Re-signing verifies the legacy signature first, signs the same fingerprint with ML-DSA-65, keeps the classical signature as a co-signature and appends a MIGRATE block to the ledger. {data.counts.pqcRecords.toLocaleString("en-US")} entities are already signed with ML-DSA.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
