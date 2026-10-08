import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ChangedField, EntityVerification } from "../lib/api";
import { fieldLabel, formatTime } from "../lib/format";
import { CheckIcon, cx, Hash } from "./ui";

const fade = { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2, ease: "easeOut" as const } };

/** The overall result. Colour carries meaning here and nowhere else on the page. */
export function VerdictBanner({ report }: { report: EntityVerification }) {
  const failed = report.checks.filter((c) => c.status === "fail");
  const tone = report.verdict === "TAMPERED"
    ? { border: "border-red-500/50", bg: "bg-red-500/[0.07]", text: "text-red-300", icon: <ShieldAlert className="h-6 w-6 text-red-400" />, title: "RECORD TAMPERED" }
    : report.verdict === "AUTHENTIC_LEGACY"
      ? { border: "border-amber-500/45", bg: "bg-amber-500/[0.06]", text: "text-amber-300", icon: <AlertTriangle className="h-6 w-6 text-amber-400" />, title: "AUTHENTIC · LEGACY CRYPTOGRAPHY" }
      : { border: "border-emerald-500/45", bg: "bg-emerald-500/[0.06]", text: "text-emerald-300", icon: <ShieldCheck className="h-6 w-6 text-emerald-400" />, title: "AUTHENTIC RECORD" };
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={report.verdict} {...fade} role="status" aria-live="polite" className={cx("flex items-start gap-4 rounded-lg border px-5 py-4", tone.border, tone.bg)}>
        <div className="mt-0.5">{tone.icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Final result</div>
          <div className={cx("text-[24px] font-bold leading-tight tracking-[-0.01em]", tone.text)}>{tone.title}</div>
          <div className="mt-1 text-[13px] text-slate-300">
            {report.verdict === "TAMPERED"
              ? `${failed.length} verification check${failed.length === 1 ? "" : "s"} failed: ${failed.map((c) => c.label).join(", ")}.`
              : report.verdict === "AUTHENTIC_LEGACY"
                ? "Valid today, but signed with a classical algorithm that a future quantum computer could forge. Migrate to ML-DSA."
                : `All checks passed. ${report.algorithm} signature by ${report.signer.name}. Verified in ${report.durationMs} ms at ${formatTime(report.verifiedAt)}.`}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function CheckList({ report, compact }: { report: EntityVerification; compact?: boolean }) {
  return (
    <ul className="divide-y divide-ink-700 overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      {report.checks.map((c, i) => (
        <motion.li key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: i * 0.05 }} className={cx("flex gap-3 px-4", compact ? "py-2.5" : "py-3", c.status === "fail" && "bg-red-500/[0.05]")}>
          <CheckIcon status={c.status} className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="text-[13px] font-medium text-slate-200">{c.label}</span>
              <span className={cx("text-[13px] font-semibold", c.status === "pass" ? "text-emerald-300" : c.status === "warn" ? "text-amber-300" : "text-red-300")}>{c.summary}</span>
            </div>
            {!compact && <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.detail}</p>}
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

const short = (h: string | null) => (h ? `${h.slice(0, 6).toUpperCase()}…${h.slice(-4).toUpperCase()}` : "—");

function HashLine({ label, sub, value, bad }: { label: string; sub: string; value: string | null; bad?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[140px_1fr]">
      <div>
        <div className="text-[13px] font-medium text-slate-300">{label}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
      <div className="min-w-0">
        <div className={cx("font-mono text-[19px] font-semibold tracking-[0.04em]", bad ? "text-red-300" : "text-slate-100")}>{short(value)}</div>
        <Hash value={value} full className="mt-0.5 text-[11px] text-slate-500" />
      </div>
    </div>
  );
}

export function HashComparison({ report }: { report: EntityVerification }) {
  const anchored = report.anchoredHash;
  const computed = report.computedHash;
  const stored = report.storedHash;
  const mismatch = anchored !== computed;
  const attackerRehashed = stored !== anchored && stored === computed;
  return (
    <div>
      <div className="divide-y divide-ink-700 rounded-lg border border-ink-700 bg-ink-900 px-4">
        <HashLine label="Original" sub={`Anchored in block #${report.block?.index ?? "?"}`} value={anchored} />
        <HashLine label="Current" sub="SHA-256, recomputed now" value={computed} bad={mismatch} />
      </div>
      <div className={cx("mt-2 flex items-center justify-between rounded-md px-4 py-2 text-[13px] font-semibold", mismatch ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300")}>
        <span>Hash verification</span>
        <span>{mismatch ? "FAILED" : "MATCH"}</span>
      </div>
      {attackerRehashed && (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          The stored hash was rewritten to match the altered content, so a hash-only check would pass. Verification still fails because the ML-DSA signature
          and the ledger anchor commit to the original hash, and the attacker holds neither the signing key nor control of the chain.
        </p>
      )}
    </div>
  );
}

export function ChangedFields({ fields }: { fields: ChangedField[] }) {
  if (!fields.length) return null;
  const show = (v: unknown) => String(typeof v === "object" ? JSON.stringify(v) : v);
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900">
      <div className="border-b border-ink-700 px-4 py-2.5 text-[13px] font-semibold text-slate-100">Modified fields</div>
      <ul className="divide-y divide-ink-700">
        {fields.map((f) => (
          <li key={f.field} className="grid grid-cols-[110px_1fr] items-center gap-x-4 px-4 py-2.5 text-[13px] sm:grid-cols-[140px_1fr]">
            <span className="text-slate-400">{fieldLabel(f.field)}</span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 line-through">{show(f.original)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-red-300">{show(f.current)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-ink-700 px-4 py-2 text-[11px] text-slate-500">Original values are kept only so the demo can be reset. A real verifier detects the change from the cryptography alone.</p>
    </div>
  );
}
