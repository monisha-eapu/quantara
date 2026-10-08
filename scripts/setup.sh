#!/usr/bin/env bash
# One-time setup: Node dependencies + Python venv for the quantum service.
set -euo pipefail
cd "$(dirname "$0")/.."

node -e 'const [maj]=process.versions.node.split(".").map(Number); if (maj < 24) { console.error("Node >= 24 required (for native ML-DSA via OpenSSL 3.5)"); process.exit(1) }'
npm install

# The quantum service needs Python >= 3.10. Python 3.9 (the macOS system Python) links an old LibreSSL
# that cannot complete TLS handshakes with IBM Quantum.
find_python() {
  for c in "${PYTHON:-}" python3.13 python3.12 python3.11 python3.10 python3; do
    [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 || continue
    if "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then command -v "$c"; return 0; fi
  done
  return 1
}

if [ ! -x quantum-service/.venv/bin/python ]; then
  if ! PY="$(find_python)"; then
    echo "No Python >= 3.10 found; installing Python 3.12 with uv (kept in ~/.local/share/uv)..."
    python3 -m pip install --user -q uv 2>/dev/null || python3 -m pip install -q uv
    UV="$(python3 -c 'import shutil,site,os;print(shutil.which("uv") or os.path.join(site.getuserbase(),"bin","uv"))')"
    "$UV" python install 3.12
    PY="$("$UV" python find 3.12)"
  fi
  echo "Creating quantum-service/.venv with $("$PY" --version)"
  "$PY" -m venv quantum-service/.venv
fi
quantum-service/.venv/bin/pip install --upgrade pip -q
quantum-service/.venv/bin/pip install -r quantum-service/requirements.txt -q
[ -f .env ] || cp .env.example .env
echo "Setup complete. Add IBM_QUANTUM_TOKEN to .env for hardware runs, then run: npm run dev"
