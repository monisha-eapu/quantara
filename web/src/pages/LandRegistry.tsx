import { ChevronLeft, ChevronRight, Landmark, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, cx, Empty, ErrorState, Loading, PageHeader, StatusBadge } from "../components/ui";
import { api, type RecordSummary } from "../lib/api";
import { nf, timeAgo } from "../lib/format";
import { useApi } from "../lib/hooks";

const PAGE = 15;
const YEARS = Array.from({ length: 12 }, (_, i) => String(2026 - i));

export default function LandRegistry() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [ptype, setPtype] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setDebounced(q.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);

  const meta = useApi(() => api.get<{ propertyTypes: string[] }>("/records/meta"));
  const { data, error, loading, reload } = useApi(
    () => api.get<{ records: RecordSummary[]; total: number }>(`/records?type=LAND_RECORD&featuredFirst=true&limit=${PAGE}&offset=${page * PAGE}&q=${encodeURIComponent(debounced)}&status=${status}&propertyType=${encodeURIComponent(ptype)}&year=${year}`),
    [debounced, status, ptype, year, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const reset = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { fn(e.target.value); setPage(0); };

  return (
    <div>
      <PageHeader
        title="Land Registry"
        description="Manage and verify protected property records."
        actions={<Button variant="primary" onClick={() => navigate("/land/new")} icon={<Plus className="h-4 w-4" />}>Create record</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search property ID, owner, survey number, district" aria-label="Search records" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" aria-label="Property type" value={ptype} onChange={reset(setPtype)}>
          <option value="">All property types</option>
          {meta.data?.propertyTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-auto" aria-label="Verification status" value={status} onChange={reset(setStatus)}>
          <option value="">All verification states</option>
          <option value="VERIFIED">Verified</option><option value="TAMPERED">Tampered</option><option value="LEGACY">Legacy crypto</option><option value="UNVERIFIED">Not yet verified</option>
        </select>
        <select className="input w-auto" aria-label="Registration year" value={year} onChange={reset(setYear)}>
          <option value="">Any registration year</option>
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data || data.records.length === 0 ? (
        <div className="rounded-lg border border-ink-700"><Empty icon={<Landmark className="h-7 w-7" />} title="No land records match these filters" description="Clear a filter or register a new record." action={<Link to="/land/new" className="text-[13px] text-brand-400 hover:underline">Create record</Link>} /></div>
      ) : (
        <div className={cx("overflow-x-auto rounded-lg border border-ink-700 transition-opacity", loading && "opacity-60")}>
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-b border-ink-700 bg-ink-900">
              <tr><th className="th">Property ID</th><th className="th">Owner</th><th className="th">Survey number</th><th className="th">District</th><th className="th">Area</th><th className="th">Status</th><th className="th text-right">Last verified</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {data.records.map((r) => {
                const d = r.data as Record<string, string>;
                return (
                  <tr key={r.id} className="cursor-pointer hover:bg-ink-900" onClick={() => navigate(`/records/${r.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/records/${r.id}`)}>
                    <td className="td font-mono text-[12px] font-medium text-white">{d.propertyId}</td>
                    <td className="td font-medium text-slate-100">{d.ownerName}</td>
                    <td className="td text-slate-300">{d.surveyNumber}</td>
                    <td className="td text-slate-300">{d.district}<span className="text-slate-500">, {d.state === "Andhra Pradesh" ? "AP" : d.state === "Telangana" ? "TS" : d.state === "Karnataka" ? "KA" : d.state}</span></td>
                    <td className="td text-slate-300">{d.area}<span className="block text-[11px] text-slate-500">{d.propertyType}</span></td>
                    <td className="td"><StatusBadge status={r.integrityStatus} /></td>
                    <td className="td whitespace-nowrap text-right text-slate-400">{timeAgo(r.lastVerifiedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-ink-700 bg-ink-900 px-4 py-2.5 text-xs text-slate-400">
            <span>{nf.format(data.total)} records · page {page + 1} of {nf.format(pages)}</span>
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
