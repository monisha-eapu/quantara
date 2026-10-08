"""
Q-SHIELD AP: Quantum Kernel Matrix Evaluator
Evaluates the transition probability fidelity kernel:
  K(x_i, x_j) = |<phi(x_i) | phi(x_j)>|^2
via exact statevector execution on Qiskit Aer / Statevector simulation.
"""
from __future__ import annotations

import numpy as np
from qiskit.quantum_info import Statevector
from .feature_map import build_feature_map


class QuantumKernelEvaluator:
    def __init__(self, num_qubits: int = 4, reps: int = 2, scale: float = 0.5):
        self.num_qubits = num_qubits
        self.reps = reps
        self.scale = scale
        self.feature_map = build_feature_map(num_qubits=num_qubits, reps=reps)

    def encode_statevectors(self, X: np.ndarray) -> np.ndarray:
        """Computes pure statevectors for a batch of feature vectors X."""
        states = []
        for x in X:
            scaled_params = (x * self.scale).tolist()
            bound_qc = self.feature_map.assign_parameters(scaled_params)
            sv = Statevector.from_instruction(bound_qc)
            states.append(sv.data)
        return np.array(states, dtype=complex)

    @staticmethod
    def compute_gram_matrix(states_A: np.ndarray, states_B: np.ndarray) -> np.ndarray:
        """
        Transition probability fidelity:
        K_ij = |<psi_A_i | psi_B_j>|^2 = |(states_A^* @ states_B^T)|^2
        """
        inner_prod = states_A.conj() @ states_B.T
        return np.abs(inner_prod) ** 2

    def evaluate_kernel(self, X_A: np.ndarray, X_B: np.ndarray | None = None) -> np.ndarray:
        states_A = self.encode_statevectors(X_A)
        if X_B is None or X_B is X_A:
            return self.compute_gram_matrix(states_A, states_A)
        states_B = self.encode_statevectors(X_B)
        return self.compute_gram_matrix(states_A, states_B)
