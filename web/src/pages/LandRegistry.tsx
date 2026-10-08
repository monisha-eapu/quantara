import { ChevronLeft, ChevronRight, Map, Plus, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Card, cx, Empty, ErrorState, Hash, Loading, PageHeader, Pill, StatusBadge } from "../components/ui";
import { api, type RecordSummary } from "../lib/api";
import { formatDate, nf } from "../lib/format";
import { useApi } from "../lib/hooks";

const PAGE = 15;
const STATUSES = ["", "VERIFIED", "TAMPERED", "LEGACY", "UNVERIFIED"];

export default function LandRegistry() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setDebounced(q.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);

  const { data, error, loading, reload } = useApi(
    () => api.get<{ records: RecordSummary[]; total: number }>(`/records?type=LAND_RECORD&featuredFirst=true&limit=${PAGE}&offset=${page * PAGE}&q=${encodeURIComponent(debounced)}&status=${status}`),
    [debounced, status, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div>
      <PageHeader
        eyebrow="Land Registry"
        title="Land ownership records"
        description="Each record is canonicalised, fingerprinted with SHA-256, signed with ML-DSA-65 by the issuing authority and anchored on the append-only ledger. All records are fictional."
        actions={<Button variant="primary" onClick={() => navigate("/land/new")} icon={<Plus className="h-4 w-4" />}>Register land record</Button>}
      />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Search by record ID, owner, survey number, district…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.charAt(0) + s.slice(1).toLowerCase() : "All statuses"}</option>)}
          </select>
          {data && <span className="text-xs text-slate-400">{nf.format(data.total)} records</span>}
        </div>
        {loading && !data ? <Loading /> : error ? <div className="p-5"><ErrorState error={error} onRetry={reload} /></div> : !data || data.records.length === 0 ? (
          <Empty icon={<Map className="h-8 w-8" />} title="No land records match" description="Try a different search or register a new record." action={<Link to="/land/new" className="text-sm text-brand-400 hover:underline">Register land record</Link>} />
        ) : (
          <div className={cx("overflow-x-auto transition", loading && "opacity-60")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="label px-5 py-3">Record ID</th><th className="label px-3 py-3">Owner</th><th className="label px-3 py-3">Survey · District</th>
                  <th className="label hidden px-3 py-3 lg:table-cell">Area · Type</th><th className="label hidden px-3 py-3 xl:table-cell">Content hash</th>
                  <th className="label hidden px-3 py-3 md:table-cell">Algorithm</th><th className="label px-5 py-3 text-right">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.records.map((r) => {
                  const d = r.data as Record<string, string>;
                  return (
                    <tr key={r.id} className="cursor-pointer transition hover:bg-white/[0.03]" onClick={() => navigate(`/records/${r.id}`)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-white">{r.featured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}{r.id}</div>
                        <div className="text-[11px] text-slate-500">Registered {formatDate(d.registrationDate)}</div>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-100">{d.ownerName}</td>
                      <td className="px-3 py-3 text-slate-300">{d.surveyNumber} · {d.district}<div className="text-[11px] text-slate-500">{d.state}</div></td>
                      <td className="hidden px-3 py-3 text-slate-300 lg:table-cell">{d.area}<div className="text-[11px] text-slate-500">{d.propertyType} · {d.status}</div></td>
                      <td className="hidden px-3 py-3 xl:table-cell"><Hash value={r.dataHash} n={6} /></td>
                      <td className="hidden px-3 py-3 md:table-cell"><Pill tone={r.algorithm.startsWith("ML-DSA") ? "blue" : "amber"}>{r.algorithm}</Pill></td>
                      <td className="px-5 py-3 text-right"><StatusBadge status={r.integrityStatus} /></td>
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
