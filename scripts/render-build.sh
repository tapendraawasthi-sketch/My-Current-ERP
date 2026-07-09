#!/usr/bin/env bash
# Render production build — avoids Rolldown WASM OOM on low-memory builders.
set -euo pipefail
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
echo "[render-build] NODE_OPTIONS=$NODE_OPTIONS"
npm install
npm run build
test -f dist/index.html
echo "[render-build] dist/index.html OK"
