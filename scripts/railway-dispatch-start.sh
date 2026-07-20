#!/bin/sh
# Railway monorepo start dispatcher.
# Bot services must run Python OIP (erp_bot), never Node serve.mjs.
# Must be POSIX sh + LF endings: Railway runs `chmod +x <cmd> && sh <cmd>`.
set -eu

svc=$(printf '%s' "${RAILWAY_SERVICE_NAME:-}" | tr '[:upper:]' '[:lower:]')
role=$(printf '%s' "${SUTRA_SERVICE_ROLE:-}" | tr '[:upper:]' '[:lower:]')

is_bot=0
case "$role" in
  bot|erp-bot|sutra-erp-bot) is_bot=1 ;;
esac
case "$svc" in
  *erp-bot*|*erp_bot*|*-bot|bot-*) is_bot=1 ;;
esac

if [ "$is_bot" -eq 1 ]; then
  echo "[railway-dispatch-start] bot service detected — starting Python OIP"
  if [ ! -f erp_bot/scripts/start_render.py ]; then
    echo "[railway-dispatch-start] ERROR: erp_bot/scripts/start_render.py missing" >&2
    exit 1
  fi
  cd erp_bot
  # Pin 8080 so private DNS ERP_BOT_BACKEND_URL can use :8080 reliably.
  export PORT=8080
  if command -v python >/dev/null 2>&1; then
    exec python scripts/start_render.py
  fi
  if command -v python3 >/dev/null 2>&1; then
    exec python3 scripts/start_render.py
  fi
  echo "[railway-dispatch-start] ERROR: python/python3 not found in PATH" >&2
  exit 1
fi

echo "[railway-dispatch-start] frontend service — starting Node serve.mjs"
exec npm start
