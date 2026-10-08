#!/usr/bin/env bash
# QuantumShield quantum AI/ML demo. Runs from anywhere; no venv activation needed.
# Usage: ./qml [--tamper] [--ibm] [--record ID] [--qubits N]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/quantum-service/.venv/bin/python"
[ -x "$PY" ] || { echo "Run 'npm run setup' first." >&2; exit 1; }
cd "$ROOT/quantum-service"
exec "$PY" -W ignore qml_demo.py "$@"
