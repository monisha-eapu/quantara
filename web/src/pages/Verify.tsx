import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ResultBanner, stepsFromReport } from "../components/verify";
import { Banner, Btn, cx, InlineError, PageTitle, StepList, type Step } from "../components/ui";
import { api, ApiError, type EntityVerification, type RecordDetail, type RecordSummary } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";

interface ProductVerification { verdict: "AUTHENTIC" | "TAMPERED"; product: EntityVerification; events: EntityVerification[] }
type Result =
  | { kind: "record"; id: string; desc: string; anchor: string; report: EntityVerification; steps: Step[] }
  | { kind: "product"; id: string; desc: string; anchor: string; report: ProductVerification; steps: Step[] }
  | { kind: "missing"; id: string };

function productSteps(r: ProductVerification): Step[] {
  const ev = r.events, n = ev.length;
  const count = (id: string) => ev.filter((e) => e.checks.find((c) => c.id === id)?.status !== "fail").length;
  const tally = (label: string, id: string, ok: string, bad: string, detail: (c: number) => string): Omit<Step, "n"> => {
    const c = count(id);
    return { label, detail: detail(c), status: c === n ? ok : bad, tone: c === n ? "ok" : "bad" };
  };
  const chain = r.product.checks.find((c) => c.id === "chain");
  const rows: Omit<Step, "n">[] = [
    { label: "Fetch batch and provenance events", detail: `${n} signed events from ${r.product.signer.organization.replace(" (fictional)", "")}`, status: "found", tone: "ok" },
    tally("Recompute SHA-256 of each event", "hash", "match", "mismatch", (c) => `${c} of ${n} fingerprints match`),
    tally(`Verify ${r.product.algorithm} signature of each custodian`, "signature", "valid", "invalid", (c) => `${c} of ${n} signatures valid`),
    tally("Check each event links to the one before", "eventLink", "linked", "broken", (c) => `${c} of ${n} previous-event hashes match`),
    { label: "Walk hash chain to tip", detail: chain?.detail, status: chain?.status === "fail" ? "broken" : "intact", tone: chain?.status === "fail" ? "bad" : "ok" },
  ];
  return rows.map((s, i) => ({ ...s, n: i + 1 }));
}

