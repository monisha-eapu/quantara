import { ArrowDown, FlaskConical, Link2, Link2Off, RotateCcw, Search, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button, CheckIcon, cx, Empty, ErrorState, Hash, InlineError, KV, Loading, Modal, PageHeader, Pill, Section } from "../components/ui";
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

const PAGE = 10;
const TYPE_LABEL: Record<string, string> = { LAND_RECORD: "Land record", SUPPLY_PRODUCT: "Product", SUPPLY_EVENT: "Provenance event", GENESIS: "Genesis" };
const recordHref = (b: Block) => b.recordType === "LAND_RECORD" ? `/records/${b.recordId}` : b.recordType === "SUPPLY_PRODUCT" ? `/supply-chain/${b.recordId}` : b.recordType === "SUPPLY_EVENT" ? `/supply-chain/${b.recordId.replace(/-E\d+$/, "")}` : null;
const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour12: false });

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
        title="Ledger"
        description="An append-only chain. Each block commits to its content and to the hash of the block before it, so altering any past block is detectable."
        actions={<Button variant="primary" size="lg" onClick={() => verify.run()} loading={verify.pending} icon={<ShieldCheck className="h-4 w-4" />}>Verify entire ledger</Button>}
      />

      {verify.error && <div className="mb-5"><InlineError error={verify.error} /></div>}
      {report && (
        <div className={cx("fade-up mb-8 rounded-lg border px-5 py-4", report.valid ? "border-emerald-500/45 bg-emerald-500/[0.06]" : "border-red-500/50 bg-red-500/[0.07]")} role="status">
          <div className="flex items-start gap-4">
            {report.valid ? <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-400" /> : <ShieldX className="mt-0.5 h-6 w-6 text-red-400" />}
            <div className="min-w-0 flex-1">
              <div className={cx("text-[22px] font-bold leading-tight", report.valid ? "text-emerald-300" : "text-red-300")}>{report.valid ? "LEDGER INTEGRITY VERIFIED" : "LEDGER INTEGRITY FAILED"}</div>
              <div className="mt-1 text-[13px] text-slate-300">{nf.format(report.totalBlocks)} block hashes recomputed · {nf.format(report.totalBlocks - 1)} links checked · {nf.format(report.totalBlocks)} signatures verified · {report.durationMs} ms</div>
              {!report.valid && (
                <ul className="mt-3 space-y-1.5 text-[13px]">
                  {report.issues.slice(0, 6).map((i, k) => (
                    <li key={k} className="flex flex-wrap items-center gap-2"><Pill tone="red">{i.kind.replace(/_/g, " ")}</Pill><button className="text-left text-red-200 hover:underline" onClick={() => setParams({ block: String(i.index) })}>{i.message}</button></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Section
          title="Blocks"
          description={`${nf.format(total)} blocks, newest first. Select a block to inspect it.`}
          actions={
            <form onSubmit={search} className="flex gap-2">
              <input className="input h-8 w-52 py-1 text-[13px]" placeholder="Block # or record ID" aria-label="Find block" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <Button size="sm" type="submit" icon={<Search className="h-3.5 w-3.5" />}>Find</Button>
            </form>
          }
        >
          {loadError ? <ErrorState error={loadError} onRetry={() => load()} /> : loading && !blocks.length ? <Loading /> : !blocks.length ? (
            <Empty title="No blocks found" description="No ledger block matches that record ID." action={<Button size="sm" onClick={() => { setFilter(""); load(); }}>Show all blocks</Button>} />
          ) : (
            <div>
              {blocks.map((b, i) => {
                const bad = !b.hashValid || !b.linkValid;
                const older = blocks[i + 1];
                const contiguous = older && older.index === b.index - 1;
                return (
                  <div key={b.index}>
                    <div
                      role="button" tabIndex={0}
                      onClick={() => setParams({ block: String(b.index) })}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setParams({ block: String(b.index) }); } }}
                      className={cx("cursor-pointer rounded-lg border px-4 py-3.5 transition-colors", bad ? "border-red-500/50 bg-red-500/[0.06]" : "border-ink-700 bg-ink-900 hover:border-ink-600 hover:bg-ink-850")}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-3"><span className="font-mono text-[16px] font-semibold text-white">Block #{b.index}</span><span className="text-xs text-slate-500">{TYPE_LABEL[b.recordType] ?? b.recordType} · {b.action.toLowerCase()}</span></div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {bad && <Pill tone="red">Integrity failure</Pill>}
                          <span className="font-mono">{hhmmss(b.timestamp)}</span><span>{formatDateTime(b.timestamp).split(",").slice(0, 2).join(",")}</span>
                        </div>
                      </div>
                      <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_0.7fr]">
                        <KV label="Record"><span className="font-mono text-[12px]">{b.recordId}</span></KV>
                        <KV label="Previous hash"><Hash value={b.previousHash} n={6} tone={b.linkValid ? undefined : "red"} /></KV>
                        <KV label="Current hash"><Hash value={b.blockHash} n={6} tone={b.hashValid ? undefined : "red"} /></KV>
                        <KV label="Signature"><span className="text-[12px] text-slate-300">{b.algorithm}</span></KV>
                      </dl>
                    </div>
                    {contiguous && (
                      <div className="flex items-center gap-2 py-1.5 pl-5 text-[11px]">
                        <ArrowDown className={cx("h-3.5 w-3.5", b.linkValid ? "text-slate-500" : "text-red-400")} />
                        {b.linkValid
                          ? <span className="flex items-center gap-1.5 text-slate-500"><Link2 className="h-3 w-3 text-emerald-400" /> previous hash of #{b.index} equals current hash of #{older.index}</span>
                          : <span className="flex items-center gap-1.5 font-semibold text-red-300"><Link2Off className="h-3 w-3" /> Broken link: #{b.index} does not point to the current hash of #{older.index}</span>}
                      </div>
                    )}
                    {!contiguous && i < blocks.length - 1 && <div className="py-2 pl-5 text-[11px] text-slate-600">⋯</div>}
                  </div>
                );
              })}
              {blocks.length > 0 && blocks[blocks.length - 1].index > 0 && !filter && (
                <div className="mt-5"><Button size="sm" loading={loading} onClick={() => load({ before: blocks[blocks.length - 1].index, append: true })}>Load older blocks</Button></div>
              )}
            </div>
          )}
        </Section>

        <div className="space-y-9">
          <Section title="How a block is built">
            <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-300">{`index
timestamp
recordId · recordType · action
dataHash       SHA-256 of record
signature      ML-DSA-65
signer
previousHash   hash of block n-1
─────────────────────────────
blockHash = SHA-256(all of the above)`}</pre>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">A single-node permissioned ledger for the prototype. There is no mining or token. A production deployment would replicate it across independent authorities with Byzantine fault-tolerant consensus.</p>
          </Section>
          <Section title="What protects what">
            <p className="text-[13px] leading-relaxed text-slate-400">The hash chain makes history tamper-evident. It is not what makes the system post-quantum: SHA-256 links are expected to remain sound against known quantum attacks. What needs replacing for the quantum era is the signature scheme, so every block carries an ML-DSA signature.</p>
          </Section>
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
    <Modal open onClose={onClose} title={<span className="font-mono">Block #{index}</span>} wide>
      {error ? <ErrorState error={error} /> : !data ? <Loading /> : (
        <div className="space-y-6">
          <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {checks.map(([label, ok]) => (
              <li key={label} className={cx("flex items-center gap-2 text-[13px]", ok === null ? "text-slate-500" : ok ? "text-slate-200" : "font-semibold text-red-300")}>
                {ok === null ? <span className="w-4 text-center">–</span> : <CheckIcon status={ok ? "pass" : "fail"} className="h-4 w-4" />}
                {label}{ok === null && " (tip of chain)"}
              </li>
            ))}
          </ul>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <KV label="Record">{href ? <Link to={href} className="font-mono text-[12px] text-brand-300 hover:underline" onClick={onClose}>{data.block.recordId}</Link> : <span className="font-mono text-[12px]">{data.block.recordId}</span>}</KV>
            <KV label="Signer">{data.block.signer}</KV>
            <KV label="Timestamp">{formatDateTime(data.block.timestamp)}</KV>
            <KV label="Signature">{data.block.algorithm} · {data.signatureBytes.toLocaleString()} bytes</KV>
            <KV label="Stored block hash"><Hash value={data.block.blockHash} full tone={data.checks.blockHashValid ? undefined : "red"} /></KV>
            <KV label="Recomputed block hash"><Hash value={data.recomputedHash} full tone={data.checks.blockHashValid ? "green" : "red"} /></KV>
            <KV label="Previous hash (stored)"><Hash value={data.block.previousHash} full /></KV>
            <KV label={data.previousBlock ? `Current hash of block #${data.previousBlock.index}` : "Genesis"}><Hash value={data.previousBlock?.blockHash ?? "0".repeat(64)} full tone={data.checks.previousLinkValid ? undefined : "red"} /></KV>
          </dl>
          <div>
            <div className="label mb-1.5">Canonical header (input to SHA-256)</div>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-[11px] text-slate-400">{data.canonicalHeader}</pre>
          </div>
          {index > 0 && (
            <div className="border-t border-ink-700 pt-5">
              <div className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-slate-100"><FlaskConical className="h-4 w-4 text-red-400" /> Ledger tampering simulation</div>
              <p className="mb-3 text-[13px] text-slate-400">Demonstration only. Overwrites this block's data hash directly in the database, as an insider bypassing the append-only API might.</p>
              <InlineError error={tamper.error ?? restore.error} />
              <div className="mt-2 flex flex-wrap gap-2">
                {data.block.demoTampered ? (
                  <Button variant="secondary" onClick={() => restore.run()} loading={restore.pending} icon={<RotateCcw className="h-4 w-4" />}>Restore original block</Button>
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
