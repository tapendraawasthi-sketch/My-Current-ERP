#!/usr/bin/env python3
"""Sector NLU hold-out evaluation harness (Phase A — Step 4).

Builds a deterministic 10% hold-out per sector from ingested KB JSONL and scores
the v2 pipeline: sector retrieval boost + erp_action policy + enrich.

Usage:
    python erp_bot/scripts/eval_sector_nlu_holdout.py --build
    python erp_bot/scripts/eval_sector_nlu_holdout.py --tier enrich
    python erp_bot/scripts/eval_sector_nlu_holdout.py --tier enrich --sector mobile-repair-shop
    python erp_bot/scripts/eval_sector_nlu_holdout.py --save-baseline
    python erp_bot/scripts/eval_sector_nlu_holdout.py --compare-baseline
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BOT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BOT_ROOT.parent
sys.path.insert(0, str(BOT_ROOT))

from src.eval.sector_holdout import (  # noqa: E402
    compare_to_baseline,
    load_holdout,
    run_sector_holdout_eval,
    save_holdout,
)

HOLDOUT_PATH = REPO_ROOT / "data" / "ekhata" / "sector-nlu-holdout.json"
REPORT_PATH = BOT_ROOT / "data" / "sector_nlu_eval_report.json"
BASELINE_PATH = BOT_ROOT / "data" / "sector_nlu_eval_baseline.json"


def _print_summary(report: dict, regression: dict) -> None:
    print("=" * 72)
    print(
        f"Sector NLU hold-out — tier={report['tier']} | "
        f"{report['passed']}/{report['total']} passed ({report['pass_rate']:.1%})"
    )
    if regression.get("has_baseline"):
        print(
            f"  vs baseline: {regression['baseline_pass_rate']:.1%} → "
            f"{regression['current_pass_rate']:.1%} "
            f"(Δ {regression['overall_delta']:+.1%})"
        )
    print("=" * 72)
    for slug, st in sorted(report.get("sector_stats", {}).items()):
        print(f"  {slug:40s} {st['passed']:3d}/{st['total']:3d}  ({st['pass_rate']:.1%})")
    print("=" * 72)
    if regression.get("regressions"):
        print(f"Regressions ({len(regression['regressions'])}):")
        for r in regression["regressions"][:10]:
            print(
                f"  {r['sector_slug']}: {r['baseline_pass_rate']:.1%} → "
                f"{r['current_pass_rate']:.1%} ({r['delta']:+.1%})"
            )
        print()
    fails = report.get("failures") or []
    if fails:
        print(f"First {min(5, len(fails))} failures:")
        for f in fails[:5]:
            print(f"  [{f['id']}] {f['input'][:55]}")
            if f.get("notes"):
                print(f"    → {f['notes'][0]}")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sector NLU hold-out eval harness")
    parser.add_argument("--build", action="store_true", help="Build sector-nlu-holdout.json")
    parser.add_argument("--holdout-pct", type=int, default=10, help="Hold-out percent per sector")
    parser.add_argument("--tier", choices=["enrich", "parse"], default="enrich")
    parser.add_argument("--sector", type=str, default="", help="Comma-separated sector slugs")
    parser.add_argument("--limit", type=int, default=0, help="Max cases (0=all)")
    parser.add_argument("--report", type=str, default=str(REPORT_PATH), help="JSON report path")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--save-baseline", action="store_true", help="Save report as baseline")
    parser.add_argument(
        "--compare-baseline",
        action="store_true",
        help="Fail if per-sector pass rate drops >2%% vs baseline",
    )
    parser.add_argument(
        "--max-regression",
        type=float,
        default=0.02,
        help="Max allowed pass-rate drop per sector vs baseline",
    )
    args = parser.parse_args()

    if args.build:
        path = save_holdout(HOLDOUT_PATH, holdout_pct=args.holdout_pct)
        data = load_holdout(path)
        print(f"Built {data['total']} hold-out cases → {path}")
        for slug, n in sorted(data.get("sector_counts", {}).items()):
            print(f"  {slug}: {n}")
        return 0

    sectors = {s.strip() for s in args.sector.split(",") if s.strip()} or None
    limit = args.limit or None

    report = run_sector_holdout_eval(
        tier=args.tier,
        holdout_path=HOLDOUT_PATH,
        limit=limit,
        sectors=sectors,
        verbose=args.verbose,
    )
    report["run_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report → {report_path}")

    regression = compare_to_baseline(
        report, BASELINE_PATH, max_regression=args.max_regression
    )
    report["regression"] = regression

    if args.save_baseline:
        BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
        BASELINE_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Baseline saved → {BASELINE_PATH}")

    _print_summary(report, regression)

    if args.compare_baseline and regression.get("has_baseline") and not regression.get("ok"):
        return 1
    if report["passed"] != report["total"] and args.compare_baseline and not args.save_baseline:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
