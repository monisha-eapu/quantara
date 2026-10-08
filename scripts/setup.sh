#!/usr/bin/env bash
# One-time setup: Node dependencies + Python venv for the quantum service.
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'const [maj]=process.versions.node.split(".").map(Number); if (maj < 24) { console.error("Node >= 24 required (for native ML-DSA via OpenSSL 3.5)"); process.exit(1) }'
npm install
PY="${PYTHON:-python3}"
if [ ! -x quantum-service/.venv/bin/python ]; then "$PY" -m venv quantum-service/.venv; fi
quantum-service/.venv/bin/pip install --upgrade pip -q
quantum-service/.venv/bin/pip install -r quantum-service/requirements.txt -q
[ -f .env ] || cp .env.example .env
echo "Setup complete. Run: npm run dev"
