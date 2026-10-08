import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, cx, Dot, Empty, ErrorState, Loading, PageHeader, Section, Stat, StatusBadge } from "../components/ui";
import { api, type AuditEntry } from "../lib/api";
import { nf, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface Activity { id: number; timestamp: string; actor: string; action: string; recordId: string; result: string; recordType: string; algorithm: string; integrityStatus: string; productId: string | null }
interface DashboardData {
  metrics: { totalRecords: number; landRecords: number; products: number; events: number; verified: number; tamperAlerts: number; legacy: number; unverified: number; ledgerBlocks: number; pqcSigned: number };
  system: {
    cryptoEngine: { online: boolean; detail: string };
    ledgerIntegrity: { valid: boolean; detail: string };
    pqcVerification: { online: boolean; detail: string };
    auditSystem: { online: boolean; detail: string };
    quantumService: { online: boolean; ibmConfigured?: boolean; detail?: string };
  };
  ledger: { tipIndex: number; tipHash: string; tipAt: string; checkMs: number };
  alerts: { id: string; title: string; type: string; at: string | null }[];
  recentAudit: AuditEntry[];
  recentActivity: Activity[];
  activity: { day: string; n: number }[];
  lastScan: { at: string; durationMs: number; entities: number; tampered: number; signaturesVerified: number } | null;
}

const TYPE_LABEL: Record<string, string> = { LAND_RECORD: "Land record", SUPPLY_PRODUCT: "Supply chain", SUPPLY_EVENT: "Supply chain" };
const ACTION_LABEL: Record<string, string> = {
  CREATE_RECORD: "Created", VERIFY_RECORD: "Verified", VERIFY_PROVENANCE: "Chain verified", SUPPLY_EVENT: "Event signed",
  TAMPER_DETECTED: "Tamper detected", TAMPER_ATTEMPT: "Tamper simulated", PQC_MIGRATION: "Migrated to ML-DSA", RESTORE_ORIGINAL: "Restored",
};

const recordLink = (r: { id: string; type?: string }) => {
  if (r.type === "SUPPLY_PRODUCT") return `/supply-chain/${r.id}`;
  if (r.type === "SUPPLY_EVENT") return `/supply-chain/${r.id.replace(/-E\d+$/, "")}`;
  if (r.type === "LEDGER_BLOCK") return `/ledger?block=${r.id.replace("BLOCK-", "")}`;
  return `/records/${r.id}`;
};

function SystemRow({ label, ok, text, detail }: { label: string; ok: boolean; text: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0"><div className="text-[14px] font-medium text-slate-100">{label}</div><div className="truncate text-xs text-slate-500">{detail}</div></div>
      <div className={cx("flex shrink-0 items-center gap-2 text-[13px] font-medium", ok ? "text-slate-200" : "text-red-300")}><Dot tone={ok ? "green" : "red"} />{text}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<DashboardData>("/dashboard"), [], { pollMs: 15000 });
  const scan = useAction(async () => { await api.post("/integrity/scan"); await reload(); });

  if (loading && !data) return <Loading label="Loading overview…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const { metrics: m, system: s } = data;
  const secure = s.cryptoEngine.online && s.ledgerIntegrity.valid && s.pqcVerification.online;
  const q = s.quantumService;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Post-quantum security infrastructure"
        actions={<Button onClick={() => scan.run()} loading={scan.pending} icon={<Radar className="h-4 w-4" />}>Run integrity scan</Button>}
      />
      {scan.error && <div className="mb-5"><ErrorState error={scan.error} /></div>}

      {/* Metrics: one divided grid, not four cards */}
      <div className="grid grid-cols-2 divide-x divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 lg:grid-cols-4 lg:divide-y-0">
        <Stat label="Protected records" value={nf.format(m.totalRecords)} sub={`${nf.format(m.landRecords)} land · ${m.products} products · ${m.events} events`} />
        <Stat label="Verified" value={nf.format(m.verified)} sub={m.legacy ? `${m.legacy} legacy-signed` : "All with ML-DSA"} />
        <Stat label="Ledger blocks" value={nf.format(m.ledgerBlocks)} sub={`Tip #${data.ledger.tipIndex} · chain ${s.ledgerIntegrity.valid ? "intact" : "broken"}`} />
        <Stat label="Security alerts" value={nf.format(m.tamperAlerts)} tone={m.tamperAlerts ? "red" : "slate"} sub={m.tamperAlerts ? "Integrity violations detected" : "None"} />
      </div>

      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="System integrity" description={data.lastScan ? `Last full scan ${timeAgo(data.lastScan.at)}: ${nf.format(data.lastScan.signaturesVerified)} signatures and blocks in ${data.lastScan.durationMs} ms` : undefined}>
          <div className="mb-2 flex items-center gap-2.5">
            <Dot tone={secure ? "green" : "red"} />
            <span className={cx("text-[22px] font-bold tracking-[-0.01em]", secure ? "text-white" : "text-red-300")}>{secure ? "SECURE" : "ATTENTION REQUIRED"}</span>
          </div>
          <div className="divide-y divide-ink-800">
            <SystemRow label="Cryptographic engine" ok={s.cryptoEngine.online} text={s.cryptoEngine.online ? "Operational" : "Offline"} detail={s.cryptoEngine.detail} />
            <SystemRow label="Ledger integrity" ok={s.ledgerIntegrity.valid} text={s.ledgerIntegrity.valid ? "Verified" : "Failure"} detail={s.ledgerIntegrity.detail} />
            <SystemRow label="PQC verification" ok={s.pqcVerification.online} text={s.pqcVerification.online ? "Operational" : "Offline"} detail="ML-DSA-65 signature verification" />
            <SystemRow label="Audit system" ok={s.auditSystem.online} text={s.auditSystem.online ? "Operational" : "Offline"} detail={s.auditSystem.detail} />
            <SystemRow label="IBM Quantum connection" ok={q.online && Boolean(q.ibmConfigured)} text={!q.online ? "Service offline" : q.ibmConfigured ? "Connected" : "Not configured"} detail={q.online ? (q.ibmConfigured ? "Qiskit Runtime · IBM Quantum platform" : "Simulators only · add an IBM API key to enable hardware") : "Optional; independent of the security layer"} />
          </div>
        </Section>

        <div className="space-y-10">
          <Section title="Security alerts" description="Records whose verification currently fails" actions={<Link to="/audit" className="text-[13px] text-brand-400 hover:underline">Audit trail</Link>}>
            {data.alerts.length === 0 ? <Empty title="No active alerts" description="Every verified record matches its signature and ledger anchor." /> : (
              <ul className="divide-y divide-ink-800">
                {data.alerts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link to={recordLink(a)} className="flex items-center justify-between gap-4 py-2.5 hover:text-white">
                      <span className="flex min-w-0 items-center gap-3"><Dot tone="red" /><span className="font-mono text-[13px] text-slate-100">{a.id}</span><span className="hidden truncate text-[13px] text-slate-500 sm:inline">{a.title}</span></span>
                      <span className="shrink-0 text-xs text-slate-500">{a.at ? timeAgo(a.at) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Ledger activity" description="Blocks appended per day, last 14 days">
            <div className="h-[132px]" aria-label="Ledger blocks per day">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.activity} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#202b38" />
                  <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(8)} stroke="#667383" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#667383" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#0d131c", border: "1px solid #202b38", borderRadius: 6, fontSize: 12 }} labelStyle={{ color: "#9aa6b2" }} formatter={(v) => [`${v} blocks`, ""]} separator="" />
                  <Bar dataKey="n" fill="#2f7bff" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>

      <Section title="Recent activity" description="Signing, verification and integrity events across all registries" className="mt-12" actions={<Link to="/audit" className="text-[13px] text-brand-400 hover:underline">View full audit trail</Link>}>
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th">Record</th><th className="th">Type</th><th className="th">Event</th><th className="th">Actor</th><th className="th">Time</th><th className="th">Verification</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-ink-800">
              {data.recentActivity.map((a, i) => (
                <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: i * 0.025 }} className="cursor-pointer hover:bg-ink-900" onClick={() => navigate(recordLink({ id: a.recordId, type: a.recordType }))}>
                  <td className="td font-mono text-[12px] font-medium text-white">{a.recordId}</td>
                  <td className="td text-slate-300">{TYPE_LABEL[a.recordType] ?? a.recordType}</td>
                  <td className="td text-slate-300">{ACTION_LABEL[a.action] ?? a.action}</td>
                  <td className="td text-slate-300">{a.actor}</td>
                  <td className="td whitespace-nowrap text-slate-400">{timeAgo(a.timestamp)}</td>
                  <td className="td text-slate-300">{a.algorithm?.startsWith("ML-DSA") ? "ML-DSA" : a.algorithm ?? "—"}</td>
                  <td className="td"><StatusBadge status={a.integrityStatus} /></td>
                </motion.tr>
              ))}
              {data.recentActivity.length === 0 && <tr><td colSpan={7}><Empty title="No activity yet" /></td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
