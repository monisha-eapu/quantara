import {
  AlertTriangle,
  Atom,
  BarChart3,
  Cpu,
  FileCode,
  Play,
  Server,
  ShieldCheck,
  Split,
  Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, cx, Empty, ErrorState, KV, Loading, PageHeader, Pill } from "../components/ui";
import { api, ApiError } from "../lib/api";
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

interface QLIPrediction {
  classification: "LEGITIMATE" | "SUSPICIOUS";
  prediction: number;
  risk_score: number;
  confidence_metric: string;
  behavioral_evidence: string[];
  qubits: number;
  circuit_depth: number;
  backend: string;
  model_type: string;
  feature_map: string;
  decision_value?: number;
}

interface QLICircuitData {
  ascii_circuit: string;
  num_qubits: number;
  circuit_depth: number;
  gate_counts: Record<string, number>;
  parameter_count: number;
  feature_map_name: string;
  entanglement: string;
}

interface QLIBenchmarkData {
  experiment_meta: {
    dataset_records: number;
    train_size: number;
    test_size: number;
    features_used: string[];
    date_evaluated: string;
    backend: string;
  };
  metrics: {
    quantum_kernel_qsvc: {
      model_name: string;
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      roc_auc: number;
      train_time_sec: number;
      inference_time_sec: number;
      circuit_depth: number;
      qubits: number;
    };
    classical_rbf_svm: {
      model_name: string;
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      roc_auc: number;
      train_time_sec: number;
      inference_time_sec: number;
    };
  };
  scientific_analysis: {
    observation: string;
    nisq_reality: string;
  };
}

interface QLICodeSnippets {
  snippets: Record<string, { filename: string; filepath: string; code: string }>;
}

const FINAL = new Set(["DONE", "ERROR", "CANCELLED"]);

