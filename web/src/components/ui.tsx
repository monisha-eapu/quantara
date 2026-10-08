import { AlertTriangle, Check, CheckCircle2, CircleDashed, Copy, Inbox, Loader2, RefreshCw, ShieldAlert, ShieldCheck, X, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { CheckStatus, IntegrityStatus } from "../lib/api";
import { shortHash } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ title, subtitle, actions, children, className, bodyClass, icon }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode;
}) {
  return (
    <section className={cx("glass rounded-2xl", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-start gap-3">
            {icon && <div className="mt-0.5 text-brand-400">{icon}</div>}
            <div>
              {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && <div className="label mb-2 text-brand-400">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[28px]">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success" | "quantum";
const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-400 shadow-[0_0_24px_-6px_rgba(47,123,255,0.8)]",
  secondary: "bg-white/[0.06] text-slate-100 hover:bg-white/[0.1] border border-white/10",
  danger: "bg-red-500/90 text-white hover:bg-red-500 shadow-[0_0_24px_-6px_rgba(239,68,68,0.8)]",
  success: "bg-emerald-500/90 text-white hover:bg-emerald-500 shadow-[0_0_24px_-6px_rgba(16,185,129,0.8)]",
  ghost: "text-slate-300 hover:bg-white/[0.06] hover:text-white",
  quantum: "bg-quantum-500 text-white hover:bg-quantum-400 shadow-[0_0_24px_-6px_rgba(168,85,247,0.8)]",
};

export function Button({ variant = "secondary", loading, icon, children, className, size = "md", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; loading?: boolean; icon?: ReactNode; size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-3 text-sm tracking-wide" };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", sizes[size], variants[variant], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

const statusStyles: Record<IntegrityStatus, { cls: string; icon: ReactNode; label: string }> = {
  VERIFIED: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Verified" },
  TAMPERED: { cls: "border-red-500/40 bg-red-500/15 text-red-300", icon: <ShieldAlert className="h-3.5 w-3.5" />, label: "Tampered" },
  LEGACY: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Legacy crypto" },
  UNVERIFIED: { cls: "border-slate-500/30 bg-slate-500/10 text-slate-300", icon: <CircleDashed className="h-3.5 w-3.5" />, label: "Re-verify" },
};

export function StatusBadge({ status, className }: { status: IntegrityStatus | string; className?: string }) {
  const s = statusStyles[status as IntegrityStatus] ?? statusStyles.UNVERIFIED;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", s.cls, className)}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function Pill({ children, tone = "slate", className }: { children: ReactNode; tone?: "slate" | "blue" | "green" | "red" | "amber" | "violet" | "cyan"; className?: string }) {
  const tones = {
    slate: "border-white/10 bg-white/[0.05] text-slate-300",
    blue: "border-brand-500/30 bg-brand-500/10 text-brand-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    violet: "border-quantum-500/40 bg-quantum-500/10 text-quantum-400",
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide", tones[tone], className)}>{children}</span>;
}

export function CheckIcon({ status, className = "h-5 w-5" }: { status: CheckStatus; className?: string }) {
  if (status === "pass") return <CheckCircle2 className={cx(className, "text-emerald-400")} />;
  if (status === "warn") return <AlertTriangle className={cx(className, "text-amber-400")} />;
  return <XCircle className={cx(className, "text-red-400")} />;
}

export function Hash({ value, n = 10, full, className, tone }: { value: string | null | undefined; n?: number; full?: boolean; className?: string; tone?: "red" | "green" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="font-mono text-xs text-slate-500">—</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <span className={cx("group inline-flex max-w-full items-center gap-1.5 font-mono text-xs", tone === "red" ? "text-red-300" : tone === "green" ? "text-emerald-300" : "text-cyan-200/90", className)}>
      <span className={full ? "break-all" : "truncate"} title={value}>{full ? value : shortHash(value, n)}</span>
      <button onClick={copy} className="shrink-0 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-white" title="Copy" type="button">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-brand-400", className)} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-10 text-center">
      <XCircle className="h-8 w-8 text-red-400" />
      <p className="max-w-lg text-sm text-red-200">{error.message}</p>
      {onRetry && <Button size="sm" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>Retry</Button>}
    </div>
  );
}

export function InlineError({ error }: { error: Error | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error.message}</div>;
}

export function Empty({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 text-slate-500">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description && <p className="max-w-md text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, tone }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; tone?: "red" | "violet" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("glass fade-up w-full rounded-2xl bg-ink-900/95", wide ? "max-w-4xl" : "max-w-lg", tone === "red" && "glow-red", tone === "violet" && "glow-violet")}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function KV({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label mb-1">{label}</div>
      <div className={cx("min-w-0 text-sm text-slate-100", mono && "font-mono text-xs")}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, tone = "blue", icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "blue" | "green" | "red" | "slate" | "amber"; icon?: ReactNode }) {
  const tones = { blue: "text-brand-400", green: "text-emerald-400", red: "text-red-400", slate: "text-slate-300", amber: "text-amber-400" };
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className="label">{label}</div>
        <div className={tones[tone]}>{icon}</div>
      </div>
      <div className={cx("mt-3 text-3xl font-semibold tabular-nums tracking-tight md:text-4xl", tone === "red" ? "text-red-300" : "text-white")}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-slate-400">{sub}</div>}
      <div className={cx("pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full blur-3xl", tone === "red" ? "bg-red-500/20" : tone === "green" ? "bg-emerald-500/15" : tone === "amber" ? "bg-amber-500/15" : "bg-brand-500/20")} />
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
