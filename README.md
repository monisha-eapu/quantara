# Q-SHIELD AP: Quantum-Safe Trust Framework for Critical Digital Records

**Post-quantum cryptography + quantum machine learning + distributed ledger for Andhra Pradesh land registries, agri-supply chains and university credentials.**

Qiskit Fall Fest 2026 · Centurion University of Technology and Management (CUTM), Vizianagaram · Use Case 02: Quantum-Safe DLT

## Abstract

Q-SHIELD AP is a quantum-safe trust framework for Andhra Pradesh land records, agricultural supply chains and university credentials. It combines post-quantum cryptography (PQC), quantum machine learning (QML) and a hash-chained distributed ledger (DLT) in one full-stack system built with Qiskit, Node.js and React. 

Novelty: it pairs NIST FIPS 204 ML-DSA-65 signatures, which resist Shor's algorithm, with a Qiskit Level-4 quantum kernel classifier that flags authenticated insider attacks, where a valid signature is attached to a fraudulent mutation. 

Qiskit Level 4: a custom 4-qubit parameterized circuit (multi-basis Ry/Rz data re-uploading, circular C4 entanglement, R_ZZ phase gates) with a Projected Quantum Kernel and analytical parameter-shift gradients. Optimization-level-3 transpilation to the IBM native basis gives depth 50 and 32 CX gates with all-to-all connectivity, and depth 171 with 55 CZ gates when routed onto a modeled 133-qubit IBM Torino heavy-hex device, with unitary equivalence verified. A BB84 quantum key distribution simulation aborts the channel above an 11% quantum bit error rate, and a React dashboard exposes live verification, ledger and audit views. 

Empirical benchmark: four models (quantum QSVC, classical RBF SVM, Random Forest, MLP) were evaluated on a synthetic 10,000-record Andhra Pradesh land and supply-chain dataset with a 600/200 train/test split. The quantum QSVC reached 97.0% recall (97.5% accuracy, 0.999 ROC-AUC) while classical models reached 100%, showing detection capability under subtle insider churn.

Quantum advantage indicators: geometric difference g = 74.252 (Huang et al., Nature Communications 2021), Meyer-Wallach entanglement Q = 0.763 and kernel-target alignment 32.1%, against 55.2% for a classical RBF kernel. These metrics describe kernel geometry and are necessary, not sufficient, conditions for advantage. All data is synthetic.

**Keywords:** post-quantum cryptography, ML-DSA-65, FIPS 204, quantum machine learning, Qiskit, quantum kernel, QSVC, projected quantum kernel, BB84, IBM Quantum, distributed ledger, hash chain, land records, supply chain provenance, insider fraud detection, React, Node.js, FastAPI.

## Contents

