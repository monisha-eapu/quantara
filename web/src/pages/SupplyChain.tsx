import { Boxes, MapPin, Plus, Truck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { STAGE_META, STAGES } from "../components/stages";
import { Button, Card, cx, Empty, ErrorState, Field, InlineError, Loading, Modal, PageHeader, Pill, StatusBadge } from "../components/ui";
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
        eyebrow="Supply chain provenance"
        title="Product provenance"
        description="Every custody transfer is a signed event. Each event's hash commits to the previous event's hash, and each is signed with ML-DSA-65 by the accountable party, giving a tamper-evident chain from manufacture to retail."
        actions={<Button variant="primary" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Register product batch</Button>}
      />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.products.length ? (
        <Card><Empty icon={<Boxes className="h-8 w-8" />} title="No products yet" description="Register a product batch to start a provenance chain." /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.products.map((p) => {
            const tampered = p.integrityStatus === "TAMPERED" || p.eventIntegrity === "TAMPERED";
            const reached = new Set(p.stages);
            return (
              <button key={p.id} onClick={() => navigate(`/supply-chain/${p.id}`)} className={cx("glass group rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-500/40", tampered && "ring-1 ring-red-500/40")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-brand-300">{p.id}</div>
                    <div className="mt-1 truncate text-lg font-semibold text-white">{String(p.data.productName)}</div>
                    <div className="text-xs text-slate-400">{String(p.data.manufacturer)} · {String(p.data.origin)}</div>
                  </div>
                  <StatusBadge status={tampered ? "TAMPERED" : p.integrityStatus} />
                </div>
                <div className="mt-5 flex items-center">
                  {STAGES.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <div title={STAGE_META[s].label} className={cx("grid h-8 w-8 place-items-center rounded-full border transition", reached.has(s) ? "border-brand-400/60 bg-brand-500/20 text-brand-300 shadow-[0_0_14px_-2px_rgba(47,123,255,0.8)]" : "border-white/10 bg-white/[0.02] text-slate-600")}>
                        {STAGE_META[s].icon}
                      </div>
                      {i < STAGES.length - 1 && <div className={cx("mx-1 h-px flex-1", reached.has(STAGES[i + 1]) ? "bg-brand-400/60" : "bg-white/10")} />}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  {p.currentState && (
                    <>
                      <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {p.currentState.status}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.currentState.location}</span>
                      <span>Custodian: <span className="text-slate-200">{p.currentState.custodian}</span></span>
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                  <span>{p.eventCount} signed events · {String(p.data.certification)}</span>
                  <span>{p.currentState ? `updated ${timeAgo(p.currentState.updatedAt)}` : ""}</span>
                </div>
              </button>
            );
          })}
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
        <div className="sm:col-span-2 text-xs text-slate-400">Creates a signed product record plus a signed <Pill tone="blue">MANUFACTURED</Pill> event, each anchored in its own ledger block.</div>
        <div className="sm:col-span-2"><InlineError error={create.error} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.pending}>Sign &amp; register</Button>
        </div>
      </form>
    </Modal>
  );
}
