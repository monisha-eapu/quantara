"""
Real quantum circuits for the QuantumShield *threat demonstration*.

These circuits run on IBM Quantum hardware (or local simulators). They illustrate the
quantum algorithms behind the post-quantum threat model. They do NOT break RSA/ECC,
do NOT attack any QuantumShield key, and are completely separate from the ML-DSA
signature layer that protects records.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from math import gcd, pi
from typing import Callable, Dict, List, Optional

from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister
from qiskit.quantum_info import Statevector

Counts = Dict[str, int]


@dataclass
class CircuitSpec:
    id: str
    name: str
    short: str
    category: str
    threat_link: str
    explanation: str
    honesty: str
    build: Callable[[], QuantumCircuit]
    analyze: Callable[[Counts], dict]
    references: List[Dict[str, str]] = field(default_factory=list)


# ---------------------------------------------------------------- GHZ entanglement
def build_ghz() -> QuantumCircuit:
    q = QuantumRegister(3, "q")
    c = ClassicalRegister(3, "c")
    qc = QuantumCircuit(q, c, name="ghz3")
    qc.h(q[0])
    qc.cx(q[0], q[1])
    qc.cx(q[1], q[2])
    qc.barrier()
    qc.measure(q, c)
    return qc


def analyze_ghz(counts: Counts) -> dict:
    shots = sum(counts.values()) or 1
    good = counts.get("000", 0) + counts.get("111", 0)
    return {
        "kind": "ghz",
        "correlatedFraction": good / shots,
        "headline": f"{good / shots:.1%} of shots were perfectly correlated (000 or 111)",
        "interpretation": (
            "An ideal device gives 100% correlated outcomes split ~50/50 between 000 and 111. "
            "Other bitstrings come from gate errors, decoherence and readout noise."
        ),
    }


# ---------------------------------------------------------------- Shor order finding, N = 15
SHOR_N = 15
SHOR_A = 7
SHOR_COUNT = 3  # counting qubits: enough to resolve period r = 4 exactly


def c_amod15(a: int) -> "QuantumCircuit":
    """Controlled multiplication by `a` mod 15 on a 4-qubit register.

    For N = 15 these multiplications happen to be pure bit permutations (+ NOTs), so they can be
    written with SWAP/X gates. This shortcut does NOT exist for general N.
    """
    if a not in (2, 4, 7, 8, 11, 13):
        raise ValueError("a must be coprime with 15")
    u = QuantumCircuit(4)
    if a in (2, 13):
        u.swap(2, 3); u.swap(1, 2); u.swap(0, 1)
    if a in (7, 8):
        u.swap(0, 1); u.swap(1, 2); u.swap(2, 3)
    if a in (4, 11):
        u.swap(1, 3); u.swap(0, 2)
    if a in (7, 11, 13):
        for q in range(4):
            u.x(q)
    gate = u.to_gate()
    gate.name = f"×{a} mod 15"
    return gate.control(1)


def inverse_qft(qc: QuantumCircuit, qubits: List) -> None:
    n = len(qubits)
    for i in range(n // 2):
        qc.swap(qubits[i], qubits[n - i - 1])
    for j in range(n):
        for m in range(j):
            qc.cp(-pi / float(2 ** (j - m)), qubits[m], qubits[j])
        qc.h(qubits[j])


def build_shor15() -> QuantumCircuit:
    count = QuantumRegister(SHOR_COUNT, "count")
    work = QuantumRegister(4, "work")
    c = ClassicalRegister(SHOR_COUNT, "c")
    qc = QuantumCircuit(count, work, c, name="shor_order_finding_15")
    qc.h(count)
    qc.x(work[0])  # work register = |1>
    for j in range(SHOR_COUNT):
        # U^(2^j) = multiplication by a^(2^j) mod N; the constant is computed classically by repeated squaring.
        a_j = pow(SHOR_A, 2 ** j, SHOR_N)
        if a_j == 1:
            continue  # multiplication by 1 is the identity
        qc.append(c_amod15(a_j), [count[j]] + list(work))
    qc.barrier()
    inverse_qft(qc, list(count))
    qc.measure(count, c)
    return qc


def analyze_shor15(counts: Counts) -> dict:
    shots = sum(counts.values()) or 1
    rows = []
    success_shots = 0
    for bits, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        m = int(bits, 2)
        phase = Fraction(m, 2 ** SHOR_COUNT)
        r = phase.limit_denominator(SHOR_N).denominator
        valid_r = pow(SHOR_A, r, SHOR_N) == 1
        factors: Optional[List[int]] = None
        if valid_r and r % 2 == 0:
            x = pow(SHOR_A, r // 2, SHOR_N)
            f = sorted({gcd(x - 1, SHOR_N), gcd(x + 1, SHOR_N)})
            if all(1 < v < SHOR_N for v in f):
                factors = f
        if factors:
            success_shots += n
        rows.append({
            "bitstring": bits, "count": n, "measured": m,
            "phase": f"{phase.numerator}/{phase.denominator}", "phaseDecimal": float(phase),
            "periodCandidate": r, "periodValid": valid_r, "factors": factors,
        })
    return {
        "kind": "shor",
        "N": SHOR_N, "a": SHOR_A, "countingQubits": SHOR_COUNT,
        "outcomes": rows,
        "successFraction": success_shots / shots,
        "headline": f"{success_shots / shots:.1%} of shots led (via classical post-processing) to the factors 3 × 5",
        "interpretation": (
            "Ideal outcomes are 000, 010, 100, 110 (phases 0, 1/4, 1/2, 3/4) at ~25% each. Phases 1/4 and 3/4 "
            "reveal the period r = 4 of 7^x mod 15, and gcd(7^2 ± 1, 15) gives 3 and 5. The ideal success rate "
            "is therefore ~50%; hardware noise lowers it."
        ),
    }


# ---------------------------------------------------------------- Grover search (3 qubits)
GROVER_TARGET = "101"


def _ccz(qc: QuantumCircuit, q) -> None:
    qc.h(q[2]); qc.ccx(q[0], q[1], q[2]); qc.h(q[2])


def build_grover() -> QuantumCircuit:
    q = QuantumRegister(3, "q")
    c = ClassicalRegister(3, "c")
    qc = QuantumCircuit(q, c, name="grover_3q")
    qc.h(q)
    zero_bits = [i for i, b in enumerate(reversed(GROVER_TARGET)) if b == "0"]  # Qiskit is little-endian
    for _ in range(2):  # optimal for N = 8: floor(pi/4 * sqrt(8)) = 2
        qc.barrier()
        for i in zero_bits: qc.x(q[i])          # oracle: flip phase of |101>
        _ccz(qc, q)
        for i in zero_bits: qc.x(q[i])
        qc.barrier()
        qc.h(q); qc.x(q)                         # diffuser: inversion about the mean
        _ccz(qc, q)
        qc.x(q); qc.h(q)
    qc.barrier()
    qc.measure(q, c)
    return qc


def analyze_grover(counts: Counts) -> dict:
    shots = sum(counts.values()) or 1
    hit = counts.get(GROVER_TARGET, 0) / shots
    return {
        "kind": "grover",
        "target": GROVER_TARGET,
        "targetProbability": hit,
        "classicalSingleGuess": 1 / 8,
        "headline": f"Marked item {GROVER_TARGET} found in {hit:.1%} of shots (a random guess finds it 12.5% of the time)",
        "interpretation": (
            "Two Grover iterations amplify the marked state to ~94.5% on an ideal device. Grover gives a quadratic, "
            "not exponential, speed-up — the reason SHA-256 remains a sound content fingerprint."
        ),
    }


SPECS: Dict[str, CircuitSpec] = {
    "ghz": CircuitSpec(
        id="ghz", name="GHZ Entanglement Check", short="3-qubit GHZ state",
        category="Hardware validation",
        threat_link="Every quantum algorithm, including Shor's, relies on multi-qubit entanglement. This circuit checks that the target backend produces it.",
        explanation="A Hadamard and two CNOTs create (|000⟩ + |111⟩)/√2. Measuring gives only 000 or 111 on an ideal device: the three qubits are perfectly correlated.",
        honesty="This circuit has no cryptographic impact whatsoever. It is a hardware sanity check that proves the job ran on a real quantum processor (noise included).",
        build=build_ghz, analyze=analyze_ghz,
    ),
    "shor15": CircuitSpec(
        id="shor15", name="Shor Order-Finding (N = 15)", short="Toy period finding, a = 7, N = 15",
        category="Threat to RSA / ECC",
        threat_link="Shor's algorithm reduces factoring (RSA) and discrete logarithms (ECC/ECDSA) to period finding. A large, fault-tolerant quantum computer running it could forge classical signatures. ML-DSA is not based on these problems.",
        explanation="Quantum phase estimation finds the period r of f(x) = 7^x mod 15. Three counting qubits in superposition control modular multiplications on a 4-qubit work register; an inverse QFT turns the period into measurable phase peaks; classical continued fractions then recover r = 4 and the factors 3 and 5.",
        honesty=(
            "This is a toy demonstration and does NOT threaten real cryptography. N = 15 is trivially factorable by hand. "
            "Multiplication by constants mod 15 happens to be a bit permutation, so the circuit uses a few SWAP/X gates — "
            "general N needs full reversible modular arithmetic. Breaking RSA-2048 is estimated to need on the order of a "
            "million noisy physical qubits running for days with error correction; today's processors are noisy and far "
            "from that scale. Small 'Shor' demonstrations rely on such simplifications (see Smolin, Smith & Vargo, 2013)."
        ),
        build=build_shor15, analyze=analyze_shor15,
        references=[
            {"label": "Shor (1994/1997), Polynomial-time algorithms for prime factorization and discrete logarithms", "url": "https://arxiv.org/abs/quant-ph/9508027"},
            {"label": "Gidney (2025), How to factor 2048 bit RSA integers with less than a million noisy qubits", "url": "https://arxiv.org/abs/2505.15917"},
            {"label": "Smolin, Smith & Vargo (2013), Oversimplifying quantum factoring", "url": "https://www.nature.com/articles/nature12290"},
        ],
    ),
    "grover": CircuitSpec(
        id="grover", name="Grover Search (3 qubits)", short="Unstructured search for |101⟩",
        category="Impact on hashing",
        threat_link="Grover's algorithm speeds up brute-force search quadratically. For SHA-256 preimages that is ~2^256 → ~2^128 operations: still far out of reach, which is why QuantumShield keeps SHA-256 for content fingerprints.",
        explanation="An oracle flips the phase of the marked state |101⟩; the diffuser reflects amplitudes about their mean. After two iterations the marked state dominates the measurement distribution.",
        honesty="Searching 8 items is trivial classically. The point is the scaling law: Grover offers only a quadratic speed-up, so symmetric primitives and hashes remain secure with adequate output sizes.",
        build=build_grover, analyze=analyze_grover,
        references=[{"label": "Grover (1996), A fast quantum mechanical algorithm for database search", "url": "https://arxiv.org/abs/quant-ph/9605043"}],
    ),
}


def ideal_distribution(qc: QuantumCircuit) -> Dict[str, float]:
    """Exact output distribution of the measured qubits, from statevector simulation."""
    bare = qc.remove_final_measurements(inplace=False)
    measured = []
    for inst in qc.data:
        if inst.operation.name == "measure":
            measured.append((qc.find_bit(inst.clbits[0]).index, qc.find_bit(inst.qubits[0]).index))
    measured.sort()  # by classical bit index
    qargs = [q for _, q in measured]
    probs = Statevector(bare).probabilities_dict(qargs=qargs, decimals=6)
    return {str(k): float(v) for k, v in probs.items() if v > 1e-9}


def describe(spec: CircuitSpec) -> dict:
    qc = spec.build()
    ops = {k: int(v) for k, v in qc.count_ops().items()}
    try:
        from qiskit import qasm3
        qasm = qasm3.dumps(qc.decompose(reps=2))
    except Exception:  # pragma: no cover - qasm export is informational only
        qasm = None
    return {
        "id": spec.id, "name": spec.name, "short": spec.short, "category": spec.category,
        "threatLink": spec.threat_link, "explanation": spec.explanation, "honesty": spec.honesty,
        "references": spec.references,
        "qubits": qc.num_qubits, "clbits": qc.num_clbits, "depth": qc.depth(), "ops": ops,
        "diagram": str(qc.draw(output="text", fold=-1)),
        "qasm": qasm,
        "idealDistribution": ideal_distribution(qc),
    }


if __name__ == "__main__":
    for spec in SPECS.values():
        d = describe(spec)
        print(f"\n{'=' * 78}\n{d['name']}  ·  {d['qubits']} qubits · depth {d['depth']}\n{'=' * 78}")
        print(d["diagram"])
        top = sorted(d["idealDistribution"].items(), key=lambda kv: -kv[1])[:4]
        print("Ideal outcome probabilities:", ", ".join(f"{k}: {v:.1%}" for k, v in top))
