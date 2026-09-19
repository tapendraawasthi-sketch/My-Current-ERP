"""MAI-07R3E closeout regression validation (read-only commands)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERP = ROOT / "erp_bot"
results: list[dict] = []


def step(name: str, argv: list[str], *, cwd: Path | None = None) -> None:
    print(f"=== {name} ===", flush=True)
    proc = subprocess.run(argv, cwd=str(cwd or ERP), capture_output=True, text=True)
    out = (proc.stdout or "") + (proc.stderr or "")
    tail = "\n".join(out.splitlines()[-22:])
    print(f"exit={proc.returncode}", flush=True)
    print(tail, flush=True)
    results.append({"name": name, "exit": proc.returncode, "tail": tail})


def main() -> int:
    py = sys.executable
    step(
        "mai07_c1_c2",
        [
            py,
            "-m",
            "pytest",
            "tests/oip/language_runtime/test_mai07_c2_target_metrics.py",
            "tests/oip/language_runtime/test_mai07_eval_metrics.py",
            "-q",
            "--tb=line",
        ],
    )
    step(
        "mai04_validate",
        [
            py,
            "-m",
            "src.oip.evaluation.cli",
            "validate",
            "--manifest",
            str(ROOT / "evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json"),
        ],
    )
    out_base = ROOT / "tmp_mai07r3e" / "mai04_runs"
    out_base.mkdir(parents=True, exist_ok=True)
    step(
        "mai04_component",
        [
            py,
            "-m",
            "src.oip.evaluation.cli",
            "run",
            "--manifest",
            str(ROOT / "evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json"),
            "--mode",
            "component",
            "--output",
            str(out_base / "component"),
            "--seed",
            "0",
        ],
    )
    step(
        "mai04_pipeline",
        [
            py,
            "-m",
            "src.oip.evaluation.cli",
            "run",
            "--manifest",
            str(ROOT / "evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json"),
            "--mode",
            "pipeline_in_process",
            "--output",
            str(out_base / "pipeline"),
            "--seed",
            "0",
        ],
    )
    step("mai05_eval", [py, "-m", "src.oip.modules.language_runtime.application.eval_mai05"])
    step(
        "mai05_tests",
        [py, "-m", "pytest", "tests/oip/language_runtime/test_mai05_language_spans.py", "-q", "--tb=line"],
    )
    step(
        "mai06_eval",
        [py, "-m", "src.oip.modules.language_runtime.normalization.application.eval_mai06"],
    )
    step(
        "mai06_tests",
        [
            py,
            "-m",
            "pytest",
            "tests/oip/language_runtime/test_mai06_normalization.py",
            "tests/oip/language_runtime/test_mai06_reconstruction_integrity_closure.py",
            "tests/oip/language_runtime/test_mai06_reconstruction_closure.py",
            "-q",
            "--tb=line",
        ],
    )
    step("schema_export_check", [py, "-m", "src.oip.contracts.export_schemas", "--check"])
    step("pytest_collect_only", [py, "-m", "pytest", "tests", "--collect-only", "-q"])
    (ROOT / "tmp_mai07r3e" / "validation_results.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )
    return 0 if all(r["exit"] == 0 for r in results if r["name"] != "pytest_collect_only") else 1


if __name__ == "__main__":
    raise SystemExit(main())
