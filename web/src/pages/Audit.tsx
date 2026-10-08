import { BookLock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button, cx, Dot, Empty, ErrorState, Hash, Loading, PageHeader } from "../components/ui";
import { api, type AuditEntry } from "../lib/api";
import { formatDate, formatTime, nf } from "../lib/format";
import { useApi } from "../lib/hooks";

const PAGE = 25;
const RESULT: Record<string, { tone: "green" | "red" | "amber" | "slate" | "blue"; text: string; label: string }> = {
  SUCCESS: { tone: "green", text: "text-emerald-300", label: "Success" },
  VALID: { tone: "green", text: "text-emerald-300", label: "Valid" },
  RESTORED: { tone: "blue", text: "text-brand-300", label: "Restored" },
  INVALID: { tone: "red", text: "text-red-300", label: "Invalid" },
  DETECTED: { tone: "red", text: "text-red-300", label: "Detected" },
  FAILED: { tone: "red", text: "text-red-300", label: "Failed" },
  WARNING: { tone: "amber", text: "text-amber-300", label: "Simulated" },
  INFO: { tone: "slate", text: "text-slate-400", label: "Info" },
};

const link = (id: string) => id.startsWith("LAND-") ? `/records/${id}` : /-E\d+$/.test(id) ? `/supply-chain/${id.replace(/-E\d+$/, "")}` : /^[A-Z]+-[A-Z]+-\d+$/.test(id) ? `/supply-chain/${id}` : null;

export default function Audit() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setDebounced(q.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useApi(
    () => api.get<{ entries: AuditEntry[]; total: number; actions: string[] }>(`/audit?limit=${PAGE}&offset=${page * PAGE}&q=${encodeURIComponent(debounced)}&action=${action}&result=${result}`),
    [debounced, action, result, page], { pollMs: 10000 },
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div>
      <PageHeader title="Audit Trail" description="Every creation, verification, tampering attempt, detection, migration and quantum job, with the actor, result and content hash." />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search record, actor or details" aria-label="Search audit trail" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
          <option value="">All actions</option>
          {data?.actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
        <select className="input w-auto" aria-label="Result" value={result} onChange={(e) => { setResult(e.target.value); setPage(0); }}>
          <option value="">All results</option>
          {Object.entries(RESULT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.entries.length ? (
        <div className="rounded-lg border border-ink-700"><Empty icon={<BookLock className="h-7 w-7" />} title="No audit entries match these filters" /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th">Timestamp</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Record</th><th className="th">Result</th><th className="th">Hash</th><th className="th">Details</th></tr></thead>
            <tbody className="divide-y divide-ink-800">
              {data.entries.map((e) => {
                const r = RESULT[e.result] ?? RESULT.INFO;
                const href = e.recordId ? link(e.recordId) : null;
                return (
                  <tr key={e.id} className={cx(r.tone === "red" && "bg-red-500/[0.04]")}>
                    <td className="td whitespace-nowrap"><span className="font-mono text-[12px] text-slate-100">{formatTime(e.timestamp)}</span><span className="ml-2 text-[11px] text-slate-500">{formatDate(e.timestamp)}</span></td>
                    <td className="td text-slate-300">{e.actor}</td>
                    <td className="td font-medium text-slate-100">{e.action.replace(/_/g, " ")}</td>
                    <td className="td font-mono text-[12px]">{e.recordId ? (href ? <Link to={href} className="text-brand-300 hover:underline">{e.recordId}</Link> : <span className="text-slate-400">{e.recordId}</span>) : <span className="text-slate-600">—</span>}</td>
                    <td className="td"><span className={cx("inline-flex items-center gap-2 font-semibold", r.text)}><Dot tone={r.tone} />{r.label.toUpperCase()}</span></td>
                    <td className="td"><Hash value={e.hash} n={5} /></td>
                    <td className="td max-w-[320px] truncate text-xs text-slate-500" title={e.details ?? ""}>{e.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-ink-700 bg-ink-900 px-4 py-2.5 text-xs text-slate-400">
            <span>{nf.format(data.total)} entries · page {page + 1} of {nf.format(pages)}</span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" />}>Previous</Button>
              <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
