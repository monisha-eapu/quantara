import { ArrowRight, ArrowDown, CheckCircle2, Clock, Gauge, KeyRound, Layers, Repeat2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { CheckList, VerdictBanner } from "../components/Verification";
import { Button, Card, cx, Empty, ErrorState, InlineError, Loading, PageHeader, Pill, StatusBadge } from "../components/ui";
import { api, type EntityVerification, type RecordSummary } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";

interface Overview { candidates: RecordSummary[]; migrated: (RecordSummary & { legacyAlgorithm: string })[]; counts: { pqcRecords: number; legacyRecords: number; hybridRecords: number } }
interface SchemeResult { algorithm: string; displayName: string; family: string; standard: string; securityNote: string; signer: string; publicKeyBytes: number; signatureBytes: number; signaturePreview: string; verified: boolean; signMs: number; verifyMs: number; keygenMs: number }
interface Comparison { recordId: string; message: string; iterations: number; legacy: SchemeResult; pqc: SchemeResult }

export default function Migration() {
  const overview = useApi(() => api.get<Overview>("/migration"));
  const [selected, setSelected] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [migration, setMigration] = useState<{ before: EntityVerification; after: EntityVerification; signatureBytes: number } | null>(null);
  const recent = useApi(() => api.get<{ records: RecordSummary[] }>("/records?type=LAND_RECORD&featuredFirst=true&limit=5"));

  const compare = useAction(async (id: string) => { setSelected(id); setMigration(null); setComparison(await api.post<Comparison>(`/migration/${id}/compare`)); });
  const migrate = useAction(async (id: string) => { setSelected(id); setMigration(await api.post(`/migration/${id}/migrate`)); await overview.reload(); });

  return (
    <div>
      <PageHeader eyebrow="Crypto-agility" title="Post-Quantum Migration" description="Long-lived records signed today with RSA or ECC must stay trustworthy for decades, beyond the point where a large fault-tolerant quantum computer might exist. QuantumShield shows a concrete migration path: verify the legacy signature, re-sign with ML-DSA, keep the classical signature as a co-signature, and anchor the change on the ledger." />

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="glass glow-amber rounded-2xl p-5">
          <div className="label text-amber-300">Legacy</div>
          <div className="mt-2 text-xl font-semibold text-white">RSA / ECC (ECDSA)</div>
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-200/90"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> Potentially vulnerable to future quantum attacks (Shor's algorithm)</div>
          <div className="mt-3 text-xs text-slate-400">Small keys and signatures, very fast, widely deployed.</div>
        </div>
        <div className="hidden items-center justify-center text-slate-500 lg:flex"><ArrowRight className="h-6 w-6" /></div>
        <div className="flex justify-center lg:hidden"><ArrowDown className="h-5 w-5 text-slate-500" /></div>
        <div className="glass rounded-2xl p-5">
          <div className="label text-brand-300">Migration</div>
          <div className="mt-2 text-xl font-semibold text-white">Hybrid re-signing</div>
          <ol className="mt-3 space-y-1.5 text-sm text-slate-300">
            <li>1. Verify existing classical signature</li>
            <li>2. Sign the same content hash with ML-DSA</li>
            <li>3. Retain the classical co-signature</li>
            <li>4. Anchor a MIGRATE block on the ledger</li>
          </ol>
        </div>
        <div className="hidden items-center justify-center text-slate-500 lg:flex"><ArrowRight className="h-6 w-6" /></div>
        <div className="flex justify-center lg:hidden"><ArrowDown className="h-5 w-5 text-slate-500" /></div>
        <div className="glass glow-blue rounded-2xl p-5">
          <div className="label text-brand-300">Post-quantum</div>
          <div className="mt-2 text-xl font-semibold text-white">ML-DSA-65 (FIPS 204)</div>
          <div className="mt-3 flex items-start gap-2 text-sm text-emerald-200/90"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Designed for the post-quantum era</div>
          <div className="mt-3 text-xs text-slate-400">Lattice-based. Larger keys and signatures; no known efficient quantum attack.</div>
        </div>
      </div>

      {overview.data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[["ML-DSA-protected entities", overview.data.counts.pqcRecords, "text-brand-300"], ["Legacy-signed records", overview.data.counts.legacyRecords, "text-amber-300"], ["Hybrid (migrated) records", overview.data.counts.hybridRecords, "text-emerald-300"]].map(([l, v, c]) => (
            <div key={l as string} className="glass rounded-xl p-4"><div className="label">{l}</div><div className={cx("mt-1 text-2xl font-semibold tabular-nums", c as string)}>{(v as number).toLocaleString()}</div></div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Legacy-signed records" subtitle="Signed by the 2019 digitisation system with ECDSA P-256" icon={<KeyRound className="h-4 w-4 text-amber-400" />} bodyClass="p-0">
            {overview.loading && !overview.data ? <Loading /> : overview.error ? <div className="p-4"><ErrorState error={overview.error} onRetry={overview.reload} /></div> : !overview.data?.candidates.length ? (
              <Empty icon={<CheckCircle2 className="h-8 w-8 text-emerald-400" />} title="All records migrated" description="Every record is now protected by ML-DSA. Reset demo data in Cryptography settings to replay the migration." />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {overview.data.candidates.map((r) => (
                  <li key={r.id} className={cx("px-5 py-3.5", selected === r.id && "bg-brand-500/[0.06]")}>
                    <div className="flex items-center justify-between gap-2"><Link to={`/records/${r.id}`} className="font-mono text-xs font-semibold text-white hover:underline">{r.id}</Link><StatusBadge status={r.integrityStatus} /></div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">{r.title}</div>
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" onClick={() => compare.run(r.id)} loading={compare.pending && selected === r.id} icon={<Gauge className="h-3.5 w-3.5" />}>Compare</Button>
                      <Button size="sm" variant="primary" onClick={() => migrate.run(r.id)} loading={migrate.pending && selected === r.id} icon={<Repeat2 className="h-3.5 w-3.5" />}>Migrate to ML-DSA</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Compare on an ML-DSA record" bodyClass="p-0">
            <ul className="divide-y divide-white/[0.05]">
              {recent.data?.records.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <span className="truncate font-mono text-xs text-slate-200">{r.id}</span>
                  <Button size="sm" variant="ghost" onClick={() => compare.run(r.id)} loading={compare.pending && selected === r.id}>Compare</Button>
                </li>
              ))}
            </ul>
          </Card>
          {overview.data && overview.data.migrated.length > 0 && (
            <Card title="Migrated (hybrid)" bodyClass="p-0">
              <ul className="divide-y divide-white/[0.05]">
                {overview.data.migrated.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-xs">
                    <Link to={`/records/${r.id}`} className="font-mono text-slate-200 hover:underline">{r.id}</Link>
                    <span className="text-slate-400">{r.legacyAlgorithm} → <span className="text-brand-300">{r.algorithm}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <InlineError error={compare.error ?? migrate.error} />
          {migration ? (
            <Card title={`Migration complete · ${migration.after.entityId}`} subtitle={`New ML-DSA-65 signature (${migration.signatureBytes.toLocaleString()} bytes) anchored in block #${migration.after.block?.index}`} icon={<Layers className="h-4 w-4" />}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div><div className="label mb-2">Before</div><Pill tone="amber">{migration.before.algorithm}</Pill><div className="mt-3"><CheckList report={migration.before} compact /></div></div>
                <div><div className="label mb-2">After</div><Pill tone="blue">{migration.after.algorithm} + legacy co-signature</Pill><div className="mt-3"><CheckList report={migration.after} compact /></div></div>
              </div>
              <div className="mt-4"><VerdictBanner report={migration.after} /></div>
            </Card>
          ) : comparison ? (
            <Card title={`Live signing comparison · ${comparison.recordId}`} subtitle={`Both algorithms sign the record's real signing message; timings averaged over ${comparison.iterations} runs on this server`} icon={<Gauge className="h-4 w-4" />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left"><th className="label py-2 pr-4" /><th className="label py-2 pr-4 text-amber-300">Legacy</th><th className="label py-2 text-brand-300">Post-quantum</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {([
                      ["Algorithm", (s: SchemeResult) => <span className="font-semibold text-white">{s.displayName}</span>],
                      ["Standard", (s: SchemeResult) => <span className="text-xs text-slate-400">{s.standard}</span>],
                      ["Quantum outlook", (s: SchemeResult) => s.family === "POST_QUANTUM" ? <span className="text-emerald-300">✓ Designed for the post-quantum era</span> : <span className="text-amber-300">⚠ Vulnerable to a large-scale quantum computer</span>],
                      ["Public key size", (s: SchemeResult) => `${s.publicKeyBytes.toLocaleString()} bytes`],
                      ["Signature size", (s: SchemeResult) => `${s.signatureBytes.toLocaleString()} bytes`],
                      ["Sign time", (s: SchemeResult) => `${s.signMs} ms`],
                      ["Verify time", (s: SchemeResult) => `${s.verifyMs} ms`],
                      ["Key generation", (s: SchemeResult) => `${s.keygenMs} ms`],
                      ["Signature verifies", (s: SchemeResult) => s.verified ? <span className="text-emerald-300">✓ Valid</span> : <span className="text-red-300">✗ Invalid</span>],
                    ] as const).map(([label, render]) => (
                      <tr key={label}><td className="py-2.5 pr-4 text-xs text-slate-400">{label}</td><td className="py-2.5 pr-4 text-slate-200">{render(comparison.legacy)}</td><td className="py-2.5 text-slate-200">{render(comparison.pqc)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-ink-950/60 p-3"><div className="label mb-1">ECDSA signature (base64)</div><code className="break-all font-mono text-[10.5px] text-amber-200/80">{comparison.legacy.signaturePreview}…</code></div>
                <div className="rounded-lg bg-ink-950/60 p-3"><div className="label mb-1">ML-DSA-65 signature (first 88 of {Math.ceil(comparison.pqc.signatureBytes / 3) * 4} chars)</div><code className="break-all font-mono text-[10.5px] text-cyan-200/80">{comparison.pqc.signaturePreview}…</code></div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-400">Trade-off: ML-DSA signatures are roughly {Math.round(comparison.pqc.signatureBytes / comparison.legacy.signatureBytes)}× larger than ECDSA, but signing and verification stay in the sub-millisecond range, which is negligible for registry workloads.</p>
            </Card>
          ) : (
            <Card bodyClass="p-0"><Empty icon={<Repeat2 className="h-9 w-9 text-brand-400" />} title="Select a record" description="Compare runs a live classical vs. ML-DSA signing benchmark on the record. Migrate performs a real, ledger-anchored hybrid re-signing of a legacy record." /></Card>
          )}

          <Card title="Migration timeline context" icon={<Clock className="h-4 w-4" />}>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3"><Pill tone="blue">Aug 2024</Pill><span className="text-slate-300">NIST publishes FIPS 204 (ML-DSA), FIPS 203 (ML-KEM) and FIPS 205 (SLH-DSA).</span></li>
              <li className="flex gap-3"><Pill tone="amber">2030 / 2035</Pill><span className="text-slate-300">NIST IR 8547 (initial public draft) proposes deprecating quantum-vulnerable RSA/ECC after 2030 and disallowing them after 2035.</span></li>
              <li className="flex gap-3"><Pill tone="slate">Decades</Pill><span className="text-slate-300">Typical lifetime of land titles and regulated provenance records. Signatures must remain trustworthy for that whole period.</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
