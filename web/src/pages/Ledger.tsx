import { ArrowDown, Blocks, FlaskConical, Link2, Link2Off, RotateCcw, Search, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button, Card, CheckIcon, cx, Empty, ErrorState, Hash, InlineError, KV, Loading, Modal, PageHeader, Pill } from "../components/ui";
import { api, type Block, type ChainReport } from "../lib/api";
import { formatDateTime, nf } from "../lib/format";
import { useAction } from "../lib/hooks";

interface ListedBlock extends Block { hashValid: boolean; linkValid: boolean }
interface BlockInspection {
  block: Block;
  canonicalHeader: string;
  recomputedHash: string;
  checks: { blockHashValid: boolean; previousLinkValid: boolean; nextLinkValid: boolean | null; signatureValid: boolean };
  previousBlock: { index: number; blockHash: string } | null;
  nextBlock: { index: number; previousHash: string } | null;
  signatureBytes: number;
}

const PAGE = 12;
const TYPE_TONE: Record<string, "blue" | "cyan" | "violet" | "amber" | "slate"> = { LAND_RECORD: "blue", SUPPLY_PRODUCT: "cyan", SUPPLY_EVENT: "violet", GENESIS: "slate" };
const recordHref = (b: Block) => b.recordType === "LAND_RECORD" ? `/records/${b.recordId}` : b.recordType === "SUPPLY_PRODUCT" ? `/supply-chain/${b.recordId}` : b.recordType === "SUPPLY_EVENT" ? `/supply-chain/${b.recordId.replace(/-E\d+$/, "")}` : null;

