"""
Q-SHIELD AP: Quantum Feature Encoding Circuit
Constructs high-expressibility ZZFeatureMap with non-linear entanglement.
"""
from __future__ import annotations

from typing import Dict, Any
from qiskit.circuit.library import ZZFeatureMap, zz_feature_map
from qiskit import QuantumCircuit


def build_feature_map(num_qubits: int = 4, reps: int = 2, entanglement: str = "full") -> QuantumCircuit:
    """
    Constructs an N-qubit ZZ feature map circuit:
      |0> --- H --- Rz(2*x_i) ---●----------------●---
                                  |                |
      |0> --- H --- Rz(2*x_j) ---X--- Rz(2*(pi-x_i)*(pi-x_j)) ---X---
    """
    try:
        # Standard Qiskit 1.x/2.x call
        return zz_feature_map(feature_dimension=num_qubits, reps=reps, entanglement=entanglement)
    except Exception:
        return ZZFeatureMap(feature_dimension=num_qubits, reps=reps, entanglement=entanglement)


def get_feature_map_metadata(num_qubits: int = 4, reps: int = 2) -> Dict[str, Any]:
    qc = build_feature_map(num_qubits=num_qubits, reps=reps)
    decomposed = qc.decompose()
    return {
        "num_qubits": qc.num_qubits,
        "circuit_depth": qc.depth(),
        "decomposed_depth": decomposed.depth(),
        "num_parameters": qc.num_parameters,
        "operations": dict(decomposed.count_ops()),
        "entanglement_strategy": "full",
        "reps": reps,
    }
