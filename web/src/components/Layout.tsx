import { Activity, Atom, BookLock, Boxes, FileCheck2, LayoutDashboard, Link2, Map, Menu, Repeat2, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { api } from "../lib/api";
import { cx } from "./ui";

const NAV: { section: string; items: { to: string; label: string; icon: ReactNode; tone?: "quantum" }[] }[] = [
  { section: "Overview", items: [{ to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> }] },
  {
    section: "Registries",
    items: [
      { to: "/land", label: "Land Registry", icon: <Map className="h-4 w-4" /> },
      { to: "/supply-chain", label: "Supply Chain", icon: <Boxes className="h-4 w-4" /> },
    ],
  },
  {
    section: "Trust",
    items: [
      { to: "/verify", label: "Verify Record", icon: <FileCheck2 className="h-4 w-4" /> },
      { to: "/ledger", label: "Ledger Explorer", icon: <Link2 className="h-4 w-4" /> },
      { to: "/audit", label: "Audit Trail", icon: <BookLock className="h-4 w-4" /> },
    ],
  },
  {
    section: "Post-Quantum",
    items: [
      { to: "/migration", label: "PQC Migration", icon: <Repeat2 className="h-4 w-4" /> },
      { to: "/quantum", label: "Quantum Threat Lab", icon: <Atom className="h-4 w-4" />, tone: "quantum" },
    ],
  },
  { section: "System", items: [{ to: "/settings", label: "Cryptography", icon: <Settings className="h-4 w-4" /> }] },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-brand-600 shadow-[0_0_24px_-4px_rgba(47,123,255,0.9)]">
        <ShieldCheck className="h-5 w-5 text-white" />
      </div>
      <div>
        <div className="text-[15px] font-bold tracking-tight text-white">QuantumShield</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Post-Quantum Trust</div>
      </div>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-8 space-y-6">
      {NAV.map((group) => (
        <div key={group.section}>
          <div className="label mb-2 px-3 text-[10px] text-slate-500">{group.section}</div>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? item.tone === "quantum"
                        ? "bg-quantum-500/15 text-quantum-400 ring-1 ring-quantum-500/30"
                        : "bg-brand-500/15 text-white ring-1 ring-brand-500/30"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function HealthChip() {
  const [state, setState] = useState<{ ok: boolean; openssl?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => api.get<{ ok: boolean; openssl: string }>("/health").then((h) => alive && setState(h)).catch(() => alive && setState({ ok: false }));
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!state) return null;
  return (
    <div className={cx("flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", state.ok ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300")}>
      <span className="relative flex h-2 w-2">
        {state.ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cx("relative inline-flex h-2 w-2 rounded-full", state.ok ? "bg-emerald-400" : "bg-red-400")} />
      </span>
      {state.ok ? "ML-DSA-65 engine online" : "API offline"}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-ink-900/80 px-3 py-5 backdrop-blur-xl lg:flex">
        <Brand />
        <Nav />
        <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-400">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300"><Activity className="h-3.5 w-3.5 text-brand-400" /> Hackathon prototype</div>
          All records are fictional demo data. Not for production use.
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 overflow-y-auto bg-ink-900 px-3 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} className="p-2 text-slate-400"><X className="h-5 w-5" /></button></div>
            <Nav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-950/70 px-4 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3">
          <button className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <span className="hidden text-sm text-slate-400 sm:block">Post-Quantum Trust for Critical Digital Records</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300 md:inline">FIPS 204 · ML-DSA-65</span>
          <HealthChip />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
