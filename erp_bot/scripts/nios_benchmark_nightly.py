#!/usr/bin/env python3
"""NIOS nightly benchmark runner — Phase 5."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BOT_ROOT))

from src.nios.benchmarks.nightly.runner import nightly_runner  # noqa: E402


def main() -> int:
    report = nightly_runner.run_all()
    print(f"Run {report.run_id}: passed={report.total_passed} failed={report.total_failed} regression={report.regression}")
    for suite in report.suites:
        status = "OK" if suite.failed == 0 else "FAIL"
        print(f"  [{status}] {suite.suite_id}: {suite.passed}/{suite.total} ({suite.duration_ms}ms)")
        for f in suite.failures:
            print(f"    - {f}")
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
