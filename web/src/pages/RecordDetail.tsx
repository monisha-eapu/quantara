import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { TamperDialog, type TamperMode } from "../components/TamperDialog";
import { ChangedFields, HashComparison, ResultBanner, stepsFromReport } from "../components/verify";
import { BackLink, Banner, Btn, cx, Empty, ErrorState, Hash, InlineError, IntegrityStatusLabel, Loading, PageTitle, SectionHead, Status, StepList, type Tone } from "../components/ui";
import { api, type Block, type EntityVerification, type RecordDetail as Detail } from "../lib/api";
import { fieldLabel, formatDateTime } from "../lib/format";
import { useAction } from "../lib/hooks";

const ORDER = ["propertyId", "ownerName", "surveyNumber", "district", "state", "area", "propertyType", "registrationDate", "status", "issuingAuthority"];
type ChainBlock = Block & { hashValid: boolean; linkValid: boolean };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One-click demo edit: Ravi Kumar → Raj Kumar (or an equivalent small change for other owners). */
function forgedOwner(name: string): string {
  const parts = name.split(" ");
  parts[0] = parts[0] === "Raj" ? "Ravi" : "Raj";
  return parts.join(" ");
}

export default function RecordDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const rid = encodeURIComponent(id);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [report, setReport] = useState<EntityVerification | null>(null);
  const [chain, setChain] = useState<ChainBlock[]>([]);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const verify = useCallback(async (passive = false) => {
    setVerifying(true);
    try {
      const r = await api.post<EntityVerification>(`/records/${rid}/verify${passive ? "?passive=1" : ""}`);
      const d = await api.get<Detail>(`/records/${rid}`);
      setReport(r); setDetail(d);
      return r;
    } finally { setVerifying(false); }
  }, [rid]);

  useEffect(() => {
    let alive = true;
    setDetail(null); setReport(null); setLoadError(null); setChain([]);
    (async () => {
      try {
        const d = await api.get<Detail>(`/records/${rid}`);
        if (!alive) return;
        setDetail(d);
        if (d.block) api.get<{ blocks: ChainBlock[] }>(`/ledger?before=${d.block.index + 1}&limit=3`).then((r) => alive && setChain(r.blocks)).catch(() => undefined);
        await verify(true); // passive: shows the true current state without adding audit entries
      } catch (e) { if (alive) setLoadError(e as Error); }
    })();
    return () => { alive = false; };
  }, [rid, verify]);

  const runVerify = useAction(async () => { await verify(false); });
  const tamperDemo = useAction(async () => {
    if (!detail) return;
    const d = await api.post<Detail>(`/records/${rid}/tamper`, { field: "ownerName", value: forgedOwner(String(detail.record.data.ownerName ?? "")), mode: "FIELD_ONLY" satisfies TamperMode });
    setDetail(d); setVerifying(true);
    await wait(650);          // the record visibly changes first…
    await verify(false);      // …then verification runs automatically
  });
  const tamperCustom = useAction(async (input: { field: string; value: string; mode: TamperMode }) => {
    const d = await api.post<Detail>(`/records/${rid}/tamper`, input);
    setDetail(d); setCustomOpen(false); setVerifying(true);
    await wait(400);
    await verify(false);
  });
  const restore = useAction(async () => {
    const d = await api.post<Detail>(`/records/${rid}/restore`);
    setDetail(d); setVerifying(true);
    await wait(300);
    await verify(false);
  });

  if (loadError) return <ErrorState error={loadError} onRetry={() => window.location.reload()} />;
  if (!detail) return <Loading label="Loading record…" />;

  const { record } = detail;
  const data = record.data as Record<string, string>;
  const changed = new Map(detail.tamper.changedFields.map((f) => [f.field, f]));
  const fields = Object.keys(record.data).filter((k) => k !== "recordType").sort((a, b) => ((ORDER.indexOf(a) + 100) % 100) - ((ORDER.indexOf(b) + 100) % 100));
  const busy = tamperDemo.pending || restore.pending || runVerify.pending || tamperCustom.pending;
  const err = tamperDemo.error ?? restore.error ?? runVerify.error;
  const tampered = report?.verdict === "TAMPERED";
  const show = report && !verifying;
  const rowTone = (id: string, ok: string, bad: string): { text: string; tone: Tone } => {
    const c = report?.checks.find((x) => x.id === id);
    return !c || verifying ? { text: "…", tone: "mute" } : c.status === "fail" ? { text: bad, tone: "bad" } : { text: ok, tone: c.status === "warn" ? "warn" : "ok" };
  };
  const state: [string, React.ReactNode, { text: string; tone: Tone }][] = [
    ["Content hash", <Hash key="h" value={record.dataHash} n={8} />, rowTone("hash", "Matches", "Mismatch")],
    ["Digital signature", <span key="s" className="text-[13px]">{record.algorithm} · {detail.signatureBytes.toLocaleString()} bytes</span>, rowTone("signature", "Valid", "Invalid")],
    ["Ledger anchor", <span key="a" className="text-[13px]">Block #{record.blockIndex}</span>, rowTone("anchor", "Verified", "Integrity failure")],
    ["Ledger chain", <span key="c" className="text-[13px]">Hash links recomputed</span>, rowTone("chain", "Intact", "Broken")],
  ];

  return (
    <div className="flex flex-col gap-8">
      <BackLink onClick={() => nav("/app/land")}>Land Records</BackLink>
      <PageTitle
        mono={<span className="flex flex-wrap items-center gap-4">{record.id}<IntegrityStatusLabel status={show ? (tampered ? "TAMPERED" : report.verdict === "AUTHENTIC" ? "VERIFIED" : "LEGACY") : "UNVERIFIED"} /></span>}
        title={data.ownerName}
        sub={`Survey ${data.surveyNumber} · ${data.district}, ${data.state} · Registered ${data.registrationDate} · Issued by ${data.issuingAuthority}`}
        actions={<>
          <Btn loading={runVerify.pending} disabled={busy} onClick={() => runVerify.run()}>Verify record</Btn>
          {detail.tamper.active
            ? <Btn variant="outline" loading={restore.pending} disabled={busy} onClick={() => restore.run()} className="!bg-card">Restore original</Btn>
            : <Btn variant="danger" loading={tamperDemo.pending} disabled={busy} onClick={() => tamperDemo.run()}>Simulate tampering</Btn>}
        </>}
      />
      <InlineError error={err} />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionHead title="Record information" sub={detail.tamper.active ? "Altered directly in the database. The signature and ledger were not updated." : "Canonicalised, hashed and signed at registration."} />
          <dl className="m-0">
            {fields.map((k) => {
              const ch = changed.get(k);
              return (
                <div key={k} className={cx("grid grid-cols-[150px_1fr] items-baseline gap-4 border-b border-line-3 py-3", ch && "bg-bad-bg px-3")}>
                  <dt className="text-[14px] text-mute">{fieldLabel(k)}</dt>
                  <dd className="m-0 min-w-0 text-[15px]">
                    {ch ? (<><div className="text-[13px] text-faint line-through">{String(ch.original)}</div><div className="font-semibold text-bad">↓ {String(ch.current)}</div></>) : String(record.data[k])}
                  </dd>
                </div>
              );
            })}
          </dl>
          {!detail.tamper.active && <button onClick={() => { tamperCustom.clearError(); setCustomOpen(true); }} className="mt-4 w-fit cursor-pointer border-0 bg-transparent p-0 text-[13px] text-mute underline underline-offset-[3px] hover:text-ink">Choose a different field to tamper with…</button>}
        </div>

        <div className="flex flex-col gap-4">
          <SectionHead title="Security verification" sub="Recomputed from the stored bytes on every check; nothing is read from a cached status." />
          {show ? <ResultBanner report={report} /> : <Banner tone="warn" title="Verifying…">Recomputing the fingerprint and checking the signature.</Banner>}
          <div className="rounded border border-line bg-card">
            {state.map(([label, value, st]) => (
              <div key={label} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 border-b border-line-3 px-[18px] py-3 text-[14px]">
                <span className="text-mute">{label}</span><span className="min-w-0 truncate">{value}</span><Status tone={st.tone} className="font-medium">{st.text}</Status>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 px-[18px] py-3 text-[14px]"><span className="text-mute">Signed by</span><span className="text-right">{detail.signer.name}<span className="block text-[12px] text-mute">{detail.signer.organization}</span></span></div>
          </div>
        </div>
      </div>

      {show && (
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3"><SectionHead title="Verification checks" /><div className="rounded border border-line bg-card px-5"><StepList steps={stepsFromReport(report)} /></div></div>
          <div className="flex flex-col gap-4">
            <SectionHead title="Hash comparison" /><HashComparison report={report} />
            {report.changedFields && <ChangedFields fields={report.changedFields} />}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SectionHead title="Ledger history" sub="The anchoring block and the blocks before it. Each commits to the hash of the one below." right={detail.block && <button onClick={() => nav("/app/ledger")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] underline underline-offset-[3px]">Open ledger</button>} />
        {chain.length === 0 ? <Empty title="Ledger blocks unavailable" /> : chain.map((b, i) => (
          <div key={b.index}>
            <div className={cx("grid gap-x-6 gap-y-2 rounded border bg-card px-[22px] py-4 md:grid-cols-[170px_1.4fr_1fr_1fr]", !b.hashValid || !b.linkValid ? "border-bad" : b.index === record.blockIndex ? "border-ink" : "border-line")}>
              <div><div className="font-mono text-[15px] font-medium">Block #{b.index}</div><div className="text-[12px] text-mute">{b.index === record.blockIndex ? "Anchors this record" : b.recordType.replace("_", " ").toLowerCase()}</div></div>
              <div className="min-w-0"><div className="eyebrow text-faint">Record</div><div className="truncate font-mono text-[12.5px]">{b.recordId}</div></div>
              <div className="min-w-0"><div className="eyebrow text-faint">Current hash</div><Hash value={b.blockHash} /></div>
              <div className="min-w-0"><div className="eyebrow text-faint">Previous hash</div><Hash value={b.previousHash} /></div>
            </div>
            {i < chain.length - 1 && <div className={cx("ml-[22px] border-l border-line-4 py-2.5 pl-[22px] font-mono text-[12px]", b.linkValid ? "text-mute" : "text-bad")}>↓ previous hash of #{b.index} {b.linkValid ? "=" : "≠"} current hash of #{b.index - 1}</div>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="Record audit trail" />
        <div className="overflow-x-auto rounded border border-line bg-card">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <thead className="border-b border-line bg-paper"><tr><th className="th">Time</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Result</th></tr></thead>
            <tbody>
              {detail.audit.map((a) => {
                const tone: Tone = ["DETECTED", "INVALID", "FAILED"].includes(a.result) ? "bad" : a.result === "WARNING" ? "warn" : "ok";
                return <tr key={a.id} className="border-b border-line-3 last:border-0"><td className="td whitespace-nowrap font-mono text-[12px] text-mute">{formatDateTime(a.timestamp)}</td><td className="td">{a.actor}</td><td className="td">{a.action.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</td><td className="td"><Status tone={tone}>{a.result}</Status></td></tr>;
              })}
              {detail.audit.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-[14px] text-mute">No audit entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {customOpen && (
        <TamperDialog open onClose={() => setCustomOpen(false)} data={record.data} fields={fields} defaultField="ownerName"
          suggest={(f, cur) => (f === "ownerName" ? forgedOwner(cur) : f === "area" ? cur.replace(/^[\d.]+/, (n) => String(Number(n) * 4)) : "")}
          onSubmit={(input) => tamperCustom.run(input)} pending={tamperCustom.pending} error={tamperCustom.error} />
      )}
    </div>
  );
}