export default function Ledger() {
  const [params, setParams] = useSearchParams();
  const [blocks, setBlocks] = useState<ListedBlock[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [report, setReport] = useState<ChainReport | null>(null);
  const selected = params.get("block");

  const load = async (opts: { before?: number; recordId?: string; append?: boolean } = {}) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: String(PAGE) });
      if (opts.before !== undefined) q.set("before", String(opts.before));
      if (opts.recordId) q.set("recordId", opts.recordId);
      const res = await api.get<{ blocks: ListedBlock[]; total: number }>(`/ledger?${q}`);
      setBlocks((prev) => (opts.append ? [...prev, ...res.blocks] : res.blocks));
      setTotal(res.total);
      setLoadError(null);
    } catch (e) {
      setLoadError(e as Error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const verify = useAction(async () => setReport(await api.get<ChainReport>("/ledger/verify")));
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const v = filter.trim();
    if (!v) return load();
    if (/^#?\d+$/.test(v)) setParams({ block: v.replace("#", "") });
    else load({ recordId: v.toUpperCase() });
  };
  const refresh = async () => { await load(); if (report) await verify.run(); };

  return (
    <div>
      <PageHeader
        eyebrow="Permissioned append-only ledger"
        title="Ledger Explorer"
        description="Every block commits to its content (data hash, signature, signer, timestamp) and to the hash of the previous block. Changing any historical block breaks its own hash or the link from the block after it."
        actions={<Button variant="primary" onClick={() => verify.run()} loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>Verify entire ledger</Button>}
      />

      {verify.error && <div className="mb-4"><InlineError error={verify.error} /></div>}
      {report && (
        <div className={cx("fade-up mb-6 rounded-2xl border p-5", report.valid ? "glow-green border-emerald-500/40 bg-emerald-500/[0.07]" : "glow-red border-red-500/50 bg-red-500/[0.08]")}>
          <div className="flex flex-wrap items-center gap-4">
            {report.valid ? <ShieldCheck className="h-9 w-9 text-emerald-300" /> : <ShieldX className="h-9 w-9 text-red-300" />}
            <div className="flex-1">
              <div className="text-lg font-bold text-white">{report.valid ? "LEDGER INTEGRITY VERIFIED" : "LEDGER INTEGRITY FAILED"}</div>
              <div className="text-sm text-slate-300">
                {nf.format(report.totalBlocks)} block hashes recomputed, {nf.format(report.totalBlocks - 1)} links checked and {nf.format(report.totalBlocks)} signatures verified in {report.durationMs} ms
              </div>
            </div>
          </div>
          {!report.valid && (
            <ul className="mt-3 space-y-1 text-sm text-red-200">
              {report.issues.slice(0, 6).map((i, k) => (
                <li key={k} className="flex items-center gap-2"><Pill tone="red">{i.kind}</Pill><button className="text-left hover:underline" onClick={() => setParams({ block: String(i.index) })}>{i.message}</button></li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card
          title="Chain"
          subtitle={`${nf.format(total)} blocks · newest first`}
          icon={<Link2 className="h-4 w-4" />}
          actions={
            <form onSubmit={search} className="flex gap-2">
              <input className="input w-56 py-1.5 text-xs" placeholder="Block # or record ID" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <Button size="sm" type="submit" icon={<Search className="h-3.5 w-3.5" />}>Find</Button>
            </form>
          }
        >
          {loadError ? <ErrorState error={loadError} onRetry={() => load()} /> : loading && !blocks.length ? <Loading /> : !blocks.length ? <Empty title="No blocks found" description="No ledger block matches that record ID." action={<Button size="sm" onClick={() => { setFilter(""); load(); }}>Show all blocks</Button>} /> : (
            <div>
              {blocks.map((b, i) => {
                const bad = !b.hashValid || !b.linkValid;
                const older = blocks[i + 1];
                const contiguous = older && older.index === b.index - 1;
                return (
                  <div key={b.index}>
                    <div role="button" tabIndex={0} onClick={() => setParams({ block: String(b.index) })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setParams({ block: String(b.index) }); } }} className={cx("fade-up w-full cursor-pointer rounded-xl border p-4 text-left transition hover:border-brand-400/50", bad ? "glow-red border-red-500/50 bg-red-500/[0.07]" : "border-white/[0.08] bg-ink-900/50")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cx("grid h-9 w-9 place-items-center rounded-lg", bad ? "bg-red-500/20 text-red-300" : "bg-brand-500/15 text-brand-300")}><Blocks className="h-4 w-4" /></div>
                          <div>
                            <div className="font-mono text-[15px] font-bold text-white">BLOCK #{b.index}</div>
                            <div className="text-[11px] text-slate-400">{formatDateTime(b.timestamp)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill tone={TYPE_TONE[b.recordType] ?? "slate"}>{b.recordType}</Pill>
                          <Pill tone={b.action === "MIGRATE" ? "amber" : "slate"}>{b.action}</Pill>
                          <Pill tone={b.algorithm.startsWith("ML-DSA") ? "blue" : "amber"}>{b.algorithm}</Pill>
                          {bad && <Pill tone="red">INTEGRITY FAILURE</Pill>}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <KV label="Record"><span className="font-mono text-xs">{b.recordId}</span></KV>
                        <KV label="Data hash"><Hash value={b.dataHash} n={6} /></KV>
                        <KV label="Previous hash"><Hash value={b.previousHash} n={6} tone={b.linkValid ? undefined : "red"} /></KV>
                        <KV label="Block hash"><Hash value={b.blockHash} n={6} tone={b.hashValid ? undefined : "red"} /></KV>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">Signed by {b.signer}</div>
                    </div>
                    {contiguous && (
                      <div className="flex items-center gap-2 py-1.5 pl-7 text-[11px]">
                        <ArrowDown className={cx("h-4 w-4", b.linkValid ? "text-brand-400" : "text-red-400")} />
                        {b.linkValid
                          ? <span className="flex items-center gap-1 text-slate-500"><Link2 className="h-3 w-3 text-emerald-400" /> previousHash of #{b.index} = blockHash of #{older.index}</span>
                          : <span className="flex items-center gap-1 font-semibold text-red-300"><Link2Off className="h-3 w-3" /> BROKEN LINK: #{b.index} does not point to the current hash of #{older.index}</span>}
                      </div>
                    )}
                    {!contiguous && i < blocks.length - 1 && <div className="py-2 text-center text-[11px] text-slate-600">⋯</div>}
                  </div>
                );
              })}
              {blocks.length > 0 && blocks[blocks.length - 1].index > 0 && !filter && (
                <div className="mt-4 text-center"><Button size="sm" loading={loading} onClick={() => load({ before: blocks[blocks.length - 1].index, append: true })}>Load older blocks</Button></div>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Block anatomy">
            <pre className="overflow-x-auto rounded-lg bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-300">{`{
  "index":        10291,
  "timestamp":    "…",
  "recordId":     "LAND-AP-…",
  "recordType":   "LAND_RECORD",
  "action":       "CREATE",
  "dataHash":     SHA-256(record),
  "signature":    ML-DSA-65(…),
  "algorithm":    "ML-DSA-65",
  "signer":       "Revenue Officer",
  "previousHash": hash(block n-1)
}
blockHash = SHA-256(canonical(header))`}</pre>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">This is a single-node permissioned ledger for the prototype: no mining, no tokens, no proof-of-work. Production would replicate it across independent authorities with BFT consensus.</p>
          </Card>
          <Card title="Honest note">
            <p className="text-xs leading-relaxed text-slate-400">The hash chain itself is not "quantum-safe" or "quantum-vulnerable". SHA-256 hash links are expected to stay sound against known quantum attacks (Grover gives only a quadratic speed-up). What needs replacing for the post-quantum era is the <span className="text-slate-200">signature</span> scheme, which is why every block carries an ML-DSA signature.</p>
          </Card>
        </div>
      </div>

      {selected !== null && <BlockModal index={Number(selected)} onClose={() => setParams({})} onChanged={refresh} />}
    </div>
  );
}

function BlockModal({ index, onClose, onChanged }: { index: number; onClose: () => void; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<BlockInspection | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setData(null); setError(null);
    api.get<BlockInspection>(`/ledger/blocks/${index}`).then(setData).catch(setError);
  }, [index]);
  const tamper = useAction(async (mode: "EDIT_ONLY" | "EDIT_AND_REHASH") => { setData(await api.post<BlockInspection>(`/ledger/blocks/${index}/tamper`, { mode })); await onChanged(); });
  const restore = useAction(async () => { setData(await api.post<BlockInspection>(`/ledger/blocks/${index}/restore`)); await onChanged(); });

  const href = data ? recordHref(data.block) : null;
  const checks = data ? [
    ["Block hash recomputes", data.checks.blockHashValid],
    ["Links to previous block", data.checks.previousLinkValid],
    ["Next block links here", data.checks.nextLinkValid],
    [`${data.block.algorithm} signature valid`, data.checks.signatureValid],
  ] as const : [];

  return (
    <Modal open onClose={onClose} title={<span className="font-mono">BLOCK #{index}</span>} wide>
      {error ? <ErrorState error={error} /> : !data ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {checks.map(([label, ok]) => (
              <div key={label} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", ok === null ? "border-white/10 text-slate-400" : ok ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200" : "border-red-500/40 bg-red-500/10 text-red-200")}>
                {ok === null ? <span className="text-slate-500">—</span> : <CheckIcon status={ok ? "pass" : "fail"} className="h-4 w-4" />}
                {label}{ok === null && " (tip of chain)"}
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KV label="Record">{href ? <Link to={href} className="font-mono text-xs text-brand-300 hover:underline" onClick={onClose}>{data.block.recordId}</Link> : <span className="font-mono text-xs">{data.block.recordId}</span>}</KV>
            <KV label="Signer">{data.block.signer}</KV>
            <KV label="Timestamp">{formatDateTime(data.block.timestamp)}</KV>
            <KV label="Signature">{data.block.algorithm} · {data.signatureBytes.toLocaleString()} bytes</KV>
            <KV label="Stored block hash"><Hash value={data.block.blockHash} full tone={data.checks.blockHashValid ? undefined : "red"} /></KV>
            <KV label="Recomputed block hash"><Hash value={data.recomputedHash} full tone={data.checks.blockHashValid ? "green" : "red"} /></KV>
            <KV label="Previous hash"><Hash value={data.block.previousHash} full /></KV>
            <KV label={data.previousBlock ? `Hash of block #${data.previousBlock.index}` : "Genesis"}><Hash value={data.previousBlock?.blockHash ?? "0".repeat(64)} full tone={data.checks.previousLinkValid ? undefined : "red"} /></KV>
          </div>
          <div>
            <div className="label mb-1.5">Canonical header (input to SHA-256)</div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink-950/70 p-3 font-mono text-[10.5px] text-slate-400">{data.canonicalHeader}</pre>
          </div>
          {index > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-200"><FlaskConical className="h-4 w-4" /> Ledger tampering simulation (demo)</div>
              <p className="mb-3 text-xs text-slate-400">Overwrites this block's data hash directly in the database, as an insider bypassing the append-only API might.</p>
              <InlineError error={tamper.error ?? restore.error} />
              <div className="mt-2 flex flex-wrap gap-2">
                {data.block.demoTampered ? (
                  <Button variant="success" onClick={() => restore.run()} loading={restore.pending} icon={<RotateCcw className="h-4 w-4" />}>Restore original block</Button>
                ) : (
                  <>
                    <Button variant="danger" size="sm" onClick={() => tamper.run("EDIT_ONLY")} loading={tamper.pending}>Edit block (leave hash stale)</Button>
                    <Button variant="danger" size="sm" onClick={() => tamper.run("EDIT_AND_REHASH")} loading={tamper.pending}>Edit block and recompute its hash</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
