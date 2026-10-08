import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Btn, cx, ErrorState, Loading, PageTitle, Status, TableCard, theadCls, rowCls, type Tone } from "../components/ui";
import { api, type AuditEntry } from "../lib/api";
import { formatDate, formatTime, nf } from "../lib/format";
import { useApi } from "../lib/hooks";

const PAGE = 25;
const FILTERS: [string, string, string][] = [
  ["all", "All", ""],
  ["records", "Records", "CREATE_RECORD,SUPPLY_EVENT,PQC_MIGRATION,RESTORE_ORIGINAL"],
  ["verify", "Verifications", "VERIFY_RECORD,VERIFY_PROVENANCE,VERIFY_LEDGER"],
  ["scan", "Scans", "INTEGRITY_SCAN,TAMPER_DETECTED"],
  ["tamper", "Tampering", "TAMPER_ATTEMPT,LEDGER_TAMPER_ATTEMPT,TAMPER_DETECTED"],
  ["quantum", "Quantum", "QUANTUM_JOB_SUBMITTED,PQC_COMPARISON"],
];
const RES: Record<string, { tone: Tone; label: string }> = {
  SUCCESS: { tone: "ok", label: "Success" }, VALID: { tone: "ok", label: "Valid" }, RESTORED: { tone: "ok", label: "Restored" },
  INVALID: { tone: "bad", label: "Invalid" }, DETECTED: { tone: "bad", label: "Detected" }, FAILED: { tone: "bad", label: "Failed" },
  WARNING: { tone: "warn", label: "Simulated" }, INFO: { tone: "mute", label: "Info" },
};
const title = (a: string) => a.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const target = (id: string | null) => (!id ? null : id.startsWith("LAND-") ? `/app/records/${id}` : /-E\d+$/.test(id) ? `/app/supply-chain/${id.replace(/-E\d+$/, "")}` : /^[A-Z]+-[A-Z]+-\d+$/.test(id) ? `/app/supply-chain/${id}` : null);

export default function Audit() {
  const nav = useNavigate();
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);
  const action = FILTERS.find((x) => x[0] === f)?.[2] ?? "";
  const qs = (limit: number, offset: number) => `/audit?limit=${limit}&offset=${offset}&q=${encodeURIComponent(dq)}&action=${encodeURIComponent(action)}`;
  const { data, error, loading, reload } = useApi(() => api.get<{ entries: AuditEntry[]; total: number }>(qs(PAGE, page * PAGE)), [f, dq, page], { pollMs: 10000 });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await api.get<{ entries: AuditEntry[] }>(qs(500, 0));
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = ["timestamp,actor,action,record,result,hash,details", ...r.entries.map((e) => [e.timestamp, e.actor, e.action, e.recordId, e.result, e.hash, e.details].map(esc).join(","))].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a"); a.href = url; a.download = "quantumshield-audit.csv"; a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Audit Trail" sub={`Every action on the registry, recorded and append-only. ${data ? nf.format(data.total) : "…"} entries.`} actions={<Btn variant="outline" loading={exporting} onClick={exportCsv}>Export CSV</Btn>} />
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => <button key={k} onClick={() => { setF(k); setPage(0); }} className={cx("cursor-pointer rounded-full border px-3 py-[7px] text-[13px]", f === k ? "border-ink bg-ink text-paper" : "border-line bg-card")}>{label}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit trail" placeholder="Search record, actor or details" className="inp ml-auto !w-[260px] !py-2 !text-[13px]" />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <TableCard min={900}>
          <thead className={theadCls}><tr><th className="th">Time</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Target</th><th className="th">Result</th><th className="th">Details</th></tr></thead>
          <tbody>
            {data?.entries.map((e) => {
              const r = RES[e.result] ?? RES.INFO, href = target(e.recordId);
              return (
                <tr key={e.id} className={cx(rowCls, r.tone === "bad" && "bg-bad-bg/40")}>
                  <td className="td whitespace-nowrap py-3"><span className="font-mono text-[12px] text-mute">{formatDate(e.timestamp)} {formatTime(e.timestamp)}</span></td>
                  <td className="td py-3">{e.actor}</td>
                  <td className="td py-3">{title(e.action)}</td>
                  <td className="td py-3 font-mono text-[12px]">{e.recordId ? (href ? <button onClick={() => nav(href)} className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] underline underline-offset-[3px]">{e.recordId}</button> : e.recordId) : <span className="text-faint">—</span>}</td>
                  <td className="td py-3"><Status tone={r.tone}>{r.label}</Status></td>
                  <td className="td max-w-[320px] truncate py-3 text-[12px] text-mute" title={e.details ?? ""}>{e.details}</td>
                </tr>
              );
            })}
            {data?.entries.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-[14px] text-mute">No audit entries match these filters.</td></tr>}
          </tbody>
        </TableCard>
      )}
      {data && data.total > PAGE && <div className="flex items-center justify-between text-[13px] text-mute"><span>Page {page + 1} of {nf.format(pages)}</span><span className="flex gap-2"><Btn variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Btn><Btn variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Btn></span></div>}
    </div>
  );
}
