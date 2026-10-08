import type { ChangedField, EntityVerification, VerificationCheck } from "../lib/api";
import { fieldLabel, shortHash } from "../lib/format";
import { Banner, cx, Hash, type Step, type Tone } from "./ui";

/** Short mono word shown at the right of a step ("match", "valid", "intact"...). */
export function checkWord(c: VerificationCheck, classical?: boolean): { word: string; tone: Tone } {
  const fail = c.status === "fail";
  switch (c.id) {
    case "hash": return { word: fail ? "mismatch" : "match", tone: fail ? "bad" : "ok" };
    case "signature": return fail ? { word: "invalid", tone: "bad" } : classical ? { word: "valid · not PQ-safe", tone: "warn" } : { word: "valid", tone: "ok" };
    case "anchor": return { word: fail ? "mismatch" : "found", tone: fail ? "bad" : "ok" };
    case "chain": return { word: fail ? "broken" : "intact", tone: fail ? "bad" : "ok" };
    case "eventLink": return { word: fail ? "broken" : "linked", tone: fail ? "bad" : "ok" };
    case "legacy": return { word: fail ? "invalid" : "valid", tone: fail ? "bad" : "ok" };
    default: return { word: c.status === "pass" ? "ok" : c.status === "warn" ? "legacy" : "failed", tone: c.status === "pass" ? "ok" : c.status === "warn" ? "warn" : "bad" };
  }
}

const LABEL: Record<string, (r: EntityVerification) => string> = {
  hash: () => "Recompute SHA-256 fingerprint",
  signature: (r) => (r.algorithmFamily === "CLASSICAL" ? `Verify ${r.algorithm.replace("-SHA256", "").replace("ECDSA-P256", "ECDSA P-256")} signature (legacy)` : `Verify ${r.algorithm} signature`),
  anchor: () => "Confirm ledger anchor",
  chain: () => "Walk hash chain to tip",
  eventLink: () => "Check link to the previous step",
  legacy: () => "Verify retained legacy co-signature",
};

/** Real verification checks as display steps (the algorithm check is folded into the signature step). */
export function stepsFromReport(r: EntityVerification, firstStep?: { label: string; detail: string }): Step[] {
  const classical = r.algorithmFamily === "CLASSICAL";
  const rows = r.checks.filter((c) => c.id !== "algorithm" && LABEL[c.id]).map((c) => {
    const w = checkWord(c, classical);
    let detail = c.detail;
    if (c.id === "hash") detail = c.status === "fail" ? `computed ${shortHash(c.actual, 6)} ≠ anchored ${shortHash(r.anchoredHash, 6)}. ${c.detail}` : `${shortHash(c.actual, 6)} matches the recorded fingerprint.`;
    if (c.id === "anchor" && c.status === "pass" && r.block) detail = `Block #${r.block.index} commits to this fingerprint and signature.`;
    return { label: LABEL[c.id](r), detail, status: w.word, tone: w.tone } as Omit<Step, "n">;
  });
  const all = firstStep ? [{ label: firstStep.label, detail: firstStep.detail, status: "found", tone: "ok" as Tone }, ...rows] : rows;
  return all.map((s, i) => ({ ...s, n: i + 1 }));
}

export function ResultBanner({ report, detail }: { report: EntityVerification; detail?: string }) {
  const failed = report.checks.filter((c) => c.status === "fail").map((c) => c.label.toLowerCase());
  if (report.verdict === "TAMPERED") {
    return <Banner tone="bad" title="RECORD TAMPERED">{detail ?? `${failed.length} verification check${failed.length === 1 ? "" : "s"} failed (${failed.join(", ")}). The stored content no longer matches what the issuing authority signed, and the ledger anchor still holds the original fingerprint.`}</Banner>;
  }
  if (report.verdict === "AUTHENTIC_LEGACY") {
    return <Banner tone="warn" title="Valid, but legacy-signed">The record is unaltered, but its classical signature could be forged by a large quantum computer. Re-sign it with ML-DSA-65 from the Post-Quantum page.</Banner>;
  }
  return <Banner tone="ok" title="AUTHENTIC RECORD">{detail ?? `The record matches its fingerprint, carries a valid ${report.algorithm} signature from ${report.signer.name} and is anchored in an intact chain. Verified in ${report.durationMs} ms.`}</Banner>;
}

const big = (h: string | null) => (h ? `${h.slice(0, 6).toUpperCase()}…${h.slice(-4).toUpperCase()}` : "—");

export function HashComparison({ report }: { report: EntityVerification }) {
  const anchored = report.anchoredHash, computed = report.computedHash, stored = report.storedHash;
  const mismatch = anchored !== computed;
  const rewritten = stored !== anchored && stored === computed;
  const Row = ({ label, sub, value, bad }: { label: string; sub: string; value: string | null; bad?: boolean }) => (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-line-3 py-3.5 last:border-0 sm:grid-cols-[150px_1fr]">
      <div className="flex flex-col"><span className="text-[14px] font-medium">{label}</span><span className="text-[12px] text-mute">{sub}</span></div>
      <div className="min-w-0">
        <div className={cx("font-mono text-[20px] font-medium tracking-[0.03em]", bad ? "text-bad" : "text-ink")}>{big(value)}</div>
        <Hash value={value} full className="text-[11px] text-mute" />
      </div>
    </div>
  );
  return (
    <div>
      <div className="rounded border border-line bg-card px-5">
        <Row label="Original" sub={`Anchored in block #${report.block?.index ?? "?"}`} value={anchored} />
        <Row label="Current" sub="SHA-256, recomputed now" value={computed} bad={mismatch} />
      </div>
      <div className={cx("mt-2.5 flex items-center justify-between border-l-[3px] px-4 py-2.5 text-[13px] font-medium", mismatch ? "border-bad bg-bad-bg text-bad" : "border-ok bg-ok-bg text-ok")}>
        <span>Hash verification</span><span className="font-mono">{mismatch ? "FAILED" : "MATCH"}</span>
      </div>
      {rewritten && (
        <p className="mb-0 mt-3 text-[13px] leading-relaxed text-mute">
          The stored hash was rewritten to match the altered content, so a hash-only check would pass. Verification still fails because the ML-DSA signature and the ledger anchor commit to the original hash.
        </p>
      )}
    </div>
  );
}

export function ChangedFields({ fields }: { fields: ChangedField[] }) {
  if (!fields.length) return null;
  const show = (v: unknown) => String(typeof v === "object" ? JSON.stringify(v) : v);
  return (
    <div className="rounded border border-line bg-card">
      <div className="border-b border-line-2 px-5 py-3 text-[14px] font-semibold">Modified fields</div>
      {fields.map((f) => (
        <div key={f.field} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-line-3 px-5 py-3 text-[14px] last:border-0 sm:grid-cols-[150px_1fr]">
          <span className="text-mute">{fieldLabel(f.field)}</span>
          <span className="flex flex-wrap items-center gap-2.5"><span className="text-faint line-through">{show(f.original)}</span><span className="text-mute">→</span><span className="font-semibold text-bad">{show(f.current)}</span></span>
        </div>
      ))}
      <p className="m-0 border-t border-line-2 px-5 py-2.5 text-[12px] text-mute">Original values are kept only so the demo can be reset. A real verifier detects the change from the cryptography alone.</p>
    </div>
  );
}
