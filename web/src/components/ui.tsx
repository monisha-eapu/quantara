import { useEffect, useState, type ReactNode } from "react";
import type { CheckStatus, IntegrityStatus } from "../lib/api";
import { shortHash } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export type Tone = "ok" | "bad" | "warn" | "mute" | "ink";
const toneText: Record<Tone, string> = { ok: "text-ok", bad: "text-bad", warn: "text-warn", mute: "text-mute", ink: "text-ink" };
const toneBg: Record<Tone, string> = { ok: "bg-ok", bad: "bg-bad", warn: "bg-warn", mute: "bg-faint", ink: "bg-ink" };

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cx("inline-block h-[7px] w-[7px] shrink-0 rounded-full", toneBg[tone], className)} />;
}

/** Coloured dot + label, used for every status in the product. */
export function Status({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-2 whitespace-nowrap", toneText[tone], className)}><Dot tone={tone} />{children}</span>;
}

export const integrityTone: Record<IntegrityStatus, { tone: Tone; label: string }> = {
  VERIFIED: { tone: "ok", label: "Verified" },
  TAMPERED: { tone: "bad", label: "Integrity failure" },
  LEGACY: { tone: "warn", label: "Legacy-signed" },
  UNVERIFIED: { tone: "mute", label: "Not yet verified" },
};
export function IntegrityStatusLabel({ status }: { status: IntegrityStatus | string }) {
  const s = integrityTone[status as IntegrityStatus] ?? integrityTone.UNVERIFIED;
  return <Status tone={s.tone}>{s.label}</Status>;
}

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "light";
const btnVariant: Record<BtnVariant, string> = {
  primary: "bg-ink text-paper border border-ink hover:bg-ink-hover",
  light: "bg-paper text-ink border border-paper hover:bg-white",
  outline: "bg-transparent border border-line-4 hover:border-ink",
  ghost: "bg-transparent border border-transparent hover:bg-hov",
  danger: "bg-transparent border border-bad-line text-bad hover:border-bad",
};
export function Btn({ variant = "primary", size = "md", loading, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean;
}) {
  const sizes = { sm: "px-3.5 py-2 text-[13px]", md: "px-[18px] py-[11px] text-[14px]", lg: "px-[22px] py-[14px] text-[15px]" };
  return (
    <button {...rest} disabled={rest.disabled || loading} className={cx("cursor-pointer whitespace-nowrap rounded font-medium transition-colors", sizes[size], btnVariant[variant], className)}>
      {loading ? "Working…" : children}
    </button>
  );
}

export function PageTitle({ title, sub, actions, mono }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; mono?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex max-w-[780px] flex-col gap-1.5">
        {mono && <span className="font-mono text-[13px] text-mute">{mono}</span>}
        <h1 className="m-0 font-serif text-[clamp(30px,4vw,40px)] font-normal leading-[1.1] tracking-[-0.02em]">{title}</h1>
        {sub && <p className="m-0 text-[15px] leading-relaxed text-mute">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionHead({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-end justify-between gap-3 border-b border-ink pb-3.5", className)}>
      <div className="flex flex-col gap-1"><h2 className="m-0 text-[17px] font-semibold">{title}</h2>{sub && <span className="text-[13px] text-mute">{sub}</span>}</div>
      {right}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded border border-line bg-card", className)}>{children}</div>;
}

export function TableCard({ children, min = 900 }: { children: ReactNode; min?: number }) {
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]" style={{ minWidth: min }}>{children}</table>
    </Panel>
  );
}
export const theadCls = "border-b border-line bg-paper";
export const rowCls = "border-b border-line-3 last:border-0";

/** Result banner: tinted block with a 3px left rule, as used for verification outcomes. */
export function Banner({ tone, title, children }: { tone: "ok" | "bad" | "warn"; title: ReactNode; children?: ReactNode }) {
  const t = { ok: ["bg-ok-bg", "border-ok", "text-ok"], bad: ["bg-bad-bg", "border-bad", "text-bad"], warn: ["bg-warn-bg", "border-warn", "text-warn"] }[tone];
  return (
    <div role="status" aria-live="polite" className={cx("flex flex-col gap-1.5 border-l-[3px] px-5 py-[18px]", t[0], t[1])}>
      <span className={cx("text-[15px] font-semibold", t[2])}>{title}</span>
      {children && <span className="text-[14px] leading-relaxed text-body">{children}</span>}
    </div>
  );
}

export function Hash({ value, n = 6, full, className, tone }: { value: string | null | undefined; n?: number; full?: boolean; className?: string; tone?: "red" | "green" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="font-mono text-[12px] text-faint">—</span>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard unavailable */ }
  };
  return (
    <button type="button" onClick={copy} title={copied ? "Copied" : "Click to copy"} className={cx("max-w-full cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-[12.5px]", tone === "red" && "text-bad", tone === "green" && "text-ok", full ? "break-all" : "truncate", className)}>
      {full ? value : shortHash(value, n)}{copied && <span className="ml-2 text-ok">copied</span>}
    </button>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div role="status" className="py-16 text-center text-[14px] text-mute">{label}</div>;
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border-l-[3px] border-bad bg-bad-bg px-5 py-4">
      <p className="m-0 text-[14px] leading-relaxed text-bad">{error.message}</p>
      {onRetry && <Btn variant="outline" size="sm" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

export function InlineError({ error }: { error: Error | null }) {
  if (!error) return null;
  return <div role="alert" className="border-l-[3px] border-bad bg-bad-bg px-4 py-2.5 text-[13px] text-bad">{error.message}</div>;
}

export function Empty({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-line-4 px-6 py-[72px] text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <span className="text-[16px] font-medium">{title}</span>
      {description && <span className="max-w-[520px] text-[14px] leading-relaxed text-mute">{description}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide, tone }: { tone?: "red" | "violet"; open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} className={cx("my-auto flex w-full flex-col rounded bg-card shadow-[0_30px_60px_-20px_rgba(25,25,23,0.4)]", wide ? "max-w-[860px]" : "max-w-[520px]", tone === "red" && "border-l-[3px] border-bad", tone === "violet" && "border-l-[3px] border-ink")}>
        <div className="flex flex-col gap-1 border-b border-line-2 px-[26px] py-[22px]">
          <span className="font-serif text-[26px] leading-tight">{title}</span>
          {subtitle && <span className="text-[13px] text-mute">{subtitle}</span>}
        </div>
        <div className="px-[26px] py-[22px]">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 border-t border-line-2 px-[26px] py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
      {label}
      {children}
      {error ? <span className="text-[12px] font-normal text-bad">{error}</span> : hint ? <span className="text-[12px] font-normal text-mute">{hint}</span> : null}
    </label>
  );
}

export function KV({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return <div className="flex min-w-0 flex-col gap-1"><span className="eyebrow text-faint">{label}</span><div className={cx("min-w-0 text-[14px]", mono && "font-mono text-[12px]")}>{children}</div></div>;
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[13px] text-mute underline decoration-line-4 underline-offset-[3px] hover:decoration-ink">← {children}</button>;
}

/** One numbered verification step, in the style of the Verification page. */
export interface Step { n: number; label: string; detail?: string; status: string; tone: Tone | "pending" }
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {steps.map((s) => (
        <li key={s.n} className="grid grid-cols-[28px_1fr_auto] items-start gap-3.5 border-b border-line-3 py-3.5 last:border-0">
          <span className="pt-0.5 font-mono text-[12px] text-faint">{String(s.n).padStart(2, "0")}</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px]">{s.label}</span>
            {s.detail && <span className="break-words text-[12.5px] leading-relaxed text-mute">{s.detail}</span>}
          </span>
          <span className={cx("font-mono text-[13px]", s.tone === "pending" ? "text-faint" : toneText[s.tone])}>{s.status}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---- Components used by the Certificates, Live Demo and Quantum Lab pages, in the same paper/ink style ---- */

const pillTone: Record<string, string> = {
  slate: "border-line bg-hov text-body",
  blue: "border-line-4 bg-card text-ink",
  green: "border-ok/40 bg-ok-bg text-ok",
  red: "border-bad-line bg-bad-bg text-bad",
  amber: "border-warn-line bg-warn-bg text-warn",
  violet: "border-ink bg-card text-ink",
  cyan: "border-line-4 bg-card text-ink",
};
export function Pill({ children, tone = "slate", className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-2 py-0.5 text-[11px] font-medium", pillTone[tone] || pillTone.slate, className)}>{children}</span>;
}

export function StatusBadge({ status, className }: { status: IntegrityStatus | string; className?: string }) {
  const s = integrityTone[status as IntegrityStatus] ?? integrityTone.UNVERIFIED;
  return <Status tone={s.tone} className={className}>{s.label}</Status>;
}

export function CheckIcon({ status, className = "h-5 w-5" }: { status: CheckStatus; className?: string }) {
  const tone = status === "pass" ? "text-ok" : status === "warn" ? "text-warn" : "text-bad";
  const d = status === "pass" ? "M5 12.5l4.5 4.5L19 7.5" : status === "warn" ? "M12 8v5M12 16.5v.01" : "M6 6l12 12M18 6L6 18";
  return <svg className={cx(className, tone)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={status}><path d={d} /></svg>;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span role="presentation" className={cx("inline-block animate-spin rounded-full border-2 border-line-4 border-t-ink", className)} />;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "quantum" | "outline" | "light";
const buttonMap: Record<ButtonVariant, BtnVariant> = { primary: "primary", quantum: "primary", success: "primary", secondary: "outline", outline: "outline", ghost: "ghost", danger: "danger", light: "light" };
export function Button({ variant = "secondary", loading, icon, children, className, size = "md", ...rest }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant; loading?: boolean; icon?: ReactNode; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const sizes = { sm: "px-3.5 py-2 text-[13px]", md: "px-[18px] py-[11px] text-[14px]", lg: "px-[22px] py-[14px] text-[15px]" };
  return (
    <button {...rest} disabled={rest.disabled || loading} className={cx("inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors", sizes[size], btnVariant[buttonMap[variant]], className)}>
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon}
      {children}
    </button>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex max-w-[760px] flex-col gap-1.5">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="m-0 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.02em]">{title}</h1>
        {description && <p className="m-0 text-[15px] leading-relaxed text-mute">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className, bodyClass, icon }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode;
}) {
  return (
    <section className={cx("rounded border border-line bg-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-2 px-5 py-4">
          <div className="flex items-start gap-3">
            {icon && <div className="mt-0.5 text-mute">{icon}</div>}
            <div className="flex flex-col gap-0.5">
              {title && <h2 className="m-0 text-[15px] font-semibold">{title}</h2>}
              {subtitle && <p className="m-0 text-[13px] text-mute">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "blue", icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "blue" | "green" | "red" | "slate" | "amber"; icon?: ReactNode }) {
  const c = { blue: "text-ink", green: "text-ok", red: "text-bad", slate: "text-ink", amber: "text-warn" }[tone];
  return (
    <div className={cx("flex flex-col gap-1 rounded border border-line bg-card p-5", tone === "red" && "bg-bad-bg")}>
      <div className="flex items-start justify-between"><span className="eyebrow">{label}</span><span className="text-mute">{icon}</span></div>
      <span className={cx("mt-2 font-serif text-[38px] leading-none tabular-nums", c)}>{value}</span>
      {sub && <span className="mt-1 text-[13px] text-mute">{sub}</span>}
    </div>
  );
}
