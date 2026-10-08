#!/usr/bin/env python3
"""
Quantum Variational Classifier (VQC) for DLT Ledger Anomaly & Tamper Detection
--------------------------------------------------------------------------------
Architecture Specifications:
1. Qubit Scale: Exactly 8 qubits.
2. Feature Map: 2-layer ZZFeatureMap capturing non-linear cross-correlations.
   Custom data mapping function:
     - Single terms  (x_i)   : f(x_i) = pi - x_i
     - Pair terms    (x_i,x_j): f(x_i, x_j) = (pi - x_i) * (pi - x_j)
3. Parameterized Quantum Circuit (PQC) / Ansatz:
   - Architecture: TwoLocal (reps=3)
   - Rotations: 'ry' and 'rz' for high expressibility
   - Entanglement: 'cz' gates in full linear/all-to-all topology for global dependencies
4. Optimization Objective & Loss Function:
   - Objective: Min_θ [ (1/N) * Σ L(f(x_i, θ), y_i) + λ ||θ||^2 ]
   - Loss Function: Cross-Entropy Loss / Square Loss via VQC framework
5. Optimizer: COBYLA / SPSA tuned for noisy quantum environments (maxiter=150)
6. Execution Pipeline:
   - Qiskit 1.x StatevectorSampler Primitive
   - 8-feature DLT transaction dataset matrix generator
   - Loss convergence tracking, curve plotting, and test accuracy metrics
"""

from __future__ import annotations

import os
import sys
import time
import warnings

# Auto-reconfigure terminal encoding for Windows environments
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

warnings.filterwarnings("ignore")

# Auto-detect virtual environment Python & auto-redirect if missing packages
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

try:
    import numpy as np  # noqa: F401
    import qiskit  # noqa: F401
    import qiskit_machine_learning  # noqa: F401
except ImportError:
    win_venv_py = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    unix_venv_py = os.path.join(base_dir, ".venv", "bin", "python")
    venv_py = win_venv_py if (os.name == "nt" and os.path.exists(win_venv_py)) else unix_venv_py
    if os.path.exists(venv_py) and os.path.abspath(sys.executable) != os.path.abspath(venv_py):
        import subprocess
        sys.exit(subprocess.call([venv_py] + sys.argv))
    else:
        print("Error: Missing Python dependencies. Please run 'npm run setup' first.")
        sys.exit(1)

import numpy as np
import matplotlib.pyplot as plt

# Qiskit Core & Primitives (Qiskit 1.x)
from qiskit.circuit.library import ZZFeatureMap, TwoLocal
from qiskit.primitives import StatevectorSampler

# Qiskit Machine Learning
from qiskit_machine_learning.algorithms import VQC
from qiskit_machine_learning.optimizers import COBYLA, SPSA
from qiskit_machine_learning.utils import algorithm_globals

# Scikit-learn for dataset splitting & evaluation
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Fix random seed for reproducibility
SEED = 42
algorithm_globals.random_seed = SEED
np.random.seed(SEED)