1. [The problem](#the-problem)
2. [Solution overview](#solution-overview)
3. [Results](#results)
4. [Quick start](#quick-start)
5. [Running from the terminal](#running-from-the-terminal)
6. [Tour of the web app](#tour-of-the-web-app)
7. [Repository layout](#repository-layout)
8. [Limitations and honest notes](#limitations-and-honest-notes)
9. [Documentation](#documentation)

## The problem

Land titles, product provenance and degrees must stay trustworthy for decades. Most registries sign records with RSA or ECDSA, and Shor's algorithm breaks both on a large enough quantum computer, so a forged signature would look identical to a real one. Cryptography also checks only that a signature is valid. It cannot tell that a valid signature was applied to a fraudulent change by a coerced or compromised insider.

## Solution overview

Three layers, each answering a different question.

| Layer | Question it answers | Technology |
| :--- | :--- | :--- |
| **PQC** | Who signed this, and is it unaltered? | ML-DSA-65 (NIST FIPS 204) via native OpenSSL 3.5 in Node.js 24. Public key 1,952 B, signature 3,309 B |
| **DLT** | Has history been rewritten? | Append-only SHA-256 hash chain; each block commits to the previous one and carries an ML-DSA signature |
| **QML** | Is this authentic record behaving suspiciously? | Qiskit 4-qubit quantum kernel classifier (QLIE) scoring 8 behavioural features |

**Decision policy**

| PQC | Ledger | QML risk | Outcome |
| :---: | :---: | :---: | :--- |
| invalid | any | any | **Block** |
| valid | broken | any | **Block** |
| valid | intact | low | **Approve** |
| valid | intact | high | **Human review** |

The QML layer is advisory: it can route a record to a reviewer but cannot approve or block on its own. The quantum service never receives records, keys or signatures.

```text
 Record ──► ML-DSA-65 verify ──┐
   │                           ├─► Policy engine ─► Approve / Review / Block ─► Hash-chained ledger ─► Dashboard + audit
   └─► 8 features ─► QLIE ─────┘
        (4-qubit kernel, C^16)         BB84 channel protects replica-to-replica transit
```

### QLIE circuit (Qiskit Level 4)

- Custom 4-qubit parameterized circuit in a 16-dimensional Hilbert space (C^16).
- Hadamard layer, multi-basis `Ry(x)·Rz(2x)` data re-uploading, circular C4 CNOT ring with cross-ladder shortcuts (0→2, 1→3), and non-linear `R_ZZ(2(π−xᵢ)(π−xⱼ))` phase gates.
- Fidelity kernel and Projected Quantum Kernel (single-body ⟨Zᵢ⟩ and two-body ⟨ZᵢZⱼ⟩ observables).
- Analytical parameter-shift gradients.
- Hardware-aware compilation (see Results).

## Results

### Hardware-aware compilation

Compiled onto a 133-qubit IBM Torino device model (heavy-hex coupling map, native `cz, rz, sx, x`, calibrated errors). Reproduce with `npm run qml:eval` (Part 2) or in the web app.

| Level | Depth | 2Q gates | Est. success | Notes |
| :--- | ---: | ---: | ---: | :--- |
| O0 | 269 | 87 | 50.1% | no optimisation |
| O1 | 221 | 84 | 69.3% | |
| O2 | 174 | 57 | 76.1% | |
| O3 | 174 | 57 | 77.3% | Qiskit's highest preset level |
| **L4** | **171** | **55** | **77.8%** | O3 + best-of-16 routing search + calibration-aware scoring + unitary-equivalence check |

With all-to-all connectivity (no routing) the same circuit compiles to depth 50 and 32 CX. The gap is the routing cost of real hardware. Success probability is estimated from calibration data and is not a hardware run. "L4" is this project's label, not a Qiskit setting.

### Benchmark

Synthetic Andhra Pradesh dataset (10,000 rows across 10 districts and 55 mandals). The quantum kernel is evaluated on a **600-sample training / 200-sample test** subset because the Gram matrix is O(N²).

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | Training Time | Inference |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Quantum QSVC (4 qubits) | 97.5% | 98.0% | 97.0% | 0.975 | 0.999 | 0.31 s | ~0.5 ms |
| Classical RBF SVM | 100% | 100% | 100% | 1.000 | 1.000 | <0.01 s | <0.1 ms |
| Random Forest (100 trees) | 100% | 100% | 100% | 1.000 | 1.000 | ~0.04 s | ~0.02 ms |
| MLP | 100% | 100% | 100% | 1.000 | 1.000 | ~0.05 s | <0.1 ms |

The classical models separate this dataset cleanly, while the quantum model achieves 97.5% accuracy and 97.0% recall, demonstrating end-to-end detection capability on non-trivial boundary data.

### Kernel geometry indicators

| Metric | Value |
| :--- | ---: |
| Geometric difference g(K_Q, K_C), Huang et al. 2021 | 74.252 |
| Meyer-Wallach entanglement Q | 0.763 |
| Kernel-target alignment, quantum kernel | 32.1% |
| Kernel-target alignment, classical RBF kernel | 55.2% |

A large g is a necessary condition for a possible quantum advantage, not proof of one, and the classical kernel aligns better with the labels here. We report these as descriptions of the kernel, not as a demonstrated advantage.

### Quantum key distribution (BB84)

Qiskit Aer simulation. Honest channel: QBER ≈ 0%. Intercept-resend eavesdropper: QBER ≈ 25–30% (theory: 25%). The channel aborts at 11% QBER and no key is issued.

## Quick start

**Prerequisites:** Node.js 24 or later (native ML-DSA needs OpenSSL 3.5) and Python 3.10 or later.

```bash
git clone <repo-url> quantara-1 && cd quantara-1
npm run setup     # npm install + Python virtualenv in quantum-service/.venv
npm run dev       # server + web + quantum service together
```

| Service | URL | Role |
| :--- | :--- | :--- |
| Web | http://localhost:5173 | React 19 + Vite + Tailwind dashboard |
| API | http://localhost:4000 | Express, SQLite ledger, ML-DSA-65 signing |
| Quantum service | http://127.0.0.1:8001 | FastAPI, Qiskit 2.2.3, Aer, IBM Runtime |

Optional: copy `.env.example` to `.env` and set `IBM_QUANTUM_TOKEN` to enable the IBM Quantum hardware target. Never commit a real token.

## Running from the terminal

| Command | What it does |
| :--- | :--- |
| `npm run qml:eval` | Full technical evaluator: circuit architecture, hardware-aware compilation, kernel metrics, benchmark, live personas |
| `npm run qml` | Combined demo: ML-DSA verification, BB84 channel, QML screen, combined decision |
| `npm run demo` | Standalone terminal demo |
| `npm run seed` | Re-seed the demo ledger (2,481 signed entities) |
| `npm test` | Server tests and quantum-service tests |
| `npm run typecheck` | TypeScript check for server and web |
| `npm run build` | Production build |

Compile report only, as JSON:

```bash
quantum-service/.venv/bin/python -c "
from qml.feature_map import hardware_compile_report as h
import json; r = h(backend_name='torino', seeds=16); r.pop('ascii'); print(json.dumps(r, indent=2))"
```

`backend_name` accepts `torino`, `sherbrooke` or `brisbane`.

## Tour of the web app

Sign in is a prototype screen; any input opens the workspace.

| Page | Route | What to look at |
| :--- | :--- | :--- |
| Overview | `/app` | Integrity scan, security alerts, ledger activity |
| Land Records | `/app/land` | Create, sign and verify records; open a record to tamper with it and watch verification fail |
| Supply Chain | `/app/supply-chain` | Signed custody events per batch |
| Certificates | `/app/certificates` | Issue and verify ML-DSA-signed credentials |
| Verification | `/app/verify` | Step-by-step verification from first principles |
| Ledger | `/app/ledger` | Blocks, hash links, full-chain verification |
| Post-Quantum | `/app/post-quantum` | Scheme comparison, legacy-signature migration queue |
| Quantum Lab | `/app/quantum` | **QLIE inference, circuit viewer, Hardware Compilation (L4) with re-run, benchmark, QKD, IBM threat lab** |
| Live Demo | `/app/demo` | Three scenarios: legitimate transfer (approved), insider fraud (human review), tampered record (blocked) |
| Audit Trail | `/app/audit` | Append-only log of actions |

## Repository layout

```text
server/           Express + SQLite API, ML-DSA-65 signing, ledger, audit
web/              React 19 + Vite frontend
quantum-service/  FastAPI service: circuits, QML endpoints, IBM Runtime
qml/              QLIE: feature map, quantum kernel, training, inference, compile report
dataset/          Synthetic Andhra Pradesh dataset generator and data.csv
scripts/          setup and launch scripts
qml_evaluator.py  Terminal evaluator behind `npm run qml:eval`
artifacts/        Generated figures
```

## Limitations and honest notes

- **All data is synthetic.** Names, survey numbers and transactions are fictional. No real registry data is used.
- **No empirical quantum advantage is claimed.** Classical baselines match the quantum model on this dataset.
- **The ledger is single-node.** A production deployment would replicate it across independent authorities with Byzantine fault-tolerant consensus.
- **The hash chain is tamper-evident, not the post-quantum part.** SHA-256 is expected to stay sound against known quantum attacks. The signature scheme is what needed replacing.
- **Quantum workloads run on simulators or device models by default.** Real IBM hardware is optional and needs a token.
- **Nothing here breaks RSA, ECC or ML-DSA.** The Shor demonstration factors N = 15.
- **Sign-in is a prototype screen** with no real authentication.

## Documentation

- [Technical report](TECHNICAL_REPORT.md): mathematical formulation and specifications
- [Pitch deck guide](PITCH_DECK_GUIDE.md): five-minute presentation script
- [Judges' defence FAQ](JUDGES_DEFENSE_FAQ.md): answers to likely technical questions

---

**Q-SHIELD AP** · Qiskit Fall Fest 2026 · CUTM Vizianagaram · *QML detects. PQC protects. DLT proves.*
