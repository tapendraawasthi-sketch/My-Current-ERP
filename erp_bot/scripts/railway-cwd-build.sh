#!/bin/sh
# Resolve erp_bot cwd whether Railway Root Directory is `erp_bot` or repo root.
set -eu
if [ -f requirements.txt ] && [ -f scripts/render-build.sh ]; then
  exec sh scripts/render-build.sh
fi
if [ -f erp_bot/requirements.txt ] && [ -f erp_bot/scripts/render-build.sh ]; then
  cd erp_bot
  exec sh scripts/render-build.sh
fi
echo "[erp_bot railway-cwd-build] ERROR: cannot locate erp_bot/scripts/render-build.sh" >&2
exit 1
