import { ArrowRight, Gauge, Repeat2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { CheckList, VerdictBanner } from "../components/Verification";
import { Button, cx, Empty, ErrorState, InlineError, Loading, PageHeader, Pill, Section, StatusBadge } from "../components/ui";
import { api, type EntityVerification, type RecordSummary } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";

interface Overview { candidates: RecordSummary[]; migrated: (RecordSummary & { legacyAlgorithm: string })[]; counts: { pqcRecords: number; legacyRecords: number; hybridRecords: number } }
interface SchemeResult { algorithm: string; displayName: string; family: string; standard: string; publicKeyBytes: number; signatureBytes: number; signaturePreview: string; verified: boolean; signMs: number; verifyMs: number; keygenMs: number }
interface Comparison { recordId: string; iterations: number; legacy: SchemeResult; pqc: SchemeResult }

const FLOW = [
  { n: "1", title: "Traditional cryptography", main: "RSA / ECC", body: "Widely deployed signatures. Secure against today's computers." },
  { n: "2", title: "Potential future quantum threat", main: "Shor's algorithm", body: "A large fault-tolerant quantum computer could forge these signatures. No such machine exists today." },
  { n: "3", title: "Post-quantum cryptography", main: "ML-DSA (FIPS 204)", body: "Lattice-based signatures designed to resist both classical and quantum attacks." },
  { n: "4", title: "Quantum-ready migration", main: "Hybrid re-signing", body: "Verify the legacy signature, re-sign with ML-DSA, keep the old one as a co-signature, record it on the ledger." },
];

export default function Migration() {
  const overview = useApi(() => api.get<Overview>("/migration"));
  const recent = useApi(() => api.get<{ records: RecordSummary[] }>("/records?type=LAND_RECORD&featuredFirst=true&limit=4"));
  const [selected, setSelected] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [migration, setMigration] = useState<{ before: EntityVerification; after: EntityVerification; signatureBytes: number } | null>(null);

  const compare = useAction(async (id: string) => { setSelected(id); setMigration(null); setComparison(await api.post<Comparison>(`/migration/${id}/compare`)); });
  const migrate = useAction(async (id: string) => { setSelected(id); setMigration(await api.post(`/migration/${id}/migrate`)); await overview.reload(); });
  const c = overview.data?.counts;

  return (
    <div>
      <PageHeader title="Post-Quantum Migration" description="Records signed today with RSA or ECC must stay trustworthy for decades. This shows how a legacy record moves to ML-DSA without losing its history." />

      <ol className="grid divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {FLOW.map((s, i) => (
          <li key={s.n} className="relative px-5 py-5">
            <div className="text-[11px] font-medium text-slate-500">{s.n}. {s.title}</div>
            <div className={cx("mt-1.5 text-[19px] font-semibold tracking-[-0.01em]", i === 1 ? "text-amber-300" : i >= 2 ? "text-white" : "text-slate-200")}>{s.main}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{s.body}</p>
            {i < FLOW.length - 1 && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-ink-900 p-0.5 text-slate-500 lg:block" aria-hidden />}
          </li>
        ))}
      </ol>

      {c && (
        <dl className="mt-8 grid grid-cols-3 divide-x divide-ink-700 border-y border-ink-700">
          {[["Protected with ML-DSA", c.pqcRecords], ["Legacy-signed", c.legacyRecords], ["Migrated (hybrid)", c.hybridRecords]].map(([l, v]) => (
            <div key={l as string} className="px-5 py-4"><dd className="text-[26px] font-bold tabular-nums tracking-[-0.02em] text-white">{(v as number).toLocaleString()}</dd><dt className="text-[13px] text-slate-400">{l}</dt></div>
          ))}
        </dl>
      )}

      <div className="mt-12 grid gap-x-12 gap-y-10 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-10">
          <Section title="Legacy-signed records" description="Signed by the 2019 digitisation system with ECDSA P-256.">
            {overview.loading && !overview.data ? <Loading /> : overview.error ? <ErrorState error={overview.error} onRetry={overview.reload} /> : !overview.data?.candidates.length ? (
              <Empty title="All records migrated" description="Every record is now protected by ML-DSA. Reset the demo data in Settings to replay the migration." />
            ) : (
              <ul className="divide-y divide-ink-800 border-y border-ink-800">
                {overview.data.candidates.map((r) => (
                  <li key={r.id} className={cx("px-1 py-3.5", selected === r.id && "bg-ink-900")}>
                    <div className="flex items-center justify-between gap-2"><Link to={`/records/${r.id}`} className="font-mono text-[12px] font-medium text-white hover:underline">{r.id}</Link><StatusBadge status={r.integrityStatus} /></div>
                    <div className="mt-0.5 truncate text-[13px] text-slate-400">{r.title}</div>
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" onClick={() => compare.run(r.id)} loading={compare.pending && selected === r.id} icon={<Gauge className="h-3.5 w-3.5" />}>Compare</Button>
                      <Button size="sm" variant="primary" onClick={() => migrate.run(r.id)} loading={migrate.pending && selected === r.id} icon={<Repeat2 className="h-3.5 w-3.5" />}>Migrate to ML-DSA</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Compare on an ML-DSA record">
            <ul className="divide-y divide-ink-800 border-y border-ink-800">
              {recent.data?.records.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-1 py-2">
                  <span className="truncate font-mono text-[12px] text-slate-300">{r.id}</span>
                  <Button size="sm" variant="ghost" onClick={() => compare.run(r.id)} loading={compare.pending && selected === r.id}>Compare</Button>
                </li>
              ))}
            </ul>
          </Section>
          {overview.data && overview.data.migrated.length > 0 && (
            <Section title="Migrated records">
              <ul className="divide-y divide-ink-800 border-y border-ink-800">
                {overview.data.migrated.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-1 py-2 text-[12px]">
                    <Link to={`/records/${r.id}`} className="font-mono text-slate-200 hover:underline">{r.id}</Link>
                    <span className="text-slate-500">{r.legacyAlgorithm} → <span className="text-slate-200">{r.algorithm}</span></span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-10">
          <InlineError error={compare.error ?? migrate.error} />
          {migration ? (
            <Section title={`Migration complete: ${migration.after.entityId}`} description={`New ML-DSA-65 signature (${migration.signatureBytes.toLocaleString()} bytes) anchored in ledger block #${migration.after.block?.index}.`}>
              <div className="grid gap-6 lg:grid-cols-2">
                <div><div className="mb-2 flex items-center gap-2"><span className="label">Before</span><Pill tone="amber">{migration.before.algorithm}</Pill></div><CheckList report={migration.before} compact /></div>
                <div><div className="mb-2 flex items-center gap-2"><span className="label">After</span><Pill tone="blue">{migration.after.algorithm} + legacy co-signature</Pill></div><CheckList report={migration.after} compact /></div>
              </div>
              <div className="mt-5"><VerdictBanner report={migration.after} /></div>
            </Section>
          ) : comparison ? (
            <Section title={`Signing comparison: ${comparison.recordId}`} description={`Both algorithms sign this record's real signing message. Timings are averaged over ${comparison.iterations} runs on this server.`}>
              <div className="overflow-x-auto rounded-lg border border-ink-700">
                <table className="w-full text-[13px]">
                  <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th" /><th className="th">Legacy</th><th className="th">Post-quantum</th></tr></thead>
                  <tbody className="divide-y divide-ink-800">
                    {([
                      ["Algorithm", (s: SchemeResult) => <span className="font-semibold text-white">{s.displayName}</span>],
                      ["Standard", (s: SchemeResult) => <span className="text-xs text-slate-400">{s.standard}</span>],
                      ["Quantum outlook", (s: SchemeResult) => s.family === "POST_QUANTUM" ? <span className="text-emerald-300">Designed for the post-quantum era</span> : <span className="text-amber-300">Vulnerable to a large-scale quantum computer</span>],
                      ["Public key size", (s: SchemeResult) => `${s.publicKeyBytes.toLocaleString()} bytes`],
                      ["Signature size", (s: SchemeResult) => `${s.signatureBytes.toLocaleString()} bytes`],
                      ["Sign time", (s: SchemeResult) => `${s.signMs} ms`],
                      ["Verify time", (s: SchemeResult) => `${s.verifyMs} ms`],
                      ["Key generation", (s: SchemeResult) => `${s.keygenMs} ms`],
                      ["Signature verifies", (s: SchemeResult) => s.verified ? <span className="text-emerald-300">Valid</span> : <span className="text-red-300">Invalid</span>],
                    ] as const).map(([label, render]) => (
                      <tr key={label}><td className="td text-slate-500">{label}</td><td className="td text-slate-200">{render(comparison.legacy)}</td><td className="td text-slate-200">{render(comparison.pqc)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-slate-400">ML-DSA signatures are about {Math.round(comparison.pqc.signatureBytes / comparison.legacy.signatureBytes)}× larger than ECDSA. Signing and verification stay well under a millisecond, which is negligible for registry workloads.</p>
            </Section>
          ) : (
            <Section title="Signing comparison"><Empty title="Select a record" description="Compare runs a live classical versus ML-DSA signing benchmark. Migrate performs a real, ledger-anchored hybrid re-signing of a legacy record." /></Section>
          )}

          <Section title="Why now">
            <dl className="divide-y divide-ink-800 border-y border-ink-800 text-[13px]">
              <div className="grid grid-cols-[110px_1fr] gap-4 py-3"><dt className="font-medium text-slate-200">Aug 2024</dt><dd className="text-slate-400">NIST published FIPS 203 (ML-KEM), FIPS 204 (ML-DSA) and FIPS 205 (SLH-DSA).</dd></div>
              <div className="grid grid-cols-[110px_1fr] gap-4 py-3"><dt className="font-medium text-slate-200">2030 / 2035</dt><dd className="text-slate-400">NIST IR 8547 (initial public draft) proposes deprecating quantum-vulnerable RSA and ECC after 2030 and disallowing them after 2035.</dd></div>
              <div className="grid grid-cols-[110px_1fr] gap-4 py-3"><dt className="font-medium text-slate-200">Decades</dt><dd className="text-slate-400">Typical lifetime of land titles and regulated provenance records. Signatures must stay trustworthy for that whole period.</dd></div>
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