export default function Verify() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(routeId ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [shown, setShown] = useState(0);
  const recs = useApi(() => api.get<{ records: RecordSummary[] }>("/records?type=LAND_RECORD&featuredFirst=true&limit=5"));
  const bad = useApi(() => api.get<{ records: RecordSummary[] }>("/records?status=TAMPERED&limit=4"));
  const legacy = useApi(() => api.get<{ records: RecordSummary[] }>("/records?status=LEGACY&limit=2"));
  const prods = useApi(() => api.get<{ products: RecordSummary[] }>("/supply-chain/products"));

  const run = useAction(async (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (!id) return;
    setRes(null); setShown(0);
    let look: { id: string; recordType: string };
    try { look = await api.get<{ id: string; recordType: string }>(`/lookup/${encodeURIComponent(id)}`); }
    catch (e) { if (e instanceof ApiError && e.status === 404) { setRes({ kind: "missing", id }); return; } throw e; }
    setInput(look.id);
    if (routeId !== look.id) nav(`/app/verify/${look.id}`, { replace: true });
    if (look.recordType === "SUPPLY_PRODUCT") {
      const report = await api.post<ProductVerification>(`/supply-chain/products/${look.id}/verify`);
      setRes({ kind: "product", id: look.id, desc: `${report.events.length} custody events`, anchor: report.product.block ? `anchored in block #${report.product.block.index}` : "", report, steps: productSteps(report) });
    } else {
      const [report, d] = await Promise.all([api.post<EntityVerification>(`/records/${look.id}/verify`), api.get<RecordDetail>(`/records/${look.id}`)]);
      const data = d.record.data as Record<string, string>;
      const desc = `${data.ownerName} · Survey ${data.surveyNumber}, ${data.district}, ${data.state}`;
      setRes({ kind: "record", id: look.id, desc, anchor: report.block ? `anchored in block #${report.block.index}` : "", report, steps: stepsFromReport(report, { label: "Fetch record", detail: `Land Registry · ${data.area} · ${data.propertyType}` }) });
    }
  });

  useEffect(() => { if (routeId) run.run(routeId); }, [routeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal the real checks one by one so the audience can follow them.
  const total = res && res.kind !== "missing" ? res.steps.length : 0;
  useEffect(() => {
    if (!res || res.kind === "missing") return;
    setShown(0);
    const timers = Array.from({ length: res.steps.length }, (_, i) => setTimeout(() => setShown(i + 1), (i + 1) * 420));
    return () => timers.forEach(clearTimeout);
  }, [res]);

  const display = useMemo<Step[]>(() => {
    if (!res || res.kind === "missing") return [];
    return res.steps.map((s, i) => i < shown ? s : { ...s, detail: undefined, status: i === shown ? "checking…" : "pending", tone: "pending" as const });
  }, [res, shown]);
  const done = !!res && res.kind !== "missing" && shown >= total;

  const quick: { id: string; tone: "bad" | "warn" | "ink" }[] = [
    ...(recs.data?.records ?? []).map((r) => ({ id: r.id, tone: (r.integrityStatus === "LEGACY" ? "warn" : "ink") as "warn" | "ink" })),
    ...(prods.data?.products ?? []).slice(0, 2).map((p) => ({ id: p.id, tone: "ink" as const })),
    ...(legacy.data?.records ?? []).map((r) => ({ id: r.id, tone: "warn" as const })),
    ...(bad.data?.records ?? []).map((r) => ({ id: r.id, tone: "bad" as const })),
  ].filter((q, i, a) => a.findIndex((x) => x.id === q.id) === i);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Verification" sub="Independent verification from first principles: recompute the SHA-256 fingerprint, verify the ML-DSA-65 signature with the signer's registered public key, confirm the ledger anchor and walk the hash chain." />
      <form className="flex flex-wrap gap-2.5" onSubmit={(e) => { e.preventDefault(); run.run(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Record ID" placeholder="Record ID, e.g. LAND-AP-VZM-10293 or PHARMA-BT-9921" className="inp min-w-[280px] flex-1 !px-4 !py-3.5 font-mono !text-[15px]" />
        <Btn type="submit" loading={run.pending} className="!px-6">Verify</Btn>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-mute">Quick select</span>
        {quick.map((q) => (
          <button key={q.id} onClick={() => run.run(q.id)} className={cx("cursor-pointer rounded-[3px] border bg-card px-2.5 py-1.5 font-mono text-[12px] hover:border-ink", q.tone === "bad" ? "border-bad-line text-bad" : q.tone === "warn" ? "border-warn-line text-warn" : "border-line")}>{q.id}</button>
        ))}
      </div>
      <InlineError error={run.error} />

      {!res && !run.pending && (
        <div className="flex flex-col items-center gap-2 rounded border border-dashed border-line-4 px-6 py-[72px] text-center">
          <span className="text-[16px] font-medium">Select or enter a record to verify</span>
          <span className="max-w-[520px] text-[14px] leading-relaxed text-mute">Land records, products (verifies the full provenance chain) and legacy-signed records are supported.</span>
        </div>
      )}
      {run.pending && !res && <div role="status" className="rounded border border-line bg-card px-6 py-14 text-center text-[14px] text-mute">Recomputing hashes and verifying signatures…</div>}

      {res?.kind === "missing" && <Banner tone="bad" title="Record not found">No record with ID “{res.id}” exists in any registry. Land record IDs look like LAND-AP-VZM-10293; product batches look like PHARMA-BT-9921.</Banner>}

      {res && res.kind !== "missing" && (
        <div className="rounded border border-line bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line-2 px-7 py-[22px]">
            <div className="flex flex-col gap-1"><span className="font-mono text-[20px]">{res.id}</span><span className="text-[14px] text-mute">{res.desc}</span></div>
            <span className="font-mono text-[12px] text-mute">{res.anchor}</span>
          </div>
          <div className="px-7 py-2"><StepList steps={display} /></div>
          {done && (
            <div className="mx-7 mb-7 mt-3 flex flex-col gap-3">
              {res.kind === "record"
                ? <ResultBanner report={res.report} />
                : res.report.verdict === "AUTHENTIC"
                  ? <Banner tone="ok" title="AUTHENTIC PROVENANCE">Every custody transfer is signed with {res.report.product.algorithm} and links to the step before it.</Banner>
                  : <Banner tone="bad" title="PROVENANCE CHAIN INVALID">Failed at {res.report.events.filter((e) => e.verdict === "TAMPERED").map((e) => e.entityId).join(", ") || "the product record"}. A step was altered after it was signed.</Banner>}
              <button onClick={() => nav(res.kind === "record" ? `/app/records/${res.id}` : `/app/supply-chain/${res.id}`)} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[14px] underline underline-offset-[3px]">{res.kind === "record" ? "Open record and tamper demo" : "Open provenance details"} →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
