import { ArrowLeft, Blocks, FileSignature, Fingerprint, FlaskConical, Hash as HashIcon, History, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ChangedFields, CheckList, HashComparison, VerdictBanner } from "../components/Verification";
import { TamperDialog, type TamperMode } from "../components/TamperDialog";
import { Button, Card, cx, Empty, ErrorState, Hash, KV, Loading, PageHeader, Pill, StatusBadge } from "../components/ui";
import { api, type EntityVerification, type RecordDetail as Detail } from "../lib/api";
import { fieldLabel, formatDateTime, LAND_FIELD_LABELS, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

const HIDDEN = new Set(["recordType"]);

export default function RecordDetail() {
  const { id = "" } = useParams();
  const { data, error, loading, reload, setData } = useApi(() => api.get<Detail>(`/records/${encodeURIComponent(id)}`), [id]);
  const [report, setReport] = useState<EntityVerification | null>(null);
  const [verifyCount, setVerifyCount] = useState(0);
  const [tamperOpen, setTamperOpen] = useState(false);

  const verify = useAction(async () => {
    const r = await api.post<EntityVerification>(`/records/${encodeURIComponent(id)}/verify`);
    setReport(r);
    setVerifyCount((n) => n + 1);
    await reload();
  });
  const tamper = useAction(async (input: { field: string; value: string; mode: TamperMode }) => {
    const d = await api.post<Detail>(`/records/${encodeURIComponent(id)}/tamper`, input);
    setData(d);
    setReport(null);
    setTamperOpen(false);
  });
  const restore = useAction(async () => {
    const d = await api.post<Detail>(`/records/${encodeURIComponent(id)}/restore`);
    setData(d);
    setReport(null);
  });

  if (loading && !data) return <Loading label="Loading record…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { record } = data;
  const changed = new Set(data.tamper.changedFields.map((f) => f.field));
  const order = Object.keys(LAND_FIELD_LABELS);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  const fields = Object.keys(record.data).filter((k) => !HIDDEN.has(k)).sort((a, b) => rank(a) - rank(b));
  const isPqc = record.algorithm.startsWith("ML-DSA");

  return (
    <div>
      <Link to={record.recordType === "LAND_RECORD" ? "/land" : "/supply-chain"} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to {record.recordType === "LAND_RECORD" ? "Land Registry" : "Supply Chain"}
      </Link>
      <PageHeader
        eyebrow={record.recordType === "LAND_RECORD" ? "Land record" : "Product record"}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono">{record.id}</span><StatusBadge status={record.integrityStatus} /></span>}
        description={record.title}
        actions={
          <>
            <Button variant="primary" size="lg" onClick={() => verify.run()} loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>
              {verifyCount > 0 ? "VERIFY AGAIN" : "VERIFY RECORD"}
            </Button>
            {data.tamper.active ? (
              <Button variant="success" size="lg" onClick={() => restore.run()} loading={restore.pending} icon={<RotateCcw className="h-4 w-4" />}>RESTORE ORIGINAL</Button>
            ) : (
              <Button variant="danger" size="lg" onClick={() => { tamper.clearError(); setTamperOpen(true); }} icon={<FlaskConical className="h-4 w-4" />}>SIMULATE TAMPERING</Button>
            )}
          </>
        }
      />
      {(verify.error || restore.error) && <div className="mb-4"><ErrorState error={(verify.error ?? restore.error)!} /></div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card
            title="Record data"
            subtitle={data.tamper.active ? "⚠ This record has been altered in the database (demo simulation)" : "Canonicalised, hashed and signed at registration"}
            icon={<FileSignature className="h-4 w-4" />}
            className={data.tamper.active ? "ring-1 ring-red-500/40" : undefined}
          >
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((k) => (
                <div key={k} className={cx("rounded-lg p-2 -m-2 transition", changed.has(k) && "bg-red-500/10 ring-1 ring-red-500/40")}>
                  <div className="label mb-1">{fieldLabel(k)}</div>
                  <div className={cx("text-[15px] font-medium", changed.has(k) ? "text-red-300" : "text-white", k === "ownerName" && "text-lg")}>
                    {String(record.data[k])}
                    {changed.has(k) && <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wider text-red-400">altered</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {report ? (
            <div className="space-y-4">
              <VerdictBanner report={report} />
              <div className="grid gap-4 lg:grid-cols-2">
                <CheckList report={report} />
                <div className="space-y-4">
                  <HashComparison report={report} />
                  {report.changedFields && <ChangedFields fields={report.changedFields} />}
                </div>
              </div>
            </div>
          ) : (
            <Card bodyClass="p-0">
              <Empty
                icon={<ShieldCheck className="h-9 w-9 text-brand-400" />}
                title={data.tamper.active ? "Record altered. Run verification to see what the cryptography detects." : "Run an independent verification"}
                description="Recomputes the SHA-256 fingerprint, verifies the ML-DSA signature against the signer's registered public key, and checks the ledger anchor and hash chain. Nothing is taken from cached status."
                action={<Button variant="primary" onClick={() => verify.run()} loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>{verifyCount > 0 ? "Verify again" : "Verify record"}</Button>}
              />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Cryptographic seal" icon={<KeyRound className="h-4 w-4" />} actions={<Pill tone={isPqc ? "blue" : "amber"}>{record.algorithm}</Pill>}>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Signature", record.integrityStatus === "TAMPERED" ? "INVALID" : record.integrityStatus === "UNVERIFIED" ? "PENDING" : "VALID"],
                ["Hash", record.integrityStatus === "TAMPERED" ? "MISMATCH" : record.integrityStatus === "UNVERIFIED" ? "PENDING" : "VERIFIED"],
                ["Ledger", record.integrityStatus === "TAMPERED" ? "MISMATCH" : record.integrityStatus === "UNVERIFIED" ? "PENDING" : "VERIFIED"],
              ].map(([k, v]) => (
                <div key={k} className={cx("rounded-lg border px-2 py-2", v === "PENDING" ? "border-white/10 bg-white/[0.03]" : ["INVALID", "MISMATCH"].includes(v) ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/[0.08]")}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{k}</div>
                  <div className={cx("text-xs font-bold", v === "PENDING" ? "text-slate-300" : ["INVALID", "MISMATCH"].includes(v) ? "text-red-300" : "text-emerald-300")}>{v}</div>
                </div>
              ))}
            </div>
            <p className="mb-4 text-[11px] text-slate-500">Status from last verification · {timeAgo(record.lastVerifiedAt)}</p>
            <div className="space-y-4">
              <KV label="Content hash (SHA-256)"><Hash value={record.dataHash} n={14} /></KV>
              <KV label="Signature"><span className="text-sm">{data.signatureBytes.toLocaleString()} bytes · <Hash value={data.signature} n={12} /></span></KV>
              <KV label="Signed by"><div>{data.signer.name}</div><div className="text-xs text-slate-400">{data.signer.organization}</div></KV>
              <KV label="Public key fingerprint"><span className="flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5 text-slate-500" /><Hash value={data.signer.fingerprint} n={10} /></span></KV>
              {data.legacy && <KV label="Legacy co-signature"><Pill tone="amber">{data.legacy.algorithm} · {data.legacy.signatureBytes} bytes</Pill></KV>}
              <KV label="Signed message"><code className="block break-all rounded-md bg-ink-950/70 p-2 font-mono text-[10.5px] text-slate-300">{data.signingMessage}</code></KV>
            </div>
          </Card>

          <Card title="Ledger anchor" icon={<Blocks className="h-4 w-4" />} actions={<Link to={`/ledger?block=${data.block?.index}`} className="text-xs text-brand-400 hover:underline">Open in explorer</Link>}>
            {data.block ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><span className="font-mono text-lg font-semibold text-white">BLOCK #{data.block.index}</span><Pill>{data.block.action}</Pill></div>
                <KV label="Block hash"><Hash value={data.block.blockHash} n={12} /></KV>
                <KV label="Previous hash"><Hash value={data.block.previousHash} n={12} /></KV>
                <KV label="Timestamp">{formatDateTime(data.block.timestamp)}</KV>
                {data.ledgerHistory.length > 1 && (
                  <div className="border-t border-white/[0.06] pt-3">
                    <div className="label mb-2 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Ledger history</div>
                    {data.ledgerHistory.map((b) => (
                      <div key={b.index} className="flex items-center justify-between py-1 text-xs"><span className="font-mono text-slate-300">#{b.index} · {b.action}</span><span className="text-slate-400">{b.algorithm}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-red-300">Anchor block missing</p>}
          </Card>

          <Card title="Record audit trail" icon={<HashIcon className="h-4 w-4" />} bodyClass="p-0">
            {data.audit.length === 0 ? <Empty title="No audit entries" /> : (
              <ul className="max-h-80 divide-y divide-white/[0.05] overflow-y-auto">
                {data.audit.map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-200">{a.action}</span>
                      <span className={cx("font-semibold", ["DETECTED", "INVALID", "FAILED"].includes(a.result) ? "text-red-300" : a.result === "WARNING" ? "text-amber-300" : "text-emerald-300")}>{a.result}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(a.timestamp)} · {a.actor}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {tamperOpen && (
        <TamperDialog
          open
          onClose={() => setTamperOpen(false)}
          data={record.data}
          fields={fields}
          defaultField="ownerName"
          suggest={(f, cur) => (f === "ownerName" && cur === "Ravi Kumar" ? "Raj Kumar" : f === "area" ? cur.replace(/^[\d.]+/, (n) => String(Number(n) * 4)) : "")}
          onSubmit={(input) => tamper.run(input)}
          pending={tamper.pending}
          error={tamper.error}
        />
      )}
    </div>
  );
}
