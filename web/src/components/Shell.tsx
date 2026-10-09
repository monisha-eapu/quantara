import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useSystemStatus } from "../lib/useSystemStatus";
import { cx, Dot } from "./ui";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center rounded bg-ink" style={{ width: size, height: size }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" fill="none" stroke="#f6f4ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
    </div>
  );
}

const NAV: { group: string | null; items: { to: string; label: string; icon: string; end?: boolean }[] }[] = [
  { group: null, items: [{ to: "/app", label: "Overview", end: true, icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" }] },
  { group: "REGISTRY", items: [
    { to: "/app/land", label: "Land Records", icon: "M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2 10l10-6 10 6z" },
    { to: "/app/supply-chain", label: "Supply Chain", icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" },
    { to: "/app/certificates", label: "Certificates", icon: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7" },
  ] },
  { group: "INTEGRITY", items: [
    { to: "/app/verify", label: "Verification", icon: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 14l2 2 4-4" },
    { to: "/app/ledger", label: "Ledger", icon: "M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" },
    { to: "/app/post-quantum", label: "Post-Quantum", icon: "M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5zM9 12h6M12 9v6" },
    { to: "/app/quantum", label: "Quantum Lab", icon: "M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10" },
    { to: "/app/demo", label: "Live Demo", icon: "M6 4l14 8-14 8z" },
    { to: "/app/audit", label: "Audit Trail", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
    { to: "/app/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
  ] },
];

const TITLES: [string, string][] = [
  ["/app/land", "Land Records"], ["/app/records", "Land Records"], ["/app/supply-chain", "Supply Chain"], ["/app/verify", "Verification"], ["/app/ledger", "Ledger"],
  ["/app/post-quantum", "Post-Quantum"], ["/app/quantum", "Quantum Lab"], ["/app/certificates", "Certificates"], ["/app/demo", "Live Demo"], ["/app/audit", "Audit Trail"], ["/app/settings", "Settings"],
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const s = useSystemStatus();
  const ok = s.apiOnline && s.cryptoOnline && s.ledgerValid;
  return (
    <>
      <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-5 py-[22px] no-underline">
        <Logo />
        <div className="flex flex-col leading-[1.2]"><span className="text-[15px] font-semibold">QuantumShield</span><span className="text-[11px] text-mute">Trust infrastructure</span></div>
      </NavLink>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Primary">
        {NAV.map((g, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {g.group && <span className="px-2.5 pb-1.5 pt-[18px] text-[11px] tracking-[0.1em] text-faint">{g.group}</span>}
            {g.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
                className={({ isActive }) => cx("flex items-center gap-3 rounded px-2.5 py-[9px] text-[14px] no-underline", isActive ? "bg-card font-medium shadow-[0_0_0_1px_#d3cec2]" : "hover:bg-hov-2")}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>{n.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-1 border-t border-line-2 px-5 py-4">
        <span className={cx("flex items-center gap-2 text-[13px]", s.loaded && !ok && "text-bad")}>
          <Dot tone={!s.loaded ? "mute" : ok ? "ok" : "bad"} />
          {!s.loaded ? "Checking…" : !s.apiOnline ? "API unreachable" : !s.ledgerValid ? "Ledger integrity failure" : !s.cryptoOnline ? "Crypto engine offline" : "All systems operational"}
        </span>
        <span className="text-[12px] text-faint">Prototype · fictional demo data</span>
      </div>
    </>
  );
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const s = useSystemStatus();
  const menuRef = useRef<HTMLDivElement>(null);
  const secure = s.apiOnline && s.cryptoOnline && s.ledgerValid;
  const title = TITLES.find(([p]) => loc.pathname.startsWith(p))?.[1] ?? "Overview";
  const user = (() => { try { return JSON.parse(localStorage.getItem("qs-user") || "null") as { name: string; role: string } | null; } catch { return null; } })() ?? { name: "Ravi Kumar", role: "Registry officer" };
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => { window.scrollTo(0, 0); setMenu(false); setDrawer(false); }, [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line-2 bg-side lg:flex"><Sidebar /></aside>
      {drawer && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="flex h-full w-[280px] flex-col bg-side" onClick={(e) => e.stopPropagation()}><Sidebar onNavigate={() => setDrawer(false)} /></aside>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex h-[60px] items-center justify-between gap-4 border-b border-line-2 bg-paper px-5 md:px-10">
          <div className="flex items-center gap-3">
            <button className="cursor-pointer border-0 bg-transparent p-1 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <span className="text-[13px] text-mute">SRO Vizianagaram / <span className="text-ink">{title}</span></span>
          </div>
          <div className="flex items-center gap-5">
            <span className={cx("flex items-center gap-2 whitespace-nowrap font-mono text-[12px] tracking-[0.04em]", !s.loaded ? "text-mute" : secure ? "text-ok" : "text-bad")}>
              <Dot tone={!s.loaded ? "mute" : secure ? "ok" : "bad"} />{!s.loaded ? "CHECKING" : secure ? "SYSTEM SECURE" : "ATTENTION REQUIRED"}
            </span>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenu(!menu)} aria-label="Account menu" aria-expanded={menu} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-ink text-[12px] font-semibold text-paper">{initials}</button>
              {menu && (
                <div className="absolute right-0 top-10 z-30 flex w-[220px] flex-col rounded border border-line bg-card p-1.5 shadow-[0_12px_32px_-12px_rgba(25,25,23,0.25)]">
                  <div className="mb-1 flex flex-col gap-0.5 border-b border-line-2 p-2.5"><span className="text-[14px] font-medium">{user.name}</span><span className="text-[12px] text-mute">{user.role}</span></div>
                  <button onClick={() => nav("/app/settings")} className="cursor-pointer rounded-[3px] border-0 bg-transparent p-2.5 text-left text-[14px] hover:bg-hov">Settings</button>
                  <button onClick={() => { localStorage.removeItem("qs-user"); nav("/signin"); }} className="cursor-pointer rounded-[3px] border-0 bg-transparent p-2.5 text-left text-[14px] text-bad hover:bg-hov">Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full max-w-[1320px] flex-col gap-8 px-5 pb-20 pt-10 md:px-10"><Outlet /></div>
      </main>
    </div>
  );
}
