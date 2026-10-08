import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { STAGE_LABEL } from "../components/stages";
import { TamperDialog } from "../components/TamperDialog";
import { BackLink, Banner, Btn, cx, ErrorState, Field, Hash, InlineError, IntegrityStatusLabel, KV, Loading, PageTitle, SectionHead, Status } from "../components/ui";
import { api, type EntityVerification, type RecordSummary } from "../lib/api";
import { formatDateTime, humanize } from "../lib/format";
import { useAction } from "../lib/hooks";

interface EventDto {
  id: string; sequence: number; eventType: string;
  data: { actor: string; custodian: string; location: string; status: string; timestamp: string; metadata: Record<string, string>; previousEventHash: string };
  dataHash: string; signatureBytes: number; algorithm: string; blockIndex: number; integrityStatus: string; demoTampered: boolean;
}
interface ProductDto {
  product: RecordSummary; signer: { name: string };
  events: EventDto[]; currentState: { custodian: string; location: string; status: string; updatedAt: string } | null;
  allowedNextEvents: string[]; eventSigners: Record<string, string>;
}
interface ProductVerification { verdict: "AUTHENTIC" | "TAMPERED"; product: EntityVerification; events: EntityVerification[] }

export default function ProductDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const pid = encodeURIComponent(id);
  const [data, setData] = useState<ProductDto | null>(null);
  const [report, setReport] = useState<ProductVerification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [tampering, setTampering] = useState<EventDto | null>(null);

  const load = useCallback(async () => { const d = await api.get<ProductDto>(`/supply-chain/products/${pid}`); setData(d); }, [pid]);
  const verifyChain = useCallback(async (passive: boolean) => { setReport(await api.post<ProductVerification>(`/supply-chain/products/${pid}/verify${passive ? "?passive=1" : ""}`)); await load(); }, [pid, load]);
  useEffect(() => { setData(null); setReport(null); setError(null); load().then(() => verifyChain(true)).catch((e) => setError(e as Error)); }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = useAction(async () => { await verifyChain(false); });
  const tamper = useAction(async (eventId: string, input: { field: string; value: string }) => { await api.post(`/supply-chain/events/${eventId}/tamper`, input); setTampering(null); await load(); await verifyChain(false); });
  const restore = useAction(async (eventId: string) => { await api.post(`/supply-chain/events/${eventId}/restore`); await load(); await verifyChain(false); });

  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (!data) return <Loading label="Loading provenance chain…" />;
  const p = data.product;
  const byId = new Map(report?.events.map((e) => [e.entityId, e]) ?? []);
  const bad = report ? report.verdict === "TAMPERED" : data.events.some((e) => e.integrityStatus === "TAMPERED");
  const failed = report?.events.filter((e) => e.verdict === "TAMPERED").map((e) => e.entityId) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <BackLink onClick={() => nav("/app/supply-chain")}>Supply Chain</BackLink>
      <PageTitle mono={<span className="flex flex-wrap items-center gap-4">{p.id}<IntegrityStatusLabel status={bad ? "TAMPERED" : "VERIFIED"} /></span>} title={String(p.data.productName)}
        sub={`${String(p.data.manufacturer)} · Origin ${String(p.data.origin)} · ${String(p.data.certification)}`}
        actions={<Btn loading={verify.pending} onClick={() => verify.run()}>Verify provenance chain</Btn>} />
      <InlineError error={verify.error ?? restore.error} />
      {report && (bad
        ? <Banner tone="bad" title="PROVENANCE CHAIN INVALID">{failed.length ? `Verification failed at ${failed.join(", ")}. The altered step no longer matches its signature, and the steps after it no longer link to it.` : "The product record failed verification."}</Banner>
        : <Banner tone="ok" title="AUTHENTIC PROVENANCE">All {data.events.length} events carry a valid {data.events[0]?.algorithm ?? "ML-DSA-65"} signature and link to the step before them.</Banner>)}

      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col">
          <SectionHead title="Provenance" sub="Each step is signed by its accountable party and committed to the hash of the step before it." />
          <ol className="m-0 mt-5 list-none p-0">
            <Item tone="ink" last={data.events.length === 0}>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="m-0 text-[15px] font-semibold">Product registered</h3><span className="text-[12px] text-mute">Genesis of this chain</span></div>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-3"><KV label="Signed by">{data.signer.name}</KV><KV label="Content hash"><Hash value={p.dataHash} /></KV><KV label="Ledger block">#{p.blockIndex}</KV></div>
            </Item>
            {data.events.map((e, i) => {
              const v = byId.get(e.id);
              const isBad = v ? v.verdict === "TAMPERED" : e.integrityStatus === "TAMPERED";
              return (
                <Item key={e.id} tone={isBad ? "bad" : "ok"} last={i === data.events.length - 1}>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div><h3 className="m-0 text-[15px] font-semibold">{STAGE_LABEL[e.eventType] ?? e.eventType}</h3><div className="text-[12px] text-mute">{formatDateTime(e.data.timestamp)} · <span className="font-mono">{e.id}</span></div></div>
                    <div className="flex items-center gap-3">
                      <Status tone={isBad ? "bad" : "ok"} className="text-[13px] font-medium">{isBad ? "Verification failed" : "Verified"}</Status>
                      {e.demoTampered
                        ? <Btn size="sm" variant="outline" loading={restore.pending} onClick={() => restore.run(e.id)}>Restore</Btn>
                        : <Btn size="sm" variant="danger" onClick={() => { tamper.clearError(); setTampering(e); }}>Simulate tampering</Btn>}
                    </div>
                  </div>
                  <dl className="m-0 mt-3 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-3">
                    <div><dt className="eyebrow mb-0.5 text-faint">Actor</dt><dd className="m-0">{e.data.actor}</dd></div>
                    <div><dt className="eyebrow mb-0.5 text-faint">Location</dt><dd className="m-0">{e.data.location}</dd></div>
                    <div><dt className="eyebrow mb-0.5 text-faint">Custodian</dt><dd className="m-0">{e.data.custodian}</dd></div>
                  </dl>
                  {Object.keys(e.data.metadata).length > 0 && <p className="m-0 mt-2 text-[13px] text-mute">{Object.entries(e.data.metadata).map(([k, val]) => <span key={k} className="mr-4 inline-block">{humanize(k)}: <span className="text-body">{val}</span></span>)}</p>}
                  <div className="mt-3 grid gap-x-8 gap-y-2 border-t border-line-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KV label="Event hash"><Hash value={e.dataHash} /></KV>
                    <KV label="Previous event"><Hash value={e.data.previousEventHash} /></KV>
                    <KV label="Signature"><span className="text-[13px]">{e.algorithm} · {e.signatureBytes.toLocaleString()} B</span></KV>
                    <KV label="Ledger block">#{e.blockIndex}</KV>
                  </div>
                  {v && isBad && <ul className="m-0 mt-3 list-none p-0 text-[13px] text-bad">{v.checks.filter((c) => c.status === "fail").map((c) => <li key={c.id}>✗ {c.label}: {c.summary}</li>)}</ul>}
                </Item>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4"><SectionHead title="Current state" />
            {data.currentState ? <><KV label="Status"><span className="text-[17px] font-semibold">{data.currentState.status}</span></KV><KV label="Custodian">{data.currentState.custodian}</KV><KV label="Location">{data.currentState.location}</KV><KV label="Last updated">{formatDateTime(data.currentState.updatedAt)}</KV></> : <p className="m-0 text-[14px] text-mute">No events yet.</p>}
          </div>
          <AddEvent product={data} onAdded={async () => { await load(); await verifyChain(true); }} />
        </div>
      </div>

      {tampering && (
        <TamperDialog open onClose={() => setTampering(null)} data={tampering.data as unknown as Record<string, unknown>} allowModes={false}
          fields={["custodian", "location", "status", ...Object.keys(tampering.data.metadata).map((k) => `metadata.${k}`)]}
          defaultField={tampering.data.metadata.qcResult ? "metadata.qcResult" : "custodian"}
          suggest={(f, cur) => (f === "metadata.qcResult" ? (cur === "PASSED" ? "PASSED (re-test waived)" : "PASSED") : f === "custodian" ? "Unlicensed Trader (grey market)" : f === "location" ? "Unregistered depot, Kolkata" : "")}
          onSubmit={(input) => tamper.run(tampering.id, { field: input.field, value: input.value })} pending={tamper.pending} error={tamper.error} />
      )}
    </div>
  );
}

function Item({ children, last, tone }: { children: React.ReactNode; last: boolean; tone: "ink" | "ok" | "bad" }) {
  return (
    <li className="relative pl-9">
      <span className={cx("absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 bg-card", tone === "bad" ? "border-bad bg-bad" : "border-ink", tone === "ink" && "bg-ink")} />
      {!last && <span className={cx("absolute bottom-0 left-[5px] top-5 w-px", tone === "bad" ? "bg-bad" : "bg-line")} />}
      <div className="pb-8">{children}</div>
    </li>
  );
}

function AddEvent({ product, onAdded }: { product: ProductDto; onAdded: () => Promise<void> }) {
  const next = product.allowedNextEvents;
  const [type, setType] = useState(next[0] ?? "");
  const [location, setLocation] = useState("");
  const [custodian, setCustodian] = useState("");
  const [notes, setNotes] = useState("");
  const cur = next.includes(type) ? type : next[0];
  const add = useAction(async () => {
    await api.post(`/supply-chain/products/${product.product.id}/events`, { eventType: cur, location, custodian, metadata: notes ? { notes } : {} });
    setLocation(""); setCustodian(""); setNotes(""); await onAdded();
  });
  if (!next.length) return <div className="flex flex-col gap-3"><SectionHead title="Lifecycle complete" /><p className="m-0 text-[14px] text-mute">This batch has reached the retailer. No further events can be appended.</p></div>;
  return (
    <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); add.run(); }}>
      <SectionHead title="Append event" sub="Signed by the party responsible for the stage." />
      <Field label="Event type"><select className="inp" value={cur} onChange={(e) => setType(e.target.value)}>{next.map((t) => <option key={t} value={t}>{STAGE_LABEL[t] ?? t}</option>)}</select></Field>
      <span className="text-[12px] text-mute">Signer: <span className="text-ink">{product.eventSigners[cur]}</span> · ML-DSA-65</span>
      <Field label="Location"><input className="inp" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. CityCare Pharmacy, Vizianagaram" /></Field>
      <Field label="New custodian"><input className="inp" value={custodian} onChange={(e) => setCustodian(e.target.value)} placeholder="e.g. CityCare Pharmacy" /></Field>
      <Field label="Notes (optional)"><input className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <InlineError error={add.error} />
      <Btn type="submit" loading={add.pending} disabled={location.length < 2 || custodian.length < 2}>Sign and append event</Btn>
    </form>
  );
}
