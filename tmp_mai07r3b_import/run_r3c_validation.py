"""MAI-07R3C regression validation batch."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERP = ROOT / "erp_bot"
results = []


def step(name: str, argv: list[str], *, cwd: Path | None = None) -> None:
    print(f"=== {name} ===", flush=True)
    proc = subprocess.run(argv, cwd=str(cwd or ERP), capture_output=True, text=True)
    out = (proc.stdout or "") + (proc.stderr or "")
    tail = "\n".join(out.splitlines()[-18:])
    print(f"exit={proc.returncode}", flush=True)
    print(tail, flush=True)
    results.append({"name": name, "exit": proc.returncode, "tail": tail})


def main() -> int:
    py = sys.executable
    step("r3c_tests", [py, "-m", "pytest", "tests/oip/language_runtime/test_mai07_r3c_dataset_v2.py", "-q", "--tb=line"])
    step("r3b_tests", [py, "-m", "pytest", "tests/oip/language_runtime/test_mai07_r3b_import.py", "-q", "--tb=line"])
    step("r3a_tests", [py, "-m", "pytest", "tests/oip/language_runtime/test_mai07_r3a_review.py", "-q", "--tb=line"])
    step("lang_runtime", [py, "-m", "pytest", "tests/oip/language_runtime/", "-q", "--tb=no"])
    step("mai07_c1c2", [py, "-m", "pytest", "tests/oip/language_runtime/test_mai07_c2_target_metrics.py", "tests/oip/language_runtime/test_mai07_eval_metrics.py", "-q", "--tb=line"])
    step("mai07_resource", [py, "-m", "src.oip.modules.language_runtime.transliteration.infrastructure.resource_repository", "--check-twice"])
    step("schema_export", [py, "-m", "src.oip.contracts.export_schemas", "--check"])
    step("mai04_validate", [py, "-m", "src.oip.evaluation.cli", "validate", "--manifest", str(ROOT / "evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json")])
    step("mai04_tests", [py, "-m", "pytest", "tests/oip/evaluation/test_mai04_harness.py", "-q", "--tb=line"])
    step("mai05_eval", [py, "-m", "src.oip.modules.language_runtime.application.eval_mai05"])
    step("mai05_tests", [py, "-m", "pytest", "tests/oip/language_runtime/test_mai05_language_spans.py", "-q", "--tb=line"])
    step("mai06_eval", [py, "-m", "src.oip.modules.language_runtime.normalization.application.eval_mai06"])
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
    step("pytest_collect", [py, "-m", "pytest", "--collect-only", "-q"])
    step(
        "orbix_vitest",
        ["npx", "vitest", "run", "src/__tests__/orbix", "--config", "vitest.config.ts"],
        cwd=ROOT,
    )
    step(
        "node_auth",
        [
            "npx",
            "vitest",
            "run",
            "packages/backend/src/middleware/khataConfirmAuth.test.ts",
            "packages/backend/src/middleware/correlation.test.ts",
            "--config",
            "vitest.config.ts",
        ],
        cwd=ROOT,
    )
    for name, cfg in (("tsc_mai02", "tsconfig.mai02.json"), ("tsc_mai03", "tsconfig.mai03.json"), ("tsc_mai05", "tsconfig.mai05.json")):
        step(name, ["npx", "tsc", "-p", cfg, "--noEmit"], cwd=ROOT)

    out = ROOT / "tmp_mai07r3b_import" / "validation_r3c.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps([{k: r[k] for k in ("name", "exit")} for r in results], indent=2))
    # Known baseline: pytest collect reasoning_filter
    hard = [r for r in results if r["exit"] != 0 and r["name"] != "pytest_collect"]
    return 1 if hard else 0


if __name__ == "__main__":
    raise SystemExit(main())
