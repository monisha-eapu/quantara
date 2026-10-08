import { ArrowRight, Blocks, CheckCircle2, FileJson, Fingerprint, KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button, Section, cx, ErrorState, Field, Hash, InlineError, KV, Loading, PageHeader, Pill } from "../components/ui";
import { api, type RecordSummary, type SigningTrace } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";

interface Meta { propertyTypes: string[]; statuses: string[]; landSigners: { id: string; name: string; organization: string }[] }

const DISTRICTS: Record<string, [string, string][]> = {
  "Andhra Pradesh": [["Vizianagaram", "VZM"], ["Visakhapatnam", "VSP"], ["Srikakulam", "SKL"], ["Guntur", "GNT"], ["Krishna", "KRS"], ["East Godavari", "EGD"], ["Nellore", "NLR"]],
  Telangana: [["Hyderabad", "HYD"], ["Warangal", "WGL"], ["Karimnagar", "KRM"], ["Nalgonda", "NLG"]],
  Karnataka: [["Mysuru", "MYS"], ["Belagavi", "BGM"], ["Dharwad", "DWD"]],
};
const AUTH: Record<string, { authority: string; signer: string; code: string }> = {
  "Andhra Pradesh": { authority: "Revenue Department", signer: "revenue-ap", code: "AP" },
  Telangana: { authority: "Registration & Stamps Department", signer: "subregistrar-ts", code: "TS" },
  Karnataka: { authority: "Survey Settlement & Land Records", signer: "land-registry-ka", code: "KA" },
};

const randomId = (state: string, code: string) => `${AUTH[state].code}-${code}-${String(Math.floor(60000 + Math.random() * 39999))}`;

