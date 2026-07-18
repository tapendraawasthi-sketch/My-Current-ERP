"""Development-only R3N5 scorer.  This module cannot open holdout splits."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from .eval_mai07_r3n5_canonical_scorer import observe_case, score_observations
from .eval_mai07_r3n5_audit_scorer import (
    compare_canonical_audit,
    compare_case_observations,
    observe_case_audit,
    score_observations_audit,
)
from .mai07_r3n5_candidate_runtime import transliterate_r3n5

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n5_fresh_holdout"
DEVELOPMENT_PATH = OUT / "development.jsonl"
THRESHOLDS_PATH = OUT / "MAI_07R3N5_THRESHOLDS.json"
REPORT_PATH = OUT / "reports" / "development_score_report.json"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_R3N5_DEVELOPMENT_WRITE"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def score_development(*, write: bool = False) -> dict[str, Any]:
    cases = _load_jsonl(DEVELOPMENT_PATH)
    thresholds = json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))
    bundles = [transliterate_r3n5(case["input_text"]) for case in cases]
    observations = [observe_case(case, bundle) for case, bundle in zip(cases, bundles, strict=True)]
    audit_observations = [
        observe_case_audit(case, bundle) for case, bundle in zip(cases, bundles, strict=True)
    ]
    # A second run proves deterministic observable behavior before any lock.
    for case, first in zip(cases, observations, strict=True):
        second = observe_case(case, transliterate_r3n5(case["input_text"]))
        keys = (
            "span_found", "identity_top1", "exact_raw_identity", "exactly_one_identity",
            "finalizer_idempotence", "path_finalized", "anchor_valid",
            "devanagari_at_5", "candidate_count",
        )
        if any(first[key] != second[key] for key in keys):
            raise RuntimeError(f"nondeterministic:{case['case_id']}")
    report = score_observations(cases, observations, thresholds=thresholds, split="DEVELOPMENT")
    audit = score_observations_audit(
        cases, audit_observations, thresholds=thresholds, split="DEVELOPMENT"
    )
    agreement = compare_canonical_audit(report, audit)
    case_agreement = compare_case_observations(observations, audit_observations)
    report["audit"] = audit
    report["agreement"] = agreement
    report["case_agreement"] = case_agreement
    report["ok"] = bool(
        report.get("ok") and audit.get("ok") and agreement.get("ok") and case_agreement.get("ok")
    )
    report.update(
        {
            "phase": "MAI-07R3N5",
            "mode": "DEVELOPMENT_ONLY",
            "case_count": len(cases),
            "holdout_opened": False,
            "candidate_promoted": False,
            "MAI-07": "NEEDS_CORRECTIVE_WORK",
            "MAI-08": "NOT_STARTED",
        }
    )
    if write:
        if os.environ.get(AUTHORIZE_ENV) != "1":
            raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to write development report")
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    report = score_development(write=args.write)
    print(json.dumps({"ok": report.get("ok"), "failed_gates": report.get("failed_gates"), "case_count": report["case_count"]}, indent=2))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
