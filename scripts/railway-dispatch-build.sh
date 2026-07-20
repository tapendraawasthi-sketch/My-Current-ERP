#!/bin/sh
# Railway monorepo build dispatcher.
# If the service is sutra-erp-bot but Root Directory was left at repo root,
# Nixpacks would otherwise run the frontend build and ship SPA HTML on :8080.
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
  echo "[railway-dispatch-build] bot service detected (RAILWAY_SERVICE_NAME=${RAILWAY_SERVICE_NAME:-} SUTRA_SERVICE_ROLE=${SUTRA_SERVICE_ROLE:-})"
  if [ ! -f erp_bot/scripts/render-build.sh ]; then
    echo "[railway-dispatch-build] ERROR: erp_bot/scripts/render-build.sh missing (wrong Root Directory?)" >&2
    exit 1
  fi
  cd erp_bot
  exec sh scripts/render-build.sh
fi

echo "[railway-dispatch-build] frontend service (RAILWAY_SERVICE_NAME=${RAILWAY_SERVICE_NAME:-})"
exec sh scripts/render-build.sh
