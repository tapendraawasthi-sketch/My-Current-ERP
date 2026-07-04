#!/usr/bin/env python3
"""Run e-Khata baseline evaluation on held-out test set.

Metrics (Step 9 overhaul guide):
  - Intent classification accuracy (parser mode)
  - Amount exact match
  - Party partial match
  - Question gate accuracy (pipeline mode)
  - False positive rate (pipeline mode)

Usage:
  python3 erp_bot/scripts/eval_khata.py
  python3 erp_bot/scripts/eval_khata.py --mode pipeline --verbose
  python3 erp_bot/scripts/eval_khata.py --json
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

_eval_spec = importlib.util.spec_from_file_location("khata_eval", SRC / "khata" / "eval.py")
assert _eval_spec and _eval_spec.loader
_eval_mod = importlib.util.module_from_spec(_eval_spec)
sys.modules["khata_eval"] = _eval_mod
_eval_spec.loader.exec_module(_eval_mod)

from falcon_trader import parse_khata_message  # noqa: E402

evaluate_parser = _eval_mod.evaluate_parser
load_eval_cases = _eval_mod.load_eval_cases

TARGETS = {
    "intent_accuracy": 0.92,
    "amount_accuracy": 0.95,
    "party_accuracy": 0.85,
    "question_gate_accuracy": 0.98,
    "false_positive_rate": 0.02,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="e-Khata parser evaluation")
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    parser.add_argument("--verbose", action="store_true", help="Show per-case failures")
    parser.add_argument(
        "--mode",
        choices=["parser", "pipeline"],
        default="parser",
        help="parser=direct extraction; pipeline=includes transaction signal gate",
    )
    parser.add_argument(
        "--eval-path",
        type=Path,
        default=None,
        help="Path to eval-test-set.json",
    )
    args = parser.parse_args()

    cases = load_eval_cases(args.eval_path)
    report = evaluate_parser(
        parse_khata_message,
        engine="python-rules",
        cases=cases,
        mode=args.mode,
    )

    if args.json:
        print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(f"e-Khata Eval — {report.engine}")
        print(f"Cases: {report.total} | Passed: {report.passed} | Failed: {report.failed}")
        print()
        print(f"Intent accuracy:        {report.intent_accuracy * 100:5.1f}%  (target >{TARGETS['intent_accuracy']*100:.0f}%)")
        print(f"Amount accuracy:        {report.amount_accuracy * 100:5.1f}%  (target >{TARGETS['amount_accuracy']*100:.0f}%)")
        print(f"Party accuracy:         {report.party_accuracy * 100:5.1f}%  (target >{TARGETS['party_accuracy']*100:.0f}%)")
        print(f"Question gate accuracy: {report.question_gate_accuracy * 100:5.1f}%  (target >{TARGETS['question_gate_accuracy']*100:.0f}%)")
        print(f"False positive rate:    {report.false_positive_rate * 100:5.1f}%  (target <{TARGETS['false_positive_rate']*100:.0f}%)")

        if args.verbose and report.failures:
            print("\nFailures:")
            for line in report.failures:
                print(f"  - {line}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
