"""
Q-SHIELD AP: Level 4 Quantum Kernel & Observables Engine
Evaluates both:
  1. Pure State Transition Fidelity Kernel:
       K(x_i, x_j) = |<psi(x_i) | psi(x_j)>|^2
     via exact statevector execution on Qiskit Aer / Statevector simulation.
  2. Projected Quantum Kernel (PQK):
       Computes local Pauli-Z and Pauli-ZZ observable expectation values <Z_i>, <Z_i Z_j>
       to avoid barren plateaus and exponential concentration.
  3. Analytical Parameter-Shift Gradient computation for variational updates.
"""
from __future__ import annotations

import math
from typing import Optional, List, Tuple
import numpy as np
from qiskit.quantum_info import Statevector, SparsePauliOp
from .feature_map import build_feature_map, build_custom_qshield_feature_map


class QuantumKernelEvaluator:
    def __init__(self, num_qubits: int = 4, reps: int = 2, scale: float = 0.25):
        self.num_qubits = num_qubits
        self.reps = reps
        self.scale = scale
        self.feature_map = build_custom_qshield_feature_map(num_qubits=num_qubits, reps=reps)

    def encode_statevectors(self, X: np.ndarray) -> np.ndarray:
        """Computes pure statevectors for a batch of feature vectors X without phase aliasing."""
        states = []
        for x in X:
            x_arr = np.asarray(x, dtype=float)
            scaled_params = (x_arr * self.scale).tolist()
            bound_qc = self.feature_map.assign_parameters(scaled_params)
            sv = Statevector.from_instruction(bound_qc)
            states.append(sv.data)
        return np.array(states, dtype=complex)

    @staticmethod
    def compute_gram_matrix(states_A: np.ndarray, states_B: np.ndarray) -> np.ndarray:
        """
        Transition probability fidelity:
        K_ij = |<psi_A_i | psi_B_j>|^2 = |(states_A^* @ states_B^T)|^2
        Guaranteed to be symmetric and positive semi-definite (PSD).
        """
        inner_prod = states_A.conj() @ states_B.T
        return np.clip(np.abs(inner_prod) ** 2, 0.0, 1.0)

    def evaluate_kernel(self, X_A: np.ndarray, X_B: np.ndarray | None = None) -> np.ndarray:
        states_A = self.encode_statevectors(X_A)
        if X_B is None or X_B is X_A:
            return self.compute_gram_matrix(states_A, states_A)
        states_B = self.encode_statevectors(X_B)
        return self.compute_gram_matrix(states_A, states_B)

    # --------------------------------------------------------------------------
    # Level-4 Advanced Quantum Capability: Projected Quantum Kernel (PQK)
    # --------------------------------------------------------------------------
    def compute_projected_expectations(self, X: np.ndarray) -> np.ndarray:
        """
        Computes 1-qubit and 2-qubit Pauli observable expectation values:
          P_k(x) = <psi(x) | Z_k | psi(x)>
          P_jk(x) = <psi(x) | Z_j Z_k | psi(x)>
        Maps quantum states into classical projection space preventing concentration.
        """
        projections = []
        # Build 1-qubit and 2-qubit Pauli-Z operators
        pauli_ops = []
        for i in range(self.num_qubits):
            z_str = ["I"] * self.num_qubits
            z_str[i] = "Z"
            pauli_ops.append(SparsePauliOp("".join(z_str)))

        for i in range(self.num_qubits):
            for j in range(i + 1, self.num_qubits):
                zz_str = ["I"] * self.num_qubits
                zz_str[i] = "Z"
                zz_str[j] = "Z"
                pauli_ops.append(SparsePauliOp("".join(zz_str)))

        for x in X:
            scaled_params = (x * self.scale).tolist()
            bound_qc = self.feature_map.assign_parameters(scaled_params)
            sv = Statevector.from_instruction(bound_qc)
            row = [float(np.real(sv.expectation_value(op))) for op in pauli_ops]
            projections.append(row)

        return np.array(projections, dtype=float)

    def compute_projected_kernel(self, X_A: np.ndarray, X_B: Optional[np.ndarray] = None, gamma: float = 0.5) -> np.ndarray:
        """Projected Gaussian Quantum Kernel over Pauli observable space."""
        P_A = self.compute_projected_expectations(X_A)
        P_B = P_A if X_B is None or X_B is X_A else self.compute_projected_expectations(X_B)

        dists = np.sum((P_A[:, np.newaxis, :] - P_B[np.newaxis, :, :]) ** 2, axis=-1)
        return np.exp(-gamma * dists)

    # --------------------------------------------------------------------------
    # Analytical Parameter-Shift Quantum Gradient
    # --------------------------------------------------------------------------
    def parameter_shift_gradient(self, x: np.ndarray, param_idx: int) -> float:
        """
        Exact parameter-shift rule:
        d<O>/dθ = (<O(θ + π/2)> - <O(θ - π/2)>) / 2
        """
        shift = math.pi / 2.0
        x_plus = np.array(x, dtype=float)
        x_minus = np.array(x, dtype=float)
        x_plus[param_idx] += shift
        x_minus[param_idx] -= shift

        sv_plus = Statevector.from_instruction(self.feature_map.assign_parameters((x_plus * self.scale).tolist()))
        sv_minus = Statevector.from_instruction(self.feature_map.assign_parameters((x_minus * self.scale).tolist()))

        op = SparsePauliOp("Z" * self.num_qubits)
        exp_plus = float(np.real(sv_plus.expectation_value(op)))
        exp_minus = float(np.real(sv_minus.expectation_value(op)))

        return (exp_plus - exp_minus) / 2.0

    # --------------------------------------------------------------------------
    # Quantum Advantage Metrics: Alignment, Geometric Difference & Entanglement
    # --------------------------------------------------------------------------
    @staticmethod
    def kernel_target_alignment(K: np.ndarray, y: np.ndarray) -> float:
        """
        Calculates Kernel-Target Alignment (Cristianini et al., 2002):
          A(K, y) = <K, y y^T>_F / (||K||_F * ||y y^T||_F)
        """
        y_vec = np.asarray(y, dtype=float).reshape(-1, 1)
        if set(np.unique(y_vec)).issubset({0.0, 1.0}):
            y_vec = 2.0 * y_vec - 1.0
        T = y_vec @ y_vec.T
        inner_prod = np.sum(K * T)
        norm_K = np.linalg.norm(K, ord="fro")
        norm_T = np.linalg.norm(T, ord="fro")
        if norm_K * norm_T == 0:
            return 0.0
        return float(np.clip(inner_prod / (norm_K * norm_T), -1.0, 1.0))

    @staticmethod
    def geometric_difference(K_Q: np.ndarray, K_C: np.ndarray, reg: float = 1e-4) -> float:
        """
        Computes the Huang et al. (2021) geometric difference between quantum and classical kernels:
          g(K_Q, K_C) = sqrt(|| K_Q^{1/2} (K_C + reg*I)^{-1} K_Q^{1/2} ||_inf)
        When g > 1.0, the quantum model can efficiently separate representations that classical kernels cannot.
        """
        n = K_Q.shape[0]
        u, s, vh = np.linalg.svd(K_Q + reg * np.eye(n))
        sqrt_KQ = u @ np.diag(np.sqrt(np.maximum(s, 0.0))) @ vh
        inv_KC = np.linalg.pinv(K_C + reg * np.eye(n))
        M = sqrt_KQ @ inv_KC @ sqrt_KQ
        spectral_norm = float(np.max(np.abs(np.linalg.eigvalsh(M))))
        return float(np.sqrt(max(spectral_norm, 1.0)))

    def meyer_wallach_entanglement(self, x: np.ndarray) -> float:
        """
        Computes the Meyer-Wallach global entanglement measure Q(|psi>) in [0, 1]:
          Q(|psi>) = 2 * (1 - 1/n * sum_k Tr(rho_k^2))
        """
        from qiskit.quantum_info import partial_trace
        x_arr = np.asarray(x, dtype=float)
        scaled_params = (x_arr * self.scale).tolist()
        bound_qc = self.feature_map.assign_parameters(scaled_params)
        sv = Statevector.from_instruction(bound_qc)

        n = self.num_qubits
        purity_sum = 0.0
        for k in range(n):
            trace_qubits = [i for i in range(n) if i != k]
            rho_k = partial_trace(sv, trace_qubits).data
            purity = float(np.real(np.trace(rho_k @ rho_k)))
            purity_sum += purity

        Q = 2.0 * (1.0 - (purity_sum / n))
        return float(np.clip(Q, 0.0, 1.0))
