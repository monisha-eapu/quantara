import { AlertTriangle, ExternalLink, Loader2, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, cx, Dot, Empty, ErrorState, Hash, InlineError, KV, Loading, PageHeader, Pill, Section } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDateTime, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface QStatus {
  online: boolean;
  versions: { qiskit: string; qiskitIbmRuntime: string; qiskitAer: string };
  ibm: { configured: boolean; source: string | null; channel: string; instanceConfigured: boolean; preferredBackend: string | null };
  targets: Record<string, { label: string; kind: string; description: string }>;
}
interface QCircuit {
  id: string; name: string; short: string; category: string; threatLink: string; explanation: string; honesty: string;
  references: { label: string; url: string }[]; qubits: number; depth: number; ops: Record<string, number>; diagram: string; idealDistribution: Record<string, number>;
}
interface ShorRow { bitstring: string; count: number; phase: string; periodCandidate: number; periodValid: boolean; factors: number[] | null }
interface QJob {
  id: string; circuit: string; circuitName: string; target: "ideal" | "noisy" | "ibm"; targetLabel: string; backend: string | null;
  shots: number; status: string; submittedAt: string; ibmJobId: string | null; counts: Record<string, number> | null;
  analysis: { headline: string; interpretation: string; outcomes?: ShorRow[] } | null;
  transpiled: { depth: number; twoQubitGates: number; physicalQubits: number[] | null } | null;
  error: string | null; hellingerFidelity?: number | null; executionSeconds?: number; ibmUsage?: { quantumSeconds?: number }; lastPollError?: string;
}
interface Backend { name: string; qubits: number; pendingJobs: number | null }

const FINAL = new Set(["DONE", "ERROR", "CANCELLED"]);
const TARGET_NAME = { ibm: "IBM Quantum hardware", noisy: "Simulator with IBM device noise", ideal: "Ideal simulator" } as const;

function phase(job: QJob | undefined, submitting: boolean): { text: string; tone: "slate" | "amber" | "green" | "red" } {
  if (submitting) return { text: "Submitting job…", tone: "amber" };
  if (!job) return { text: "Ready", tone: "slate" };
  if (job.status === "DONE") return { text: "Completed", tone: "green" };
  if (job.status === "ERROR" || job.status === "CANCELLED") return { text: "Failed", tone: "red" };
  if (job.status === "RUNNING") return { text: job.target === "ibm" ? "Running on quantum hardware…" : "Running simulation…", tone: "amber" };
  return { text: job.target === "ibm" ? "Queued at IBM Quantum…" : "Submitting job…", tone: "amber" };
}

