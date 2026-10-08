import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Banner, Btn, cx, ErrorState, Hash, InlineError, KV, Loading, Modal, PageTitle, SectionHead, Status } from "../components/ui";
import { api, type Block, type ChainReport } from "../lib/api";
import { formatDateTime, nf } from "../lib/format";
import { useAction } from "../lib/hooks";

interface Listed extends Block { hashValid: boolean; linkValid: boolean }
interface Inspection {
  block: Block; canonicalHeader: string; recomputedHash: string;
  checks: { blockHashValid: boolean; previousLinkValid: boolean; nextLinkValid: boolean | null; signatureValid: boolean };
  previousBlock: { index: number; blockHash: string } | null; signatureBytes: number;
}

const PAGE = 8;
const KIND: Record<string, string> = { LAND_RECORD: "Land record", SUPPLY_PRODUCT: "Product", SUPPLY_EVENT: "Provenance event", GENESIS: "Genesis" };
const href = (b: Block) => b.recordType === "LAND_RECORD" ? `/app/records/${b.recordId}` : b.recordType === "SUPPLY_PRODUCT" ? `/app/supply-chain/${b.recordId}` : b.recordType === "SUPPLY_EVENT" ? `/app/supply-chain/${b.recordId.replace(/-E\d+$/, "")}` : null;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(",", ",");

