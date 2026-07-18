"""Development-only R3N6 scorer; holdout splits are never opened here."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from .eval_mai07_r3n6_audit_scorer import (
    compare_canonical_audit,
    compare_case_observations,
    observe_case_audit,
    score_observations_audit,
)
from .eval_mai07_r3n6_canonical_scorer import observe_case, score_observations
from .mai07_r3n6_candidate_runtime import transliterate_r3n6
from .r3n6_scoring_contracts import observation_persistence_status

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n6_fresh_holdout"
DEVELOPMENT_PATH = OUT / "development.jsonl"
THRESHOLDS_PATH = OUT / "MAI_07R3N6_THRESHOLDS.json"
REPORT_PATH = OUT / "reports" / "development_score_report.json"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_R3N6_DEVELOPMENT_WRITE"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _expected_metric_passes(report: dict[str, Any], case_count: int) -> bool:
    metric = report.get("metrics", {}).get("split_expected_pass", {})
    return bool(
        metric.get("numerator") == case_count
        and metric.get("denominator") == case_count
    )


def _write_same_or_new(path: Path, payload: dict[str, Any]) -> None:
    encoded = (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    if path.exists():
        if path.read_bytes() != encoded:
            raise FileExistsError(
                f"refusing_to_replace_different_r3n6_development_report:{path}"
            )
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)


def score_development(*, write: bool = False) -> dict[str, Any]:
    cases = _load_jsonl(DEVELOPMENT_PATH)
    thresholds = json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))
    bundles = [transliterate_r3n6(case["input_text"]) for case in cases]
    observations = [
        observe_case(case, bundle)
        for case, bundle in zip(cases, bundles, strict=True)
    ]
    audit_observations = [
        observe_case_audit(case, bundle)
        for case, bundle in zip(cases, bundles, strict=True)
    ]
    for case, first in zip(cases, observations, strict=True):
        second = observe_case(case, transliterate_r3n6(case["input_text"]))
        keys = (
            "populations",
            "expected_behavior",
            "target_contract_valid",
            "runtime_contract_valid",
            "span_found",
            "identity_top1",
            "exact_raw_identity",
            "exactly_one_identity",
            "finalizer_idempotence",
            "path_finalized",
            "anchor_valid",
            "devanagari_at_5",
            "candidate_count",
        )
        if any(first.get(key) != second.get(key) for key in keys):
            raise RuntimeError(f"nondeterministic:{case['case_id']}")
    canonical = score_observations(
        cases, observations, thresholds=thresholds, split="DEVELOPMENT"
    )
    audit = score_observations_audit(
        cases, audit_observations, thresholds=thresholds, split="DEVELOPMENT"
    )
    agreement = compare_canonical_audit(canonical, audit)
    persisted_canonical = canonical.get("observations")
    persisted_audit = audit.get("observations")
    case_agreement = compare_case_observations(
        persisted_canonical if isinstance(persisted_canonical, list) else [],
        persisted_audit if isinstance(persisted_audit, list) else [],
    )
    observation_persistence = observation_persistence_status(
        cases, persisted_canonical, persisted_audit
    )
    expected_pass = bool(
        _expected_metric_passes(canonical, len(cases))
        and _expected_metric_passes(audit, len(cases))
    )
    report: dict[str, Any] = {
        "phase": "MAI-07R3N6",
        "mode": "DEVELOPMENT_ONLY",
        "case_count": len(cases),
        "canonical": canonical,
        "audit": audit,
        "agreement": agreement,
        "case_agreement": case_agreement,
        "observation_persistence": observation_persistence,
        "split_expected_pass": expected_pass,
        "holdout_opened": False,
        "candidate_promoted": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
    }
    report["ok"] = bool(
        canonical.get("ok")
        and audit.get("ok")
        and agreement.get("ok")
        and case_agreement.get("ok")
        and observation_persistence.get("ok")
        and expected_pass
    )
    if write:
        if os.environ.get(AUTHORIZE_ENV) != "1":
            raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to write development report")
        _write_same_or_new(REPORT_PATH, report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    report = score_development(write=args.write)
    print(
        json.dumps(
            {
                "ok": report.get("ok"),
                "case_count": report["case_count"],
                "split_expected_pass": report["split_expected_pass"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
