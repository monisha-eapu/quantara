import { AlertTriangle, Atom, BookOpen, Cpu, ExternalLink, Play, Server, ShieldCheck, Split, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, cx, Empty, ErrorState, Hash, InlineError, KV, Loading, PageHeader, Pill } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDateTime, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface QStatus {
  online: boolean;
  separation: string;
  versions: { qiskit: string; qiskitIbmRuntime: string; qiskitAer: string };
  ibm: { configured: boolean; source: string | null; channel: string; instanceConfigured: boolean; preferredBackend: string | null };
  targets: Record<string, { label: string; kind: string; description: string }>;
}
interface QCircuit {
  id: string; name: string; short: string; category: string; threatLink: string; explanation: string; honesty: string;
  references: { label: string; url: string }[]; qubits: number; depth: number; ops: Record<string, number>; diagram: string; qasm: string | null;
  idealDistribution: Record<string, number>;
}
interface ShorRow { bitstring: string; count: number; measured: number; phase: string; periodCandidate: number; periodValid: boolean; factors: number[] | null }
interface QJob {
  id: string; circuit: string; circuitName: string; target: "ideal" | "noisy" | "ibm"; targetKind: string; targetLabel: string; backend: string | null;
  shots: number; status: string; submittedAt: string; completedAt?: string; ibmJobId: string | null; counts: Record<string, number> | null;
  analysis: { headline: string; interpretation: string; outcomes?: ShorRow[] } | null;
  transpiled: { depth: number; size: number; twoQubitGates: number; physicalQubits: number[] | null } | null;
  error: string | null; hellingerFidelity?: number | null; executionSeconds?: number; ibmUsage?: { quantumSeconds?: number }; lastPollError?: string;
}
interface Backend { name: string; qubits: number; pendingJobs: number | null; statusMsg: string }

const FINAL = new Set(["DONE", "ERROR", "CANCELLED"]);

