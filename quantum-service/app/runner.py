"""Execution of demo circuits on local simulators or IBM Quantum hardware (Qiskit Runtime SamplerV2)."""
from __future__ import annotations

import sys as _sys
if __package__ in (None, ""):  # started as "python app/runner.py"
    _sys.exit("runner.py is a library module, not a script.\n"
              "  Terminal demo:   ./qml            (from the repo root)\n"
              "  Quantum service: npm run dev:quantum")

import json
import os
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from qiskit import QuantumCircuit
from qiskit.quantum_info import hellinger_fidelity
from qiskit.transpiler import generate_preset_pass_manager

from .circuits import SPECS, ideal_distribution

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
JOBS_FILE = DATA_DIR / "jobs.json"

TARGETS = {
    "ideal": {
        "label": "Local ideal simulator",
        "kind": "SIMULATOR",
        "description": "Qiskit Aer statevector-based sampling with no noise. Runs on this machine's CPU.",
    },
    "noisy": {
        "label": "Local noisy simulator (IBM device model)",
        "kind": "SIMULATOR",
        "description": "Qiskit Aer with the calibration snapshot of IBM Torino (FakeTorino): real topology, gate set and error rates — but simulated on this machine, NOT real hardware.",
    },
    "ibm": {
        "label": "IBM Quantum hardware",
        "kind": "QUANTUM_HARDWARE",
        "description": "Submits the transpiled circuit to a real IBM Quantum processor through Qiskit Runtime (SamplerV2). Jobs may queue.",
    },
}

_lock = threading.Lock()
_pool = ThreadPoolExecutor(max_workers=2)
_service = None
_service_error: Optional[str] = None
_backends_cache: Dict[str, Any] = {"at": 0.0, "data": None}
_runtime_jobs: Dict[str, Any] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------ persistence
def _load() -> List[dict]:
    if not JOBS_FILE.exists():
        return []
    try:
        return json.loads(JOBS_FILE.read_text())
    except json.JSONDecodeError:
        return []


def _save(jobs: List[dict]) -> None:
    tmp = JOBS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(jobs, indent=2, default=str))
    tmp.replace(JOBS_FILE)


def _update(job_id: str, **changes: Any) -> dict:
    with _lock:
        jobs = _load()
        for j in jobs:
            if j["id"] == job_id:
                j.update(changes)
                _save(jobs)
                return j
    raise KeyError(job_id)


def list_jobs() -> List[dict]:
    with _lock:
        return sorted(_load(), key=lambda j: j["submittedAt"], reverse=True)


def get_job(job_id: str) -> Optional[dict]:
    with _lock:
        return next((j for j in _load() if j["id"] == job_id), None)


# ------------------------------------------------------------------ IBM Quantum
def ibm_config() -> dict:
    token = os.getenv("IBM_QUANTUM_TOKEN", "").strip()
    saved = (Path.home() / ".qiskit" / "qiskit-ibm.json").exists()
    return {
        "configured": bool(token) or saved,
        "source": "environment" if token else ("saved account (~/.qiskit)" if saved else None),
        "channel": os.getenv("IBM_QUANTUM_CHANNEL", "ibm_quantum_platform"),
        "instanceConfigured": bool(os.getenv("IBM_QUANTUM_INSTANCE", "").strip()),
        "preferredBackend": os.getenv("IBM_QUANTUM_BACKEND") or None,
    }


def get_service():
    """Connects lazily; credentials never leave this process and are never returned by the API."""
    global _service, _service_error
    if _service is not None:
        return _service
    from qiskit_ibm_runtime import QiskitRuntimeService

    cfg = ibm_config()
    if not cfg["configured"]:
        raise RuntimeError("IBM Quantum is not configured. Set IBM_QUANTUM_TOKEN (and optionally IBM_QUANTUM_INSTANCE) in .env, or save an account with QiskitRuntimeService.save_account().")
    try:
        token = os.getenv("IBM_QUANTUM_TOKEN", "").strip()
        if token:
            _service = QiskitRuntimeService(channel=cfg["channel"], token=token, instance=os.getenv("IBM_QUANTUM_INSTANCE") or None)
        else:
            _service = QiskitRuntimeService()
        _service_error = None
        return _service
    except Exception as exc:  # surface a readable reason (bad token, network, instance...)
        _service_error = str(exc)
        raise RuntimeError(f"Could not connect to IBM Quantum: {exc}") from exc


def list_ibm_backends(force: bool = False) -> dict:
    if not force and _backends_cache["data"] is not None and time.time() - _backends_cache["at"] < 120:
        return _backends_cache["data"]
    service = get_service()
    out = []
    for b in service.backends(simulator=False, operational=True):
        try:
            st = b.status()
            out.append({"name": b.name, "qubits": b.num_qubits, "pendingJobs": st.pending_jobs, "operational": st.operational, "statusMsg": st.status_msg})
        except Exception:
            out.append({"name": b.name, "qubits": getattr(b, "num_qubits", None), "pendingJobs": None, "operational": True, "statusMsg": "unknown"})
    out.sort(key=lambda b: (b["pendingJobs"] is None, b["pendingJobs"] or 0))
    data = {"backends": out, "fetchedAt": _now()}
    _backends_cache.update(at=time.time(), data=data)
    return data


# ------------------------------------------------------------------ execution
def _status_name(status: Any) -> str:
    """RuntimeJobV2.status() returns a string; local-mode jobs return a JobStatus enum."""
    return getattr(status, "name", str(status)).upper()


