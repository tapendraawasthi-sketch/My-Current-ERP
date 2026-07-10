#!/usr/bin/env bash
# NIOS nightly benchmark gate — exit 1 on failure (for cron/CI)
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -c "
from src.nios.benchmarks.nightly.runner import nightly_runner
r = nightly_runner.run_all()
print(f'NIOS nightly: {r.total_passed}/{r.total_passed + r.total_failed} passed')
if not r.ok:
    raise SystemExit(1)
"
