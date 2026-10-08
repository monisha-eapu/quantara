import { AlertTriangle, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import type { ChangedField, EntityVerification } from "../lib/api";
import { fieldLabel, formatTime } from "../lib/format";
import { CheckIcon, cx, Hash } from "./ui";

export function VerdictBanner({ report }: { report: EntityVerification }) {
  const failed = report.checks.filter((c) => c.status === "fail");
  if (report.verdict === "TAMPERED") {
    return (
      <div className="glow-red pulse-red fade-up relative overflow-hidden rounded-2xl border border-red-500/50 bg-gradient-to-br from-red-600/25 via-red-500/10 to-transparent p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-500/20 ring-1 ring-red-400/50"><Siren className="h-8 w-8 text-red-300" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Final result</div>
            <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">🚨 RECORD TAMPERED</div>
            <div className="mt-1 text-sm text-red-200/90">{failed.length} check{failed.length === 1 ? "" : "s"} failed: {failed.map((c) => c.label).join(" · ")}</div>
          </div>
        </div>
      </div>
    );
  }
  if (report.verdict === "AUTHENTIC_LEGACY") {
    return (
      <div className="glow-amber fade-up rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-transparent p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/40"><AlertTriangle className="h-8 w-8 text-amber-300" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Final result</div>
            <div className="text-2xl font-bold tracking-tight text-white">AUTHENTIC · LEGACY CRYPTOGRAPHY</div>
            <div className="mt-1 text-sm text-amber-100/80">Valid today, but signed with a classical algorithm that a future large-scale quantum computer could forge. Migrate to ML-DSA.</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="glow-green fade-up rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent p-6">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/40"><ShieldCheck className="h-8 w-8 text-emerald-300" /></div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Final result</div>
          <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">🟢 AUTHENTIC RECORD</div>
          <div className="mt-1 text-sm text-emerald-100/80">All checks passed · {report.algorithm} signature by {report.signer.name} · verified in {report.durationMs} ms at {formatTime(report.verifiedAt)}</div>
        </div>
      </div>
    </div>
  );
}

export function CheckList({ report, compact }: { report: EntityVerification; compact?: boolean }) {
  return (
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-ink-900/50">
      {report.checks.map((c, i) => (
        <div key={c.id} className={cx("fade-up flex gap-3 px-4", compact ? "py-2.5" : "py-3.5", c.status === "fail" && "bg-red-500/[0.06]")} style={{ animationDelay: `${i * 70}ms` }}>
          <CheckIcon status={c.status} className={compact ? "mt-0.5 h-4 w-4 shrink-0" : "mt-0.5 h-5 w-5 shrink-0"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="label text-slate-400">{c.label}</span>
              <span className={cx("text-sm font-semibold", c.status === "pass" ? "text-emerald-300" : c.status === "warn" ? "text-amber-300" : "text-red-300")}>
                {c.status === "pass" ? "✓ " : c.status === "fail" ? "❌ " : "⚠ "}{c.summary}
              </span>
            </div>
            {!compact && <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function HashRow({ label, sub, value, tone }: { label: string; sub: string; value: string | null; tone: "green" | "red" | undefined }) {
  return (
    <div className={cx("rounded-xl border p-3.5", tone === "red" ? "border-red-500/40 bg-red-500/[0.07]" : "border-white/[0.08] bg-ink-900/60")}>
      <div className="flex items-center justify-between gap-2">
        <div className="label">{label}</div>
        <div className="text-[10px] text-slate-500">{sub}</div>
      </div>
      <div className={cx("mt-1.5 font-mono text-lg font-semibold tracking-wider", tone === "red" ? "text-red-300" : "text-emerald-300")}>
        {value ? `${value.slice(0, 6).toUpperCase()}…${value.slice(-4).toUpperCase()}` : "—"}
      </div>
      <Hash value={value} full className="mt-1 text-[10.5px] text-slate-400" />
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
    <div className="space-y-2.5">
      <HashRow label="Original hash" sub={`anchored on ledger · block #${report.block?.index ?? "?"}`} value={anchored} tone="green" />
      {attackerRehashed && <HashRow label="Hash stored in record row" sub="overwritten by attacker" value={stored} tone="red" />}
      <HashRow label="Current hash" sub="SHA-256 recomputed now" value={computed} tone={mismatch ? "red" : "green"} />
      <div className={cx("flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold", mismatch ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300")}>
        <span>Hash verification</span>
        <span>{mismatch ? "❌ FAILED" : "✓ MATCH"}</span>
      </div>
      {attackerRehashed && (
        <p className="text-xs leading-relaxed text-slate-400">
          The attacker recomputed the hash stored next to the record, so a naive hash check passes. It still fails because the
          ML-DSA signature and the ledger anchor commit to the original hash, and the attacker holds neither the signing key nor control of the chain.
        </p>
      )}
    </div>
  );
}

export function ChangedFields({ fields }: { fields: ChangedField[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-200"><ShieldAlert className="h-4 w-4" /> Unauthorised modification</div>
      <div className="space-y-2">
        {fields.map((f) => {
          const show = (v: unknown) => String(typeof v === "object" ? JSON.stringify(v) : v);
          return (
            <div key={f.field} className="rounded-lg bg-ink-950/50 px-3 py-2">
              <div className="label mb-1">{fieldLabel(f.field)}</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-emerald-300 line-through decoration-emerald-300/40">{show(f.original)}</span>
                <span className="text-slate-500">→</span>
                <span className="font-semibold text-red-300">{show(f.current)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Demo view: the original values are kept only so the demo can be reset. A real verifier detects the change from the cryptography alone.</p>
    </div>
  );
}
