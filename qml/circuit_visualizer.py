"""
Q-SHIELD AP: Quantum Circuit Visualizer
Generates real Qiskit-drawn ASCII circuits and gate metadata for judge inspection.
"""
from __future__ import annotations

from typing import Dict, Any
from .feature_map import build_feature_map


def get_ascii_circuit(num_qubits: int = 4, reps: int = 2, fold: int = 100) -> str:
    """Returns the real decomposed text circuit representation from Qiskit."""
    qc = build_feature_map(num_qubits=num_qubits, reps=reps)
    decomposed = qc.decompose()
    return str(decomposed.draw(output="text", fold=fold))


def get_circuit_details(num_qubits: int = 4, reps: int = 2) -> Dict[str, Any]:
    qc = build_feature_map(num_qubits=num_qubits, reps=reps)
    decomposed = qc.decompose()
    ascii_art = str(decomposed.draw(output="text", fold=90))
    ops = dict(decomposed.count_ops())

    return {
        "model_name": "Quantum Kernel Classifier (QSVC) / ZZFeatureMap",
        "num_qubits": qc.num_qubits,
        "circuit_depth": decomposed.depth(),
        "num_parameters": qc.num_parameters,
        "total_gates": sum(ops.values()),
        "gate_breakdown": ops,
        "entanglement": "Full all-to-all cross-correlation",
        "ascii_diagram": ascii_art,
    }
