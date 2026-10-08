import { FileSearch, ScanSearch, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChangedFields, CheckList, HashComparison, VerdictBanner } from "../components/Verification";
import { Button, Empty, InlineError, PageHeader, Pill, Section } from "../components/ui";
import { api, type EntityVerification, type RecordSummary } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";

interface ProductVerification { verdict: "AUTHENTIC" | "TAMPERED"; product: EntityVerification; events: EntityVerification[] }

export default function Verify() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(routeId ?? "");
  const quick = useApi(() => api.get<{ records: RecordSummary[] }>("/records?limit=6&featuredFirst=true"));
  const alerts = useApi(() => api.get<{ records: RecordSummary[] }>("/records?status=TAMPERED&limit=4"));
  const [result, setResult] = useState<{ kind: "record"; report: EntityVerification } | { kind: "product"; report: ProductVerification } | null>(null);

  const verify = useAction(async (raw: string) => {
    const lookup = await api.get<{ id: string; recordType: string }>(`/lookup/${encodeURIComponent(raw.trim())}`);
    if (lookup.recordType === "SUPPLY_PRODUCT") {
      setResult({ kind: "product", report: await api.post<ProductVerification>(`/supply-chain/products/${lookup.id}/verify`) });
    } else {
      setResult({ kind: "record", report: await api.post<EntityVerification>(`/records/${lookup.id}/verify`) });
    }
    if (routeId !== lookup.id) navigate(`/verify/${lookup.id}`, { replace: true });
    setInput(lookup.id);
  });

  useEffect(() => { if (routeId) verify.run(routeId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => { setInput(id); verify.run(id); };

  return (
    <div>
      <PageHeader title="Verification" description="Independent verification from first principles: recompute the SHA-256 fingerprint, verify the ML-DSA-65 signature with the signer's registered public key, confirm the ledger anchor and walk the hash chain." />
      <div>
        <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); if (input.trim()) verify.run(input); }}>
          <div className="relative min-w-[240px] flex-1">
            <FileSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input py-3 pl-10 font-mono text-base" placeholder="Record ID, e.g. LAND-AP-VZM-10293 or PHARMA-BT-9921" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" size="lg" loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>Verify</Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Quick select:</span>
          {quick.data?.records.map((r) => <button key={r.id} onClick={() => pick(r.id)} className="rounded border border-ink-700 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-slate-500 hover:text-white">{r.id}</button>)}
          <button onClick={() => pick("PHARMA-BT-9921")} className="rounded border border-ink-700 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-slate-500 hover:text-white">PHARMA-BT-9921</button>
          {alerts.data?.records.map((r) => <button key={r.id} onClick={() => pick(r.id)} className="rounded border border-red-500/40 px-2 py-1 font-mono text-[11px] text-red-300 hover:border-red-400">{r.id}</button>)}
        </div>
        {verify.error && <div className="mt-4"><InlineError error={verify.error} /></div>}
      </div>

      <div className="mt-6">
        {verify.pending && !result ? (
          <div className="scanline rounded-lg border border-ink-700 py-14 text-center text-sm text-slate-400" role="status">Recomputing hashes and verifying ML-DSA signatures…</div>
        ) : !result ? (
          <div className="rounded-lg border border-ink-700"><Empty icon={<ScanSearch className="h-7 w-7" />} title="Select or enter a record to verify" description="Land records, products (verifies the full provenance chain) and legacy-signed records are supported." /></div>
        ) : result.kind === "record" ? (
          <div className="space-y-4">
            <VerdictBanner report={result.report} />
            <div className="grid gap-4 lg:grid-cols-2">
              <CheckList report={result.report} />
              <div className="space-y-4">
                <HashComparison report={result.report} />
                {result.report.changedFields && <ChangedFields fields={result.report.changedFields} />}
                <Link to={`/records/${result.report.entityId}`} className="inline-block text-sm text-brand-400 hover:underline">Open record {result.report.entityId} →</Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <VerdictBanner report={{ ...result.report.product, verdict: result.report.verdict, checks: [...result.report.product.checks, ...result.report.events.flatMap((e) => e.checks.filter((c) => c.status === "fail").map((c) => ({ ...c, label: `${e.entityId} · ${c.label}` })))] }} />
            <Section title="Provenance chain verification" description={`${result.report.events.length} events · each ML-DSA signature and hash link checked`} actions={<Link to={`/supply-chain/${result.report.product.entityId}`} className="text-xs text-brand-400 hover:underline">Open product</Link>}>
              <div className="space-y-2">
                {[result.report.product, ...result.report.events].map((e) => (
                  <div key={e.entityId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-ink-900/50 px-3 py-2">
                    <span className="font-mono text-xs text-white">{e.entityId}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {e.checks.map((c) => <Pill key={c.id} tone={c.status === "pass" ? "green" : c.status === "warn" ? "amber" : "red"}>{c.status === "pass" ? "✓" : "✗"} {c.label}</Pill>)}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
