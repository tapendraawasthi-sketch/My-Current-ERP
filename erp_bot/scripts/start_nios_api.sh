#!/usr/bin/env bash
# Lightweight NIOS API server (no Ollama warmup required)
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-../.venv/bin/python}"
if [ ! -x "$PY" ]; then PY=python3; fi

# Ensure deps
"$PY" -m pip install -q -r requirements.txt 2>/dev/null || true

export NIOS_PLATFORM_V3=true
echo "[NIOS] Starting API on :8765 (NIOS at /nios/v1)"
exec "$PY" -c "
import sys; sys.path.insert(0, '.')
import src.config
import uvicorn
from src.api.server import app
uvicorn.run(app, host='0.0.0.0', port=8765)
"
