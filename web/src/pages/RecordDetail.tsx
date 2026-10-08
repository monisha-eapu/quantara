import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, FlaskConical, Link2, Loader2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { TamperDialog, type TamperMode } from "../components/TamperDialog";
import { ChangedFields, CheckList, HashComparison } from "../components/Verification";
import { Button, cx, Dot, Empty, ErrorState, Hash, InlineError, Loading, PageHeader, Section, StatusBadge } from "../components/ui";
import { api, type Block, type EntityVerification, type RecordDetail as Detail } from "../lib/api";
import { fieldLabel, formatDateTime } from "../lib/format";
import { useAction } from "../lib/hooks";

const HIDDEN = new Set(["recordType"]);
const ORDER = ["propertyId", "ownerName", "surveyNumber", "district", "state", "area", "propertyType", "registrationDate", "status", "issuingAuthority"];
type ChainBlock = Block & { hashValid: boolean; linkValid: boolean };

/** One-click demo edit: Ravi Kumar → Raj Kumar (or an equivalent small change for other owners). */
function forgedOwner(name: string): string {
  const parts = name.split(" ");
  parts[0] = parts[0] === "Raj" ? "Ravi" : "Raj";
  return parts.join(" ");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function RecordDetail() {
  const { id = "" } = useParams();
  const rid = encodeURIComponent(id);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [report, setReport] = useState<(EntityVerification) | null>(null);
  const [chain, setChain] = useState<ChainBlock[]>([]);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const loadChain = useCallback(async (blockIndex: number) => {
    const res = await api.get<{ blocks: ChainBlock[] }>(`/ledger?before=${blockIndex + 1}&limit=3`);
    setChain(res.blocks);
  }, []);

  const verify = useCallback(async (passive = false) => {
    setVerifying(true);
    try {
      const r = await api.post<EntityVerification>(`/records/${rid}/verify${passive ? "?passive=1" : ""}`);
      const d = await api.get<Detail>(`/records/${rid}`);
      setReport(r);
      setDetail(d);
      return r;
    } finally {
      setVerifying(false);
    }
  }, [rid]);

  useEffect(() => {
    let alive = true;
    setDetail(null); setReport(null); setLoadError(null); setChain([]);
    (async () => {
      try {
        const d = await api.get<Detail>(`/records/${rid}`);
        if (!alive) return;
        setDetail(d);
        if (d.block) loadChain(d.block.index).catch(() => undefined);
        await verify(true); // passive: shows true current state without adding audit noise
      } catch (e) {
        if (alive) setLoadError(e as Error);
      }
    })();
    return () => { alive = false; };
  }, [rid, verify, loadChain]);

  const runVerify = useAction(async () => { await verify(false); });
  const tamperDemo = useAction(async () => {
    if (!detail) return;
    const owner = String(detail.record.data.ownerName ?? "");
    const d = await api.post<Detail>(`/records/${rid}/tamper`, { field: "ownerName", value: forgedOwner(owner), mode: "FIELD_ONLY" satisfies TamperMode });
    setDetail(d);          // the record visibly changes first…
    setVerifying(true);
    await wait(650);
    await verify(false);   // …then verification runs automatically
  });
  const tamperCustom = useAction(async (input: { field: string; value: string; mode: TamperMode }) => {
    const d = await api.post<Detail>(`/records/${rid}/tamper`, input);
    setDetail(d);
    setCustomOpen(false);
    setVerifying(true);
    await wait(400);
    await verify(false);
  });
  const restore = useAction(async () => {
    const d = await api.post<Detail>(`/records/${rid}/restore`);
    setDetail(d);
    setVerifying(true);
    await wait(300);
    await verify(false);
  });

  if (loadError) return <ErrorState error={loadError} onRetry={() => window.location.reload()} />;
  if (!detail) return <Loading label="Loading record…" />;

  const { record } = detail;
  const changed = new Map(detail.tamper.changedFields.map((f) => [f.field, f]));
  const fields = Object.keys(record.data).filter((k) => !HIDDEN.has(k)).sort((a, b) => (ORDER.indexOf(a) + 100) % 100 - (ORDER.indexOf(b) + 100) % 100);
  const tampered = report?.verdict === "TAMPERED";
  const sigCheck = report?.checks.find((c) => c.id === "signature");
  const hashCheck = report?.checks.find((c) => c.id === "hash");
  const anchorCheck = report?.checks.find((c) => c.id === "anchor");
  const chainCheck = report?.checks.find((c) => c.id === "chain");
  const busy = tamperDemo.pending || restore.pending || runVerify.pending || tamperCustom.pending;
  const err = tamperDemo.error ?? restore.error ?? runVerify.error;
  const backTo = record.recordType === "LAND_RECORD" ? ["/land", "Land Records"] : ["/supply-chain", "Supply Chain"];

  return (
    <div>
      <Link to={backTo[0]} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {backTo[1]}</Link>

      <PageHeader
        title={<span className="flex flex-wrap items-center gap-x-4 gap-y-1"><span className="font-mono text-[26px] tracking-tight">{record.id}</span><StatusBadge status={report ? (tampered ? "TAMPERED" : report.verdict === "AUTHENTIC" ? "VERIFIED" : "LEGACY") : "UNVERIFIED"} /></span>}
        description={`${record.title} · Registered ${String(record.data.registrationDate ?? "")} · Issued by ${String(record.data.issuingAuthority ?? "")}`}
        actions={
          <>
            <Button variant="primary" size="lg" onClick={() => runVerify.run()} loading={runVerify.pending} disabled={busy} icon={<ShieldCheck className="h-4 w-4" />}>Verify record</Button>
            {detail.tamper.active ? (
              <Button variant="secondary" size="lg" onClick={() => restore.run()} loading={restore.pending} disabled={busy} icon={<RotateCcw className="h-4 w-4" />}>Restore original</Button>
            ) : (
              <Button variant="danger" size="lg" onClick={() => tamperDemo.run()} loading={tamperDemo.pending} disabled={busy} icon={<FlaskConical className="h-4 w-4" />}>Simulate tampering</Button>
            )}
          </>
        }
      />
      {err && <div className="mb-5"><InlineError error={err} /></div>}

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* LEFT: record information */}
        <Section
          title="Record information"
          description={detail.tamper.active ? "Altered directly in the database. Signature and ledger were not updated." : "Canonicalised, hashed and signed at registration."}
        >
          <dl className="divide-y divide-ink-800">
            {fields.map((k) => {
              const ch = changed.get(k);
              return (
                <div key={k} className={cx("grid grid-cols-[150px_1fr] items-baseline gap-4 py-2.5", ch && "-mx-3 rounded-md bg-red-500/[0.07] px-3")}>
                  <dt className="text-[13px] text-slate-400">{fieldLabel(k)}</dt>
                  <dd className="min-w-0 text-[14px] font-medium text-slate-100">
                    <AnimatePresence mode="wait" initial={false}>
                      {ch ? (
                        <motion.div key="changed" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                          <div className="text-[13px] font-normal text-slate-500 line-through">{String(ch.original)}</div>
                          <div className="flex items-center gap-1.5 font-semibold text-red-300"><ArrowDown className="h-3.5 w-3.5" />{String(ch.current)}</div>
                        </motion.div>
                      ) : (
                        <motion.div key="same" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>{String(record.data[k])}</motion.div>
                      )}
                    </AnimatePresence>
                  </dd>
                </div>
              );
            })}
          </dl>
          {!detail.tamper.active && (
            <button onClick={() => { tamperCustom.clearError(); setCustomOpen(true); }} className="mt-4 text-[12px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">Choose a different field to tamper with…</button>
          )}
        </Section>

        {/* RIGHT: security verification */}
        <Section title="Security verification" description="Recomputed from the stored bytes on every check; nothing is read from a cached status.">
          <div className="rounded-lg border border-ink-700 bg-ink-900">
            <div className={cx("flex items-center gap-3 border-b px-4 py-3.5", tampered ? "border-red-500/40 bg-red-500/[0.07]" : report ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-ink-700")}>
              {verifying || !report ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : tampered ? <ShieldAlert className="h-5 w-5 text-red-400" /> : <ShieldCheck className="h-5 w-5 text-emerald-400" />}
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Overall</div>
                <div className={cx("text-[18px] font-bold leading-tight", verifying || !report ? "text-slate-300" : tampered ? "text-red-300" : "text-emerald-300")}>
                  {verifying || !report ? "Verifying…" : tampered ? "RECORD TAMPERED" : report.verdict === "AUTHENTIC" ? "AUTHENTIC RECORD" : "AUTHENTIC · LEGACY CRYPTOGRAPHY"}
                </div>
              </div>
            </div>
            {report && !verifying && (
              <p className={cx("border-b border-ink-800 px-4 py-2.5 text-[13px]", tampered ? "text-red-200" : "text-slate-400")}>
                {tampered
                  ? `${report.checks.filter((c) => c.status === "fail").length} checks failed: ${report.checks.filter((c) => c.status === "fail").map((c) => c.label).join(", ")}.`
                  : report.verdict === "AUTHENTIC"
                    ? `All checks passed. ${report.algorithm} signature by ${report.signer.name}, verified in ${report.durationMs} ms.`
                    : "Valid today, but signed with a classical algorithm. Migrate to ML-DSA."}
              </p>
            )}
            <dl className="divide-y divide-ink-800 text-[13px]">
              <StateRow label="Content hash" value={<Hash value={record.dataHash} n={8} className="text-[12px]" />} ok={hashCheck?.status} okText="Matches" badText="Mismatch" />
              <StateRow label="Digital signature" value={<span className="text-slate-300">{record.algorithm} · {detail.signatureBytes.toLocaleString()} bytes</span>} ok={sigCheck?.status} okText="Valid" badText="Invalid" />
              <StateRow label="Ledger anchor" value={<span className="text-slate-300">Block #{record.blockIndex}</span>} ok={anchorCheck?.status} okText="Verified" badText="Integrity failure" />
              <StateRow label="Ledger chain" value={<span className="text-slate-300">{chain.length ? "Hash links recomputed" : "Previous-hash links"}</span>} ok={chainCheck?.status} okText="Intact" badText="Broken" />
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5"><dt className="text-slate-400">Signed by</dt><dd className="text-right text-slate-200">{detail.signer.name}<span className="block text-[11px] text-slate-500">{detail.signer.organization}</span></dd></div>
            </dl>
          </div>
        </Section>
      </div>

      {/* Result details */}
      <AnimatePresence initial={false}>
        {report && !verifying && (
          <motion.div key={report.verifiedAt} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mt-10 space-y-5">
            <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
              <Section title="Hash comparison"><HashComparison report={report} /></Section>
              <Section title="Verification checks"><CheckList report={report} /></Section>
            </div>
            {report.changedFields && report.changedFields.length > 0 && <ChangedFields fields={report.changedFields} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ledger history */}
      <Section title="Ledger history" description="The anchoring block and the blocks before it. Each block commits to the hash of the one below." className="mt-12" actions={detail.block && <Link to={`/ledger?block=${detail.block.index}`} className="text-[13px] text-brand-400 hover:underline">Open in ledger explorer</Link>}>
        {chain.length === 0 ? <Empty title="Ledger blocks unavailable" /> : (
          <ol>
            {chain.map((b, i) => {
              const isAnchor = b.index === record.blockIndex;
              const bad = !b.hashValid || !b.linkValid;
              return (
                <li key={b.index}>
                  <div className={cx("grid gap-x-6 gap-y-1 rounded-md border px-4 py-3 md:grid-cols-[150px_1.4fr_1fr_1fr]", bad ? "border-red-500/40 bg-red-500/[0.05]" : isAnchor ? "border-brand-500/40 bg-brand-500/[0.05]" : "border-ink-700 bg-ink-900")}>
                    <div><div className="font-mono text-[14px] font-semibold text-white">Block #{b.index}</div><div className="text-[11px] text-slate-500">{isAnchor ? "Anchors this record" : b.recordType.replace("_", " ").toLowerCase()}</div></div>
                    <div className="min-w-0"><div className="label">Record</div><div className="truncate font-mono text-[12px] text-slate-200">{b.recordId}</div></div>
                    <div className="min-w-0"><div className="label">Block hash</div><Hash value={b.blockHash} n={6} /></div>
                    <div className="min-w-0"><div className="label">Previous hash</div><Hash value={b.previousHash} n={6} /></div>
                  </div>
                  {i < chain.length - 1 && (
                    <div className="flex items-center gap-2 py-1.5 pl-6 text-[11px] text-slate-500">
                      <ArrowDown className="h-3.5 w-3.5" /><Link2 className={cx("h-3 w-3", b.linkValid ? "text-emerald-400" : "text-red-400")} />
                      {b.linkValid ? `previous hash of #${b.index} = block hash of #${b.index - 1}` : `broken link between #${b.index} and #${b.index - 1}`}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="Record audit trail" className="mt-12">
        {detail.audit.length === 0 ? <Empty title="No audit entries yet" /> : (
          <div className="overflow-x-auto rounded-lg border border-ink-700">
            <table className="w-full text-[13px]">
              <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th">Timestamp</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Result</th></tr></thead>
              <tbody className="divide-y divide-ink-800">
                {detail.audit.map((a) => (
                  <tr key={a.id}>
                    <td className="td whitespace-nowrap font-mono text-[12px] text-slate-400">{formatDateTime(a.timestamp)}</td>
                    <td className="td text-slate-300">{a.actor}</td>
                    <td className="td font-medium text-slate-100">{a.action.replace(/_/g, " ")}</td>
                    <td className="td"><span className={cx("inline-flex items-center gap-2 font-medium", ["DETECTED", "INVALID", "FAILED"].includes(a.result) ? "text-red-300" : a.result === "WARNING" ? "text-amber-300" : "text-emerald-300")}><Dot tone={["DETECTED", "INVALID", "FAILED"].includes(a.result) ? "red" : a.result === "WARNING" ? "amber" : "green"} />{a.result}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {customOpen && (
        <TamperDialog
          open
          onClose={() => setCustomOpen(false)}
          data={record.data}
          fields={fields}
          defaultField="ownerName"
          suggest={(f, cur) => (f === "ownerName" ? forgedOwner(cur) : f === "area" ? cur.replace(/^[\d.]+/, (n) => String(Number(n) * 4)) : "")}
          onSubmit={(input) => tamperCustom.run(input)}
          pending={tamperCustom.pending}
          error={tamperCustom.error}
        />
      )}
    </div>
  );
}

function StateRow({ label, value, ok, okText, badText }: { label: string; value: React.ReactNode; ok?: "pass" | "fail" | "warn"; okText: string; badText: string }) {
  const tone = ok === "fail" ? "red" : ok === "warn" ? "amber" : ok === "pass" ? "green" : "slate";
  return (
    <div className="grid grid-cols-[130px_1fr_auto] items-center gap-3 px-4 py-2.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate">{value}</dd>
      <dd className={cx("flex items-center gap-2 text-right font-semibold", tone === "red" ? "text-red-300" : tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-slate-500")}>
        <Dot tone={tone} />{ok ? (ok === "fail" ? badText : okText) : "…"}
      </dd>
    </div>
  );
}
