import { useEffect, useMemo, useState } from "react";
import { Btn, cx, Dot, ErrorState, Hash, InlineError, Loading, PageTitle, SectionHead, Status, type Tone } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDateTime, timeAgo } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface QStatus { versions: { qiskit: string; qiskitIbmRuntime: string; qiskitAer: string }; ibm: { configured: boolean; preferredBackend: string | null } }
interface QCircuit { id: string; name: string; short: string; category: string; threatLink: string; explanation: string; honesty: string; references: { label: string; url: string }[]; qubits: number; depth: number; ops: Record<string, number>; diagram: string; idealDistribution: Record<string, number> }
interface ShorRow { bitstring: string; count: number; phase: string; periodCandidate: number; periodValid: boolean; factors: number[] | null }
interface QJob {
  id: string; circuit: string; circuitName: string; target: "ideal" | "noisy" | "ibm"; targetLabel: string; backend: string | null; shots: number; status: string; submittedAt: string;
  ibmJobId: string | null; counts: Record<string, number> | null; analysis: { headline: string; interpretation: string; outcomes?: ShorRow[] } | null;
  transpiled: { depth: number; twoQubitGates: number; physicalQubits: number[] | null } | null; error: string | null; hellingerFidelity?: number | null; executionSeconds?: number; ibmUsage?: { quantumSeconds?: number }; lastPollError?: string;
}
interface Backend { name: string; qubits: number; pendingJobs: number | null }

const FINAL = new Set(["DONE", "ERROR", "CANCELLED"]);
const TARGETS = {
  ibm: { name: "IBM Quantum hardware", tag: "Real hardware", sub: "Submits to a real IBM quantum processor. Jobs may queue." },
  noisy: { name: "Simulator with IBM device noise", tag: "Simulation", sub: "Runs locally with the noise profile of IBM Torino. Not real hardware." },
  ideal: { name: "Ideal simulator", tag: "Simulation", sub: "Noise-free reference run on this machine." },
} as const;

function phase(job: QJob | undefined, submitting: boolean): { text: string; tone: Tone } {
  if (submitting) return { text: "Submitting job…", tone: "warn" };
  if (!job) return { text: "Ready", tone: "mute" };
  if (job.status === "DONE") return { text: "Completed", tone: "ok" };
  if (job.status === "ERROR" || job.status === "CANCELLED") return { text: "Failed", tone: "bad" };
  if (job.status === "RUNNING") return { text: job.target === "ibm" ? "Running on quantum hardware" : "Running simulation", tone: "warn" };
  return { text: job.target === "ibm" ? "Queued at IBM Quantum" : "Submitting job…", tone: "warn" };
}