export default function QuantumLab() {
  const status = useApi(() => api.get<QStatus>("/quantum/status"));
  const circuits = useApi(() => api.get<{ circuits: QCircuit[] }>("/quantum/circuits"));
  const jobs = useApi(() => api.get<{ jobs: QJob[] }>("/quantum/jobs"));
  const [circuitId, setCircuitId] = useState("ghz");
  const [target, setTarget] = useState<"ideal" | "noisy" | "ibm">("ibm");
  const [shots, setShots] = useState(1024);
  const [backend, setBackend] = useState("");
  const [backends, setBackends] = useState<Backend[] | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const ibmReady = !!status.data?.ibm.configured;
  useEffect(() => { if (status.data && !status.data.ibm.configured) setTarget((t) => (t === "ibm" ? "noisy" : t)); }, [status.data]);

  const loadBackends = useAction(async () => setBackends((await api.get<{ backends: Backend[] }>("/quantum/ibm/backends")).backends));
  const submit = useAction(async () => {
    const job = await api.post<QJob>("/quantum/jobs", { circuitId, target, shots, backend: target === "ibm" && backend ? backend : undefined });
    setSelectedJob(job.id);
    await jobs.reload();
  });
  const remove = useAction(async (id: string) => { await api.del(`/quantum/jobs/${id}`); if (selectedJob === id) setSelectedJob(null); await jobs.reload(); });

  // Poll unfinished jobs; hardware jobs refresh their status from IBM Quantum.
  const pending = jobs.data?.jobs.filter((j) => !FINAL.has(j.status)) ?? [];
  useEffect(() => {
    if (!pending.length) return;
    const t = setInterval(async () => {
      await Promise.allSettled(pending.map((j) => api.get(`/quantum/jobs/${j.id}`)));
      await jobs.reload();
    }, pending.some((j) => j.target === "ibm") ? 5000 : 1500);
    return () => clearInterval(t);
  }, [pending.map((j) => j.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const circuit = circuits.data?.circuits.find((c) => c.id === circuitId);
  const job = jobs.data?.jobs.find((j) => j.id === selectedJob) ?? jobs.data?.jobs.find((j) => j.circuit === circuitId && j.status === "DONE");
  const offline = status.error instanceof ApiError && status.error.status === 503;
  const ph = phase(job && job.id === selectedJob ? job : undefined, submit.pending);
  const running = submit.pending || (job && !FINAL.has(job.status) && job.id === selectedJob);

  return (
    <div>
      <PageHeader title="Quantum Lab" description="IBM Quantum integration. Run a real quantum workload through IBM Quantum hardware." />

      <div className="mb-9 rounded-lg border border-ink-700 bg-ink-900 px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400">Quantum computation demonstration</div>
        <p className="mt-1.5 max-w-4xl text-[14px] leading-relaxed text-slate-300">
          This workload demonstrates execution on IBM Quantum hardware. The post-quantum security layer uses ML-DSA independently of the quantum execution.
          Nothing here breaks RSA, ECC or ML-DSA, and the quantum service never receives records, signatures or keys.
        </p>
      </div>

      {status.loading ? <Loading label="Connecting to quantum service…" /> : offline || status.error ? (
        <div className="space-y-3">
          <ErrorState error={status.error!} onRetry={status.reload} />
          <p className="text-[13px] text-slate-400">Start the service with <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-slate-200">npm run dev:quantum</code>. The ML-DSA security layer keeps working without it.</p>
        </div>
      ) : (
        <>
          {circuits.error ? <ErrorState error={circuits.error} onRetry={circuits.reload} /> : !circuits.data ? <Loading /> : (
            <>
              <div role="tablist" aria-label="Circuit" className="mb-7 flex flex-wrap gap-x-7 border-b border-ink-700">
                {circuits.data.circuits.map((c) => (
                  <button key={c.id} role="tab" aria-selected={circuitId === c.id} onClick={() => { setCircuitId(c.id); setSelectedJob(null); }} className={cx("-mb-px border-b-2 pb-3 text-[14px] font-medium transition-colors", circuitId === c.id ? "border-brand-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200")}>
                    {c.name}<span className="ml-2 text-[11px] font-normal text-slate-500">{c.qubits} qubits</span>
                  </button>
                ))}
              </div>

              {circuit && (
                <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-10">
                    <Section title="Circuit" description={`${circuit.short} · ${circuit.qubits} qubits · depth ${circuit.depth} · ${Object.entries(circuit.ops).map(([k, v]) => `${v} ${k}`).join(", ")}`}>
                      <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 p-4 font-mono text-[12px] leading-[1.35] text-slate-200">{circuit.diagram}</pre>
                      <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-slate-300">{circuit.explanation}</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-ink-700 p-4"><div className="label mb-1">Relevance to record security</div><p className="text-[13px] leading-relaxed text-slate-300">{circuit.threatLink}</p></div>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-4"><div className="label mb-1 flex items-center gap-1.5 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Limits of this demonstration</div><p className="text-[13px] leading-relaxed text-slate-300">{circuit.honesty}</p></div>
                      </div>
                      {circuit.references.length > 0 && (
                        <ul className="mt-4 space-y-1">
                          {circuit.references.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-brand-300 hover:underline">{r.label}<ExternalLink className="h-3 w-3" /></a></li>)}
                        </ul>
                      )}
                    </Section>

                    <Section title="Measurement results" description={job ? `${job.circuitName} · ${job.targetLabel}` : "Run the circuit to see measured outcomes against the ideal distribution."}>
                      {!job ? <Empty icon={<Play className="h-7 w-7" />} title="No results yet" description="Choose an execution target and run the circuit." /> : <JobResult job={job} ideal={circuit.idealDistribution} />}
                    </Section>
                  </div>

                  <div className="space-y-10">
                    <Section title="Run">
                      <dl className="divide-y divide-ink-800 border-y border-ink-800 text-[13px]">
                        <Row k="Platform">IBM Quantum</Row>
                        <Row k="Connection">{ibmReady ? <span className="flex items-center gap-2 text-slate-100"><Dot tone="green" />Connected</span> : <span className="flex items-center gap-2 text-amber-300"><Dot tone="amber" />Not configured</span>}</Row>
                        <Row k="Backend">{target === "ibm" ? (backend || status.data!.ibm.preferredBackend || "Least busy available") : target === "noisy" ? "fake_torino (simulated)" : "aer_simulator"}</Row>
                        <Row k="Shots">
                          <select className="input h-7 w-24 py-0 text-[13px]" aria-label="Shots" value={shots} onChange={(e) => setShots(Number(e.target.value))}>{[1024, 2048, 4096].map((s) => <option key={s} value={s}>{s.toLocaleString()}</option>)}</select>
                        </Row>
                        <Row k="Job status"><span className={cx("flex items-center gap-2 font-medium", ph.tone === "green" ? "text-emerald-300" : ph.tone === "red" ? "text-red-300" : ph.tone === "amber" ? "text-amber-300" : "text-slate-200")}>{running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Dot tone={ph.tone} />}{ph.text}</span></Row>
                      </dl>

                      <fieldset className="mt-5">
                        <legend className="label mb-2">Execution target</legend>
                        <div className="space-y-1.5">
                          {(["ibm", "noisy", "ideal"] as const).map((t) => {
                            const disabled = t === "ibm" && !ibmReady;
                            return (
                              <label key={t} className={cx("flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors", disabled && "cursor-not-allowed opacity-45", target === t ? "border-brand-500/60 bg-brand-500/[0.07]" : "border-ink-700 hover:border-ink-600")}>
                                <input type="radio" name="target" disabled={disabled} className="mt-1 accent-blue-500" checked={target === t} onChange={() => setTarget(t)} />
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-slate-100">{TARGET_NAME[t]}{t === "ibm" ? <Pill tone="blue">Real hardware</Pill> : <Pill>Simulation</Pill>}</span>
                                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{t === "ibm" ? (disabled ? "Add IBM_QUANTUM_TOKEN to .env to enable." : "Submits to a real IBM quantum processor. Jobs may queue.") : t === "noisy" ? "Runs locally with the noise profile of IBM Torino. Not real hardware." : "Noise-free reference run on this machine."}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {target === "ibm" && (
                          <div className="mt-3 flex items-center gap-2">
                            <select className="input h-8 flex-1 py-0 text-[13px]" aria-label="IBM backend" value={backend} onChange={(e) => setBackend(e.target.value)}>
                              <option value="">{status.data!.ibm.preferredBackend ? `${status.data!.ibm.preferredBackend} (from .env)` : "Least busy backend"}</option>
                              {backends?.map((b) => <option key={b.name} value={b.name}>{b.name} · {b.qubits} qubits · {b.pendingJobs ?? "?"} queued</option>)}
                            </select>
                            <Button size="sm" onClick={() => loadBackends.run()} loading={loadBackends.pending}>{backends ? "Refresh" : "Load backends"}</Button>
                          </div>
                        )}
                        {loadBackends.error && <p className="mt-2 text-xs text-red-300">{loadBackends.error.message}</p>}
                      </fieldset>

                      <div className="mt-5"><InlineError error={submit.error} /></div>
                      <Button variant="primary" size="lg" className="mt-2 w-full" loading={!!running} disabled={!!running} onClick={() => submit.run()} icon={<Play className="h-4 w-4" />}>
                        {running ? ph.text.replace("…", "") : target === "ibm" ? "Run on IBM Quantum" : "Run simulation"}
                      </Button>
                      {target === "ibm" && <p className="mt-2 text-xs text-slate-500">Uses part of your IBM Quantum allocation (a few seconds for this circuit). Status refreshes automatically.</p>}
                    </Section>

                    <Section title="Job history">
                      {!jobs.data?.jobs.length ? <p className="text-[13px] text-slate-500">No jobs yet.</p> : (
                        <ul className="max-h-[360px] divide-y divide-ink-800 overflow-y-auto border-y border-ink-800">
                          {jobs.data.jobs.map((j) => (
                            <li key={j.id} className={cx("group flex cursor-pointer items-center justify-between gap-3 px-1 py-2.5 hover:bg-ink-900", job?.id === j.id && "bg-ink-900")} onClick={() => { setSelectedJob(j.id); setCircuitId(j.circuit); }}>
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-slate-100">{j.circuitName}</div>
                                <div className="text-[11px] text-slate-500">{j.target === "ibm" ? "IBM hardware" : j.target === "noisy" ? "Noisy simulator" : "Ideal simulator"} · {j.backend} · {timeAgo(j.submittedAt)}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cx("flex items-center gap-1.5 text-xs font-medium", j.status === "DONE" ? "text-emerald-300" : j.status === "ERROR" || j.status === "CANCELLED" ? "text-red-300" : "text-amber-300")}><Dot tone={j.status === "DONE" ? "green" : j.status === "ERROR" || j.status === "CANCELLED" ? "red" : "amber"} />{j.status === "DONE" ? "Completed" : j.status.charAt(0) + j.status.slice(1).toLowerCase()}</span>
                                <button onClick={(e) => { e.stopPropagation(); remove.run(j.id); }} className="rounded p-1 text-slate-600 opacity-0 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100" aria-label="Delete job record"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 text-[11px] text-slate-500">Qiskit {status.data!.versions.qiskit} · Runtime {status.data!.versions.qiskitIbmRuntime} · Aer {status.data!.versions.qiskitAer}</p>
                    </Section>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Section title="Scale of the threat" description="This demonstration compared with a cryptographically relevant quantum computer" className="mt-14">
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-b border-ink-700 bg-ink-900"><tr><th className="th" /><th className="th">This lab (Shor, N = 15)</th><th className="th">Breaking RSA-2048 (published estimate)</th></tr></thead>
            <tbody className="divide-y divide-ink-800 text-slate-300">
              <tr><td className="td text-slate-500">Number to factor</td><td className="td">15 (4 bits)</td><td className="td">2048-bit modulus</td></tr>
              <tr><td className="td text-slate-500">Qubits</td><td className="td">7 physical, no error correction</td><td className="td">Under one million noisy physical qubits, error-corrected (Gidney, 2025)</td></tr>
              <tr><td className="td text-slate-500">Runtime</td><td className="td">Seconds</td><td className="td">Under a week of continuous operation (same estimate)</td></tr>
              <tr><td className="td text-slate-500">Available today</td><td className="td text-emerald-300">Yes, on current IBM hardware</td><td className="td text-amber-300">No such machine exists</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-4xl text-[14px] leading-relaxed text-slate-300">
          The risk is not today's machines. It is records that must stay trustworthy for decades: signatures made now with RSA or ECC could be forged once a large fault-tolerant quantum computer exists.
          That is why QuantumShield signs with ML-DSA today. ML-DSA runs on ordinary servers and does not depend on this lab.
        </p>
      </Section>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-slate-400">{k}</dt><dd className="min-w-0 text-right text-slate-100">{children}</dd></div>;
}

function JobResult({ job, ideal }: { job: QJob; ideal: Record<string, number> }) {
  const total = job.counts ? Object.values(job.counts).reduce((a, b) => a + b, 0) : 0;
  const data = useMemo(() => {
    const keys = new Set([...Object.keys(ideal), ...Object.keys(job.counts ?? {})]);
    const rows = [...keys].sort().map((k) => ({ state: k, measured: total ? +(((job.counts?.[k] ?? 0) / total) * 100).toFixed(2) : 0, ideal: +((ideal[k] ?? 0) * 100).toFixed(2) }));
    return rows.length > 16 ? rows.filter((r) => r.ideal > 0 || r.measured > 1) : rows;
  }, [ideal, job.counts, total]);

  return (
    <div className="space-y-6">
      <div className={cx("flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3", job.target === "ibm" ? "border-brand-500/40 bg-brand-500/[0.05]" : "border-ink-700 bg-ink-900")}>
        <div>
          <div className={cx("text-[11px] font-semibold uppercase tracking-[0.1em]", job.target === "ibm" ? "text-brand-300" : "text-slate-400")}>
            {job.target === "ibm" ? "Executed on IBM Quantum hardware" : job.target === "noisy" ? "Local simulation with IBM device noise model" : "Local ideal simulation"}
          </div>
          <div className="mt-0.5 font-mono text-[14px] text-white">{job.backend}</div>
        </div>
        <div className="text-right text-xs text-slate-400">
          {job.ibmJobId && <div className="flex items-center justify-end gap-1.5">IBM job ID <Hash value={job.ibmJobId} n={8} /></div>}
          <div>{job.shots.toLocaleString()} shots · {formatDateTime(job.submittedAt)}</div>
        </div>
      </div>

      {job.status !== "DONE" ? (
        job.status === "ERROR" || job.status === "CANCELLED" ? <ErrorState error={new Error(job.error ?? `Job ${job.status.toLowerCase()}`)} /> : (
          <div className="flex items-center gap-3 rounded-lg border border-ink-700 px-4 py-6 text-[14px] text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            {job.target === "ibm" ? (job.status === "RUNNING" ? "Running on quantum hardware…" : "Waiting in the IBM Quantum queue…") : "Running simulation…"}
            {job.lastPollError && <span className="text-xs text-red-300">Last poll error: {job.lastPollError}</span>}
          </div>
        )
      ) : (
        <>
          {job.analysis && (
            <div>
              <div className="text-[17px] font-semibold text-white">{job.analysis.headline}</div>
              <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">{job.analysis.interpretation}</p>
            </div>
          )}
          <div className="h-64" role="img" aria-label="Measured versus ideal outcome probabilities">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="#202b38" />
                <XAxis dataKey="state" stroke="#667383" tick={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }} tickLine={false} axisLine={{ stroke: "#202b38" }} />
                <YAxis unit="%" stroke="#667383" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#0d131c", border: "1px solid #202b38", borderRadius: 6, fontSize: 12 }} labelStyle={{ color: "#9aa6b2", fontFamily: "ui-monospace, monospace" }} formatter={(v) => `${v}%`} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: "#9aa6b2" }} />
                <Bar dataKey="measured" name="Measured" fill="#2f7bff" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="ideal" name="Ideal" fill="#4b5866" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="grid gap-x-8 gap-y-3 border-y border-ink-800 py-4 sm:grid-cols-4">
            <KV label="Fidelity vs ideal">{job.hellingerFidelity != null ? `${(job.hellingerFidelity * 100).toFixed(1)}%` : "—"}</KV>
            <KV label="Transpiled depth">{job.transpiled?.depth ?? "—"}</KV>
            <KV label="Two-qubit gates">{job.transpiled?.twoQubitGates ?? "—"}</KV>
            <KV label={job.target === "ibm" ? "Quantum time" : "Simulation time"}>{job.target === "ibm" ? (job.ibmUsage?.quantumSeconds != null ? `${job.ibmUsage.quantumSeconds} s` : "—") : job.executionSeconds != null ? `${job.executionSeconds} s` : "—"}</KV>
            {job.transpiled?.physicalQubits && <div className="sm:col-span-4"><KV label="Physical qubits used"><span className="font-mono text-[12px] text-slate-300">{job.transpiled.physicalQubits.join(", ")}</span></KV></div>}
          </dl>
          {job.analysis?.outcomes && (
            <div className="overflow-x-auto">
              <div className="label mb-2">Classical post-processing: continued fractions, then period, then gcd</div>
              <table className="w-full text-[12px]">
                <thead className="border-b border-ink-700"><tr className="text-left text-slate-500"><th className="py-1.5 pr-4 font-medium">Outcome</th><th className="py-1.5 pr-4 font-medium">Shots</th><th className="py-1.5 pr-4 font-medium">Phase</th><th className="py-1.5 pr-4 font-medium">Period r</th><th className="py-1.5 font-medium">Result</th></tr></thead>
                <tbody className="divide-y divide-ink-800 font-mono">
                  {job.analysis.outcomes.slice(0, 8).map((o) => (
                    <tr key={o.bitstring}><td className="py-1.5 pr-4 text-white">{o.bitstring}</td><td className="py-1.5 pr-4 text-slate-300">{o.count}</td><td className="py-1.5 pr-4 text-slate-300">{o.phase}</td><td className="py-1.5 pr-4 text-slate-300">{o.periodCandidate}{o.periodValid ? " ✓" : ""}</td><td className={cx("py-1.5", o.factors ? "text-emerald-300" : "text-slate-500")}>{o.factors ? `15 = ${o.factors[0]} × ${o.factors[1]}` : "no factor"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
