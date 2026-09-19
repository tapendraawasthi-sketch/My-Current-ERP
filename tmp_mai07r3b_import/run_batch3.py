"""Validation batch 3 — MAI-05/06 + prer1 semantic evidence."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERP = ROOT / "erp_bot"
results = []


def step(name: str, argv: list[str]) -> None:
    print(f"=== {name} ===", flush=True)
    proc = subprocess.run(argv, cwd=str(ERP), capture_output=True, text=True)
    out = (proc.stdout or "") + (proc.stderr or "")
    tail = "\n".join(out.splitlines()[-25:])
    print(f"exit={proc.returncode}", flush=True)
    print(tail, flush=True)
    results.append({"name": name, "exit": proc.returncode, "tail": tail})


def main() -> int:
    py = sys.executable
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
            "tests/oip/language_runtime/test_mai06_resources.py",
            "-q",
            "--tb=line",
        ],
    )
    step(
        "mai07_semantic_prer1",
        [
            py,
            "-c",
            (
                "from pathlib import Path;"
                "from src.oip.modules.language_runtime.transliteration.infrastructure import resource_repository as xlrr;"
                "from src.oip.modules.language_runtime.transliteration.application.eval_mai07 import load_cases;"
                "from src.oip.modules.language_runtime.transliteration.application.eval_mai07_engine import evaluate_mai07;"
                "from src.oip.modules.language_runtime.transliteration.application.eval_metric_definitions import ("
                "FROZEN_RUNTIME_SEMANTIC_HASH,FROZEN_RESOURCE_HASH);"
                f"REPO=Path(r'{ROOT}');"
                "xlrr.load_resources(force_reload=True);"
                "h=xlrr.compute_pack_content_hash();"
                "r=evaluate_mai07(load_cases(REPO/'evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json', REPO));"
                "print({'resource':h,'resource_ok':h==FROZEN_RESOURCE_HASH,"
                "'semantic':r['runtime_output_semantic_hash'],"
                "'semantic_ok':r['runtime_output_semantic_hash']==FROZEN_RUNTIME_SEMANTIC_HASH,"
                "'top1':r['target_candidate_population']['target_candidate_top1_accuracy']['numerator']})"
            ),
        ],
    )
    out_path = ROOT / "tmp_mai07r3b_import" / "validation_batch3.json"
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps([{k: r[k] for k in ("name", "exit")} for r in results], indent=2))
    return 0 if all(r["exit"] == 0 for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
