"""Nightly benchmark runner."""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .suites import ALL_SUITES, BenchmarkResult, BenchmarkSuite
from .nepal_ai_loader import NEPAL_AI_SUITES
from .ocr_golden import OCR_SUITE
from .model_swap import MODEL_SWAP_SUITE

ALL_SUITES_WITH_NEPAL_AI: list[BenchmarkSuite] = ALL_SUITES + NEPAL_AI_SUITES + [OCR_SUITE, MODEL_SWAP_SUITE]


@dataclass
class NightlyReport:
    run_id: str
    started_at: str
    completed_at: str
    suites: list[BenchmarkResult] = field(default_factory=list)
    total_passed: int = 0
    total_failed: int = 0
    regression: bool = False

    @property
    def ok(self) -> bool:
        return self.total_failed == 0 and not self.regression


class NightlyBenchmarkRunner:
    def __init__(self, results_dir: Path | None = None) -> None:
        root = Path(os.getenv("NIOS_DATA_DIR", "data"))
        self.results_dir = results_dir or root / "benchmarks"
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def run_suite(self, suite: BenchmarkSuite) -> BenchmarkResult:
        t0 = time.perf_counter()
        passed = 0
        failed = 0
        failures: list[dict[str, Any]] = []

        for case in suite.cases:
            try:
                ok = suite.runner(case)
            except Exception as exc:
                ok = False
                failures.append({"case_id": case.id, "error": str(exc)})
            if ok:
                passed += 1
            else:
                failed += 1
                if not any(f.get("case_id") == case.id for f in failures):
                    failures.append({"case_id": case.id, "expected": case.expected, "input": case.input})

        return BenchmarkResult(
            suite_id=suite.id,
            passed=passed,
            failed=failed,
            total=len(suite.cases),
            failures=failures,
            duration_ms=round((time.perf_counter() - t0) * 1000, 2),
        )

    def run_all(self) -> NightlyReport:
        started = datetime.now(timezone.utc)
        run_id = started.strftime("%Y%m%d_%H%M%S")
        results: list[BenchmarkResult] = []

        for suite in ALL_SUITES_WITH_NEPAL_AI:
            results.append(self.run_suite(suite))

        completed = datetime.now(timezone.utc)
        report = NightlyReport(
            run_id=run_id,
            started_at=started.isoformat(),
            completed_at=completed.isoformat(),
            suites=results,
            total_passed=sum(r.passed for r in results),
            total_failed=sum(r.failed for r in results),
        )

        prev = self._load_previous()
        if prev and report.total_failed > prev.get("total_failed", 0):
            report.regression = True

        self._save_report(report)
        return report

    def _report_path(self, run_id: str) -> Path:
        return self.results_dir / f"nightly_{run_id}.json"

    def _latest_path(self) -> Path:
        return self.results_dir / "nightly_latest.json"

    def _save_report(self, report: NightlyReport) -> None:
        payload = {
            "run_id": report.run_id,
            "started_at": report.started_at,
            "completed_at": report.completed_at,
            "total_passed": report.total_passed,
            "total_failed": report.total_failed,
            "regression": report.regression,
            "ok": report.ok,
            "suites": [asdict(s) for s in report.suites],
        }
        self._report_path(report.run_id).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self._latest_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _load_previous(self) -> dict | None:
        path = self._latest_path()
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def latest(self) -> dict | None:
        return self._load_previous()


nightly_runner = NightlyBenchmarkRunner()