export default function Ledger() {
  const [params, setParams] = useSearchParams();
  const [blocks, setBlocks] = useState<Listed[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [find, setFind] = useState("");
  const [report, setReport] = useState<ChainReport | null>(null);
  const selected = params.get("block");

  const load = async (o: { before?: number; recordId?: string; append?: boolean } = {}) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: String(PAGE) });
      if (o.before !== undefined) q.set("before", String(o.before));
      if (o.recordId) q.set("recordId", o.recordId);
      const r = await api.get<{ blocks: Listed[]; total: number }>(`/ledger?${q}`);
      setBlocks((p) => (o.append ? [...p, ...r.blocks] : r.blocks)); setTotal(r.total); setErr(null);
    } catch (e) { setErr(e as Error); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const verify = useAction(async () => setReport(await api.get<ChainReport>("/ledger/verify")));
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const v = find.trim();
    if (!v) return load();
    if (/^#?\d+$/.test(v)) setParams({ block: v.replace("#", "") }); else load({ recordId: v.toUpperCase() });
  };
  const verified = report?.valid;

  return (
    <div className="flex flex-col gap-7">
      <PageTitle title="Ledger" sub="An append-only chain. Each block commits to its content and to the hash of the block before it, so altering any past block is detectable."
        actions={<Btn className="!py-3" loading={verify.pending} onClick={() => verify.run()}>{verified ? `Ledger verified · ${nf.format(report!.totalBlocks)} blocks` : "Verify entire ledger"}</Btn>} />
      <InlineError error={verify.error} />
      {report && !report.valid && (
        <Banner tone="bad" title="LEDGER INTEGRITY FAILED">
          {nf.format(report.issues.length)} issue(s). {report.issues.slice(0, 4).map((i, k) => <button key={k} onClick={() => setParams({ block: String(i.index) })} className="mt-1 block cursor-pointer border-0 bg-transparent p-0 text-left text-[14px] text-bad underline underline-offset-[3px]">{i.message}</button>)}
        </Banner>
      )}
      {report?.valid && <Banner tone="ok" title="LEDGER INTEGRITY VERIFIED">{nf.format(report.totalBlocks)} block hashes recomputed, {nf.format(report.totalBlocks - 1)} links checked and {nf.format(report.totalBlocks)} signatures verified in {report.durationMs} ms.</Banner>}

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col">
          <SectionHead className="mb-4" title="Blocks" sub={`${nf.format(total)} blocks, newest first. Select a block to inspect it.`}
            right={<form onSubmit={search} className="flex gap-2"><input className="inp !w-44 !py-2 !text-[13px]" aria-label="Find block" placeholder="Block # or record ID" value={find} onChange={(e) => setFind(e.target.value)} /><Btn variant="outline" size="sm" type="submit">Find</Btn></form>} />
          {err ? <ErrorState error={err} onRetry={() => load()} /> : loading && !blocks.length ? <Loading /> : !blocks.length ? <p className="text-[14px] text-mute">No block matches that record ID. <button className="cursor-pointer border-0 bg-transparent p-0 underline" onClick={() => { setFind(""); load(); }}>Show all blocks</button></p> : blocks.map((b, i) => {
            const bad = !b.hashValid || !b.linkValid;
            const older = blocks[i + 1];
            return (
              <div key={b.index} className="flex flex-col">
                <div role="button" tabIndex={0} onClick={() => setParams({ block: String(b.index) })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setParams({ block: String(b.index) }); } }}
                  className={cx("flex cursor-pointer flex-col gap-3.5 rounded border bg-card px-[22px] py-[18px] hover:border-ink", bad ? "border-bad" : "border-line")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-3"><span className="font-mono text-[17px] font-medium">Block #{b.index}</span><span className="text-[13px] text-mute">{KIND[b.recordType] ?? b.recordType} · {b.action.toLowerCase()}</span>{bad && <Status tone="bad" className="text-[13px] font-medium">Integrity failure</Status>}</span>
                    <span className="font-mono text-[12px] text-mute">{when(b.timestamp)}</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 font-mono text-[13px]">
                    <KV label="Record"><span className="break-all font-mono text-[13px]">{b.recordId}</span></KV>
                    <KV label="Previous hash"><Hash value={b.previousHash} className={cx("text-[13px]", !b.linkValid && "text-bad")} /></KV>
                    <KV label="Current hash"><Hash value={b.blockHash} className={cx("text-[13px]", !b.hashValid && "text-bad")} /></KV>
                    <KV label="Signature"><span className="font-mono text-[13px]">{b.algorithm}</span></KV>
                  </div>
                </div>
                {older && older.index === b.index - 1 && (
                  <span className={cx("ml-[22px] border-l border-line-4 py-2.5 pl-[22px] font-mono text-[12px]", b.linkValid ? (verified ? "text-ok" : "text-mute") : "text-bad")}>↓ prev of #{b.index} {b.linkValid ? "=" : "≠"} hash of #{b.index - 1}{verified && b.linkValid ? "  ✓" : ""}</span>
                )}
                {older && older.index !== b.index - 1 && <span className="py-2 pl-[22px] text-[12px] text-faint">⋯</span>}
              </div>
            );
          })}
          {blocks.length > 0 && blocks[blocks.length - 1].index > 0 && !find && <div className="mt-5"><Btn variant="outline" size="sm" loading={loading} onClick={() => load({ before: blocks[blocks.length - 1].index, append: true })}>Load older blocks</Btn></div>}
        </div>

        <div className="sticky top-[84px] flex flex-col gap-5">
          <SectionHead title="How a block is built" />
          <pre className="m-0 overflow-x-auto rounded border border-line bg-card p-[18px] font-mono text-[12.5px] leading-[1.7]">{`index
timestamp
recordId · recordType · action
dataHash       SHA-256 of record
signature      ML-DSA-65
signer
previousHash   hash of block n-1
──────────────────────────────
blockHash = SHA-256(all of the above)`}</pre>
          <p className="m-0 text-[14px] leading-[1.7] text-body">A single-node permissioned ledger for the prototype. There is no mining or token. A production deployment would replicate it across independent authorities with Byzantine fault-tolerant consensus.</p>
          <SectionHead className="mt-3" title="What protects what" />
          <p className="m-0 text-[14px] leading-[1.7] text-body">The hash chain makes history tamper-evident. It is not what makes the system post-quantum: SHA-256 links are expected to remain sound against known quantum attacks. What needs replacing for the quantum era is the signature scheme, so every block carries an ML-DSA signature.</p>
        </div>
      </div>
      {selected !== null && <BlockModal index={Number(selected)} onClose={() => setParams({})} onChanged={async () => { await load(); if (report) await verify.run(); }} />}
    </div>
  );
}