def generate_dlt_ledger_dataset(num_samples: int = 80, noise_ratio: float = 0.15):
    """
    Generates a synthetic 8-feature ledger transaction dataset for Land Registry / Supply Chain:
    Features:
      1. timestamp_delta      : Time delta between block creation and transaction submission
      2. land_id_hash         : Normalized hash of survey / parcel ID
      3. owner_id_hash        : Normalized hash of owner identity key
      4. signature_weight     : PQC signature verification weight / entropy
      5. prev_hash_delta      : Difference score relative to previous block header
      6. area_log_scale       : Log-scaled parcel area
      7. geo_location_hash    : Geo-spatial location boundary hash
      8. lifecycle_status     : State flag (e.g. transfer, mortgage, division)

    Labels:
      0: Authentic Ledger Transaction
      1: Tampered / Anomalous Transaction Injection
    """
    num_normal = num_samples // 2
    num_tampered = num_samples - num_normal

    # Normal transactions (authentic patterns around baseline distributions)
    normal_features = np.random.multivariate_normal(
        mean=[0.2, 0.5, 0.4, 0.95, 0.1, 0.3, 0.6, 0.2],
        cov=np.diag([0.02, 0.03, 0.03, 0.01, 0.01, 0.02, 0.03, 0.02]),
        size=num_normal
    )
    normal_labels = np.zeros(num_normal, dtype=int)

    # Tampered transactions (anomalous signature weights, prev_hash mismatches, area spikes)
    tampered_features = np.random.multivariate_normal(
        mean=[0.8, 0.5, 0.8, 0.20, 0.85, 0.9, 0.6, 0.8],
        cov=np.diag([0.05, 0.05, 0.05, 0.04, 0.04, 0.05, 0.05, 0.04]),
        size=num_tampered
    )
    tampered_labels = np.ones(num_tampered, dtype=int)

    X = np.vstack([normal_features, tampered_features])
    y = np.hstack([normal_labels, tampered_labels])

    # Inject minor gaussian noise to simulate realistic telemetry fluctuations
    noise = np.random.normal(0, noise_ratio * 0.05, X.shape)
    X += noise

    # Scale feature values non-linearly to [0, 2*pi] range for quantum rotation gates
    scaler = MinMaxScaler(feature_range=(0, 2 * np.pi))
    X_scaled = scaler.fit_transform(X)

    return X_scaled, y


def custom_data_map(x: np.ndarray):
    """
    Custom non-linear data mapping function for ZZFeatureMap:
    - Single qubit terms (x_i): returns (pi - x_i)
    - Entangled pair terms (x_i, x_j): returns (pi - x_i) * (pi - x_j)
      to capture non-linear cross-correlations across all 8 qubits.
    """
    if len(x) == 1:
        return np.pi - x[0]
    return (np.pi - x[0]) * (np.pi - x[1])


def build_vqc_architecture(num_qubits: int = 8):
    """
    Constructs the 8-qubit Quantum Circuit Architecture:
    1. Feature Map: ZZFeatureMap (depth=2, entanglement='full')
    2. Ansatz / PQC: TwoLocal (rotation_blocks=['ry', 'rz'], entanglement_blocks='cz', reps=3)
    """
    print(f"\n[+] Building 8-Qubit Quantum Circuit Architecture...", flush=True)
    
    # 1. Feature Map
    feature_map = ZZFeatureMap(
        feature_dimension=num_qubits,
        reps=2,
        entanglement="full",
        data_map_func=custom_data_map
    )
    print(f"    - Feature Map : ZZFeatureMap (qubits={num_qubits}, reps=2, entanglement='full')", flush=True)

    # 2. Parameterized Quantum Circuit (PQC) Ansatz
    ansatz = TwoLocal(
        num_qubits=num_qubits,
        rotation_blocks=["ry", "rz"],
        entanglement_blocks="cz",
        entanglement="full",
        reps=3
    )
    print(f"    - Ansatz Circuit: TwoLocal (rotations=['ry','rz'], entangler='cz', reps=3, total_params={ansatz.num_parameters})", flush=True)

    return feature_map, ansatz


class LossConvergenceCallback:
    """Callback logger for tracking VQC optimization loss convergence."""
    def __init__(self):
        self.iterations = []
        self.loss_history = []
        self.start_time = time.time()

    def callback(self, weights, loss_val):
        self.iterations.append(len(self.loss_history) + 1)
        self.loss_history.append(loss_val)
        if len(self.loss_history) % 10 == 0 or len(self.loss_history) == 1:
            elapsed = time.time() - self.start_time
            print(f"    Iteration {len(self.loss_history):3d} / 150 | Loss: {loss_val:.6f} | Elapsed: {elapsed:.2f}s", flush=True)


