import { Package, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { STAGE_META, STAGES } from "../components/stages";
import { Button, cx, Empty, ErrorState, Field, InlineError, Loading, Modal, PageHeader, Pill, StatusBadge } from "../components/ui";
import { api, type RecordSummary } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface Product extends RecordSummary {
  eventCount: number;
  stages: string[];
  currentState: { custodian: string; location: string; status: string; updatedAt: string } | null;
  eventIntegrity: string;
}

export default function SupplyChain() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<{ products: Product[] }>("/supply-chain/products"));
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Supply Chain"
        description="Track product provenance from manufacture to retail. Every custody transfer is a signed event linked to the one before it."
        actions={<Button variant="primary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Register batch</Button>}
      />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.products.length ? (
        <div className="rounded-lg border border-ink-700"><Empty icon={<Package className="h-7 w-7" />} title="No product batches yet" description="Register a batch to start a provenance chain." /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th">Batch</th><th className="th">Product</th><th className="th">Progress</th><th className="th">Current custodian</th><th className="th">Updated</th><th className="th">Integrity</th></tr></thead>
            <tbody className="divide-y divide-ink-800">
              {data.products.map((p) => {
                const tampered = p.integrityStatus === "TAMPERED" || p.eventIntegrity === "TAMPERED";
                const reached = new Set(p.stages);
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-ink-900" onClick={() => navigate(`/supply-chain/${p.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/supply-chain/${p.id}`)}>
                    <td className="td font-mono text-[12px] font-medium text-white">{p.id}</td>
                    <td className="td"><div className="font-medium text-slate-100">{String(p.data.productName)}</div><div className="text-[11px] text-slate-500">{String(p.data.manufacturer)} · {String(p.data.origin)}</div></td>
                    <td className="td">
                      <div className="flex items-center gap-1" title={`${p.stages.length} of ${STAGES.length} stages recorded`}>
                        {STAGES.map((s) => <span key={s} title={STAGE_META[s].label} className={cx("h-1.5 w-6 rounded-sm", reached.has(s) ? "bg-brand-500" : "bg-ink-700")} />)}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{p.currentState?.status ?? "—"}</div>
                    </td>
                    <td className="td text-slate-300">{p.currentState?.custodian ?? "—"}<div className="text-[11px] text-slate-500">{p.currentState?.location}</div></td>
                    <td className="td whitespace-nowrap text-slate-400">{p.currentState ? timeAgo(p.currentState.updatedAt) : "—"}</td>
                    <td className="td"><StatusBadge status={tampered ? "TAMPERED" : p.integrityStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && <CreateProductModal onClose={() => setOpen(false)} onCreated={(id) => navigate(`/supply-chain/${id}`)} />}
    </div>
  );
}

function CreateProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    productId: `PRD-${Math.floor(1000 + Math.random() * 8999)}`, productName: "", batchId: `PHARMA-BT-${Math.floor(1000 + Math.random() * 8999)}`,
    manufacturer: "Example Pharma Ltd.", origin: "Andhra Pradesh", certification: "WHO-GMP (demo)", category: "Pharmaceutical", initialLocation: "Example Pharma Ltd. Plant, Visakhapatnam",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = useAction(async () => {
    const out = await api.post<{ product: { id: string } }>("/supply-chain/products", form);
    onCreated(out.product.id);
  });
  return (
    <Modal open onClose={onClose} title="Register product batch" wide>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
        <Field label="Product name"><input className="input" value={form.productName} onChange={set("productName")} placeholder="e.g. Paracetamol API" required /></Field>
        <Field label="Batch ID" hint="Becomes the record ID"><input className="input font-mono" value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value.toUpperCase() }))} required /></Field>
        <Field label="Product ID"><input className="input font-mono" value={form.productId} onChange={set("productId")} required /></Field>
        <Field label="Category">
          <select className="input" value={form.category} onChange={set("category")}>{["Pharmaceutical", "Agri-produce", "Food", "Industrial"].map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Manufacturer / producer"><input className="input" value={form.manufacturer} onChange={set("manufacturer")} required /></Field>
        <Field label="Origin"><input className="input" value={form.origin} onChange={set("origin")} required /></Field>
        <Field label="Certification"><input className="input" value={form.certification} onChange={set("certification")} required /></Field>
        <Field label="Manufacturing location"><input className="input" value={form.initialLocation} onChange={set("initialLocation")} required /></Field>
        <div className="text-xs text-slate-400 sm:col-span-2">Creates a signed product record and a signed <Pill tone="blue">MANUFACTURED</Pill> event, each anchored in its own ledger block.</div>
        <div className="sm:col-span-2"><InlineError error={create.error} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.pending}>Sign and register</Button>
        </div>
      </form>
    </Modal>
  );
}
