"""QuantumShield quantum service — IBM Quantum / Qiskit threat demonstration (separate from the ML-DSA layer)."""
from __future__ import annotations

import sys as _sys
if __package__ in (None, ""):  # started as "python app/main.py"
    _sys.exit("main.py is a library module, not a script.\n"
              "  Terminal demo:   ./qml            (from the repo root)\n"
              "  Quantum service: npm run dev:quantum")

from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

import qiskit  # noqa: E402
import qiskit_aer  # noqa: E402
import qiskit_ibm_runtime  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import runner  # noqa: E402
from .circuits import SPECS, describe  # noqa: E402

app = FastAPI(title="QuantumShield Quantum Service", version="1.0.0",
              description="Runs real quantum circuits (IBM Quantum hardware or local simulators) for the threat demonstration.")

_circuit_cache: dict = {}


def _describe(cid: str) -> dict:
    if cid not in _circuit_cache:
        _circuit_cache[cid] = describe(SPECS[cid])
    return _circuit_cache[cid]


@app.get("/status")
def status() -> dict:
    return {
        "online": True,
        "role": "THREAT_DEMONSTRATION_ONLY",
        "separation": "This service never receives records, signatures or keys. QuantumShield's record security is provided by ML-DSA running on classical computers.",
        "versions": {"qiskit": qiskit.__version__, "qiskitIbmRuntime": qiskit_ibm_runtime.__version__, "qiskitAer": qiskit_aer.__version__},
        "ibm": runner.ibm_config(),
        "targets": runner.TARGETS,
    }


@app.get("/circuits")
def circuits() -> dict:
    return {"circuits": [_describe(cid) for cid in SPECS]}


@app.get("/circuits/{cid}")
def circuit(cid: str) -> dict:
    if cid not in SPECS:
        raise HTTPException(404, f"Unknown circuit {cid}")
    return _describe(cid)


@app.get("/ibm/backends")
def ibm_backends(refresh: bool = False) -> dict:
    try:
        return runner.list_ibm_backends(force=refresh)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


class JobRequest(BaseModel):
    circuitId: str
    target: str = Field(pattern="^(ideal|noisy|ibm)$")
    shots: int = 2048
    backend: Optional[str] = None


@app.post("/jobs", status_code=201)
def create_job(req: JobRequest) -> dict:
    try:
        return runner.submit(req.circuitId, req.target, req.shots, req.backend)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:  # IBM-side failures (backend not found, auth, quota)
        raise HTTPException(502, f"IBM Quantum submission failed: {exc}")


@app.get("/jobs")
def jobs() -> dict:
    return {"jobs": runner.list_jobs()}


@app.get("/jobs/{job_id}")
def job(job_id: str) -> dict:
    j = runner.refresh(job_id)
    if j is None:
        raise HTTPException(404, "Job not found")
    return j


@app.delete("/jobs/{job_id}")
def delete(job_id: str) -> dict:
    if not runner.delete_job(job_id):
        raise HTTPException(404, "Job not found")
    return {"deleted": job_id}
