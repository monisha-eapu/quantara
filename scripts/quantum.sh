#!/usr/bin/env bash
# Starts the Python/Qiskit quantum service (IBM Quantum threat demonstration).
set -euo pipefail
cd "$(dirname "$0")/../quantum-service"
if [ ! -x .venv/bin/python ]; then
  echo "[quantum] Python venv missing — run: npm run setup" >&2
  exit 1
fi
export PYTHONWARNINGS="ignore::DeprecationWarning"
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "${QUANTUM_PORT:-8001}"
