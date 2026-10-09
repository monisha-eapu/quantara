"""
Q-SHIELD AP: Live Quantum Inference Engine
Performs real-time quantum kernel evaluation on transaction vectors.
Returns calibrated risk scores and behavioral explainability flags.
"""
from __future__ import annotations

import math
import pickle
from typing import Dict, Any, List

from .config import MODELS_DIR, NUM_QUBITS, SELECTED_FEATURES
from .preprocessing import QLIEPreprocessor
from .quantum_kernel import QuantumKernelEvaluator
from .circuit_visualizer import get_circuit_details

_MODEL_CACHE: dict | None = None


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(min(x, 15.0), -15.0)))


def load_inference_engine():
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE

    model_path = MODELS_DIR / "qsvm_model.pkl"
    prep_path = MODELS_DIR / "preprocessor.json"

    # If models haven't been trained yet, auto-train once
    if not model_path.exists() or not prep_path.exists():
        from .training import run_training_and_benchmark
        run_training_and_benchmark(train_size=180, test_size=40)

    preprocessor = QLIEPreprocessor.load(prep_path)
    with open(model_path, "rb") as f:
        bundle = pickle.load(f)

    q_eval = QuantumKernelEvaluator(
        num_qubits=bundle.get("num_qubits", NUM_QUBITS),
        reps=bundle.get("reps", 2),
        scale=bundle.get("scale", 0.25)
    )

    _MODEL_CACHE = {
        "preprocessor": preprocessor,
        "q_svc": bundle["q_svc"],
        "train_states": bundle["train_states"],
        "q_eval": q_eval,
        "circuit_meta": get_circuit_details(num_qubits=NUM_QUBITS, reps=2),
    }
    return _MODEL_CACHE


def qlie_predict(tx_data: dict) -> Dict[str, Any]:
    """
    Executes live QLIE inference for a given transaction:
    Extracts features, normalizes them, computes the quantum kernel Gram vector against support vectors,
    and returns genuine model outputs.
    """
    engine = load_inference_engine()
    preprocessor: QLIEPreprocessor = engine["preprocessor"]
    q_svc = engine["q_svc"]
    train_states = engine["train_states"]
    q_eval: QuantumKernelEvaluator = engine["q_eval"]
    circuit_meta = engine["circuit_meta"]

    # 1. Feature normalization
    X_scaled = preprocessor.transform(tx_data)

    # 2. Quantum statevector encoding
    sample_state = q_eval.encode_statevectors(X_scaled)

    # 3. Quantum Kernel transition probability vector
    # Gram vector: K(x_new, x_train_i)
    K_vec = q_eval.compute_gram_matrix(sample_state, train_states)

    # 4. Model Decision & Calibrated Risk Score
    raw_decision = float(q_svc.decision_function(K_vec)[0])
    pred_label = int(q_svc.predict(K_vec)[0])

    # Calibrated risk mapping: sigmoid of the decision function
    risk_score = round(_sigmoid(raw_decision * 1.5), 4)
    classification = "SUSPICIOUS" if pred_label == 1 else "LEGITIMATE"

    # 5. Behavioral Evidence Generation (Human-in-the-loop explainability)
    evidence: List[str] = []
    freq = float(tx_data.get("transaction_frequency", 0))
    vel = float(tx_data.get("transaction_velocity", 0))
    own_freq = float(tx_data.get("ownership_change_frequency", 0))
    geo_dist = float(tx_data.get("geographical_distance", 0))
    time_dev = float(tx_data.get("timestamp_deviation", 0))

    if freq > 5.0:
        evidence.append(f"Abnormally high transaction frequency ({freq:.1f} tx/month vs norm < 3.0)")
    if vel > 0.45:
        evidence.append(f"Elevated velocity index ({vel:.2f} > 0.45 baseline)")
    if own_freq >= 3:
        evidence.append(f"Rapid ownership churning ({int(own_freq)} transfers in 12 months)")
    if geo_dist > 100.0:
        evidence.append(f"Irregular geographical leap ({geo_dist:.1f} km between recording nodes)")
    if time_dev > 30.0:
        evidence.append(f"Suspicious client-ledger timestamp skew ({time_dev:.1f} min offset)")

    if not evidence:
        evidence.append("Transaction behavioral pattern aligns within normal statistical baseline")

    return {
        "engine": "QLIE (Quantum Ledger Intelligence Engine)",
        "model": "Quantum Kernel Classifier (QSVC)",
        "feature_map": "ZZFeatureMap (depth=2, entanglement=full)",
        "classification": classification,
        "prediction": pred_label,
        "risk_score": risk_score,
        "decision_value": round(raw_decision, 4),
        "qubits": circuit_meta["num_qubits"],
        "circuit_depth": circuit_meta["circuit_depth"],
        "num_parameters": circuit_meta["num_parameters"],
        "backend": "Qiskit Aer Simulator (Statevector)",
        "input_features": {f: float(tx_data.get(f, 0.0)) for f in SELECTED_FEATURES},
        "behavioral_evidence": evidence,
    }