export default function QuantumLab() {
  const [activeTab, setActiveTab] = useState<"qlie" | "threat_lab">("qlie");

  return (
    <div>
      <PageHeader
        eyebrow="Qiskit Fall Fest 2026 · Day 04 Hackathon · CUTM Vizianagaram"
        title={
          <span className="flex items-center gap-3">
            <Atom className="h-8 w-8 text-quantum-400" />
            <span>Quantum Intelligence Center</span>
          </span>
        }
        description="Q-SHIELD AP integrates genuine Qiskit Quantum Machine Learning (QLIE) for behavioral transaction risk detection alongside IBM Quantum Runtime threat demonstrations."
      />

      {/* Main Tab Switcher */}
      <div className="mb-6 flex border-b border-white/[0.08]">
        <button
          onClick={() => setActiveTab("qlie")}
          className={cx(
            "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition",
            activeTab === "qlie"
              ? "border-quantum-400 text-quantum-400 bg-quantum-500/[0.08]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <Cpu className="h-4 w-4" />
          <span>QLIE Engine (Quantum ML Core)</span>
          <span className="rounded-full bg-quantum-500/20 px-2 py-0.5 text-[10px] font-bold text-quantum-300">CORE</span>
        </button>

        <button
          onClick={() => setActiveTab("threat_lab")}
          className={cx(
            "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition",
            activeTab === "threat_lab"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/[0.08]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <Terminal className="h-4 w-4" />
          <span>Threat Lab & IBM Hardware</span>
        </button>
      </div>

      {activeTab === "qlie" ? <QLIESubsystem /> : <ThreatLabSubsystem />}
    </div>
  );
}

// ==========================================
// 1. QLIE QUANTUM MACHINE LEARNING SECTION
// ==========================================
function QLIESubsystem() {
  const [subTab, setSubTab] = useState<"predict" | "circuit" | "benchmark" | "code">("predict");

  // State for live inference
  const [features, setFeatures] = useState({
    transaction_frequency: 1.2,
    transaction_velocity: 0.8,
    transaction_value: 550000,
    ownership_change_frequency: 0.1,
    historical_owner_count: 2,
    time_since_previous_transaction: 420.0,
    geographical_distance: 12.5,
    timestamp_deviation: 45.0,
  });

  const [predictionResult, setPredictionResult] = useState<QLIPrediction | null>(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);

  const circuitQuery = useApi(() => api.get<QLICircuitData>("/quantum/qml/circuit"));
  const benchmarkQuery = useApi(() => api.get<QLIBenchmarkData>("/quantum/qml/benchmark"));
  const codeQuery = useApi(() => api.get<QLICodeSnippets>("/quantum/qml/code"));

  const [selectedSnippet, setSelectedSnippet] = useState<string>("quantum_feature_map");

  // Run live inference
  const runLiveInference = async (customFeatures?: typeof features) => {
    setPredictLoading(true);
    setPredictError(null);
    try {
      const res = await api.post<QLIPrediction>("/quantum/qml/predict", customFeatures || features);
      setPredictionResult(res);
    } catch (err: any) {
      setPredictError(err.message || "Failed to execute QLIE inference.");
    } finally {
      setPredictLoading(false);
    }
  };

  useEffect(() => {
    runLiveInference();
  }, []);

  const loadPreset = (type: "legitimate" | "suspicious_velocity" | "route_tamper") => {
    let p = { ...features };
    if (type === "legitimate") {
      p = {
        transaction_frequency: 0.8,
        transaction_velocity: 0.3,
        transaction_value: 350000,
        ownership_change_frequency: 0.05,
        historical_owner_count: 2,
        time_since_previous_transaction: 720.0,
        geographical_distance: 8.0,
        timestamp_deviation: 30.0,
      };
    } else if (type === "suspicious_velocity") {
      p = {
        transaction_frequency: 9.8,
        transaction_velocity: 8.5,
        transaction_value: 4800000,
        ownership_change_frequency: 4.2,
        historical_owner_count: 7,
        time_since_previous_transaction: 8.0,
        geographical_distance: 140.0,
        timestamp_deviation: 1950.0,
      };
    } else if (type === "route_tamper") {
      p = {
        transaction_frequency: 4.5,
        transaction_velocity: 5.2,
        transaction_value: 1200000,
        ownership_change_frequency: 2.1,
        historical_owner_count: 5,
        time_since_previous_transaction: 45.0,
        geographical_distance: 310.0,
        timestamp_deviation: 4200.0,
      };
    }
    setFeatures(p);
    runLiveInference(p);
  };

  return (
    <div className="space-y-6">
      {/* Architecture Highlights Card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-xl p-4 border border-quantum-500/20 bg-quantum-950/20">
          <div className="label text-quantum-300">Model Architecture</div>
          <div className="mt-1 text-base font-bold text-white">Quantum Kernel Classifier</div>
          <div className="text-xs text-slate-400 mt-1">Dual-qubit ZZFeatureMap (reps=2)</div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/[0.08]">
          <div className="label text-slate-400">Quantum Scale</div>
          <div className="mt-1 text-base font-bold text-white">4 Qubits · Full Entanglement</div>
          <div className="text-xs text-slate-400 mt-1">16-dim Hilbert statevector space</div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/[0.08]">
          <div className="label text-slate-400">Execution Backend</div>
          <div className="mt-1 text-base font-bold text-cyan-300">Qiskit Aer Simulator</div>
          <div className="text-xs text-slate-400 mt-1">Statevector transition fidelity</div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/[0.08]">
          <div className="label text-slate-400">Security Paradigm</div>
          <div className="mt-1 text-base font-bold text-emerald-300">Behavioral Intelligence</div>
          <div className="text-xs text-slate-400 mt-1">Detects authenticated insider fraud</div>
        </div>
      </div>

      {/* Sub-nav Buttons */}
      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-3">
        <button
          onClick={() => setSubTab("predict")}
          className={cx(
            "rounded-lg px-3.5 py-2 text-xs font-medium transition flex items-center gap-2",
            subTab === "predict" ? "bg-quantum-500/20 text-quantum-300 border border-quantum-500/40" : "text-slate-400 hover:text-white"
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>Live Quantum Inference</span>
        </button>

        <button
          onClick={() => setSubTab("circuit")}
          className={cx(
            "rounded-lg px-3.5 py-2 text-xs font-medium transition flex items-center gap-2",
            subTab === "circuit" ? "bg-quantum-500/20 text-quantum-300 border border-quantum-500/40" : "text-slate-400 hover:text-white"
          )}
        >
          <Atom className="h-3.5 w-3.5" />
          <span>Quantum Circuit Visualizer</span>
        </button>

        <button
          onClick={() => setSubTab("benchmark")}
          className={cx(
            "rounded-lg px-3.5 py-2 text-xs font-medium transition flex items-center gap-2",
            subTab === "benchmark" ? "bg-quantum-500/20 text-quantum-300 border border-quantum-500/40" : "text-slate-400 hover:text-white"
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Empirical Benchmark (QML vs Classical)</span>
        </button>

        <button
          onClick={() => setSubTab("code")}
          className={cx(
            "rounded-lg px-3.5 py-2 text-xs font-medium transition flex items-center gap-2",
            subTab === "code" ? "bg-quantum-500/20 text-quantum-300 border border-quantum-500/40" : "text-slate-400 hover:text-white"
          )}
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Technical Judge Code Inspector</span>
        </button>
      </div>

      {/* SUB-VIEW 1: LIVE INFERENCE */}
      {subTab === "predict" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <Card
            title="Feature Vector & Real-Time QLIE Execution"
            subtitle="Adjust transaction behavioral telemetry and execute live quantum kernel statevector inference."
            icon={<Cpu className="h-4 w-4 text-quantum-400" />}
          >
            {/* Quick Presets */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Load Preset:</span>
              <button
                type="button"
                onClick={() => loadPreset("legitimate")}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
              >
                Vizianagaram Standard Transfer
              </button>
              <button
                type="button"
                onClick={() => loadPreset("suspicious_velocity")}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
              >
                High-Velocity Land Mutation Fraud
              </button>
              <button
                type="button"
                onClick={() => loadPreset("route_tamper")}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/20"
              >
                Abnormal Supply Route Deviation
              </button>
            </div>

            {/* Feature Controls */}
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <label className="text-slate-300 font-medium flex justify-between">
                  <span>Tx Velocity (mutations/hr)</span>
                  <span className="font-mono text-quantum-300">{features.transaction_velocity}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={features.transaction_velocity}
                  onChange={(e) => setFeatures({ ...features, transaction_velocity: parseFloat(e.target.value) })}
                  className="w-full accent-quantum-500 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium flex justify-between">
                  <span>Ownership Change Freq</span>
                  <span className="font-mono text-quantum-300">{features.ownership_change_frequency}</span>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
                  step="0.1"
                  value={features.ownership_change_frequency}
                  onChange={(e) => setFeatures({ ...features, ownership_change_frequency: parseFloat(e.target.value) })}
                  className="w-full accent-quantum-500 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium flex justify-between">
                  <span>Historical Owner Count</span>
                  <span className="font-mono text-quantum-300">{features.historical_owner_count}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={features.historical_owner_count}
                  onChange={(e) => setFeatures({ ...features, historical_owner_count: parseInt(e.target.value) })}
                  className="w-full accent-quantum-500 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium flex justify-between">
                  <span>Time Since Prev (hours)</span>
                  <span className="font-mono text-quantum-300">{features.time_since_previous_transaction}h</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="1000.0"
                  step="5.0"
                  value={features.time_since_previous_transaction}
                  onChange={(e) => setFeatures({ ...features, time_since_previous_transaction: parseFloat(e.target.value) })}
                  className="w-full accent-quantum-500 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium flex justify-between">
                  <span>Geographical Distance (km)</span>
                  <span className="font-mono text-quantum-300">{features.geographical_distance} km</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="500.0"
                  step="5.0"
                  value={features.geographical_distance}
                  onChange={(e) => setFeatures({ ...features, geographical_distance: parseFloat(e.target.value) })}
                  className="w-full accent-quantum-500 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium flex justify-between">
                  <span>Timestamp Deviation (sec)</span>
                  <span className="font-mono text-quantum-300">{features.timestamp_deviation} s</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="7200"
                  step="50"
                  value={features.timestamp_deviation}
                  onChange={(e) => setFeatures({ ...features, timestamp_deviation: parseInt(e.target.value) })}
                  className="w-full accent-quantum-500 mt-1"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-[11px] text-slate-500">
                Data pipeline: Normalization → MinMax [0, 2π] → ZZFeatureMap → Gram Kernel
              </span>
              <Button
                variant="quantum"
                loading={predictLoading}
                onClick={() => runLiveInference()}
                icon={<Play className="h-3.5 w-3.5" />}
              >
                Execute Quantum Kernel
              </Button>
            </div>
            {predictError && <div className="mt-3 text-xs text-red-400">{predictError}</div>}
          </Card>

          {/* Inference Output Card */}
          <Card
            title="QML Classification Result"
            subtitle="Authentic Qiskit QLIE Kernel Evaluation"
            icon={<ShieldCheck className="h-4 w-4 text-brand-400" />}
          >
            {predictionResult ? (
              <div className="space-y-4">
                <div
                  className={cx(
                    "rounded-xl border p-4 text-center",
                    predictionResult.classification === "SUSPICIOUS"
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-emerald-500/40 bg-emerald-500/10"
                  )}
                >
                  <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
                    QLIE Output Status
                  </div>
                  <div
                    className={cx(
                      "text-2xl font-black mt-1 tracking-wider",
                      predictionResult.classification === "SUSPICIOUS" ? "text-red-400" : "text-emerald-400"
                    )}
                  >
                    {predictionResult.classification}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Decision Value: <span className="font-mono">{predictionResult.decision_value ?? "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">Calibrated Risk Score</span>
                    <span
                      className={cx(
                        "font-mono font-bold",
                        predictionResult.risk_score > 0.65
                          ? "text-red-400"
                          : predictionResult.risk_score > 0.35
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {(predictionResult.risk_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink-950 overflow-hidden border border-white/10">
                    <div
                      className={cx(
                        "h-full transition-all duration-500",
                        predictionResult.risk_score > 0.65
                          ? "bg-red-500"
                          : predictionResult.risk_score > 0.35
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      )}
                      style={{ width: `${Math.min(100, Math.max(5, predictionResult.risk_score * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-ink-950/60 p-3 space-y-2 text-xs">
                  <div className="label text-slate-400">Behavioral Evidence Breakdown</div>
                  {predictionResult.behavioral_evidence.length === 0 ? (
                    <div className="text-slate-500 italic">No behavioral threshold anomalies detected.</div>
                  ) : (
                    <ul className="space-y-1">
                      {predictionResult.behavioral_evidence.map((ev, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-amber-300">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-white/[0.05]">
                    *Note: Feature-level explanation represents behavioral heuristics and is not equivalent to a gate-level circuit decomposition.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div className="rounded-lg bg-white/[0.02] p-2">
                    <span className="block text-slate-500">Qubits</span>
                    <span className="font-semibold text-white">{predictionResult.qubits}</span>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-2">
                    <span className="block text-slate-500">Circuit Depth</span>
                    <span className="font-semibold text-white">{predictionResult.circuit_depth}</span>
                  </div>
                </div>
              </div>
            ) : (
              <Empty title="No inference run" description="Execute the model to view predictions." />
            )}
          </Card>
        </div>
      )}

      {/* SUB-VIEW 2: QUANTUM CIRCUIT VISUALIZER */}
      {subTab === "circuit" && (
        <Card
          title="QLIE ZZFeatureMap Quantum Circuit"
          subtitle="Decomposed quantum circuit generated live by Qiskit with parameterized entangling rotations."
          icon={<Atom className="h-4 w-4 text-quantum-400" />}
        >
          {circuitQuery.loading ? (
            <Loading label="Rendering quantum circuit from Qiskit..." />
          ) : circuitQuery.error ? (
            <ErrorState error={circuitQuery.error} onRetry={circuitQuery.reload} />
          ) : circuitQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4 text-xs">
                <KV label="Feature Map">{circuitQuery.data.feature_map_name}</KV>
                <KV label="Qubits">{circuitQuery.data.num_qubits}</KV>
                <KV label="Circuit Depth">{circuitQuery.data.circuit_depth}</KV>
                <KV label="Parameters">{circuitQuery.data.parameter_count}</KV>
              </div>

              <div className="label">Gate Breakdown</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(circuitQuery.data.gate_counts).map(([gate, cnt]) => (
                  <span key={gate} className="rounded-lg border border-quantum-500/30 bg-quantum-950/40 px-3 py-1 font-mono text-xs text-quantum-300">
                    {gate.toUpperCase()}: <span className="font-bold text-white">{cnt}</span>
                  </span>
                ))}
              </div>

              <div>
                <div className="label mb-2">Qiskit Text Circuit (Decomposed)</div>
                <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-ink-950 p-4 font-mono text-[11px] leading-tight text-quantum-300">
                  {circuitQuery.data.ascii_circuit}
                </pre>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* SUB-VIEW 3: EMPIRICAL BENCHMARK */}
      {subTab === "benchmark" && (
        <Card
          title="Empirical Scientific Benchmark: QML vs Classical Baseline"
          subtitle="Honest benchmark loaded directly from backend experiment execution on synthetic Andhra Pradesh transactions."
          icon={<BarChart3 className="h-4 w-4 text-brand-400" />}
        >
          {benchmarkQuery.loading ? (
            <Loading label="Loading benchmark experimental data..." />
          ) : benchmarkQuery.error ? (
            <ErrorState error={benchmarkQuery.error} onRetry={benchmarkQuery.reload} />
          ) : benchmarkQuery.data ? (
            <div className="space-y-6">
              {/* Benchmark comparison table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-slate-400">
                      <th className="py-2.5 pr-4 font-semibold">Evaluation Metric</th>
                      <th className="py-2.5 pr-4 font-semibold text-quantum-300">
                        Quantum Kernel Classifier (QSVC)
                      </th>
                      <th className="py-2.5 pr-4 font-semibold text-cyan-300">
                        Classical RBF Support Vector Machine
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-slate-200">
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-slate-400">Test Accuracy</td>
                      <td className="py-2.5 pr-4 font-mono font-bold text-quantum-300">
                        {(benchmarkQuery.data.metrics.quantum_kernel_qsvc.accuracy * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 font-mono font-bold text-cyan-300">
                        {(benchmarkQuery.data.metrics.classical_rbf_svm.accuracy * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-slate-400">Precision</td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.quantum_kernel_qsvc.precision * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.classical_rbf_svm.precision * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-slate-400">Recall</td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.quantum_kernel_qsvc.recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.classical_rbf_svm.recall * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-slate-400">F1 Score</td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.quantum_kernel_qsvc.f1_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.classical_rbf_svm.f1_score * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-slate-400">ROC-AUC</td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.quantum_kernel_qsvc.roc_auc * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 font-mono">
                        {(benchmarkQuery.data.metrics.classical_rbf_svm.roc_auc * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-slate-400">Inference Latency</td>
                      <td className="py-2.5 pr-4 font-mono text-slate-400">
                        {benchmarkQuery.data.metrics.quantum_kernel_qsvc.inference_time_sec.toFixed(3)}s
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-400">
                        {benchmarkQuery.data.metrics.classical_rbf_svm.inference_time_sec.toFixed(3)}s
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Scientific Honesty Box */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-xs text-amber-200/90 space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Scientific Rigor & NISQ Reality</span>
                </div>
                <p className="leading-relaxed">
                  {benchmarkQuery.data.scientific_analysis.observation}
                </p>
                <p className="leading-relaxed text-slate-300">
                  {benchmarkQuery.data.scientific_analysis.nisq_reality}
                </p>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* SUB-VIEW 4: CODE INSPECTOR */}
      {subTab === "code" && (
        <Card
          title="Technical Judge Code Inspector"
          subtitle="Authentic source code files directly powering QLIE QML models."
          icon={<FileCode className="h-4 w-4 text-cyan-400" />}
        >
          {codeQuery.loading ? (
            <Loading label="Loading project source files..." />
          ) : codeQuery.error ? (
            <ErrorState error={codeQuery.error} onRetry={codeQuery.reload} />
          ) : codeQuery.data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(codeQuery.data.snippets).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSnippet(key)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 text-xs font-mono transition",
                      selectedSnippet === key
                        ? "bg-brand-500/20 text-brand-300 border border-brand-500/40"
                        : "border border-white/10 bg-white/[0.02] text-slate-400 hover:text-white"
                    )}
                  >
                    {s.filename}
                  </button>
                ))}
              </div>

              {codeQuery.data.snippets[selectedSnippet] && (
                <div>
                  <div className="mb-2 text-xs text-slate-400 flex items-center justify-between">
                    <span className="font-mono text-cyan-300">
                      {codeQuery.data.snippets[selectedSnippet].filepath}
                    </span>
                    <span className="text-[10px] text-slate-500">Read-Only Production Snippet</span>
                  </div>
                  <pre className="max-h-[500px] overflow-auto rounded-xl border border-white/[0.08] bg-ink-950 p-4 font-mono text-[11px] leading-[1.4] text-slate-300">
                    {codeQuery.data.snippets[selectedSnippet].code}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

// ==========================================
// 2. THREAT LAB & HARDWARE DEMONSTRATION
// ==========================================
function ThreatLabSubsystem() {
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

  const pending = jobs.data?.jobs.filter((j) => !FINAL.has(j.status)) ?? [];
  useEffect(() => {
    if (!pending.length) return;
    const t = setInterval(async () => {
      await Promise.allSettled(pending.map((j) => api.get(`/quantum/jobs/${j.id}`)));
      await jobs.reload();
    }, pending.some((j) => j.target === "ibm") ? 5000 : 1500);
    return () => clearInterval(t);
  }, [pending.map((j) => j.id).join(",")]);

  const circuit = circuits.data?.circuits.find((c) => c.id === circuitId);
  const job = jobs.data?.jobs.find((j) => j.id === selectedJob) ?? jobs.data?.jobs.find((j) => j.circuit === circuitId && j.status === "DONE");
  const offline = status.error instanceof ApiError && status.error.status === 503;
  const ibmReady = !!status.data?.ibm.configured;

  return (
    <div className="space-y-6">
      <div className="mb-6 grid gap-0 overflow-hidden rounded-2xl border border-white/[0.08] md:grid-cols-[1fr_auto_1fr]">
        <div className="bg-gradient-to-br from-quantum-500/15 to-transparent p-5">
          <div className="label flex items-center gap-1.5 text-quantum-400"><Atom className="h-3.5 w-3.5" /> Threat Demonstration</div>
          <div className="mt-2 text-base font-semibold text-white">Shor & Grover Quantum Threat Lab</div>
          <p className="mt-1.5 text-sm text-slate-300">Demonstrates the algorithms (Shor, Grover) that motivate why Andhra Pradesh ledgers require Post-Quantum Cryptography.</p>
        </div>
        <div className="flex items-center justify-center border-y border-white/[0.06] bg-ink-900/80 px-4 py-3 md:border-x md:border-y-0">
          <div className="flex flex-col items-center gap-1 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500"><Split className="h-5 w-5" />Fully<br />separate</div>
        </div>
        <div className="bg-gradient-to-bl from-brand-500/15 to-transparent p-5">
          <div className="label flex items-center gap-1.5 text-brand-300"><ShieldCheck className="h-3.5 w-3.5" /> Protection Layer</div>
          <div className="mt-2 text-base font-semibold text-white">ML-DSA-65 Signatures on Classical Nodes</div>
          <p className="mt-1.5 text-sm text-slate-300">Transactions are authenticated with NIST FIPS 204 ML-DSA, impervious to quantum period-finding attacks.</p>
        </div>
      </div>

      {status.loading ? <Loading label="Connecting to quantum service..." /> : offline || status.error ? (
        <Card>
          <ErrorState error={status.error!} onRetry={status.reload} />
          <p className="mt-4 text-center text-xs text-slate-400">Start it with <code className="rounded bg-ink-950 px-1.5 py-0.5 font-mono text-slate-200">npm run dev:quantum</code>.</p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="glass rounded-xl p-4">
              <div className="label">Quantum SDK</div>
              <div className="mt-2 text-sm text-slate-200">Qiskit <span className="font-mono">{status.data!.versions.qiskit}</span> · Aer <span className="font-mono">{status.data!.versions.qiskitAer}</span></div>
            </div>
            <div className={cx("glass rounded-xl p-4", ibmReady && "glow-violet")}>
              <div className="label">IBM Quantum account</div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                {ibmReady ? <Pill tone="violet">CONFIGURED · {status.data!.ibm.source}</Pill> : <Pill tone="amber">NOT CONFIGURED</Pill>}
                <span className="text-xs text-slate-500">{status.data!.ibm.channel}</span>
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="label">IBM Backends</div>
              {backends ? (
                <div className="mt-2 max-h-20 space-y-1 overflow-y-auto text-xs">
                  {backends.map((b) => (
                    <div key={b.name} className="flex justify-between text-slate-300"><span className="font-mono">{b.name}</span><span className="text-slate-500">{b.qubits}q</span></div>
                  ))}
                </div>
              ) : (
                <Button size="sm" className="mt-2" disabled={!ibmReady} loading={loadBackends.pending} onClick={() => loadBackends.run()} icon={<Server className="h-3.5 w-3.5" />}>Load backends</Button>
              )}
            </div>
          </div>

          {circuits.error ? <ErrorState error={circuits.error} onRetry={circuits.reload} /> : !circuits.data ? <Loading /> : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {circuits.data.circuits.map((c) => (
                    <button key={c.id} onClick={() => { setCircuitId(c.id); setSelectedJob(null); }} className={cx("rounded-xl border px-4 py-2.5 text-left transition", circuitId === c.id ? "border-quantum-500/60 bg-quantum-500/15 text-white" : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20")}>
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.category} · {c.qubits} qubits</div>
                    </button>
                  ))}
                </div>

                {circuit && (
                  <Card title={circuit.name} subtitle={circuit.short} icon={<Atom className="h-4 w-4 text-quantum-400" />}>
                    <p className="text-sm leading-relaxed text-slate-300">{circuit.explanation}</p>
                    <div className="mt-4 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4">
                      <div className="label mb-1 text-brand-300">Why it matters for record security</div>
                      <p className="text-sm text-slate-300">{circuit.threatLink}</p>
                    </div>
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
                      <div className="label mb-1 flex items-center gap-1.5 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Reality check</div>
                      <p className="text-sm leading-relaxed text-amber-50/85">{circuit.honesty}</p>
                    </div>
                    <div className="mt-4">
                      <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-950/80 p-4 font-mono text-[11px] text-quantum-400/90">{circuit.diagram}</pre>
                    </div>
                  </Card>
                )}

                <Card title="Results" subtitle={job ? `${job.circuitName} · ${job.targetLabel}` : "Run circuit to observe outcomes"} icon={<Cpu className="h-4 w-4" />}>
                  {!job ? <Empty icon={<Play className="h-8 w-8 text-quantum-400" />} title="No results yet" description="Select target and run." /> : <JobResult job={job} ideal={circuit?.idealDistribution ?? {}} />}
                </Card>
              </div>

              <div className="space-y-6">
                <Card title="Execute" subtitle="Target Transpilation & Execution" icon={<Play className="h-4 w-4 text-quantum-400" />}>
                  <div className="space-y-2">
                    {(["ideal", "noisy", "ibm"] as const).map((t) => {
                      const info = status.data!.targets[t];
                      const disabled = t === "ibm" && !ibmReady;
                      return (
                        <label key={t} className={cx("flex cursor-pointer gap-3 rounded-xl border p-3 transition", disabled && "cursor-not-allowed opacity-50", target === t ? "border-quantum-500/60 bg-quantum-500/10" : "border-white/10 hover:border-white/20")}>
                          <input type="radio" disabled={disabled} className="mt-1 accent-violet-500" checked={target === t} onChange={() => setTarget(t)} />
                          <span>
                            <span className="flex items-center gap-2 text-sm font-semibold text-white">{info.label}</span>
                            <span className="mt-0.5 block text-xs text-slate-400">{info.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {target === "ibm" && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-300">Backend</label>
                      <select className="input mt-1 w-full" value={backend} onChange={(e) => setBackend(e.target.value)}>
                        <option value="">{status.data!.ibm.preferredBackend ? `${status.data!.ibm.preferredBackend} (from .env)` : "Least busy backend"}</option>
                        {backends?.map((b) => <option key={b.name} value={b.name}>{b.name} · {b.qubits}q</option>)}
                      </select>
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-300">Shots</label>
                    <select className="input mt-1 w-full" value={shots} onChange={(e) => setShots(Number(e.target.value))}>
                      {[1024, 2048, 4096].map((s) => <option key={s} value={s}>{s.toLocaleString()}</option>)}
                    </select>
                  </div>

                  <div className="mt-4">
                    <Button variant="quantum" size="lg" className="w-full" loading={submit.pending} onClick={() => submit.run()} icon={<Play className="h-4 w-4" />}>
                      {target === "ibm" ? "Submit to IBM Quantum" : "Run circuit"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
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
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-300">
        <div>Backend: <span className="font-mono text-white">{job.backend}</span></div>
        <div>Shots: <span className="font-mono text-white">{job.shots}</span></div>
      </div>
      <div className="flex h-44 items-end gap-1 rounded-xl border border-white/[0.06] bg-ink-950/60 p-3 pt-6">
        {shown.map((k) => {
          const m = measured(k);
          return (
            <div key={k} className="relative flex h-full flex-1 flex-col items-center justify-end">
              <div className="w-full max-w-10 rounded-t bg-gradient-to-t from-quantum-500/70 to-quantum-400" style={{ height: `${(m / max) * 100}%` }} />
              <div className="mt-1 font-mono text-[9px] text-slate-400">{k}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