function BlockModal({ index, onClose, onChanged }: { index: number; onClose: () => void; onChanged: () => Promise<void> }) {
  const [d, setD] = useState<Inspection | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  useEffect(() => { setD(null); setErr(null); api.get<Inspection>(`/ledger/blocks/${index}`).then(setD).catch(setErr); }, [index]);
  const tamper = useAction(async (mode: "EDIT_ONLY" | "EDIT_AND_REHASH") => { setD(await api.post<Inspection>(`/ledger/blocks/${index}/tamper`, { mode })); await onChanged(); });
  const restore = useAction(async () => { setD(await api.post<Inspection>(`/ledger/blocks/${index}/restore`)); await onChanged(); });
  const link = d ? href(d.block) : null;
  const checks: [string, boolean | null][] = d ? [["Block hash recomputes", d.checks.blockHashValid], ["Links to the previous block", d.checks.previousLinkValid], ["Next block links here", d.checks.nextLinkValid], [`${d.block.algorithm} signature valid`, d.checks.signatureValid]] : [];
  return (
    <Modal open onClose={onClose} wide title={`Block #${index}`} subtitle={d ? `${KIND[d.block.recordType] ?? d.block.recordType} · ${d.block.action.toLowerCase()} · ${formatDateTime(d.block.timestamp)}` : undefined}>
      {err ? <ErrorState error={err} /> : !d ? <Loading /> : (
        <div className="flex flex-col gap-6">
          <ul className="m-0 grid list-none gap-x-8 gap-y-2 p-0 sm:grid-cols-2">
            {checks.map(([l, ok]) => <li key={l}><Status tone={ok === null ? "mute" : ok ? "ok" : "bad"} className="text-[14px]">{l}{ok === null ? " (tip of chain)" : ""}</Status></li>)}
          </ul>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <KV label="Record">{link ? <Link to={link} onClick={onClose} className="font-mono text-[13px] underline underline-offset-[3px]">{d.block.recordId}</Link> : <span className="font-mono text-[13px]">{d.block.recordId}</span>}</KV>
            <KV label="Signer">{d.block.signer}</KV>
            <KV label="Stored block hash"><Hash full value={d.block.blockHash} className={cx(!d.checks.blockHashValid && "text-bad")} /></KV>
            <KV label="Recomputed block hash"><Hash full value={d.recomputedHash} className={d.checks.blockHashValid ? "text-ok" : "text-bad"} /></KV>
            <KV label="Previous hash (stored)"><Hash full value={d.block.previousHash} /></KV>
            <KV label={d.previousBlock ? `Current hash of block #${d.previousBlock.index}` : "Genesis"}><Hash full value={d.previousBlock?.blockHash ?? "0".repeat(64)} className={cx(!d.checks.previousLinkValid && "text-bad")} /></KV>
          </div>
          <KV label="Signature">{d.block.algorithm} · {d.signatureBytes.toLocaleString()} bytes</KV>
          <div><div className="eyebrow mb-1.5 text-faint">Canonical header (input to SHA-256)</div><pre className="m-0 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-line bg-paper p-3 font-mono text-[11.5px] text-mute">{d.canonicalHeader}</pre></div>
          {index > 0 && (
            <div className="flex flex-col gap-3 border-t border-line-2 pt-5">
              <div><div className="text-[15px] font-semibold">Ledger tampering simulation</div><p className="m-0 mt-1 text-[13px] text-mute">Demonstration only. Overwrites this block's data hash directly in the database, as an insider bypassing the append-only API might.</p></div>
              <InlineError error={tamper.error ?? restore.error} />
              <div className="flex flex-wrap gap-2">
                {d.block.demoTampered ? <Btn variant="outline" loading={restore.pending} onClick={() => restore.run()}>Restore original block</Btn> : (<>
                  <Btn variant="danger" size="sm" loading={tamper.pending} onClick={() => tamper.run("EDIT_ONLY")}>Edit block (leave hash stale)</Btn>
                  <Btn variant="danger" size="sm" loading={tamper.pending} onClick={() => tamper.run("EDIT_AND_REHASH")}>Edit block and recompute its hash</Btn></>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
