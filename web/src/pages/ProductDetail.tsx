import { ArrowLeft, Blocks, FlaskConical, Link2, MapPin, Plus, RotateCcw, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { STAGE_META } from "../components/stages";
import { TamperDialog } from "../components/TamperDialog";
import { VerdictBanner } from "../components/Verification";
import { Button, Card, CheckIcon, cx, ErrorState, Field, Hash, InlineError, KV, Loading, PageHeader, Pill, StatusBadge } from "../components/ui";
import { api, type AuditEntry, type Block, type EntityVerification, type RecordSummary } from "../lib/api";
import { formatDateTime, humanize } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface EventDto {
  id: string;
  sequence: number;
  eventType: string;
  data: { actor: string; actorOrganization: string; custodian: string; location: string; status: string; timestamp: string; metadata: Record<string, string>; previousEventHash: string };
  dataHash: string;
  previousEventHash: string;
  signatureBytes: number;
  signaturePreview: string;
  algorithm: string;
  blockIndex: number;
  integrityStatus: string;
  demoTampered: boolean;
}
interface ProductDto {
  product: RecordSummary;
  signer: { name: string; organization: string };
  events: EventDto[];
  currentState: { custodian: string; location: string; status: string; updatedAt: string } | null;
  allowedNextEvents: string[];
  eventSigners: Record<string, string>;
  blocks: Block[];
  audit: AuditEntry[];
}
interface ProductVerification { verdict: "AUTHENTIC" | "TAMPERED"; product: EntityVerification; events: EntityVerification[]; verifiedAt: string }

export default function ProductDetail() {
  const { id = "" } = useParams();
  const { data, error, loading, reload, setData } = useApi(() => api.get<ProductDto>(`/supply-chain/products/${encodeURIComponent(id)}`), [id]);
  const [report, setReport] = useState<ProductVerification | null>(null);
  const [tampering, setTampering] = useState<EventDto | null>(null);

  const verify = useAction(async () => { setReport(await api.post<ProductVerification>(`/supply-chain/products/${encodeURIComponent(id)}/verify`)); await reload(); });
  const tamper = useAction(async (eventId: string, input: { field: string; value: string }) => {
    setData(await api.post<ProductDto>(`/supply-chain/events/${eventId}/tamper`, input));
    setTampering(null);
    setReport(null);
  });
  const restore = useAction(async (eventId: string) => { setData(await api.post<ProductDto>(`/supply-chain/events/${eventId}/restore`)); setReport(null); });

  if (loading && !data) return <Loading label="Loading provenance chain…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const p = data.product;
  const byId = new Map(report?.events.map((e) => [e.entityId, e]) ?? []);
  const anyTampered = data.events.some((e) => e.demoTampered);

  return (
    <div>
      <Link to="/supply-chain" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Supply Chain</Link>
      <PageHeader
        eyebrow={`${String(p.data.category)} · ${String(p.data.productId)}`}
        title={<span className="flex flex-wrap items-center gap-3">{String(p.data.productName)} <StatusBadge status={data.events.some((e) => e.integrityStatus === "TAMPERED") ? "TAMPERED" : p.integrityStatus} /></span>}
        description={<>Batch <span className="font-mono text-slate-200">{p.id}</span> · {String(p.data.manufacturer)} · Origin: {String(p.data.origin)} · {String(p.data.certification)}</>}
        actions={<Button variant="primary" size="lg" onClick={() => verify.run()} loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>VERIFY PROVENANCE CHAIN</Button>}
      />
      {(verify.error || restore.error) && <div className="mb-4"><InlineError error={verify.error ?? restore.error} /></div>}

      {report && (
        <div className="mb-6">
          <VerdictBanner report={{ ...report.product, verdict: report.verdict, checks: [...report.product.checks, ...report.events.flatMap((e) => e.checks.filter((c) => c.status === "fail").map((c) => ({ ...c, label: `Step ${e.entityId.slice(-2)} ${c.label}` })))] }} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Provenance chain" subtitle="Each step is signed by its accountable party and hash-linked to the previous step" icon={<Link2 className="h-4 w-4" />}>
          <ol className="relative">
            <li className="relative flex gap-4 pb-6">
              <div className="flex flex-col items-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-brand-400/40 bg-brand-500/15 text-brand-300"><Blocks className="h-4 w-4" /></div>
                <div className="mt-1 w-px flex-1 bg-gradient-to-b from-brand-400/50 to-brand-400/20" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-ink-900/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">Product registration (genesis of this chain)</div>
                  {report && <CheckIcon status={report.product.verdict === "TAMPERED" ? "fail" : "pass"} className="h-5 w-5" />}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <KV label="Hash"><Hash value={p.dataHash} n={6} /></KV>
                  <KV label="Signed by">{data.signer.name}</KV>
                  <KV label="Block">#{p.blockIndex}</KV>
                </div>
              </div>
            </li>
            {data.events.map((e, i) => {
              const v = byId.get(e.id);
              const failed = v?.verdict === "TAMPERED" || (!v && e.integrityStatus === "TAMPERED");
              const meta = STAGE_META[e.eventType] ?? { label: e.eventType, icon: null };
              return (
                <li key={e.id} className="fade-up relative flex gap-4 pb-6 last:pb-0" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex flex-col items-center">
                    <div className={cx("grid h-10 w-10 place-items-center rounded-xl border", failed ? "border-red-400/60 bg-red-500/20 text-red-300 glow-red" : "border-brand-400/40 bg-brand-500/15 text-brand-300")}>{meta.icon}</div>
                    {i < data.events.length - 1 && <div className={cx("mt-1 w-px flex-1", failed ? "bg-red-400/50" : "bg-brand-400/30")} />}
                  </div>
                  <div className={cx("min-w-0 flex-1 rounded-xl border p-4", failed ? "border-red-500/40 bg-red-500/[0.06]" : "border-white/[0.07] bg-ink-900/40")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2"><span className="text-[15px] font-semibold text-white">{meta.label}</span><span className="font-mono text-[11px] text-slate-500">{e.id}</span></div>
                        <div className="mt-0.5 text-xs text-slate-400">{formatDateTime(e.data.timestamp)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {v ? <Pill tone={v.verdict === "TAMPERED" ? "red" : "green"}>{v.verdict === "TAMPERED" ? "✗ INVALID" : "✓ VERIFIED"}</Pill> : <StatusBadge status={e.integrityStatus} />}
                        {e.demoTampered ? (
                          <Button size="sm" variant="success" onClick={() => restore.run(e.id)} loading={restore.pending} icon={<RotateCcw className="h-3.5 w-3.5" />}>Restore</Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200" onClick={() => { tamper.clearError(); setTampering(e); }} icon={<FlaskConical className="h-3.5 w-3.5" />}>Tamper</Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                      <KV label="Actor"><span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-500" />{e.data.actor}</span></KV>
                      <KV label="Location"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-500" />{e.data.location}</span></KV>
                      <KV label="Custodian">{e.data.custodian}</KV>
                    </div>
                    {Object.keys(e.data.metadata).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(e.data.metadata).map(([k, val]) => <Pill key={k} tone="slate"><span className="text-slate-500">{humanize(k)}:</span> {val}</Pill>)}
                      </div>
                    )}
                    <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2 lg:grid-cols-4">
                      <KV label="Event hash"><Hash value={e.dataHash} n={6} /></KV>
                      <KV label="Previous event"><Hash value={e.data.previousEventHash} n={6} /></KV>
                      <KV label="Signature"><span className="text-xs text-slate-300">{e.algorithm} · {e.signatureBytes.toLocaleString()} B</span></KV>
                      <KV label="Ledger block"><Link className="font-mono text-xs text-brand-300 hover:underline" to={`/ledger?block=${e.blockIndex}`}>#{e.blockIndex}</Link></KV>
                    </div>
                    {v && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {v.checks.map((c) => <Pill key={c.id} tone={c.status === "pass" ? "green" : c.status === "warn" ? "amber" : "red"}>{c.status === "pass" ? "✓" : "✗"} {c.label}</Pill>)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card title="Current state" subtitle="Derived from the latest signed event">
            {data.currentState ? (
              <div className="space-y-3">
                <KV label="Status"><span className="text-base font-semibold text-white">{data.currentState.status}</span></KV>
                <KV label="Current owner / custodian">{data.currentState.custodian}</KV>
                <KV label="Current location">{data.currentState.location}</KV>
                <KV label="Last updated">{formatDateTime(data.currentState.updatedAt)}</KV>
              </div>
            ) : <p className="text-sm text-slate-400">No events yet.</p>}
          </Card>
          <AddEventCard product={data} onAdded={async () => { setReport(null); await reload(); }} />
          {anyTampered && <p className="text-xs text-amber-300/80">A provenance step was altered (demo). Verify the chain to see which signatures and links fail, then restore it.</p>}
        </div>
      </div>

      {tampering && (
        <TamperDialog
          open
          onClose={() => setTampering(null)}
          data={tampering.data as unknown as Record<string, unknown>}
          fields={[...["custodian", "location", "status"], ...Object.keys(tampering.data.metadata).map((k) => `metadata.${k}`)]}
          defaultField={tampering.data.metadata.qcResult ? "metadata.qcResult" : "custodian"}
          suggest={(f, cur) => (f === "metadata.qcResult" ? (cur === "PASSED" ? "PASSED (re-test waived)" : "PASSED") : f === "custodian" ? "Unlicensed Trader (grey market)" : f === "location" ? "Unregistered depot, Kolkata" : "")}
          allowModes={false}
          onSubmit={(input) => tamper.run(tampering.id, { field: input.field, value: input.value })}
          pending={tamper.pending}
          error={tamper.error}
        />
      )}
    </div>
  );
}

function AddEventCard({ product, onAdded }: { product: ProductDto; onAdded: () => Promise<void> }) {
  const next = product.allowedNextEvents;
  const [eventType, setEventType] = useState(next[0] ?? "");
  const [location, setLocation] = useState("");
  const [custodian, setCustodian] = useState("");
  const [notes, setNotes] = useState("");
  const add = useAction(async () => {
    await api.post(`/supply-chain/products/${product.product.id}/events`, { eventType, location, custodian, metadata: notes ? { notes } : {} });
    setLocation(""); setCustodian(""); setNotes("");
    await onAdded();
  });
  const current = next.includes(eventType) ? eventType : next[0];
  if (!next.length) return <Card title="Lifecycle complete"><p className="text-sm text-slate-400">This batch has reached the retailer. No further events can be appended.</p></Card>;
  return (
    <Card title="Append provenance event" subtitle="Signed by the party responsible for the stage">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setEventType(current); add.run(); }}>
        <Field label="Event type">
          <select className="input" value={current} onChange={(e) => setEventType(e.target.value)}>
            {next.map((t) => <option key={t} value={t}>{STAGE_META[t]?.label ?? t}</option>)}
          </select>
        </Field>
        <div className="text-xs text-slate-400">Signer: <span className="text-slate-200">{product.eventSigners[current]}</span> (ML-DSA-65)</div>
        <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. CityCare Pharmacy, Vizianagaram" required minLength={2} /></Field>
        <Field label="New custodian"><input className="input" value={custodian} onChange={(e) => setCustodian(e.target.value)} placeholder="e.g. CityCare Pharmacy" required minLength={2} /></Field>
        <Field label="Notes (optional)"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Temperature log attached" /></Field>
        <InlineError error={add.error} />
        <Button type="submit" variant="primary" className="w-full" loading={add.pending} icon={<Plus className="h-4 w-4" />}>Sign &amp; append event</Button>
      </form>
    </Card>
  );
}