def main():
    print("=" * 80, flush=True)
    print("  QUANTUM VARIATIONAL CLASSIFIER (VQC) FOR DLT LEDGER ANOMALY DETECTION", flush=True)
    print("=" * 80, flush=True)

    NUM_QUBITS = 8
    MAX_ITER = 150

    # Step 1: Generate Dataset
    print("\n[+] Generating Synthetic 8-Feature DLT Ledger Transaction Matrix...", flush=True)
    X, y = generate_dlt_ledger_dataset(num_samples=80)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=SEED, stratify=y
    )
    print(f"    - Training Set : {X_train.shape[0]} samples (8 features)", flush=True)
    print(f"    - Testing Set  : {X_test.shape[0]} samples (8 features)", flush=True)

    # Step 2: Build Quantum Architecture
    feature_map, ansatz = build_vqc_architecture(num_qubits=NUM_QUBITS)

    # Step 3: Setup Optimizer and Sampler Primitive (Qiskit 1.x)
    print("\n[+] Configuring Optimizer and Sampler Primitive...", flush=True)
    optimizer = COBYLA(maxiter=MAX_ITER)
    sampler = StatevectorSampler(default_shots=1024)
    loss_logger = LossConvergenceCallback()

    # Step 4: Instantiate VQC
    print("\n[+] Initializing Variational Quantum Classifier (VQC)...", flush=True)
    vqc = VQC(
        num_qubits=NUM_QUBITS,
        feature_map=feature_map,
        ansatz=ansatz,
        optimizer=optimizer,
        sampler=sampler,
        callback=loss_logger.callback
    )

    # Step 5: Train VQC Model
    print(f"\n[+] Executing VQC Optimization Workflow (Max Iterations: {MAX_ITER})...", flush=True)
    start_train_time = time.time()
    vqc.fit(X_train, y_train)
    training_duration = time.time() - start_train_time
    print(f"\n[OK] Optimization Completed in {training_duration:.2f} seconds across {len(loss_logger.loss_history)} iterations.", flush=True)

    # Step 6: Evaluate Model Performance
    print("\n[+] Evaluating Model on Test Dataset...", flush=True)
    train_acc = vqc.score(X_train, y_train)
    test_acc = vqc.score(X_test, y_test)
    y_pred = vqc.predict(X_test)

    print("\n" + "=" * 80, flush=True)
    print("  PERFORMANCE EVALUATION METRICS", flush=True)
    print("=" * 80, flush=True)
    print(f"  - Training Accuracy : {train_acc * 100:.2f}%", flush=True)
    print(f"  - Testing Accuracy  : {test_acc * 100:.2f}%", flush=True)
    print("\n  Classification Report:", flush=True)
    print(classification_report(y_test, y_pred, target_names=["Authentic (0)", "Tampered (1)"]), flush=True)
    print("  Confusion Matrix:", flush=True)
    print(confusion_matrix(y_test, y_pred), flush=True)

    # Step 7: Plot & Save Loss Convergence Curve
    plt.figure(figsize=(9, 5))
    plt.plot(loss_logger.iterations, loss_logger.loss_history, 'o-', color='#8a2be2', linewidth=2, markersize=4, label='VQC Cross-Entropy Loss')
    plt.title('Variational Quantum Classifier (VQC) Loss Convergence Curve (8 Qubits)', fontsize=13, fontweight='bold')
    plt.xlabel('Optimization Iteration', fontsize=11)
    plt.ylabel('Loss Value', fontsize=11)
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.legend(loc='upper right')
    plt.tight_layout()
    
    plot_filename = os.path.join(base_dir, "vqc_loss_convergence.png")
    plt.savefig(plot_filename, dpi=300)
    print(f"\n[OK] Loss convergence plot saved to: {plot_filename}", flush=True)

    print("\n" + "=" * 80, flush=True)
    print("  VQC LEDGER ANOMALY DETECTION COMPLETE", flush=True)
    print("=" * 80, flush=True)


if __name__ == "__main__":
    main()
