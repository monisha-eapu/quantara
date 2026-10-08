import { Activity, AlertOctagon, Atom, Blocks, Cpu, Database, FileStack, Radar, ScrollText, ShieldCheck, ShieldHalf } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button, Card, cx, Empty, ErrorState, Hash, Loading, PageHeader, Pill, Stat, StatusBadge } from "../components/ui";
import { api, type AuditEntry, type RecordSummary } from "../lib/api";
import { formatTime, nf, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface DashboardData {
  metrics: { totalRecords: number; landRecords: number; products: number; events: number; verified: number; tamperAlerts: number; legacy: number; unverified: number; ledgerBlocks: number; pqcSigned: number };
  system: {
    cryptoEngine: { online: boolean; detail: string };
    ledgerIntegrity: { valid: boolean; detail: string; tamperedBlocks: number[] };
    pqcVerification: { online: boolean; detail: string };
    auditSystem: { online: boolean; detail: string };
    quantumService: { online: boolean; ibmConfigured?: boolean; detail?: string };
  };
  ledger: { tipIndex: number; tipHash: string; tipAt: string; checkMs: number };
  recent: RecordSummary[];
  alerts: { id: string; title: string; type: string; at: string | null }[];
  recentAudit: AuditEntry[];
  activity: { day: string; n: number }[];
  lastScan: { at: string; durationMs: number; entities: number; verified: number; tampered: number; signaturesVerified: number; chainValid: boolean } | null;
}

function StatusRow({ label, ok, okText, badText, detail, icon }: { label: string; ok: boolean; okText: string; badText: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">{label}</div>
          <div className="truncate text-[11px] text-slate-500">{detail}</div>
        </div>
      </div>
      <div className={cx("flex shrink-0 items-center gap-2 font-mono text-xs font-bold tracking-wider", ok ? "text-emerald-300" : "text-red-300")}>
        <span className="relative flex h-2 w-2">
          <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", ok ? "bg-emerald-400" : "bg-red-400")} />
          <span className={cx("relative inline-flex h-2 w-2 rounded-full", ok ? "bg-emerald-400" : "bg-red-400")} />
        </span>
        {ok ? okText : badText}
      </div>
    </div>
  );
}

const recordLink = (r: { id: string; recordType?: string; type?: string }) => {
  const t = r.recordType ?? r.type;
  if (t === "SUPPLY_PRODUCT") return `/supply-chain/${r.id}`;
  if (t === "SUPPLY_EVENT") return `/supply-chain/${r.id.replace(/-E\d+$/, "")}`;
  if (t === "LEDGER_BLOCK") return `/ledger?block=${r.id.replace("BLOCK-", "")}`;
  return `/records/${r.id}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<DashboardData>("/dashboard"), [], { pollMs: 15000 });
  const scan = useAction(async () => { await api.post("/integrity/scan"); await reload(); });

  if (loading && !data) return <Loading label="Loading security posture…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const { metrics: m, system: s } = data;
  const maxActivity = Math.max(1, ...data.activity.map((a) => a.n));
  const allOnline = s.cryptoEngine.online && s.ledgerIntegrity.valid && s.pqcVerification.online;

  return (
    <div>
      {/* Q-SHIELD AP Hackathon Hero Banner */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 p-6 shadow-2xl relative">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-0.5 text-xs font-semibold text-cyan-300">
                Qiskit Fall Fest 2026 · CUTM Vizianagaram
              </span>
              <span className="rounded-full bg-brand-500/15 border border-brand-500/30 px-3 py-0.5 text-xs font-semibold text-brand-300">
                Use Case 02: Quantum-Safe DLT
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Q-SHIELD <span className="text-cyan-400">AP</span>
            </h1>
            <p className="text-sm font-medium text-slate-300">
              A Hybrid Quantum Machine Learning, Post-Quantum Cryptography and Distributed Ledger Framework for Secure Land Records, Supply Chains and Certificates.
            </p>
            <div className="text-xs font-semibold tracking-wider text-cyan-300 uppercase">
              QML Detects · PQC Protects · DLT Proves
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate("/demo")}
              className="bg-gradient-to-r from-cyan-500 to-brand-600 hover:from-cyan-400 hover:to-brand-500 text-white font-bold shadow-lg shadow-cyan-500/20"
            >
              Run Live Security Demo
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/quantum")}
              className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10 font-medium"
            >
              Quantum Intelligence Center
            </Button>
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-800/80 pt-5">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400">1. QML Detects</div>
            <div className="mt-1 font-semibold text-sm text-white">Quantum Ledger Intelligence Engine</div>
            <div className="mt-1 text-xs text-slate-400 leading-relaxed">
              Real 4-Qubit ZZFeatureMap kernel classifier screens behavioral anomalies even when credentials appear valid.
            </div>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">2. PQC Protects</div>
            <div className="mt-1 font-semibold text-sm text-white">NIST FIPS 204 ML-DSA-65</div>
            <div className="mt-1 text-xs text-slate-400 leading-relaxed">
              Quantum-resistant module-lattice digital signatures authenticate every land title, supply batch, and degree.
            </div>
          </div>
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-brand-400">3. DLT Proves</div>
            <div className="mt-1 font-semibold text-sm text-white">Permissioned Hash-Chained Ledger</div>
            <div className="mt-1 text-xs text-slate-400 leading-relaxed">
              Cryptographic block commitments preserve tamper-evident historical auditability across Andhra Pradesh nodes.
            </div>
          </div>
        </div>
      </div>

      <PageHeader
        eyebrow="Security operations"
        title={<>{nf.format(m.totalRecords)} protected records</>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className={cx("inline-flex items-center gap-1.5 font-medium", allOnline ? "text-emerald-300" : "text-red-300")}>
              <ShieldCheck className="h-4 w-4" /> {allOnline ? "Post-quantum (ML-DSA) verification online" : "Integrity issue detected"}
            </span>
            <span className="text-slate-500">·</span>
            <span>{nf.format(m.pqcSigned)} records signed with ML-DSA-65 · ledger tip #{data.ledger.tipIndex} · {timeAgo(data.ledger.tipAt)}</span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => navigate("/records/LAND-AP-VZM-10293")} icon={<FileStack className="h-4 w-4" />}>Demo record</Button>
            <Button variant="primary" onClick={() => scan.run()} loading={scan.pending} icon={<Radar className="h-4 w-4" />}>Run full integrity scan</Button>
          </>
        }
      />
      {scan.error && <div className="mb-4"><ErrorState error={scan.error} /></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total records" value={nf.format(m.totalRecords)} sub={`${nf.format(m.landRecords)} land · ${m.products} products · ${m.events} provenance events`} icon={<Database className="h-5 w-5" />} />
        <Stat label="Verified" value={nf.format(m.verified)} tone="green" sub={`${m.legacy} legacy-signed · ${m.unverified} awaiting re-verification`} icon={<ShieldCheck className="h-5 w-5" />} />
        <Stat label="Security alerts" value={nf.format(m.tamperAlerts)} tone={m.tamperAlerts ? "red" : "slate"} sub={m.tamperAlerts ? "Integrity violations detected" : "No integrity violations"} icon={<AlertOctagon className="h-5 w-5" />} />
        <Stat label="Ledger blocks" value={nf.format(m.ledgerBlocks)} sub={<>Chain {s.ledgerIntegrity.valid ? "intact" : "BROKEN"} · walked in {data.ledger.checkMs} ms</>} icon={<Blocks className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Recent records" subtitle="Latest signed registrations" className="xl:col-span-2" bodyClass="p-0" actions={<Link to="/land" className="text-xs text-brand-400 hover:underline">View registry</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th className="label px-5 py-3">Record</th><th className="label px-3 py-3">Details</th><th className="label hidden px-3 py-3 md:table-cell">Hash</th><th className="label px-5 py-3 text-right">Status</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.recent.map((r) => (
                  <tr key={r.id} className="cursor-pointer transition hover:bg-white/[0.03]" onClick={() => navigate(recordLink(r))}>
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-white">{r.id}</td>
                    <td className="max-w-[260px] truncate px-3 py-3 text-slate-300">{r.title}</td>
                    <td className="hidden px-3 py-3 md:table-cell"><Hash value={r.dataHash} n={6} /></td>
                    <td className="px-5 py-3 text-right"><StatusBadge status={r.integrityStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="System status" subtitle="Live health of the trust stack" icon={<Activity className="h-4 w-4" />} bodyClass="py-1">
          <div className="divide-y divide-white/[0.05]">
            <StatusRow label="Cryptographic Engine" ok={s.cryptoEngine.online} okText="ONLINE" badText="OFFLINE" detail={s.cryptoEngine.detail} icon={<Cpu className="h-4 w-4" />} />
            <StatusRow label="Ledger Integrity" ok={s.ledgerIntegrity.valid} okText="VERIFIED" badText="BROKEN" detail={s.ledgerIntegrity.detail} icon={<Blocks className="h-4 w-4" />} />
            <StatusRow label="PQC Verification" ok={s.pqcVerification.online} okText="ONLINE" badText="OFFLINE" detail="ML-DSA-65 signature verification" icon={<ShieldHalf className="h-4 w-4" />} />
            <StatusRow label="Audit System" ok={s.auditSystem.online} okText="ONLINE" badText="OFFLINE" detail={s.auditSystem.detail} icon={<ScrollText className="h-4 w-4" />} />
            <StatusRow label="Quantum Threat Lab" ok={s.quantumService.online} okText={s.quantumService.ibmConfigured ? "IBM READY" : "SIM READY"} badText="OFFLINE" detail={s.quantumService.online ? (s.quantumService.ibmConfigured ? "Qiskit + IBM Quantum configured" : "Qiskit simulators (IBM token not set)") : "Optional · separate from security layer"} icon={<Atom className="h-4 w-4" />} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Security alerts" subtitle="Integrity violations found by verification" bodyClass="p-0" icon={<AlertOctagon className="h-4 w-4 text-red-400" />}>
          {data.alerts.length === 0 ? <Empty icon={<ShieldCheck className="h-8 w-8 text-emerald-400" />} title="No active alerts" description="Every verified record matches its signature and ledger anchor." /> : (
            <ul className="divide-y divide-white/[0.05]">
              {data.alerts.map((a) => (
                <li key={a.id}>
                  <Link to={recordLink(a)} className="flex items-start gap-3 px-5 py-3 transition hover:bg-red-500/[0.04]">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]" />
                    <div className="min-w-0"><div className="font-mono text-xs font-semibold text-red-200">{a.id}</div><div className="truncate text-xs text-slate-400">{a.title}</div></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ledger activity" subtitle="Blocks appended per day (last 14 days)">
          {data.activity.length === 0 ? <Empty title="No recent blocks" /> : (
            <div className="flex h-40 items-end gap-1.5">
              {data.activity.map((a) => (
                <div key={a.day} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="text-[10px] text-slate-500 opacity-0 transition group-hover:opacity-100">{a.n}</div>
                  <div className="w-full rounded-t bg-gradient-to-t from-brand-600/60 to-cyan-400/80" style={{ height: `${Math.max(6, (a.n / maxActivity) * 120)}px` }} title={`${a.day}: ${a.n} blocks`} />
                  <div className="text-[9px] text-slate-500">{a.day.slice(8)}</div>
                </div>
              ))}
            </div>
          )}
          {data.lastScan && (
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-ink-900/50 p-3 text-xs text-slate-400">
              Last full scan {timeAgo(data.lastScan.at)}: <span className="text-slate-200">{nf.format(data.lastScan.signaturesVerified)}</span> signatures &amp; blocks re-verified in {data.lastScan.durationMs} ms ·{" "}
              <span className={data.lastScan.tampered ? "text-red-300" : "text-emerald-300"}>{data.lastScan.tampered} tampered</span>
            </div>
          )}
        </Card>

        <Card title="Recent audit events" bodyClass="p-0" actions={<Link to="/audit" className="text-xs text-brand-400 hover:underline">Full trail</Link>}>
          <ul className="divide-y divide-white/[0.05]">
            {data.recentAudit.map((a) => (
              <li key={a.id} className="px-5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-slate-200">{a.action}</span>
                  <Pill tone={["DETECTED", "INVALID", "FAILED"].includes(a.result) ? "red" : a.result === "WARNING" ? "amber" : a.result === "INFO" ? "slate" : "green"}>{a.result}</Pill>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-500">{formatTime(a.timestamp)} · {a.actor}{a.recordId ? ` · ${a.recordId}` : ""}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
