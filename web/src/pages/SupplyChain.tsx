import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { STAGE_LABEL, STAGES } from "../components/stages";
import { Btn, cx, ErrorState, Field, InlineError, IntegrityStatusLabel, Loading, Modal, PageTitle, Panel, rowCls, TableCard, theadCls } from "../components/ui";
import { api, type RecordSummary } from "../lib/api";
import { shortHash, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface Product extends RecordSummary {
  eventCount: number; stages: string[];
  currentState: { custodian: string; location: string; status: string; updatedAt: string } | null;
  eventIntegrity: string;
}
interface ProductDetailDto { events: { id: string; eventType: string; dataHash: string; algorithm: string; data: { actor: string; custodian: string; location: string; timestamp: string }; integrityStatus: string }[] }

export default function SupplyChain() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<{ products: Product[] }>("/supply-chain/products"));
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = data?.products.find((p) => p.id === sel) ?? data?.products.find((p) => p.id === "PHARMA-BT-9921") ?? data?.products[0];
  const detail = useApi(() => (selected ? api.get<ProductDetailDto>(`/supply-chain/products/${selected.id}`) : Promise.resolve(null)), [selected?.id]);

  useEffect(() => { if (!sel && selected) setSel(selected.id); }, [selected, sel]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Supply Chain" sub="Track product provenance from manufacture to retail. Every custody transfer is a signed event linked to the one before it." actions={<Btn className="!py-3" onClick={() => setOpen(true)}>+ Register batch</Btn>} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <TableCard min={960}>
            <thead className={theadCls}><tr><th className="th">Batch</th><th className="th">Product</th><th className="th">Progress</th><th className="th">Current custodian</th><th className="th">Updated</th><th className="th">Integrity</th></tr></thead>
            <tbody>
              {data?.products.map((p) => {
                const reached = new Set(p.stages);
                const last = STAGES.filter((s) => reached.has(s)).at(-1);
                const bad = p.integrityStatus === "TAMPERED" || p.eventIntegrity === "TAMPERED";
                return (
                  <tr key={p.id} tabIndex={0} onClick={() => setSel(p.id)} onKeyDown={(e) => e.key === "Enter" && setSel(p.id)} className={cx(rowCls, "cursor-pointer hover:bg-paper", selected?.id === p.id && "bg-paper")}>
                    <td className="td font-mono text-[13px]">{p.id}</td>
                    <td className="td"><div className="flex flex-col gap-[3px]"><span>{String(p.data.productName)}</span><span className="text-[12px] text-mute">{String(p.data.manufacturer)} · {String(p.data.origin)}</span></div></td>
                    <td className="td"><div className="flex w-[170px] flex-col gap-1.5"><span className="flex gap-[3px]">{STAGES.map((s) => <span key={s} className={cx("h-[5px] flex-1", reached.has(s) ? "bg-ink" : "bg-line-2")} />)}</span><span className="text-[12px] text-mute">{last ? STAGE_LABEL[last] : "—"}</span></div></td>
                    <td className="td"><div className="flex flex-col gap-[3px]"><span>{p.currentState?.custodian ?? "—"}</span><span className="text-[12px] text-mute">{p.currentState?.location}</span></div></td>
                    <td className="td whitespace-nowrap text-mute">{p.currentState ? timeAgo(p.currentState.updatedAt) : "—"}</td>
                    <td className="td"><IntegrityStatusLabel status={bad ? "TAMPERED" : p.integrityStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>

          {selected && (
            <Panel className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-10 p-7">
              <div className="flex flex-col gap-2.5">
                <span className="eyebrow">Provenance chain</span>
                <span className="font-mono text-[20px]">{selected.id}</span>
                <span className="text-[15px]">{String(selected.data.productName)}</span>
                <span className="text-[13px] leading-relaxed text-mute">{String(selected.data.manufacturer)} · {String(selected.data.origin)}<br />{String(selected.data.certification)}</span>
                <div className="mt-2 flex flex-wrap gap-2"><Btn variant="outline" onClick={() => nav(`/app/verify/${selected.id}`)} className="!py-2.5">Verify full chain</Btn><Btn variant="ghost" onClick={() => nav(`/app/supply-chain/${selected.id}`)} className="!py-2.5">Open details and tamper demo</Btn></div>
              </div>
              <div className="flex flex-col">
                {detail.loading && !detail.data ? <span className="text-[14px] text-mute">Loading events…</span> : detail.data?.events.map((e) => (
                  <div key={e.id} className="grid grid-cols-[18px_1fr_auto] gap-3.5 pb-[18px]">
                    <span className="flex flex-col items-center"><span className={cx("mt-1 h-[11px] w-[11px] rounded-full border-2 bg-ink", e.integrityStatus === "TAMPERED" ? "border-bad bg-bad" : "border-ink")} /><span className="mt-1 w-px flex-1 bg-line" /></span>
                    <span className="flex flex-col gap-[3px]"><span className="text-[14px] font-medium">{STAGE_LABEL[e.eventType] ?? e.eventType}</span><span className="text-[12px] text-mute">{e.data.actor} · signed {e.algorithm}<br />{e.data.location}</span></span>
                    <span className="font-mono text-[12px] text-mute">{shortHash(e.dataHash, 6)}</span>
                  </div>
                ))}
                {detail.data && STAGES.slice(Math.max(0, STAGES.findLastIndex((s) => detail.data!.events.some((e) => e.eventType === s)) + 1)).map((s) => (
                  <div key={s} className="grid grid-cols-[18px_1fr_auto] gap-3.5 pb-[18px]">
                    <span className="flex flex-col items-center"><span className="mt-1 h-[11px] w-[11px] rounded-full border-2 border-line-4" /><span className="mt-1 w-px flex-1 bg-line" /></span>
                    <span className="flex flex-col gap-[3px]"><span className="text-[14px] font-medium text-faint">{STAGE_LABEL[s]}</span><span className="text-[12px] text-mute">Not yet reached</span></span><span />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
      {open && <CreateBatch onClose={() => setOpen(false)} onCreated={(id) => { setOpen(false); reload(); setSel(id); }} />}
    </div>
  );
}

function CreateBatch({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ productId: `PRD-${Math.floor(1000 + Math.random() * 8999)}`, productName: "", batchId: `PHARMA-BT-${Math.floor(1000 + Math.random() * 8999)}`, manufacturer: "Example Pharma Ltd.", origin: "Andhra Pradesh", certification: "WHO-GMP (demo)", category: "Pharmaceutical", initialLocation: "Example Pharma Ltd. Plant, Visakhapatnam" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const create = useAction(async () => { const out = await api.post<{ product: { id: string } }>("/supply-chain/products", f); onCreated(out.product.id); });
  return (
    <Modal open onClose={onClose} wide title="Register product batch" subtitle="Creates a signed product record and a signed Manufactured event, each anchored in its own ledger block."
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn loading={create.pending} onClick={() => create.run()}>Sign and register</Btn></>}>
      <form className="grid gap-3.5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
        <Field label="Product name"><input className="inp" value={f.productName} onChange={set("productName")} placeholder="e.g. Paracetamol API" autoFocus /></Field>
        <Field label="Batch ID" hint="Becomes the record ID"><input className="inp font-mono" value={f.batchId} onChange={(e) => setF((s) => ({ ...s, batchId: e.target.value.toUpperCase() }))} /></Field>
        <Field label="Product ID"><input className="inp font-mono" value={f.productId} onChange={set("productId")} /></Field>
        <Field label="Category"><select className="inp" value={f.category} onChange={set("category")}>{["Pharmaceutical", "Agri-produce", "Food", "Industrial"].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Manufacturer / producer"><input className="inp" value={f.manufacturer} onChange={set("manufacturer")} /></Field>
        <Field label="Origin"><input className="inp" value={f.origin} onChange={set("origin")} /></Field>
        <Field label="Certification"><input className="inp" value={f.certification} onChange={set("certification")} /></Field>
        <Field label="Manufacturing location"><input className="inp" value={f.initialLocation} onChange={set("initialLocation")} /></Field>
        <div className="sm:col-span-2 empty:hidden"><InlineError error={create.error} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
