#!/usr/bin/env python3
"""Unit tests for sector NLU hold-out eval harness."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BOT_ROOT.parent
sys.path.insert(0, str(BOT_ROOT))

from src.eval.sector_holdout import (
    build_holdout_cases,
    compare_to_baseline,
    extract_user_input,
    is_holdout_row,
    run_sector_holdout_eval,
    score_sector_case,
)


def test_holdout_split_stable() -> None:
    assert is_holdout_row("kirana-grocery", "Ram lai 500 udhaar", 10) == is_holdout_row(
        "kirana-grocery", "Ram lai 500 udhaar", 10
    )


def test_extract_user_input_from_content() -> None:
    row = {
        "title": "Screen replace…",
        "content": "SECTOR NLU\nUser input: Screen replace garya, 2500 liyo cash ma\nIntent: x",
    }
    assert extract_user_input(row) == "Screen replace garya, 2500 liyo cash ma"


def test_build_holdout_has_cases() -> None:
    data = build_holdout_cases(holdout_pct=10)
    assert data["total"] > 100
    assert len(data["sector_counts"]) >= 10
    case = data["cases"][0]
    assert "user_input" in case
    assert "expected_policy" in case
    assert "sector_slug" in case


def test_score_sample_case() -> None:
    data = build_holdout_cases(holdout_pct=10)
    case = next(c for c in data["cases"] if c["sector_slug"] == "mobile-repair-shop")
    result = score_sector_case(case, tier="enrich")
    assert result.scores.get("retrieval_sector_top5") is True
    assert "enrich_policy" in result.scores


def test_run_eval_smoke() -> None:
    report = run_sector_holdout_eval(tier="enrich", limit=20)
    assert report["total"] == 20
    assert "pass_rate" in report
    assert report["pass_rate"] >= 0.0


def test_regression_compare() -> None:
    baseline = {
        "pass_rate": 0.8,
        "sector_stats": {
            "kirana-grocery": {"pass_rate": 0.9},
            "mobile-repair-shop": {"pass_rate": 0.85},
        },
    }
    current = {
        "pass_rate": 0.75,
        "sector_stats": {
            "kirana-grocery": {"pass_rate": 0.5},
            "mobile-repair-shop": {"pass_rate": 0.86},
        },
    }
    import json
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "baseline.json"
        path.write_text(json.dumps(baseline), encoding="utf-8")
        reg = compare_to_baseline(current, path, max_regression=0.02)
        assert reg["has_baseline"] is True
        assert reg["ok"] is False
        assert any(r["sector_slug"] == "kirana-grocery" for r in reg["regressions"])


def main() -> int:
    tests = [
        test_holdout_split_stable,
        test_extract_user_input_from_content,
        test_build_holdout_has_cases,
        test_score_sample_case,
        test_run_eval_smoke,
        test_regression_compare,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
        except Exception as exc:
            failed += 1
            print(f"ERROR {fn.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
