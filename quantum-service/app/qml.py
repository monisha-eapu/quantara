"""
Quantum AI/ML layer for QuantumShield (terminal demo).

  1. BB84 quantum key distribution (real Qiskit circuits): a quantum-secured channel that carries
     the ML-DSA-signed record envelope between ledger nodes.
  2. Quantum-kernel SVM (QSVM): an auxiliary anomaly screen over land-record features.

Honest scope: the QKD is simulated on Aer (or run on IBM hardware with --ibm for the honest channel);
the quantum kernel is computed by classical statevector simulation of a 2-qubit feature map. Neither
replaces ML-DSA/SHA-256 verification, which remains the authority on authenticity.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import zz_feature_map
from qiskit.quantum_info import Statevector

DB_PATH = Path(__file__).resolve().parents[2] / "server" / "data" / "quantumshield.db"
QBER_ABORT = 0.11  # standard BB84 security threshold (~11%)


# ====================================================================== BB84 QKD
@dataclass
class QkdResult:
    n_qubits: int
    sifted: int
    sampled: int
    qber: float
    eavesdropper: bool
    backend: str
    aborted: bool
    key: Optional[bytes]  # 32 bytes after privacy amplification, None if aborted
    key_bits_before_amplification: int


def _build_bb84(bits, a_basis, b_basis, e_basis: Optional[np.ndarray]) -> QuantumCircuit:
    """One circuit, one qubit per transmitted photon. Optional intercept-resend eavesdropper (Eve)."""
    n = len(bits)
    qc = QuantumCircuit(n, 2 * n if e_basis is not None else n)
    off = n if e_basis is not None else 0
    for i in range(n):
        if bits[i]:
            qc.x(i)
        if a_basis[i]:
            qc.h(i)                       # Alice encodes in the diagonal basis
        if e_basis is not None:           # Eve measures in a random basis and re-sends what she saw
            if e_basis[i]:
                qc.h(i)
            qc.measure(i, i)
            qc.reset(i)
            with qc.if_test((qc.clbits[i], 1)):
                qc.x(i)
            if e_basis[i]:
                qc.h(i)
        if b_basis[i]:
            qc.h(i)                       # Bob measures in his random basis
        qc.measure(i, off + i)
    return qc


def run_bb84(n_qubits: int = 1024, eavesdropper: bool = False, seed: Optional[int] = None,
             ibm: bool = False, ibm_backend: Optional[str] = None) -> QkdResult:
    rng = np.random.default_rng(seed)
    bits = rng.integers(0, 2, n_qubits)
    a_basis = rng.integers(0, 2, n_qubits)
    b_basis = rng.integers(0, 2, n_qubits)
    e_basis = rng.integers(0, 2, n_qubits) if eavesdropper else None
    qc = _build_bb84(bits, a_basis, b_basis, e_basis)

    if ibm:
        if eavesdropper:
            raise ValueError("The eavesdropper model needs mid-circuit measurement; run it on the simulator.")
        import os
        from dotenv import load_dotenv
        from qiskit.transpiler import generate_preset_pass_manager
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
        load_dotenv(Path(__file__).resolve().parents[2] / ".env")
        service = QiskitRuntimeService(channel=os.getenv("IBM_QUANTUM_CHANNEL", "ibm_quantum_platform"),
                                       token=os.environ["IBM_QUANTUM_TOKEN"], instance=os.getenv("IBM_QUANTUM_INSTANCE") or None)
        backend = service.backend(ibm_backend) if ibm_backend else service.least_busy(operational=True, simulator=False, min_num_qubits=n_qubits)
        isa = generate_preset_pass_manager(optimization_level=1, backend=backend).run(qc)
        counts = SamplerV2(mode=backend).run([isa], shots=1).result()[0].data.c.get_counts()
        backend_name = f"IBM Quantum · {backend.name}"
    else:
        from qiskit_aer import AerSimulator
        counts = AerSimulator().run(qc, shots=1, seed_simulator=seed).result().get_counts()
        backend_name = "Qiskit Aer (stabilizer simulator)"

    s = next(iter(counts))[::-1]  # little-endian: clbit 0 first
    bob = np.array([int(c) for c in s[n_qubits:]]) if eavesdropper else np.array([int(c) for c in s[:n_qubits]])

    sift = np.flatnonzero(a_basis == b_basis)          # keep positions where bases matched
    alice_k, bob_k = bits[sift], bob[sift]
    half = len(sift) // 2
    qber = float(np.mean(alice_k[:half] != bob_k[:half])) if half else 1.0   # publicly compare half to estimate errors
    aborted = qber > QBER_ABORT
    key = None
    remaining = bob_k[half:]
    if not aborted:
        key = hashlib.sha256(np.packbits(remaining).tobytes()).digest()       # privacy amplification
    return QkdResult(n_qubits, len(sift), half, qber, eavesdropper, backend_name, aborted, key, len(remaining))


def _keystream(key: bytes, n: int) -> bytes:
    return hashlib.shake_256(b"QuantumShield-QKD-v1" + key).digest(n)


def seal(key: bytes, payload: dict) -> dict:
    """Encrypt-then-MAC envelope under the QKD key. Demo construction; production would use AES-256-GCM."""
    plain = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ct = bytes(a ^ b for a, b in zip(plain, _keystream(key, len(plain))))
    tag = hmac.new(key, ct, hashlib.sha256).digest()
    return {"ciphertext": ct.hex(), "tag": tag.hex()}


def open_sealed(key: bytes, env: dict) -> Optional[dict]:
    ct = bytes.fromhex(env["ciphertext"])
    if not hmac.compare_digest(hmac.new(key, ct, hashlib.sha256).digest(), bytes.fromhex(env["tag"])):
        return None
    return json.loads(bytes(a ^ b for a, b in zip(ct, _keystream(key, len(ct)))))


# ====================================================================== quantum kernel SVM
_UNITS = {"acres": 4046.86, "sq.yd": 0.836127, "sq.ft": 0.092903}


def area_sqm(area: str) -> float:
    m = re.match(r"\s*([\d.,]+)\s*(acres|sq\.yd|sq\.ft)", area)
    if not m:
        return float("nan")
    return float(m.group(1).replace(",", "")) * _UNITS[m.group(2)]


def load_land_records(limit: int = 600) -> List[dict]:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"{DB_PATH} not found. Start the app once (npm run dev) or run: npm run seed")
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT id, data, created_at FROM records WHERE record_type='LAND_RECORD' AND original_snapshot IS NULL "
                       "AND integrity_status != 'TAMPERED' ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    con.close()
    out = []
    for r in rows:
        d = json.loads(r["data"])
        d["_id"], d["_ledger_year"] = r["id"], int(r["created_at"][:4])
        out.append(d)
    return out


class FeatureScaler:
    """z-scores log(area) within each property type, and the registration-to-ledger gap globally."""

    def fit(self, recs: List[dict]) -> "FeatureScaler":
        by_type: Dict[str, List[float]] = {}
        for r in recs:
            by_type.setdefault(r["propertyType"], []).append(math.log(area_sqm(r["area"])))
        self.type_stats = {t: (float(np.mean(v)), float(np.std(v)) or 1.0) for t, v in by_type.items()}
        gaps = [r["_ledger_year"] - int(r["registrationDate"][:4]) for r in recs]
        self.gap_mu, self.gap_sd = float(np.mean(gaps)), float(np.std(gaps)) or 1.0
        return self

    def features(self, r: dict) -> List[float]:
        mu, sd = self.type_stats.get(r["propertyType"], (0.0, 1.0))
        z_area = (math.log(max(area_sqm(r["area"]), 1e-6)) - mu) / sd
        z_gap = ((r["_ledger_year"] - int(r["registrationDate"][:4])) - self.gap_mu) / self.gap_sd
        return [float(np.clip(z_area, -4, 4)), float(np.clip(z_gap, -4, 4))]


def perturb(r: dict, rng: np.random.Generator) -> dict:
    """Simulated tampering used to create labelled anomalies (area inflation/deflation, or back/forward-dated registration)."""
    t = dict(r)
    if rng.random() < 0.65:
        m = re.match(r"\s*([\d.,]+)\s*(.+)", r["area"])
        factor = float(rng.choice([3, 4, 5, 6, 8])) ** float(rng.choice([-1, 1]))
        t["area"] = f"{float(m.group(1).replace(',', '')) * factor:.1f} {m.group(2)}"
    else:
        year = int(r["registrationDate"][:4]) + int(rng.choice([-1, 1])) * int(rng.integers(12, 30))
        t["registrationDate"] = f"{year}{r['registrationDate'][4:]}"
    return t


class QuantumKernel:
    """k(x, y) = |<phi(x)|phi(y)>|^2 with phi a 2-qubit ZZ feature map (reps=2), via exact statevector simulation.
    `scale` is the data-rescaling (kernel bandwidth); features are multiplied by it before encoding."""

    def __init__(self, n_features: int = 2, reps: int = 2, scale: float = 0.4):
        self.fm = zz_feature_map(n_features, reps=reps)
        self.scale = scale

    def states(self, X: np.ndarray) -> np.ndarray:
        return np.array([Statevector(self.fm.assign_parameters(list(x * self.scale))).data for x in X])

    @staticmethod
    def gram(SA: np.ndarray, SB: np.ndarray) -> np.ndarray:
        return np.abs(SA.conj() @ SB.T) ** 2

    def matrix(self, A: np.ndarray, B: np.ndarray) -> np.ndarray:
        return self.gram(self.states(A), self.states(B))


@dataclass
class QmlReport:
    n_train: int
    n_test: int
    quantum_acc: float
    classical_acc: float
    quantum_f1: float
    classical_f1: float
    circuit_text: str
    model: "QmlModel"
    kernel_scale: float = 0.4


class QmlModel:
    def __init__(self, scaler: FeatureScaler, kernel: QuantumKernel, svc, X_train: np.ndarray):
        self.scaler, self.kernel, self.svc, self.X_train = scaler, kernel, svc, X_train
        self.train_states = kernel.states(X_train)

    def score_record(self, rec: dict) -> Tuple[float, List[float]]:
        """Positive decision value = anomalous. Returns (score, [z_area, z_registration_gap])."""
        x = np.array([self.scaler.features(rec)])
        K = self.kernel.gram(self.kernel.states(x), self.train_states)
        return float(self.svc.decision_function(K)[0]), x[0].tolist()


def train_qsvm(seed: int = 7, n_each: int = 120) -> QmlReport:
    from sklearn.metrics import f1_score
    from sklearn.svm import SVC

    rng = np.random.default_rng(seed)
    recs = load_land_records()
    rng.shuffle(recs)
    base = recs[: n_each * 2]
    scaler = FeatureScaler().fit(recs)
    normal = base[:n_each]
    anomalous = [perturb(r, rng) for r in base[n_each:]]
    X = np.array([scaler.features(r) for r in normal + anomalous])
    y = np.array([0] * n_each + [1] * n_each)
    idx = rng.permutation(len(X))
    X, y = X[idx], y[idx]
    split = int(len(X) * 0.65)
    Xtr, Xte, ytr, yte = X[:split], X[split:], y[:split], y[split:]

    # Pick the kernel bandwidth on a validation slice of the training data only (never the test set).
    vsplit = int(len(Xtr) * 0.75)
    best, best_acc = 0.4, -1.0
    for scale in (0.15, 0.25, 0.4, 0.6, 1.0):
        k = QuantumKernel(scale=scale)
        S = k.states(Xtr)
        m = SVC(kernel="precomputed", C=4.0, class_weight="balanced").fit(k.gram(S[:vsplit], S[:vsplit]), ytr[:vsplit])
        acc = float(np.mean(m.predict(k.gram(S[vsplit:], S[:vsplit])) == ytr[vsplit:]))
        if acc > best_acc:
            best, best_acc = scale, acc
    qk = QuantumKernel(scale=best)
    Str, Ste = qk.states(Xtr), qk.states(Xte)
    q = SVC(kernel="precomputed", C=4.0, class_weight="balanced").fit(qk.gram(Str, Str), ytr)
    qpred = q.predict(qk.gram(Ste, Str))
    c = SVC(kernel="rbf", C=4.0, gamma="scale", class_weight="balanced").fit(Xtr, ytr)
    cpred = c.predict(Xte)
    text = str(qk.fm.decompose().draw(output="text", fold=120))
    return QmlReport(len(Xtr), len(Xte), float(np.mean(qpred == yte)), float(np.mean(cpred == yte)),
                     float(f1_score(yte, qpred)), float(f1_score(yte, cpred)), text, QmlModel(scaler, qk, q, Xtr), best)


if __name__ == "__main__":
    warnings = __import__("warnings"); warnings.filterwarnings("ignore")
    print("BB84 quantum key distribution (Qiskit, 1024 qubits)")
    ok, eve = run_bb84(1024, False, seed=3), run_bb84(1024, True, seed=3)
    print(f"  honest channel : QBER {ok.qber:.1%}  -> {'ABORT' if ok.aborted else 'key established'}")
    print(f"  eavesdropper   : QBER {eve.qber:.1%}  -> {'ABORT (eavesdropping detected)' if eve.aborted else 'key established'}")
    print("\nQuantum-kernel SVM (2-qubit ZZ feature map)")
    r = train_qsvm()
    print(f"  quantum kernel : accuracy {r.quantum_acc:.1%}, F1 {r.quantum_f1:.2f}")
    print(f"  classical RBF  : accuracy {r.classical_acc:.1%}, F1 {r.classical_f1:.2f}")
    print("\nFull demo with ML-DSA verification:  ./qml")
