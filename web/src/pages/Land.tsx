import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Btn, cx, ErrorState, Field, InlineError, Loading, Modal, PageTitle, IntegrityStatusLabel, rowCls, TableCard, theadCls } from "../components/ui";
import { api, type RecordSummary } from "../lib/api";
import { nf, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

const PAGE = 20;
const DISTRICTS: [string, string][] = [["Vizianagaram", "VZM"], ["Visakhapatnam", "VSP"], ["Srikakulam", "SKL"], ["Guntur", "GNT"], ["Krishna", "KRS"]];
const ST: Record<string, string> = { AP: "AP", "Andhra Pradesh": "AP", Telangana: "TS", Karnataka: "KA" };
const STATE_FILTER: Record<string, string> = { ok: "VERIFIED", legacy: "LEGACY", fail: "TAMPERED" };

export default function Land() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [ptype, setPtype] = useState("");
  const [vf, setVf] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState<{ id: string; block: number } | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);

  const { data, error, loading, reload } = useApi(
    () => api.get<{ records: RecordSummary[]; total: number }>(`/records?type=LAND_RECORD&featuredFirst=true&limit=${PAGE}&offset=${page * PAGE}&q=${encodeURIComponent(dq)}&status=${STATE_FILTER[vf] ?? ""}&propertyType=${encodeURIComponent(ptype)}`),
    [dq, ptype, vf, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const sel = "inp !w-auto";

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Land Registry" sub="Manage and verify protected property records." actions={<Btn onClick={() => setModal(true)} className="!px-[18px] !py-3">+ Create record</Btn>} />

      {notice && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-ok bg-ok-bg px-5 py-3 text-[14px]">
          <span><b className="font-semibold text-ok">Signed and anchored.</b> {notice.id} is now block #{notice.block}.</span>
          <span className="flex gap-4"><button className="cursor-pointer border-0 bg-transparent p-0 text-[14px] underline underline-offset-[3px]" onClick={() => nav(`/app/records/${notice.id}`)}>Open record</button><button className="cursor-pointer border-0 bg-transparent p-0 text-[14px] text-mute" onClick={() => setNotice(null)}>Dismiss</button></span>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search records" placeholder="Search property ID, owner, survey number, district" className="inp min-w-[260px] flex-1" />
        <select className={sel} aria-label="Property type" value={ptype} onChange={(e) => { setPtype(e.target.value); setPage(0); }}><option value="">All property types</option>{["Agricultural", "Residential", "Commercial", "Industrial"].map((t) => <option key={t}>{t}</option>)}</select>
        <select className={sel} aria-label="Verification state" value={vf} onChange={(e) => { setVf(e.target.value); setPage(0); }}><option value="">All verification states</option><option value="ok">Verified</option><option value="legacy">Legacy-signed</option><option value="fail">Integrity failure</option></select>
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <TableCard min={900}>
          <thead className={theadCls}><tr><th className="th">Property ID</th><th className="th">Owner</th><th className="th">Survey no.</th><th className="th">District</th><th className="th">Area</th><th className="th">Status</th><th className="th text-right">Verified</th></tr></thead>
          <tbody className={cx(loading && "opacity-60")}>
            {data?.records.map((r) => {
              const d = r.data as Record<string, string>;
              return (
                <tr key={r.id} tabIndex={0} onClick={() => nav(`/app/records/${r.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/app/records/${r.id}`)} className={cx(rowCls, "cursor-pointer hover:bg-paper")}>
                  <td className="td font-mono text-[13px]">{r.id}</td>
                  <td className="td">{d.ownerName}</td>
                  <td className="td font-mono text-[13px]">{d.surveyNumber}</td>
                  <td className="td">{d.district}<span className="text-faint">, {ST[d.state] ?? d.state}</span></td>
                  <td className="td"><div className="flex flex-col gap-0.5"><span>{d.area}</span><span className="text-[12px] text-mute">{d.propertyType}</span></div></td>
                  <td className="td"><IntegrityStatusLabel status={r.integrityStatus} /></td>
                  <td className="td whitespace-nowrap text-right text-mute">{r.integrityStatus === "TAMPERED" ? "failed " : ""}{timeAgo(r.lastVerifiedAt)}</td>
                </tr>
              );
            })}
            {data && data.records.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-[14px] text-mute">No records match these filters.</td></tr>}
          </tbody>
        </TableCard>
      )}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-mute">
          <span>Showing {data.records.length} of {nf.format(data.total)} land records. Select a row to open it.</span>
          {data.total > PAGE && <span className="flex items-center gap-2"><Btn variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Btn>page {page + 1} of {nf.format(pages)}<Btn variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Btn></span>}
        </div>
      )}
      {modal && <CreateModal onClose={() => setModal(false)} onCreated={(id, block) => { setModal(false); setNotice({ id, block }); setPage(0); reload(); }} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, block: number) => void }) {
  const [f, setF] = useState({ owner: "", survey: "", area: "", district: "Vizianagaram", type: "Agricultural" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const create = useAction(async () => {
    const code = DISTRICTS.find(([d]) => d === f.district)?.[1] ?? "VZM";
    const out = await api.post<{ record: RecordSummary; trace: { block: { index: number } } }>("/records", {
      propertyId: `AP-${code}-${10000 + Math.floor(Math.random() * 89999)}`, ownerName: f.owner, surveyNumber: f.survey, district: f.district, state: "Andhra Pradesh",
      area: f.area, propertyType: f.type, registrationDate: new Date().toISOString().slice(0, 10), status: "Active", issuingAuthority: "Revenue Department", signerId: "revenue-ap",
    });
    onCreated(out.record.id, out.trace.block.index);
  });
  return (
    <Modal open onClose={onClose} title="Create land record" subtitle="The record is signed with your ML-DSA-65 key and anchored as a new block."
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn loading={create.pending} onClick={() => create.run()}>Sign and anchor</Btn></>}>
      <form className="grid grid-cols-2 gap-3.5" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
        <div className="col-span-2"><Field label="Owner"><input className="inp" value={f.owner} onChange={set("owner")} placeholder="Full legal name" autoFocus /></Field></div>
        <Field label="Survey no."><input className="inp min-w-0" value={f.survey} onChange={set("survey")} placeholder="184/2" /></Field>
        <Field label="Area"><input className="inp min-w-0" value={f.area} onChange={set("area")} placeholder="2.4 acres" /></Field>
        <Field label="District"><select className="inp" value={f.district} onChange={set("district")}>{DISTRICTS.map(([d]) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Type"><select className="inp" value={f.type} onChange={set("type")}>{["Agricultural", "Residential", "Commercial", "Industrial"].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <div className="col-span-2 empty:hidden"><InlineError error={create.error} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

