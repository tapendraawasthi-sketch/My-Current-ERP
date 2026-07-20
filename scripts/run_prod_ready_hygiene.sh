#!/usr/bin/env bash
# PR-B6 / ADR_0089 — launch-critical hygiene substitute (no vacuous greens).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== PR-B6 honesty pytest pack =="
npm run test:prod-ready-honesty

echo ""
echo "== PR-B6 Orbix vitest pack =="
npm run test:prod-ready-orbix

if [[ "${RUN_PLAYWRIGHT_LAUNCH_SLICE:-}" == "1" ]]; then
  echo ""
  echo "== Playwright launch slice (optional) =="
  npm run test:e2e:orbix-launch-slice
else
  echo ""
  echo "== Playwright launch slice SKIPPED (set RUN_PLAYWRIGHT_LAUNCH_SLICE=1 to enable) =="
fi

echo ""
echo "PR-B6 hygiene pack: PASSED"
