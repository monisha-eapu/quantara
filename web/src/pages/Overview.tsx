import { useNavigate } from "react-router";
import { Btn, cx, ErrorState, Loading, PageTitle, SectionHead, Status, type Tone } from "../components/ui";
import { api } from "../lib/api";
import { nf, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface Dash {
  metrics: { totalRecords: number; landRecords: number; products: number; events: number; verified: number; tamperAlerts: number; legacy: number; ledgerBlocks: number };
  system: {
    cryptoEngine: { online: boolean; detail: string };
    ledgerIntegrity: { valid: boolean; detail: string };
    pqcVerification: { online: boolean; detail: string };
    auditSystem: { online: boolean; detail: string };
    quantumService: { online: boolean; ibmConfigured?: boolean };
  };
  ledger: { tipIndex: number; checkMs: number };
  alerts: { id: string; title: string; type: string; at: string | null }[];
  activity: { day: string; n: number }[];
  lastScan: { at: string; durationMs: number; signaturesVerified: number } | null;
}

const alertLink = (a: { id: string; type: string }) =>
  a.type === "SUPPLY_PRODUCT" ? `/app/supply-chain/${a.id}` : a.type === "SUPPLY_EVENT" ? `/app/supply-chain/${a.id.replace(/-E\d+$/, "")}` : a.type === "LEDGER_BLOCK" ? "/app/ledger" : `/app/records/${a.id}`;

function Metric({ value, label, sub, bad }: { value: string; label: string; sub: string; bad?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-1 border-r border-line-2 px-6 py-[22px] last:border-r-0", bad && "bg-bad-bg")}>
      <span className={cx("font-serif text-[42px] leading-none", bad && "text-bad")}>{value}</span>
      <span className="mt-2 text-[14px] font-medium">{label}</span>
      <span className="text-[13px] text-mute">{sub}</span>
    </div>
  );
}

export default function Overview() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<Dash>("/dashboard"), [], { pollMs: 15000 });
  const scan = useAction(async () => { await api.post("/integrity/scan"); await reload(); });
  if (loading && !data) return <Loading label="Loading overview…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const { metrics: m, system: s } = data;

  const q = s.quantumService;
  const rows: { name: string; sub: string; state: string; tone: Tone }[] = [
    { name: "Cryptographic engine", sub: s.cryptoEngine.detail, state: s.cryptoEngine.online ? "Operational" : "Offline", tone: s.cryptoEngine.online ? "ok" : "bad" },
    { name: "Ledger integrity", sub: s.ledgerIntegrity.detail, state: s.ledgerIntegrity.valid ? "Verified" : "Integrity failure", tone: s.ledgerIntegrity.valid ? "ok" : "bad" },
    { name: "PQC verification", sub: s.pqcVerification.detail, state: s.pqcVerification.online ? "Operational" : "Offline", tone: s.pqcVerification.online ? "ok" : "bad" },
    { name: "Audit system", sub: s.auditSystem.detail, state: s.auditSystem.online ? "Operational" : "Offline", tone: s.auditSystem.online ? "ok" : "bad" },
    { name: "IBM Quantum connection", sub: q.online ? (q.ibmConfigured ? "Qiskit Runtime · IBM Quantum platform" : "Simulators only · no IBM API key configured") : "Quantum service not running (optional)", state: !q.online ? "Offline" : q.ibmConfigured ? "Connected" : "Not configured", tone: q.online && q.ibmConfigured ? "ok" : "warn" },
  ];

  // Always show the last 14 days, including days with no blocks.
  const byDay = new Map(data.activity.map((a) => [a.day, a.n]));
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); const key = d.toISOString().slice(0, 10); return { key, d: key.slice(8), v: byDay.get(key) ?? 0 }; });
  const max = Math.max(1, ...days.map((d) => d.v));

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Overview" sub="Post-quantum security infrastructure" actions={<Btn variant="outline" loading={scan.pending} onClick={() => scan.run()} className="!bg-card">Run integrity scan</Btn>} />
      {scan.error && <ErrorState error={scan.error} />}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] rounded border border-line bg-card">
        <Metric value={nf.format(m.totalRecords)} label="Protected records" sub={`${nf.format(m.landRecords)} land · ${m.products} products · ${m.events} events`} />
        <Metric value={nf.format(m.verified)} label="Verified" sub={m.legacy ? `${m.legacy} legacy-signed` : "All signed with ML-DSA"} />
        <Metric value={nf.format(m.ledgerBlocks)} label="Ledger blocks" sub={`Tip #${data.ledger.tipIndex} · chain ${s.ledgerIntegrity.valid ? "intact" : "BROKEN"}`} />
        <Metric value={nf.format(m.tamperAlerts)} label="Security alerts" sub={m.tamperAlerts ? "Integrity violations detected" : "No integrity violations"} bad={m.tamperAlerts > 0} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-10">
        <div className="flex flex-col">
          <SectionHead title="System integrity" sub={data.lastScan ? `Last full scan ${timeAgo(data.lastScan.at)}: ${nf.format(data.lastScan.signaturesVerified)} signatures and blocks in ${data.lastScan.durationMs} ms` : "No full scan has run yet"} />
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-4 border-b border-line-2 py-3.5">
              <div className="flex min-w-0 flex-col gap-[3px]"><span className="text-[15px]">{r.name}</span><span className="truncate text-[13px] text-mute">{r.sub}</span></div>
              <Status tone={r.tone} className="text-[13px]">{r.state}</Status>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col">
            <SectionHead title="Security alerts" sub="Records whose verification currently fails" right={<button onClick={() => nav("/app/audit")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] underline underline-offset-[3px]">Audit trail</button>} />
            {data.alerts.length === 0 && <p className="m-0 border-b border-line-2 py-4 text-[14px] text-mute">No active alerts. Every verified record matches its signature and ledger anchor.</p>}
            {data.alerts.slice(0, 6).map((a) => (
              <button key={a.id} onClick={() => nav(alertLink(a))} className="flex cursor-pointer items-center gap-3.5 border-0 border-b border-line-2 bg-transparent py-3 text-left text-[14px] hover:bg-hov">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-bad" />
                <span className="whitespace-nowrap font-mono text-[13px]">{a.id}</span>
                <span className="min-w-0 flex-1 truncate text-mute">{a.title}</span>
                <span className="text-[13px] text-faint">{a.at ? timeAgo(a.at) : ""}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-[18px]">
            <SectionHead title="Ledger activity" sub="Blocks appended per day, last 14 days" />
            <div className="flex h-[150px] items-end gap-2 border-b border-line" role="img" aria-label="Ledger blocks appended per day">
              {days.map((b) => (
                <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="font-mono text-[11px] text-mute">{b.v}</span>
                  <div className="w-full bg-ink" style={{ height: `${Math.round((b.v / max) * 110)}px` }} />
                </div>
              ))}
            </div>
            <div className="-mt-2.5 flex gap-2">{days.map((b) => <span key={b.key} className="flex-1 text-center font-mono text-[11px] text-faint">{b.d}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
