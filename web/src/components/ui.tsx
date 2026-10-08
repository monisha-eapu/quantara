import { AlertTriangle, Check, CheckCircle2, Copy, Inbox, Loader2, RefreshCw, X, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { CheckStatus, IntegrityStatus } from "../lib/api";
import { shortHash } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** A bordered group of related information. Use sparingly; prefer Section for plain grouping. */
export function Card({ title, subtitle, actions, children, className, bodyClass }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode;
}) {
  return (
    <section className={cx("glass rounded-xl", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-5 py-3.5">
          <div>
            {title && <h2 className="text-[14px] font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

/** Ungrouped section: heading, optional description, and content separated by whitespace and a rule. */
export function Section({ title, description, actions, children, className }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-ink-700 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && <div className="mb-1.5 text-[12px] font-medium text-brand-400">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success" | "quantum";
const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-400",
  quantum: "bg-brand-500 text-white hover:bg-brand-400",
  secondary: "border border-ink-600 bg-ink-800 text-slate-100 hover:border-slate-500 hover:bg-ink-700",
  danger: "bg-red-500 text-white hover:bg-red-400",
  success: "bg-emerald-500 text-ink-950 hover:bg-emerald-300",
  ghost: "text-slate-300 hover:bg-ink-800 hover:text-white",
};

export function Button({ variant = "secondary", loading, icon, children, className, size = "md", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; loading?: boolean; icon?: ReactNode; size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-[13px]", lg: "h-10 px-4 text-[13px] tracking-[0.01em]" };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-45", sizes[size], variants[variant], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

const statusStyles: Record<IntegrityStatus, { dot: string; text: string; label: string }> = {
  VERIFIED: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Verified" },
  TAMPERED: { dot: "bg-red-400", text: "text-red-300", label: "Tampered" },
  LEGACY: { dot: "bg-amber-400", text: "text-amber-300", label: "Legacy crypto" },
  UNVERIFIED: { dot: "bg-slate-500", text: "text-slate-400", label: "Not yet verified" },
};

/** Status shown as a dot plus label; quiet in tables, still unambiguous. */
export function StatusBadge({ status, className }: { status: IntegrityStatus | string; className?: string }) {
  const s = statusStyles[status as IntegrityStatus] ?? statusStyles.UNVERIFIED;
  return (
    <span className={cx("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium", s.text, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function Dot({ tone }: { tone: "green" | "red" | "amber" | "slate" | "blue" }) {
  const t = { green: "bg-emerald-400", red: "bg-red-400", amber: "bg-amber-400", slate: "bg-slate-500", blue: "bg-brand-400" };
  return <span className={cx("inline-block h-1.5 w-1.5 shrink-0 rounded-full", t[tone])} />;
}

export function Pill({ children, tone = "slate", className }: { children: ReactNode; tone?: "slate" | "blue" | "green" | "red" | "amber" | "violet" | "cyan"; className?: string }) {
  const tones = {
    slate: "border-ink-600 bg-ink-800 text-slate-300",
    blue: "border-brand-500/30 bg-brand-500/10 text-brand-300",
    violet: "border-brand-500/30 bg-brand-500/10 text-brand-300",
    cyan: "border-ink-600 bg-ink-800 text-slate-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
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
    <span className={cx("group inline-flex max-w-full items-center gap-1.5 font-mono text-[12px]", tone === "red" ? "text-red-300" : tone === "green" ? "text-emerald-300" : "text-slate-300", className)}>
      <span className={full ? "break-all" : "truncate"} title={value}>{full ? value : shortHash(value, n)}</span>
      <button onClick={copy} className="shrink-0 text-slate-500 opacity-0 transition hover:text-white focus-visible:opacity-100 group-hover:opacity-100" title="Copy" type="button" aria-label="Copy value">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-slate-400", className)} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-400" role="status">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.05] px-5 py-4" role="alert">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <p className="max-w-2xl text-sm text-red-200">{error.message}</p>
      </div>
      {onRetry && <Button size="sm" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>Retry</Button>}
    </div>
  );
}

export function InlineError({ error }: { error: Error | null }) {
  if (!error) return null;
  return <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error.message}</div>;
}

export function Empty({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
      <div className="mb-1 text-slate-500">{icon ?? <Inbox className="h-7 w-7" />}</div>
      <p className="text-sm font-medium text-slate-100">{title}</p>
      {description && <p className="max-w-md text-[13px] text-slate-400">{description}</p>}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("fade-up w-full rounded-xl border bg-ink-900", tone === "red" ? "border-red-500/40" : "border-ink-700", wide ? "max-w-4xl" : "max-w-lg")}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-ink-800 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
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
      <div className={cx("min-w-0 text-[14px] text-slate-100", mono && "font-mono text-xs")}>{children}</div>
    </div>
  );
}

/** Standalone metric: used inside a divided grid, not wrapped in its own card. */
export function Stat({ label, value, sub, tone = "blue" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "blue" | "green" | "red" | "slate" | "amber"; icon?: ReactNode }) {
  return (
    <div className="px-5 py-5">
      <div className={cx("text-[34px] font-bold leading-none tracking-[-0.03em] tabular-nums", tone === "red" ? "text-red-300" : "text-white")}>{value}</div>
      <div className="mt-2 text-[13px] font-medium text-slate-300">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-300">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
