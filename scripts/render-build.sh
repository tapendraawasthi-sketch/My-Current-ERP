#!/bin/sh
# Production build for Render/Railway — avoids Rolldown WASM OOM on low-memory builders.
# Must be POSIX sh + LF endings: Railway runs `chmod +x <cmd> && sh <cmd>`.
set -eu
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
echo "[render-build] NODE_OPTIONS=$NODE_OPTIONS"
npm install
npm run build
test -f dist/index.html
echo "[render-build] dist/index.html OK"

# Optional: Python OIP deps so serve.mjs can embed erp_bot when sutra-erp-bot
# is misconfigured (SPA on private :8080).
if [ -f erp_bot/requirements.txt ]; then
  if command -v python3 >/dev/null 2>&1; then
    echo "[render-build] installing erp_bot Python deps for embed fallback..."
    python3 -m pip install -r erp_bot/requirements.txt || echo "[render-build] WARN: pip install failed (embed may be unavailable)"
  elif command -v python >/dev/null 2>&1; then
    echo "[render-build] installing erp_bot Python deps for embed fallback..."
    python -m pip install -r erp_bot/requirements.txt || echo "[render-build] WARN: pip install failed (embed may be unavailable)"
  else
    echo "[render-build] WARN: no python — Orbix embed fallback unavailable"
  fi
fi