def _transpile_stats(isa: QuantumCircuit) -> dict:
    two_q = sum(1 for inst in isa.data if inst.operation.num_qubits == 2 and inst.operation.name != "barrier")
    layout = None
    try:
        if isa.layout is not None:
            layout = [int(q) for q in isa.layout.final_index_layout()]
    except Exception:
        layout = None
    return {"depth": isa.depth(), "size": isa.size(), "twoQubitGates": two_q,
            "ops": {k: int(v) for k, v in isa.count_ops().items()}, "physicalQubits": layout}


def _finish(job_id: str, circuit_id: str, counts: Dict[str, int], extra: Optional[dict] = None) -> None:
    spec = SPECS[circuit_id]
    ideal = ideal_distribution(spec.build())
    try:
        fidelity = float(hellinger_fidelity(counts, {k: v for k, v in ideal.items()}))
    except Exception:
        fidelity = None
    _update(job_id, status="DONE", completedAt=_now(), counts=counts, analysis=spec.analyze(counts),
            hellingerFidelity=fidelity, **(extra or {}))


def _run_local(job_id: str, circuit_id: str, target: str, shots: int) -> None:
    try:
        from qiskit_aer import AerSimulator
        from qiskit_ibm_runtime import SamplerV2
        from qiskit_ibm_runtime.fake_provider import FakeTorino

        backend = AerSimulator() if target == "ideal" else FakeTorino()
        _update(job_id, status="RUNNING", startedAt=_now())
        isa = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=11).run(SPECS[circuit_id].build())
        _update(job_id, transpiled=_transpile_stats(isa))
        t0 = time.time()
        result = SamplerV2(mode=backend).run([isa], shots=shots).result()
        counts = {str(k): int(v) for k, v in result[0].data.c.get_counts().items()}
        _finish(job_id, circuit_id, counts, {"executionSeconds": round(time.time() - t0, 3)})
    except Exception as exc:
        traceback.print_exc()
        _update(job_id, status="ERROR", completedAt=_now(), error=str(exc))


def submit(circuit_id: str, target: str, shots: int, backend_name: Optional[str] = None) -> dict:
    if circuit_id not in SPECS:
        raise ValueError(f"Unknown circuit '{circuit_id}'")
    if target not in TARGETS:
        raise ValueError(f"Unknown target '{target}'")
    if not 100 <= shots <= 8192:
        raise ValueError("shots must be between 100 and 8192")

    job = {
        "id": uuid.uuid4().hex[:12], "circuit": circuit_id, "circuitName": SPECS[circuit_id].name,
        "target": target, "targetKind": TARGETS[target]["kind"], "targetLabel": TARGETS[target]["label"],
        "backend": "aer_simulator" if target == "ideal" else "fake_torino (simulated)" if target == "noisy" else None,
        "shots": shots, "status": "QUEUED", "submittedAt": _now(), "ibmJobId": None,
        "counts": None, "analysis": None, "transpiled": None, "error": None,
    }

    if target == "ibm":
        from qiskit_ibm_runtime import SamplerV2

        service = get_service()
        qc = SPECS[circuit_id].build()
        name = backend_name or os.getenv("IBM_QUANTUM_BACKEND") or None
        backend = service.backend(name) if name else service.least_busy(operational=True, simulator=False, min_num_qubits=qc.num_qubits)
        isa = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=11).run(qc)
        runtime_job = SamplerV2(mode=backend).run([isa], shots=shots)
        job.update(backend=backend.name, ibmJobId=runtime_job.job_id(), transpiled=_transpile_stats(isa), status=_status_name(runtime_job.status()))
        _runtime_jobs[job["id"]] = runtime_job
        with _lock:
            jobs = _load(); jobs.append(job); _save(jobs)
        return job

    with _lock:
        jobs = _load(); jobs.append(job); _save(jobs)
    _pool.submit(_run_local, job["id"], circuit_id, target, shots)
    return job


def refresh(job_id: str) -> Optional[dict]:
    """For hardware jobs, pulls the latest status (and results once DONE) from IBM Quantum."""
    job = get_job(job_id)
    if job is None or job["target"] != "ibm" or job["status"] in ("DONE", "ERROR", "CANCELLED"):
        return job
    try:
        rj = _runtime_jobs.get(job_id) or get_service().job(job["ibmJobId"])
        _runtime_jobs[job_id] = rj
        status = _status_name(rj.status())
        if status == "DONE":
            result = rj.result()
            counts = {str(k): int(v) for k, v in result[0].data.c.get_counts().items()}
            extra: Dict[str, Any] = {}
            try:
                metrics = rj.metrics() if hasattr(rj, "metrics") else {}
                extra["ibmUsage"] = {"quantumSeconds": (metrics.get("usage") or {}).get("quantum_seconds"),
                                     "timestamps": metrics.get("timestamps")}
            except Exception:
                pass
            _finish(job_id, job["circuit"], counts, extra)
        elif status in ("ERROR", "CANCELLED"):
            reason = None
            try:
                reason = rj.error_message()
            except Exception:
                pass
            _update(job_id, status=status, completedAt=_now(), error=reason or f"IBM job {status.lower()}")
        else:
            _update(job_id, status=status, lastPolledAt=_now())
    except Exception as exc:
        _update(job_id, lastPollError=str(exc), lastPolledAt=_now())
    return get_job(job_id)


def delete_job(job_id: str) -> bool:
    with _lock:
        jobs = _load()
        kept = [j for j in jobs if j["id"] != job_id]
        _save(kept)
        return len(kept) != len(jobs)