export default function CreateLandRecord() {
  const meta = useApi(() => api.get<Meta>("/records/meta"));
  const [form, setForm] = useState(() => ({
    propertyId: randomId("Andhra Pradesh", "VZM"), ownerName: "", surveyNumber: "", district: "Vizianagaram", state: "Andhra Pradesh",
    area: "", propertyType: "Agricultural", registrationDate: new Date().toISOString().slice(0, 10), status: "Active",
    issuingAuthority: "Revenue Department", signerId: "revenue-ap",
  }));
  const [result, setResult] = useState<{ record: RecordSummary; trace: SigningTrace } | null>(null);
  const create = useAction(async () => setResult(await api.post<{ record: RecordSummary; trace: SigningTrace }>("/records", form)));
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setState = (state: string) => {
    const [district, code] = DISTRICTS[state][0];
    setForm((f) => ({ ...f, state, district, propertyId: randomId(state, code), issuingAuthority: AUTH[state].authority, signerId: AUTH[state].signer }));
  };
  const setDistrict = (district: string) => {
    const code = DISTRICTS[form.state].find(([d]) => d === district)?.[1] ?? "XXX";
    setForm((f) => ({ ...f, district, propertyId: randomId(f.state, code) }));
  };

  if (meta.loading) return <Loading />;
  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.reload} />;

  return (
    <div>
      <PageHeader title="Create land record" description="On submission the server canonicalises the record, computes its SHA-256 fingerprint, signs it with the authority's ML-DSA-65 private key (which never leaves the server) and appends a ledger block linked to the previous block." />
      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Record details" description="Fictional data only">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
            <Field label="Property ID" hint="Format: STATE-DISTRICT-NUMBER"><input className="input font-mono" value={form.propertyId} onChange={set("propertyId")} required /></Field>
            <Field label="Owner name"><input className="input" value={form.ownerName} onChange={set("ownerName")} placeholder="e.g. Kavitha Reddy" required minLength={2} /></Field>
            <Field label="State">
              <select className="input" value={form.state} onChange={(e) => setState(e.target.value)}>{Object.keys(DISTRICTS).map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="District">
              <select className="input" value={form.district} onChange={(e) => setDistrict(e.target.value)}>{DISTRICTS[form.state].map(([d]) => <option key={d}>{d}</option>)}</select>
            </Field>
            <Field label="Survey number"><input className="input" value={form.surveyNumber} onChange={set("surveyNumber")} placeholder="e.g. 184/2" required /></Field>
            <Field label="Area"><input className="input" value={form.area} onChange={set("area")} placeholder="e.g. 2.4 acres" required /></Field>
            <Field label="Property type">
              <select className="input" value={form.propertyType} onChange={set("propertyType")}>{meta.data!.propertyTypes.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={set("status")}>{meta.data!.statuses.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Registration date"><input type="date" className="input" value={form.registrationDate} onChange={set("registrationDate")} required /></Field>
            <Field label="Issuing authority"><input className="input" value={form.issuingAuthority} onChange={set("issuingAuthority")} required /></Field>
            <div className="sm:col-span-2">
              <Field label="Signing officer (ML-DSA-65 key)">
                <select className="input" value={form.signerId} onChange={set("signerId")}>
                  {meta.data!.landSigners.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.organization}</option>)}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2"><InlineError error={create.error} /></div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" variant="primary" size="lg" loading={create.pending} icon={<Plus className="h-4 w-4" />}>Sign and anchor record</Button>
            </div>
          </form>
        </Section>

        <Section title="Security pipeline" description={result ? `Completed for ${result.record.id}` : "Runs on submit"}>
          {!result ? (
            <ol className="space-y-3">
              {[
                [<FileJson className="h-4 w-4" />, "Canonical record data", "Deterministic, sorted-key JSON so the same record always yields the same bytes."],
                [<Fingerprint className="h-4 w-4" />, "SHA-256 content fingerprint", "256-bit hash of the canonical bytes."],
                [<KeyRound className="h-4 w-4" />, "ML-DSA-65 digital signature", "Post-quantum signature (FIPS 204) by the issuing authority."],
                [<Blocks className="h-4 w-4" />, "Ledger block", "Appended to the chain; its hash commits to the previous block."],
              ].map(([icon, t, d], i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-ink-700 p-3.5">
                  <div className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-slate-300", create.pending && "scanline")}>{icon}</div>
                  <div><div className="text-sm font-medium text-slate-100">{i + 1}. {t}</div><div className="text-xs text-slate-400">{d}</div></div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="space-y-3">
              <Step n={1} title="Canonical record" meta={`${result.trace.canonicalBytes} bytes · ${result.trace.timingsMs.canonicalize} ms`}>
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-md bg-ink-950/70 p-2.5 font-mono text-[10.5px] text-slate-300">{result.trace.canonical}</pre>
              </Step>
              <Step n={2} title="SHA-256 hash" meta={`${result.trace.timingsMs.hash} ms`}><Hash value={result.trace.dataHash} full /></Step>
              <Step n={3} title={`${result.trace.algorithm} signature`} meta={`${result.trace.signatureBytes.toLocaleString()} bytes · ${result.trace.timingsMs.sign} ms`}>
                <div className="text-xs text-slate-400">Signed by {result.trace.signer.name} · {result.trace.signer.organization}</div>
                <code className="mt-1 block break-all font-mono text-[10.5px] text-slate-300">{result.trace.signaturePreview}…</code>
              </Step>
              <Step n={4} title={`Ledger block #${result.trace.block.index}`} meta={`${result.trace.timingsMs.ledger} ms`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <KV label="Previous hash"><Hash value={result.trace.block.previousHash} n={8} /></KV>
                  <KV label="Block hash"><Hash value={result.trace.block.blockHash} n={8} /></KV>
                </div>
              </Step>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Pill tone="green"><CheckCircle2 className="h-3.5 w-3.5" /> Record protected</Pill>
                <div className="flex gap-2">
                  <Button onClick={() => { setResult(null); setForm((f) => ({ ...f, ownerName: "", surveyNumber: "", area: "", propertyId: randomId(f.state, DISTRICTS[f.state].find(([d]) => d === f.district)?.[1] ?? "VZM") })); }}>Register another</Button>
                  <Link to={`/records/${result.record.id}`}><Button variant="primary">Open record <ArrowRight className="h-4 w-4" /></Button></Link>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Step({ n, title, meta, children }: { n: number; title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="fade-up rounded-lg border border-ink-700 p-3.5" style={{ animationDelay: `${n * 90}ms` }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> {n}. {title}</div>
        <span className="text-[11px] text-slate-500">{meta}</span>
      </div>
      {children}
    </div>
  );
}
