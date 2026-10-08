import { motion } from "framer-motion";
import { Atom, FileCheck2, Landmark, LayoutGrid, Link2, Menu, Package, Repeat2, ScrollText, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { useSystemStatus } from "../lib/useSystemStatus";
import { cx, Dot } from "./ui";

interface NavItem { to: string; label: string; icon: ReactNode; indent?: boolean }
const icon = "h-[15px] w-[15px]";

const NAV: { heading?: string; items: NavItem[] }[] = [
  { items: [{ to: "/", label: "Overview", icon: <LayoutGrid className={icon} /> }] },
  {
    heading: "Registry",
    items: [
      { to: "/land", label: "Land Records", icon: <Landmark className={icon} /> },
      { to: "/supply-chain", label: "Supply Chain", icon: <Package className={icon} /> },
    ],
  },
  {
    items: [
      { to: "/verify", label: "Verification", icon: <FileCheck2 className={icon} /> },
      { to: "/ledger", label: "Ledger", icon: <Link2 className={icon} /> },
      { to: "/migration", label: "Post-Quantum", icon: <Repeat2 className={icon} /> },
      { to: "/quantum", label: "Quantum Lab", icon: <Atom className={icon} /> },
      { to: "/audit", label: "Audit Trail", icon: <ScrollText className={icon} /> },
      { to: "/settings", label: "Settings", icon: <Settings className={icon} /> },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-brand-500"><ShieldCheck className="h-4 w-4 text-white" strokeWidth={2.25} /></div>
      <div className="leading-tight">
        <div className="text-[13px] font-bold tracking-[0.04em] text-white">QUANTUMSHIELD</div>
        <div className="text-[10px] font-medium tracking-[0.1em] text-slate-500">TRUST INFRASTRUCTURE</div>
      </div>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-7 flex-1 space-y-5 overflow-y-auto px-2" aria-label="Primary">
      {NAV.map((group, i) => (
        <div key={i}>
          {group.heading && <div className="mb-1 px-3 text-[11px] font-medium text-slate-500">{group.heading}</div>}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      "flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13.5px] font-medium transition-colors",
                      isActive ? "bg-brand-500/[0.14] text-white" : "text-slate-400 hover:bg-ink-800 hover:text-slate-100",
                    )
                  }
                >
                  {({ isActive }) => (<><span className={isActive ? "text-brand-400" : "text-slate-500"}>{item.icon}</span>{item.label}</>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarStatus() {
  const s = useSystemStatus();
  const ok = s.apiOnline && s.cryptoOnline && s.ledgerValid;
  return (
    <div className="border-t border-ink-700 px-5 py-4">
      <div className="text-[10px] font-medium tracking-[0.1em] text-slate-500">SYSTEM STATUS</div>
      <div className={cx("mt-1.5 flex items-center gap-2 text-[13px] font-medium", !s.loaded ? "text-slate-400" : ok ? "text-slate-200" : "text-red-300")}>
        <Dot tone={!s.loaded ? "slate" : ok ? "green" : "red"} />
        {!s.loaded ? "Checking…" : !s.apiOnline ? "API unreachable" : !s.ledgerValid ? "Ledger integrity failure" : !s.cryptoOnline ? "Cryptographic engine offline" : "All systems operational"}
      </div>
      <div className="mt-2 text-[11px] leading-snug text-slate-500">Prototype · all records are fictional demo data</div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const s = useSystemStatus();
  const secure = s.apiOnline && s.cryptoOnline && s.ledgerValid;
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-ink-700 bg-ink-950/95 px-4 backdrop-blur-sm md:px-8">
      <div className="flex items-center gap-3">
        <button className="rounded-md p-1.5 text-slate-300 hover:bg-ink-800 lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        <span className="hidden text-[12px] font-medium text-slate-400 sm:inline">Post-quantum trust for critical digital records</span>
      </div>
      <div className={cx("flex items-center gap-2 whitespace-nowrap text-[12px] font-semibold tracking-[0.06em]", !s.loaded ? "text-slate-500" : secure ? "text-emerald-300" : "text-red-300")}>
        {!s.loaded ? "CHECKING" : secure ? "SYSTEM SECURE" : "ATTENTION REQUIRED"}
        <Dot tone={!s.loaded ? "slate" : secure ? "green" : "red"} />
      </div>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-700 bg-ink-900 pt-5 lg:flex">
        <Brand />
        <Nav />
        <SidebarStatus />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-ink-900 pt-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-3"><Brand /><button onClick={() => setOpen(false)} className="p-2 text-slate-400" aria-label="Close navigation"><X className="h-5 w-5" /></button></div>
            <Nav onNavigate={() => setOpen(false)} />
            <SidebarStatus />
          </aside>
        </div>
      )}

      <TopBar onMenu={() => setOpen(true)} />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="mx-auto max-w-[1280px] px-4 py-7 md:px-8 md:py-9"
      >
        {children}
      </motion.main>
    </div>
  );
}
