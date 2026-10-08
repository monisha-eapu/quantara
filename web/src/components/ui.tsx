import { useEffect, useState, type ReactNode } from "react";
import type { IntegrityStatus } from "../lib/api";
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

export function Hash({ value, n = 6, full, className }: { value: string | null | undefined; n?: number; full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="font-mono text-[12px] text-faint">—</span>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard unavailable */ }
  };
  return (
    <button type="button" onClick={copy} title={copied ? "Copied" : "Click to copy"} className={cx("max-w-full cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-[12.5px]", full ? "break-all" : "truncate", className)}>
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

export function Empty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-line-4 px-6 py-[72px] text-center">
      <span className="text-[16px] font-medium">{title}</span>
      {description && <span className="max-w-[520px] text-[14px] leading-relaxed text-mute">{description}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} className={cx("my-auto flex w-full flex-col rounded bg-card shadow-[0_30px_60px_-20px_rgba(25,25,23,0.4)]", wide ? "max-w-[860px]" : "max-w-[520px]")}>
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

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
      {label}
      {children}
      {hint && <span className="text-[12px] font-normal text-mute">{hint}</span>}
    </label>
  );
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><span className="eyebrow text-faint">{label}</span><div className="min-w-0 text-[14px]">{children}</div></div>;
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
