import { BookLock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button, Card, cx, Empty, ErrorState, Hash, Loading, PageHeader, Pill } from "../components/ui";
import { api, type AuditEntry } from "../lib/api";
import { formatDate, formatTime, nf } from "../lib/format";
import { useApi } from "../lib/hooks";

const PAGE = 25;
const RESULT: Record<string, { tone: "green" | "red" | "amber" | "slate" | "blue"; label: string }> = {
  SUCCESS: { tone: "green", label: "✓ SUCCESS" },
  VALID: { tone: "green", label: "✓ VALID" },
  RESTORED: { tone: "blue", label: "↺ RESTORED" },
  INVALID: { tone: "red", label: "✗ INVALID" },
  DETECTED: { tone: "red", label: "🚨 DETECTED" },
  FAILED: { tone: "red", label: "✗ FAILED" },
  WARNING: { tone: "amber", label: "⚠ WARNING" },
  INFO: { tone: "slate", label: "INFO" },
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
      <PageHeader eyebrow="Accountability" title="Audit trail" description="Every create, verification, tampering attempt, detection, migration and quantum job is logged with actor, result and the relevant content hash." />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Search record, actor, details…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
            <option value="">All actions</option>
            {data?.actions.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select className="input w-auto" value={result} onChange={(e) => { setResult(e.target.value); setPage(0); }}>
            <option value="">All results</option>
            {Object.keys(RESULT).map((r) => <option key={r}>{r}</option>)}
          </select>
          {data && <span className="text-xs text-slate-400">{nf.format(data.total)} entries</span>}
        </div>
        {loading && !data ? <Loading /> : error ? <div className="p-5"><ErrorState error={error} onRetry={reload} /></div> : !data?.entries.length ? (
          <Empty icon={<BookLock className="h-8 w-8" />} title="No audit entries match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th className="label px-5 py-3">Timestamp</th><th className="label px-3 py-3">Actor</th><th className="label px-3 py-3">Action</th><th className="label px-3 py-3">Record</th><th className="label px-3 py-3">Result</th><th className="label hidden px-3 py-3 lg:table-cell">Hash</th><th className="label hidden px-5 py-3 xl:table-cell">Details</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.entries.map((e) => {
                  const r = RESULT[e.result] ?? RESULT.INFO;
                  const href = e.recordId ? link(e.recordId) : null;
                  return (
                    <tr key={e.id} className={cx(r.tone === "red" && "bg-red-500/[0.04]")}>
                      <td className="whitespace-nowrap px-5 py-3"><div className="font-mono text-xs text-white">{formatTime(e.timestamp)}</div><div className="text-[11px] text-slate-500">{formatDate(e.timestamp)}</div></td>
                      <td className="px-3 py-3 text-slate-200">{e.actor}</td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-100">{e.action}</td>
                      <td className="px-3 py-3 font-mono text-xs">{e.recordId ? (href ? <Link to={href} className="text-brand-300 hover:underline">{e.recordId}</Link> : <span className="text-slate-400">{e.recordId}</span>) : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-3"><Pill tone={r.tone}>{r.label}</Pill></td>
                      <td className="hidden px-3 py-3 lg:table-cell"><Hash value={e.hash} n={5} /></td>
                      <td className="hidden max-w-md px-5 py-3 text-xs text-slate-400 xl:table-cell">{e.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-slate-400">
            <span>Page {page + 1} of {nf.format(pages)}</span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" />}>Prev</Button>
              <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