export default function QuantumLab() {
  const status = useApi(() => api.get<QStatus>("/quantum/status"));
  const circuits = useApi(() => api.get<{ circuits: QCircuit[] }>("/quantum/circuits"));
  const jobs = useApi(() => api.get<{ jobs: QJob[] }>("/quantum/jobs"));
  const [cid, setCid] = useState("ghz");
  const [target, setTarget] = useState<"ibm" | "noisy" | "ideal">("ibm");
  const [shots, setShots] = useState(1024);
  const [backend, setBackend] = useState("");
  const [backends, setBackends] = useState<Backend[] | null>(null);
  const [selJob, setSelJob] = useState<string | null>(null);

  const ibmReady = !!status.data?.ibm.configured;
  useEffect(() => { if (status.data && !status.data.ibm.configured) setTarget((t) => (t === "ibm" ? "noisy" : t)); }, [status.data]);

  const loadBackends = useAction(async () => setBackends((await api.get<{ backends: Backend[] }>("/quantum/ibm/backends")).backends));
  const submit = useAction(async () => {
    const j = await api.post<QJob>("/quantum/jobs", { circuitId: cid, target, shots, backend: target === "ibm" && backend ? backend : undefined });
    setSelJob(j.id); await jobs.reload();
  });
  const pending = jobs.data?.jobs.filter((j) => !FINAL.has(j.status)) ?? [];
  useEffect(() => {
    if (!pending.length) return;
    const t = setInterval(async () => { await Promise.allSettled(pending.map((j) => api.get(`/quantum/jobs/${j.id}`))); await jobs.reload(); }, pending.some((j) => j.target === "ibm") ? 5000 : 1500);
    return () => clearInterval(t);
  }, [pending.map((j) => j.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const circ = circuits.data?.circuits.find((c) => c.id === cid);
  const job = jobs.data?.jobs.find((j) => j.id === selJob) ?? jobs.data?.jobs.find((j) => j.circuit === cid && j.status === "DONE");
  const live = jobs.data?.jobs.find((j) => j.id === selJob);
  const ph = phase(live, submit.pending);
  const running = submit.pending || (!!live && !FINAL.has(live.status));
  const offline = status.error instanceof ApiError && status.error.status === 503;

  return (
    <div className="flex flex-col gap-7">
      <PageTitle title="Quantum Lab" sub="IBM Quantum integration. Run a real quantum workload through IBM Quantum hardware." />
      <div className="flex flex-col gap-2 rounded border border-line bg-card px-6 py-5">
        <span className="eyebrow">Quantum computation demonstration</span>
        <p className="m-0 max-w-[960px] text-[14px] leading-[1.7] text-body">This workload demonstrates execution on IBM Quantum hardware. The post-quantum security layer uses ML-DSA independently of the quantum execution. Nothing here breaks RSA, ECC or ML-DSA, and the quantum service never receives records, signatures or keys.</p>
      </div>

      {status.loading ? <Loading label="Connecting to quantum service…" /> : offline || status.error ? (
        <div className="flex flex-col gap-3"><ErrorState error={status.error!} onRetry={status.reload} /><p className="m-0 text-[13px] text-mute">Start it with <code className="rounded-sm bg-hov px-1.5 py-0.5 font-mono">npm run dev:quantum</code>. The ML-DSA security layer keeps working without it.</p></div>
      ) : circuits.error ? <ErrorState error={circuits.error} onRetry={circuits.reload} /> : !circuits.data || !circ ? <Loading /> : (
        <>
          <div role="tablist" aria-label="Circuit" className="flex gap-7 overflow-x-auto border-b border-line">
            {circuits.data.circuits.map((c) => (
              <button key={c.id} role="tab" aria-selected={cid === c.id} onClick={() => { setCid(c.id); setSelJob(null); }} className={cx("-mb-px flex cursor-pointer items-baseline gap-2 whitespace-nowrap border-0 border-b-2 bg-transparent py-3 text-[15px]", cid === c.id ? "border-ink font-medium" : "border-transparent")}>
                {c.name}<span className="text-[12px] font-normal text-faint">{c.qubits} qubits</span>
              </button>
            ))}
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            <div className="flex flex-col gap-5">
              <SectionHead title="Circuit" sub={`${circ.short} · ${circ.qubits} qubits · depth ${circ.depth} · ${Object.entries(circ.ops).map(([k, v]) => `${v} ${k}`).join(", ")}`} />
              <pre className="m-0 overflow-x-auto rounded border border-line bg-card p-6 font-mono text-[13px] leading-[1.4]">{circ.diagram}</pre>
              <p className="m-0 text-[15px] leading-[1.7] text-body">{circ.explanation}</p>
              {job && <JobResult job={job} ideal={circ.idealDistribution} />}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
                <div className="flex flex-col gap-2 rounded border border-line bg-card px-5 py-[18px]"><span className="eyebrow">Relevance to record security</span><span className="text-[14px] leading-[1.65]">{circ.threatLink}</span></div>
                <div className="flex flex-col gap-2 rounded border border-warn-line bg-warn-bg px-5 py-[18px]"><span className="text-[11px] uppercase tracking-[0.1em] text-warn">Limits of this demonstration</span><span className="text-[14px] leading-[1.65]">{circ.honesty}</span></div>
              </div>
              {circ.references.length > 0 && <ul className="m-0 flex list-none flex-col gap-1 p-0">{circ.references.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer" className="text-[13px] underline decoration-line-4 underline-offset-[3px] hover:decoration-ink">{r.label} ↗</a></li>)}</ul>}
            </div>

            <div className="sticky top-[84px] flex flex-col gap-5">
              <SectionHead title="Run" />
              <dl className="m-0 flex flex-col text-[14px]">
                {[
                  ["Platform", "IBM Quantum"],
                  ["Connection", ibmReady ? <Status key="c" tone="ok">Connected</Status> : <Status key="c" tone="warn">Not configured</Status>],
                  ["Backend", target === "ibm" ? (backend || status.data?.ibm.preferredBackend || "Least busy available") : target === "noisy" ? "fake_torino (simulated)" : "aer_simulator"],
                ].map(([k, v]) => <div key={k as string} className="flex justify-between gap-4 border-b border-line-2 py-3"><dt className="text-mute">{k}</dt><dd className="m-0 text-right">{v}</dd></div>)}
                <div className="flex items-center justify-between border-b border-line-2 py-2"><dt className="text-mute">Shots</dt><dd className="m-0"><select aria-label="Shots" value={shots} onChange={(e) => setShots(Number(e.target.value))} className="rounded border border-line bg-card px-2.5 py-1.5 text-[14px]">{[1024, 4096, 8192].map((s) => <option key={s} value={s}>{s.toLocaleString("en-US")}</option>)}</select></dd></div>
                <div className="flex justify-between border-b border-line-2 py-3"><dt className="text-mute">Job status</dt><dd className="m-0"><Status tone={ph.tone}>{ph.text}</Status></dd></div>
              </dl>

              <span className="eyebrow">Execution target</span>
              {(["ibm", "noisy", "ideal"] as const).map((t) => {
                const disabled = t === "ibm" && !ibmReady;
                return (
                  <button key={t} disabled={disabled} onClick={() => setTarget(t)} role="radio" aria-checked={target === t} className={cx("grid grid-cols-[18px_1fr] gap-3 rounded border bg-card px-4 py-3.5 text-left", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", target === t ? "border-ink" : "border-line")}>
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-ink"><span className={cx("h-2 w-2 rounded-full", target === t ? "bg-ink" : "bg-transparent")} /></span>
                    <span className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{TARGETS[t].name}<span className="rounded-[3px] border border-line px-1.5 py-0.5 text-[11px] font-normal text-mute">{TARGETS[t].tag}</span></span>
                      <span className="text-[13px] leading-normal text-mute">{disabled ? "Requires IBM_QUANTUM_TOKEN in .env" : TARGETS[t].sub}</span>
                    </span>
                  </button>
                );
              })}
              {target === "ibm" && (
                <div className="flex items-center gap-2">
                  <select aria-label="IBM backend" value={backend} onChange={(e) => setBackend(e.target.value)} className="inp !py-2 !text-[13px]"><option value="">{status.data?.ibm.preferredBackend ? `${status.data.ibm.preferredBackend} (from .env)` : "Least busy backend"}</option>{backends?.map((b) => <option key={b.name} value={b.name}>{b.name} · {b.qubits}q · {b.pendingJobs ?? "?"} queued</option>)}</select>
                  <Btn variant="outline" size="sm" loading={loadBackends.pending} onClick={() => loadBackends.run()}>{backends ? "Refresh" : "Load"}</Btn>
                </div>
              )}
              <InlineError error={loadBackends.error ?? submit.error} />
              <Btn className="!py-[13px]" loading={running} disabled={running} onClick={() => submit.run()}>{running ? ph.text : target === "ibm" ? "Run on IBM Quantum" : "Run simulation"}</Btn>
              {target === "ibm" && <p className="m-0 text-[12px] leading-relaxed text-mute">Uses part of your IBM Quantum allocation (a few seconds for this circuit). Status refreshes automatically.</p>}

              {jobs.data && jobs.data.jobs.length > 0 && (
                <div className="flex flex-col"><SectionHead title="Job history" />
                  {jobs.data.jobs.slice(0, 6).map((j) => (
                    <button key={j.id} onClick={() => { setSelJob(j.id); setCid(j.circuit); }} className={cx("flex cursor-pointer items-center justify-between gap-3 border-0 border-b border-line-2 bg-transparent px-1 py-2.5 text-left hover:bg-hov", job?.id === j.id && "bg-hov")}>
                      <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{j.circuitName}</span><span className="block truncate text-[12px] text-mute">{j.target === "ibm" ? "IBM hardware" : j.target === "noisy" ? "Noisy simulator" : "Ideal simulator"} · {j.backend} · {timeAgo(j.submittedAt)}</span></span>
                      <Status tone={j.status === "DONE" ? "ok" : FINAL.has(j.status) ? "bad" : "warn"} className="text-[12px]">{j.status === "DONE" ? "Completed" : j.status.charAt(0) + j.status.slice(1).toLowerCase()}</Status>
                    </button>
                  ))}
                </div>
              )}
              {status.data && <p className="m-0 text-[11px] text-faint">Qiskit {status.data.versions.qiskit} · Runtime {status.data.versions.qiskitIbmRuntime} · Aer {status.data.versions.qiskitAer}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function JobResult({ job, ideal }: { job: QJob; ideal: Record<string, number> }) {
  const total = job.counts ? Object.values(job.counts).reduce((a, b) => a + b, 0) : 0;
  const rows = useMemo(() => {
    const keys = [...new Set([...Object.keys(ideal), ...Object.keys(job.counts ?? {})])].sort();
    const all = keys.map((k) => ({ k, v: job.counts?.[k] ?? 0, i: ideal[k] ?? 0 }));
    return all.length > 16 ? all.filter((r) => r.i > 0 || r.v / (total || 1) > 0.01) : all;
  }, [ideal, job.counts, total]);
  const max = Math.max(1, ...rows.map((r) => r.v));

  return (
    <div className="flex flex-col gap-3.5 rounded border border-line bg-card px-6 py-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">Measurement counts</span>
        <span className="font-mono text-[12px] text-mute">{job.backend} · {job.shots.toLocaleString("en-US")} shots · {formatDateTime(job.submittedAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-mute">
        <span className={cx("font-medium", job.target === "ibm" ? "text-ok" : "text-warn")}>{job.target === "ibm" ? "Executed on IBM Quantum hardware" : job.target === "noisy" ? "Simulation with IBM device noise (not real hardware)" : "Ideal simulation (not real hardware)"}</span>
        {job.ibmJobId && <span className="flex items-center gap-1.5">IBM job ID <Hash value={job.ibmJobId} n={8} /></span>}
      </div>
      {job.status !== "DONE" ? (
        job.status === "ERROR" || job.status === "CANCELLED" ? <ErrorState error={new Error(job.error ?? `Job ${job.status.toLowerCase()}`)} /> : (
          <div role="status" className="flex items-center gap-2.5 py-6 text-[14px] text-body"><Dot tone="warn" />{job.target === "ibm" ? (job.status === "RUNNING" ? "Running on quantum hardware…" : "Waiting in the IBM Quantum queue…") : "Running simulation…"}{job.lastPollError && <span className="text-[12px] text-bad">Last poll error: {job.lastPollError}</span>}</div>
        )
      ) : (
        <>
          <div className="flex h-40 items-end gap-2.5 border-b border-line" role="img" aria-label="Measured counts per outcome">
            {rows.map((r) => (
              <div key={r.k} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-[11px] text-mute">{r.v.toLocaleString("en-IN")}</span>
                <div className={cx("w-full", r.i > 0 ? "bg-ink" : "bg-line-4")} style={{ height: `${Math.round((r.v / max) * 120)}px` }} />
              </div>
            ))}
          </div>
          <div className="-mt-1.5 flex gap-2.5">{rows.map((r) => <span key={r.k} className="flex-1 text-center font-mono text-[12px]">{r.k}</span>)}</div>
          <p className="m-0 text-[12px] text-mute"><span className="mr-1 inline-block h-2 w-2 bg-ink align-middle" /> outcomes an ideal device produces <span className="mx-1 inline-block h-2 w-2 bg-line-4 align-middle" /> noise</p>
          {job.analysis && <div><p className="m-0 text-[15px] font-medium leading-snug">{job.analysis.headline}</p><p className="m-0 mt-1 text-[14px] leading-[1.6] text-body">{job.analysis.interpretation}</p></div>}
          <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line-2 pt-4 text-[13px] sm:grid-cols-4">
            {[["Fidelity vs ideal", job.hellingerFidelity != null ? `${(job.hellingerFidelity * 100).toFixed(1)}%` : "—"], ["Transpiled depth", job.transpiled?.depth ?? "—"], ["Two-qubit gates", job.transpiled?.twoQubitGates ?? "—"],
              [job.target === "ibm" ? "Quantum time" : "Simulation time", job.target === "ibm" ? (job.ibmUsage?.quantumSeconds != null ? `${job.ibmUsage.quantumSeconds} s` : "—") : job.executionSeconds != null ? `${job.executionSeconds} s` : "—"]].map(([k, v]) => <div key={k as string}><dt className="eyebrow text-faint">{k}</dt><dd className="m-0 mt-0.5 text-[14px]">{v}</dd></div>)}
          </dl>
          {job.analysis?.outcomes && (
            <div className="overflow-x-auto">
              <div className="eyebrow mb-2 text-faint">Classical post-processing: continued fractions, then period, then gcd</div>
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead><tr className="border-b border-line text-left text-mute"><th className="py-1.5 pr-4 font-normal">Outcome</th><th className="py-1.5 pr-4 font-normal">Shots</th><th className="py-1.5 pr-4 font-normal">Phase</th><th className="py-1.5 pr-4 font-normal">Period r</th><th className="py-1.5 font-normal">Result</th></tr></thead>
                <tbody>{job.analysis.outcomes.slice(0, 8).map((o) => <tr key={o.bitstring} className="border-b border-line-3 last:border-0"><td className="py-1.5 pr-4">{o.bitstring}</td><td className="py-1.5 pr-4">{o.count}</td><td className="py-1.5 pr-4">{o.phase}</td><td className="py-1.5 pr-4">{o.periodCandidate}{o.periodValid ? " ✓" : ""}</td><td className={cx("py-1.5", o.factors ? "text-ok" : "text-faint")}>{o.factors ? `15 = ${o.factors[0]} × ${o.factors[1]}` : "no factor"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
