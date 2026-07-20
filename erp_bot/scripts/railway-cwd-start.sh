#!/bin/sh
# Resolve erp_bot cwd whether Railway Root Directory is `erp_bot` or repo root.
set -eu
export PORT=8080
if [ -f scripts/start_render.py ]; then
  if command -v python >/dev/null 2>&1; then
    exec python scripts/start_render.py
  fi
  exec python3 scripts/start_render.py
fi
if [ -f erp_bot/scripts/start_render.py ]; then
  cd erp_bot
  if command -v python >/dev/null 2>&1; then
    exec python scripts/start_render.py
  fi
  exec python3 scripts/start_render.py
fi
echo "[erp_bot railway-cwd-start] ERROR: cannot locate scripts/start_render.py" >&2
exit 1