export default function QuantumLab() {
  const status = useApi(() => api.get<QStatus>("/quantum/status"));
  const circuits = useApi(() => api.get<{ circuits: QCircuit[] }>("/quantum/circuits"));
  const jobs = useApi(() => api.get<{ jobs: QJob[] }>("/quantum/jobs"));
  const [circuitId, setCircuitId] = useState("shor15");
  const [target, setTarget] = useState<"ideal" | "noisy" | "ibm">("noisy");
  const [shots, setShots] = useState(2048);
  const [backend, setBackend] = useState("");
  const [backends, setBackends] = useState<Backend[] | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const loadBackends = useAction(async () => setBackends((await api.get<{ backends: Backend[] }>("/quantum/ibm/backends")).backends));
  const submit = useAction(async () => {
    const job = await api.post<QJob>("/quantum/jobs", { circuitId, target, shots, backend: target === "ibm" && backend ? backend : undefined });
    setSelectedJob(job.id);
    await jobs.reload();
  });
  const remove = useAction(async (id: string) => { await api.del(`/quantum/jobs/${id}`); if (selectedJob === id) setSelectedJob(null); await jobs.reload(); });

  // Poll unfinished jobs (hardware jobs refresh their status from IBM Quantum).
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
  const ibmReady = !!status.data?.ibm.configured;

  return (
    <div>
      <PageHeader
        eyebrow="IBM Quantum · Qiskit Runtime"
        title={<span className="flex items-center gap-3"><Atom className="h-7 w-7 text-quantum-400" /> Quantum Threat Lab</span>}
        description="Real quantum circuits, executable on IBM Quantum hardware, that illustrate why today's public-key signatures need a post-quantum successor. This lab demonstrates the threat model. It does not break any cryptography."
      />

      <div className="mb-6 grid gap-0 overflow-hidden rounded-2xl border border-white/[0.08] md:grid-cols-[1fr_auto_1fr]">
        <div className="bg-gradient-to-br from-quantum-500/15 to-transparent p-5">
          <div className="label flex items-center gap-1.5 text-quantum-400"><Atom className="h-3.5 w-3.5" /> Quantum layer (this page)</div>
          <div className="mt-2 text-base font-semibold text-white">Threat demonstration on IBM Quantum</div>
          <p className="mt-1.5 text-sm text-slate-300">Qiskit circuits run on IBM quantum processors or local simulators. They show the algorithms (Shor, Grover) that motivate post-quantum cryptography.</p>
          <p className="mt-2 text-xs font-medium text-quantum-400">Never receives records, signatures or keys.</p>
        </div>
        <div className="flex items-center justify-center border-y border-white/[0.06] bg-ink-900/80 px-4 py-3 md:border-x md:border-y-0">
          <div className="flex flex-col items-center gap-1 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500"><Split className="h-5 w-5" />Fully<br />separate</div>
        </div>
        <div className="bg-gradient-to-bl from-brand-500/15 to-transparent p-5">
          <div className="label flex items-center gap-1.5 text-brand-300"><ShieldCheck className="h-3.5 w-3.5" /> Security layer (rest of QuantumShield)</div>
          <div className="mt-2 text-base font-semibold text-white">ML-DSA-65 signatures on classical servers</div>
          <p className="mt-1.5 text-sm text-slate-300">Every record is signed and verified with ML-DSA (FIPS 204). It needs no quantum computer and is designed to resist attacks from one.</p>
          <p className="mt-2 text-xs font-medium text-brand-300">Unaffected if the quantum service is offline.</p>
        </div>
      </div>

      {status.loading ? <Loading label="Connecting to quantum service…" /> : offline || status.error ? (
        <Card>
          <ErrorState error={status.error!} onRetry={status.reload} />
          <p className="mt-4 text-center text-xs text-slate-400">Start it with <code className="rounded bg-ink-950 px-1.5 py-0.5 font-mono text-slate-200">npm run dev:quantum</code>. The ML-DSA security layer keeps working without it.</p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="glass rounded-xl p-4">
              <div className="label">Quantum SDK</div>
              <div className="mt-2 text-sm text-slate-200">Qiskit <span className="font-mono">{status.data!.versions.qiskit}</span> · Runtime <span className="font-mono">{status.data!.versions.qiskitIbmRuntime}</span> · Aer <span className="font-mono">{status.data!.versions.qiskitAer}</span></div>
            </div>
            <div className={cx("glass rounded-xl p-4", ibmReady && "glow-violet")}>
              <div className="label">IBM Quantum account</div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                {ibmReady ? <Pill tone="violet">CONFIGURED · {status.data!.ibm.source}</Pill> : <Pill tone="amber">NOT CONFIGURED</Pill>}
                <span className="text-xs text-slate-500">{status.data!.ibm.channel}</span>
              </div>
              {!ibmReady && <p className="mt-2 text-xs text-slate-400">Add <code className="font-mono text-slate-300">IBM_QUANTUM_TOKEN</code> (and <code className="font-mono text-slate-300">IBM_QUANTUM_INSTANCE</code>) to <code className="font-mono">.env</code> and restart to run on hardware.</p>}
            </div>
            <div className="glass rounded-xl p-4">
              <div className="label">IBM backends</div>
              {backends ? (
                <div className="mt-2 max-h-20 space-y-1 overflow-y-auto text-xs">
                  {backends.length === 0 ? <span className="text-slate-400">No operational backends visible to this account.</span> : backends.map((b) => (
                    <div key={b.name} className="flex justify-between text-slate-300"><span className="font-mono">{b.name}</span><span className="text-slate-500">{b.qubits}q · {b.pendingJobs ?? "?"} queued</span></div>
                  ))}
                </div>
              ) : (
                <Button size="sm" className="mt-2" disabled={!ibmReady} loading={loadBackends.pending} onClick={() => loadBackends.run()} icon={<Server className="h-3.5 w-3.5" />}>Load backends</Button>
              )}
              {loadBackends.error && <p className="mt-2 text-xs text-red-300">{loadBackends.error.message}</p>}
            </div>
          </div>

          {circuits.error ? <ErrorState error={circuits.error} onRetry={circuits.reload} /> : !circuits.data ? <Loading /> : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {circuits.data.circuits.map((c) => (
                  <button key={c.id} onClick={() => { setCircuitId(c.id); setSelectedJob(null); }} className={cx("rounded-xl border px-4 py-2.5 text-left transition", circuitId === c.id ? "border-quantum-500/60 bg-quantum-500/15 text-white" : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20")}>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{c.category} · {c.qubits} qubits</div>
                  </button>
                ))}
              </div>

              {circuit && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="space-y-6">
                    <Card title={circuit.name} subtitle={circuit.short} icon={<Atom className="h-4 w-4 text-quantum-400" />} actions={<Pill tone="violet">{circuit.category}</Pill>}>
                      <p className="text-sm leading-relaxed text-slate-300">{circuit.explanation}</p>
                      <div className="mt-4 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4">
                        <div className="label mb-1 text-brand-300">Why it matters for record security</div>
                        <p className="text-sm text-slate-300">{circuit.threatLink}</p>
                      </div>
                      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
                        <div className="label mb-1 flex items-center gap-1.5 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Reality check</div>
                        <p className="text-sm leading-relaxed text-amber-50/85">{circuit.honesty}</p>
                      </div>
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="label">Circuit (Qiskit)</span>
                          <span className="text-[11px] text-slate-500">{circuit.qubits} qubits · depth {circuit.depth} · {Object.entries(circuit.ops).map(([k, v]) => `${v} ${k}`).join(", ")}</span>
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-950/80 p-4 font-mono text-[11px] leading-[1.35] text-quantum-400/90">{circuit.diagram}</pre>
                      </div>
                      {circuit.references.length > 0 && (
                        <div className="mt-4 space-y-1">
                          <div className="label flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> References</div>
                          {circuit.references.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-brand-300 hover:underline">{r.label} <ExternalLink className="h-3 w-3" /></a>)}
                        </div>
                      )}
                    </Card>

                    <Card title="Results" subtitle={job ? `${job.circuitName} · ${job.targetLabel}` : "Run the circuit to see measured outcomes"} icon={<Cpu className="h-4 w-4" />}>
                      {!job ? <Empty icon={<Play className="h-8 w-8 text-quantum-400" />} title="No results yet" description="Choose an execution target and run the circuit. Ideal probabilities are shown for comparison." /> : <JobResult job={job} ideal={circuit.idealDistribution} />}
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card title="Execute" subtitle="Transpiled with Qiskit's preset pass manager for the target" icon={<Play className="h-4 w-4 text-quantum-400" />}>
                      <div className="space-y-2">
                        {(["ideal", "noisy", "ibm"] as const).map((t) => {
                          const info = status.data!.targets[t];
                          const disabled = t === "ibm" && !ibmReady;
                          return (
                            <label key={t} className={cx("flex cursor-pointer gap-3 rounded-xl border p-3 transition", disabled && "cursor-not-allowed opacity-50", target === t ? (t === "ibm" ? "border-quantum-500/60 bg-quantum-500/10" : "border-brand-500/50 bg-brand-500/[0.07]") : "border-white/10 hover:border-white/20")}>
                              <input type="radio" disabled={disabled} className="mt-1 accent-violet-500" checked={target === t} onChange={() => setTarget(t)} />
                              <span>
                                <span className="flex items-center gap-2 text-sm font-semibold text-white">{info.label} <Pill tone={t === "ibm" ? "violet" : "slate"}>{t === "ibm" ? "REAL HARDWARE" : "SIMULATION"}</Pill></span>
                                <span className="mt-0.5 block text-xs text-slate-400">{info.description}</span>
                                {disabled && <span className="mt-1 block text-xs text-amber-300">Requires IBM_QUANTUM_TOKEN in .env</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {target === "ibm" && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-slate-300">Backend</label>
                          <select className="input mt-1" value={backend} onChange={(e) => setBackend(e.target.value)}>
                            <option value="">{status.data!.ibm.preferredBackend ? `${status.data!.ibm.preferredBackend} (from .env)` : "Least busy available backend"}</option>
                            {backends?.map((b) => <option key={b.name} value={b.name}>{b.name} · {b.qubits} qubits · {b.pendingJobs ?? "?"} queued</option>)}
                          </select>
                        </div>
                      )}
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-slate-300">Shots</label>
                        <select className="input mt-1" value={shots} onChange={(e) => setShots(Number(e.target.value))}>{[1024, 2048, 4096].map((s) => <option key={s} value={s}>{s.toLocaleString()}</option>)}</select>
                      </div>
                      <div className="mt-4"><InlineError error={submit.error} /></div>
                      <Button variant="quantum" size="lg" className="mt-2 w-full" loading={submit.pending} onClick={() => submit.run()} icon={<Play className="h-4 w-4" />}>
                        {target === "ibm" ? "Submit to IBM Quantum" : "Run circuit"}
                      </Button>
                      {target === "ibm" && <p className="mt-2 text-[11px] text-slate-500">Uses your IBM Quantum allocation. Jobs can wait in a queue; status updates automatically.</p>}
                    </Card>

                    <Card title="Job history" bodyClass="p-0">
                      {!jobs.data?.jobs.length ? <Empty title="No jobs yet" /> : (
                        <ul className="max-h-[420px] divide-y divide-white/[0.05] overflow-y-auto">
                          {jobs.data.jobs.map((j) => (
                            <li key={j.id} className={cx("group flex cursor-pointer items-start justify-between gap-2 px-4 py-3 transition hover:bg-white/[0.03]", job?.id === j.id && "bg-quantum-500/[0.08]")} onClick={() => { setSelectedJob(j.id); setCircuitId(j.circuit); }}>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-100">{j.circuitName}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                  <Pill tone={j.target === "ibm" ? "violet" : "slate"}>{j.target === "ibm" ? "IBM HW" : j.target === "noisy" ? "NOISY SIM" : "IDEAL SIM"}</Pill>
                                  <span className="font-mono">{j.backend}</span> · {timeAgo(j.submittedAt)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Pill tone={j.status === "DONE" ? "green" : j.status === "ERROR" || j.status === "CANCELLED" ? "red" : "amber"}>{j.status}</Pill>
                                <button onClick={(e) => { e.stopPropagation(); remove.run(j.id); }} className="rounded p-1 text-slate-600 opacity-0 transition hover:text-red-300 group-hover:opacity-100" title="Delete job record"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Card title="Scale reality check" subtitle="This demonstration vs. a cryptographically relevant quantum computer" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="label py-2 pr-4" /><th className="label py-2 pr-4 text-quantum-400">This lab (Shor, N = 15)</th><th className="label py-2 text-red-300">Breaking RSA-2048 (published estimate)</th></tr></thead>
            <tbody className="divide-y divide-white/[0.05] text-slate-300">
              <tr><td className="py-2.5 pr-4 text-xs text-slate-400">Number to factor</td><td className="py-2.5 pr-4">15 (4 bits)</td><td className="py-2.5">2048-bit modulus</td></tr>
              <tr><td className="py-2.5 pr-4 text-xs text-slate-400">Qubits</td><td className="py-2.5 pr-4">7 physical, no error correction</td><td className="py-2.5">Fewer than one million noisy physical qubits, with error correction (Gidney, 2025)</td></tr>
              <tr><td className="py-2.5 pr-4 text-xs text-slate-400">Runtime</td><td className="py-2.5 pr-4">Seconds</td><td className="py-2.5">Under a week of continuous operation (same estimate)</td></tr>
              <tr><td className="py-2.5 pr-4 text-xs text-slate-400">Exists today?</td><td className="py-2.5 pr-4 text-emerald-300">Yes: runs on current IBM hardware</td><td className="py-2.5 text-amber-300">No: no such machine exists today</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-white">Takeaway:</span> the threat is not today's machines, but records that must stay trustworthy for decades. Signatures made now with RSA/ECC could be forged once a large fault-tolerant quantum computer exists.
          That is why QuantumShield signs with <span className="text-brand-300">ML-DSA</span> today. ML-DSA runs on ordinary servers and does not depend on this lab.
        </p>
      </Card>
    </div>
  );
}

function JobResult({ job, ideal }: { job: QJob; ideal: Record<string, number> }) {
  const keys = useMemo(() => {
    const all = new Set([...Object.keys(ideal), ...Object.keys(job.counts ?? {})]);
    return [...all].sort();
  }, [ideal, job.counts]);
  const total = job.counts ? Object.values(job.counts).reduce((a, b) => a + b, 0) : 0;
  const measured = (k: string) => (job.counts && total ? (job.counts[k] ?? 0) / total : 0);
  const max = Math.max(0.01, ...keys.map((k) => Math.max(measured(k), ideal[k] ?? 0)));
  const shown = keys.length > 16 ? keys.filter((k) => (ideal[k] ?? 0) > 0 || measured(k) > 0.01) : keys;

  return (
    <div className="space-y-5">
      <div className={cx("flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3", job.target === "ibm" ? "glow-violet border-quantum-500/50 bg-quantum-500/10" : "border-white/10 bg-white/[0.03]")}>
        <div>
          <div className={cx("text-xs font-bold uppercase tracking-widest", job.target === "ibm" ? "text-quantum-400" : "text-slate-400")}>
            {job.target === "ibm" ? "Executed on real IBM Quantum hardware" : job.target === "noisy" ? "Local simulation with IBM device noise model" : "Local ideal simulation"}
          </div>
          <div className="mt-0.5 font-mono text-sm text-white">{job.backend}</div>
        </div>
        <div className="text-right text-xs text-slate-400">
          {job.ibmJobId && <div className="flex items-center justify-end gap-1">IBM job ID <Hash value={job.ibmJobId} n={8} /></div>}
          <div>{job.shots.toLocaleString()} shots · submitted {formatDateTime(job.submittedAt)}</div>
        </div>
      </div>

      {job.status !== "DONE" ? (
        job.status === "ERROR" || job.status === "CANCELLED" ? <ErrorState error={new Error(job.error ?? `Job ${job.status.toLowerCase()}`)} /> : (
          <div className="scanline rounded-xl border border-quantum-500/30 bg-quantum-500/[0.05] py-10 text-center text-sm text-slate-300">
            Status: <span className="font-semibold text-quantum-400">{job.status}</span>{job.target === "ibm" && " · waiting for IBM Quantum (polling every 5 s)"}
            {job.lastPollError && <div className="mt-2 text-xs text-red-300">Last poll error: {job.lastPollError}</div>}
          </div>
        )
      ) : (
        <>
          {job.analysis && (
            <div className="rounded-xl border border-white/[0.08] bg-ink-900/60 p-4">
              <div className="text-base font-semibold text-white">{job.analysis.headline}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{job.analysis.interpretation}</p>
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-quantum-500" /> Measured</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-cyan-300" /> Ideal probability</span>
              {job.hellingerFidelity != null && <span className="ml-auto">Hellinger fidelity vs ideal: <span className="font-semibold text-white">{(job.hellingerFidelity * 100).toFixed(1)}%</span></span>}
            </div>
            <div className="flex h-56 items-end gap-1 rounded-xl border border-white/[0.06] bg-ink-950/60 p-3 pt-6">
              {shown.map((k) => {
                const m = measured(k), i = ideal[k] ?? 0;
                return (
                  <div key={k} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                    <div className="absolute -top-5 text-[10px] text-slate-300 opacity-0 transition group-hover:opacity-100">{(m * 100).toFixed(1)}%</div>
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      <div className="w-full max-w-10 rounded-t bg-gradient-to-t from-quantum-500/70 to-quantum-400" style={{ height: `${(m / max) * 100}%` }} />
                      {i > 0 && <div className="absolute left-0 right-0 mx-auto h-0.5 max-w-12 bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.9)]" style={{ bottom: `${(i / max) * 100}%` }} />}
                    </div>
                    <div className="mt-1.5 font-mono text-[10px] text-slate-400">{k}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {job.analysis?.outcomes && (
            <div className="overflow-x-auto">
              <div className="label mb-2">Classical post-processing (continued fractions → period → gcd)</div>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-slate-400"><th className="py-1.5 pr-3">Outcome</th><th className="py-1.5 pr-3">Shots</th><th className="py-1.5 pr-3">Phase</th><th className="py-1.5 pr-3">Period r</th><th className="py-1.5">Result</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05] font-mono">
                  {job.analysis.outcomes.slice(0, 8).map((o) => (
                    <tr key={o.bitstring}><td className="py-1.5 pr-3 text-white">{o.bitstring}</td><td className="py-1.5 pr-3 text-slate-300">{o.count}</td><td className="py-1.5 pr-3 text-slate-300">{o.phase}</td><td className="py-1.5 pr-3 text-slate-300">{o.periodCandidate}{o.periodValid ? " ✓" : ""}</td><td className={cx("py-1.5", o.factors ? "text-emerald-300" : "text-slate-500")}>{o.factors ? `15 = ${o.factors[0]} × ${o.factors[1]}` : "no factor (retry)"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {job.transpiled && (
            <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-ink-900/40 p-4 sm:grid-cols-4">
              <KV label="Transpiled depth">{job.transpiled.depth}</KV>
              <KV label="Two-qubit gates">{job.transpiled.twoQubitGates}</KV>
              <KV label="Physical qubits"><span className="font-mono text-xs">{job.transpiled.physicalQubits?.join(", ") ?? "—"}</span></KV>
              <KV label={job.target === "ibm" ? "QPU time" : "Sim time"}>{job.target === "ibm" ? (job.ibmUsage?.quantumSeconds != null ? `${job.ibmUsage.quantumSeconds}s` : "—") : job.executionSeconds != null ? `${job.executionSeconds}s` : "—"}</KV>
            </div>
          )}
        </>
      )}
    </div>
  );
}
