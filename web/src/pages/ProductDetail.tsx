import { motion } from "framer-motion";
import { ArrowLeft, FlaskConical, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { STAGE_META } from "../components/stages";
import { TamperDialog } from "../components/TamperDialog";
import { VerdictBanner } from "../components/Verification";
import { Button, cx, Dot, ErrorState, Field, Hash, InlineError, KV, Loading, PageHeader, Section, StatusBadge } from "../components/ui";
import { api, type AuditEntry, type Block, type EntityVerification, type RecordSummary } from "../lib/api";
import { formatDateTime, humanize } from "../lib/format";
import { useAction } from "../lib/hooks";

interface EventDto {
  id: string; sequence: number; eventType: string;
  data: { actor: string; actorOrganization: string; custodian: string; location: string; status: string; timestamp: string; metadata: Record<string, string>; previousEventHash: string };
  dataHash: string; previousEventHash: string; signatureBytes: number; signaturePreview: string; algorithm: string; blockIndex: number; integrityStatus: string; demoTampered: boolean;
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
  const pid = encodeURIComponent(id);
  const [data, setData] = useState<ProductDto | null>(null);
  const [report, setReport] = useState<ProductVerification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [tampering, setTampering] = useState<EventDto | null>(null);

  const load = useCallback(async () => {
    const d = await api.get<ProductDto>(`/supply-chain/products/${pid}`);
    setData(d);
    return d;
  }, [pid]);
  const verifyChain = useCallback(async (passive: boolean) => {
    const r = await api.post<ProductVerification>(`/supply-chain/products/${pid}/verify${passive ? "?passive=1" : ""}`);
    setReport(r);
    await load();
  }, [pid, load]);

  useEffect(() => {
    setData(null); setReport(null); setError(null);
    load().then(() => verifyChain(true)).catch((e) => setError(e as Error));
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = useAction(async () => { await verifyChain(false); });
  const tamper = useAction(async (eventId: string, input: { field: string; value: string }) => {
    await api.post(`/supply-chain/events/${eventId}/tamper`, input);
    setTampering(null);
    await load();
    await verifyChain(false);
  });
  const restore = useAction(async (eventId: string) => { await api.post(`/supply-chain/events/${eventId}/restore`); await load(); await verifyChain(false); });

  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (!data) return <Loading label="Loading provenance chain…" />;
  const p = data.product;
  const byId = new Map(report?.events.map((e) => [e.entityId, e]) ?? []);
  const anyBad = report ? report.verdict === "TAMPERED" : data.events.some((e) => e.integrityStatus === "TAMPERED");

  return (
    <div>
      <Link to="/supply-chain" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Supply Chain</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">{String(p.data.productName)}<StatusBadge status={anyBad ? "TAMPERED" : "VERIFIED"} /></span>}
        description={<>Batch <span className="font-mono text-slate-200">{p.id}</span> · {String(p.data.manufacturer)} · Origin {String(p.data.origin)} · {String(p.data.certification)}</>}
        actions={<Button variant="primary" size="lg" onClick={() => verify.run()} loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>Verify provenance chain</Button>}
      />
      {(verify.error || restore.error) && <div className="mb-5"><InlineError error={verify.error ?? restore.error} /></div>}
      {report && <div className="mb-8"><VerdictBanner report={{ ...report.product, verdict: report.verdict, checks: [...report.product.checks, ...report.events.flatMap((e) => e.checks.filter((c) => c.status === "fail").map((c) => ({ ...c, label: `Step ${e.entityId.slice(-2)} · ${c.label}` })))] }} /></div>}

      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Section title="Provenance" description="Each step is signed by its accountable party and committed to the hash of the step before it.">
          <ol className="relative">
            {/* registration */}
            <TimelineItem last={data.events.length === 0} tone={report?.product.verdict === "TAMPERED" ? "red" : "blue"}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-white">Product registered</h3>
                <span className="text-xs text-slate-500">Genesis of this chain</span>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <KV label="Signed by">{data.signer.name}</KV>
                <KV label="Content hash"><Hash value={p.dataHash} n={6} /></KV>
                <KV label="Ledger block"><Link className="font-mono text-[12px] text-brand-300 hover:underline" to={`/ledger?block=${p.blockIndex}`}>#{p.blockIndex}</Link></KV>
              </div>
            </TimelineItem>

            {data.events.map((e, i) => {
              const v = byId.get(e.id);
              const bad = v ? v.verdict === "TAMPERED" : e.integrityStatus === "TAMPERED";
              const meta = STAGE_META[e.eventType] ?? { label: e.eventType, icon: null };
              return (
                <TimelineItem key={e.id} last={i === data.events.length - 1} tone={bad ? "red" : "green"} delay={i * 0.04}>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">{meta.label}</h3>
                      <div className="text-xs text-slate-500">{formatDateTime(e.data.timestamp)} · <span className="font-mono">{e.id}</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cx("flex items-center gap-2 text-[13px] font-semibold", bad ? "text-red-300" : "text-emerald-300")}><Dot tone={bad ? "red" : "green"} />{bad ? "Verification failed" : "Verified"}</span>
                      {e.demoTampered ? (
                        <Button size="sm" variant="secondary" onClick={() => restore.run(e.id)} loading={restore.pending} icon={<RotateCcw className="h-3.5 w-3.5" />}>Restore</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { tamper.clearError(); setTampering(e); }} icon={<FlaskConical className="h-3.5 w-3.5" />}>Simulate tampering</Button>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-3">
                    <div><dt className="label mb-0.5">Actor</dt><dd className="text-slate-200">{e.data.actor}</dd></div>
                    <div><dt className="label mb-0.5">Location</dt><dd className="text-slate-200">{e.data.location}</dd></div>
                    <div><dt className="label mb-0.5">Custodian</dt><dd className="text-slate-200">{e.data.custodian}</dd></div>
                  </dl>
                  {Object.keys(e.data.metadata).length > 0 && (
                    <p className="mt-2 text-[13px] text-slate-400">{Object.entries(e.data.metadata).map(([k, val]) => <span key={k} className="mr-4 inline-block"><span className="text-slate-500">{humanize(k)}</span> {val}</span>)}</p>
                  )}
                  <div className="mt-3 grid gap-x-8 gap-y-2 border-t border-ink-800 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KV label="Event hash"><Hash value={e.dataHash} n={6} /></KV>
                    <KV label="Previous event"><Hash value={e.data.previousEventHash} n={6} tone={v?.checks.find((c) => c.id === "eventLink")?.status === "fail" ? "red" : undefined} /></KV>
                    <KV label="Signature"><span className="text-[12px] text-slate-300">{e.algorithm} · {e.signatureBytes.toLocaleString()} B</span></KV>
                    <KV label="Ledger block"><Link className="font-mono text-[12px] text-brand-300 hover:underline" to={`/ledger?block=${e.blockIndex}`}>#{e.blockIndex}</Link></KV>
                  </div>
                  {v && bad && (
                    <ul className="mt-3 space-y-1 text-[12px] text-red-300">
                      {v.checks.filter((c) => c.status === "fail").map((c) => <li key={c.id}>✗ {c.label}: {c.summary}</li>)}
                    </ul>
                  )}
                </TimelineItem>
              );
            })}
          </ol>
        </Section>

        <div className="space-y-10">
          <Section title="Current state">
            {data.currentState ? (
              <dl className="space-y-3 text-[14px]">
                <KV label="Status"><span className="text-[17px] font-semibold text-white">{data.currentState.status}</span></KV>
                <KV label="Custodian">{data.currentState.custodian}</KV>
                <KV label="Location">{data.currentState.location}</KV>
                <KV label="Last updated">{formatDateTime(data.currentState.updatedAt)}</KV>
              </dl>
            ) : <p className="text-sm text-slate-400">No events yet.</p>}
          </Section>
          <AddEventForm product={data} onAdded={async () => { await load(); await verifyChain(true); }} />
        </div>
      </div>

      {tampering && (
        <TamperDialog
          open
          onClose={() => setTampering(null)}
          data={tampering.data as unknown as Record<string, unknown>}
          fields={["custodian", "location", "status", ...Object.keys(tampering.data.metadata).map((k) => `metadata.${k}`)]}
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

function TimelineItem({ children, last, tone, delay = 0 }: { children: React.ReactNode; last: boolean; tone: "blue" | "green" | "red"; delay?: number }) {
  const dot = tone === "red" ? "border-red-400 bg-red-400" : tone === "green" ? "border-emerald-400 bg-emerald-400" : "border-brand-400 bg-brand-400";
  return (
    <motion.li initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay }} className="relative pl-9">
      <span className={cx("absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 ring-4 ring-ink-950", dot)} />
      {!last && <span className={cx("absolute bottom-0 left-[5px] top-5 w-px", tone === "red" ? "bg-red-500/50" : "bg-ink-600")} />}
      <div className="pb-8">{children}</div>
    </motion.li>
  );
}

function AddEventForm({ product, onAdded }: { product: ProductDto; onAdded: () => Promise<void> }) {
  const next = product.allowedNextEvents;
  const [eventType, setEventType] = useState(next[0] ?? "");
  const [location, setLocation] = useState("");
  const [custodian, setCustodian] = useState("");
  const [notes, setNotes] = useState("");
  const current = next.includes(eventType) ? eventType : next[0];
  const add = useAction(async () => {
    await api.post(`/supply-chain/products/${product.product.id}/events`, { eventType: current, location, custodian, metadata: notes ? { notes } : {} });
    setLocation(""); setCustodian(""); setNotes("");
    await onAdded();
  });
  if (!next.length) return <Section title="Lifecycle complete"><p className="text-[13px] text-slate-400">This batch has reached the retailer. No further events can be appended.</p></Section>;
  return (
    <Section title="Append event" description="Signed by the party responsible for the stage.">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.run(); }}>
        <Field label="Event type">
          <select className="input" value={current} onChange={(e) => setEventType(e.target.value)}>{next.map((t) => <option key={t} value={t}>{STAGE_META[t]?.label ?? t}</option>)}</select>
        </Field>
        <div className="text-xs text-slate-500">Signer: <span className="text-slate-300">{product.eventSigners[current]}</span> · ML-DSA-65</div>
        <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. CityCare Pharmacy, Vizianagaram" required minLength={2} /></Field>
        <Field label="New custodian"><input className="input" value={custodian} onChange={(e) => setCustodian(e.target.value)} placeholder="e.g. CityCare Pharmacy" required minLength={2} /></Field>
        <Field label="Notes (optional)"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <InlineError error={add.error} />
        <Button type="submit" variant="primary" className="w-full" loading={add.pending} icon={<Plus className="h-4 w-4" />}>Sign and append event</Button>
      </form>
    </Section>
  );
}
