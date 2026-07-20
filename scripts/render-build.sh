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
