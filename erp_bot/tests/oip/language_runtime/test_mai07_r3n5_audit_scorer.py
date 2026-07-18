from __future__ import annotations

import json

from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n5_audit_scorer import (
    compare_canonical_audit,
    compare_case_observations,
    observe_case_audit,
    score_observations_audit,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n5_canonical_scorer import (
    observe_case,
    score_observations,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n5_development import (
    DEVELOPMENT_PATH,
    THRESHOLDS_PATH,
    score_development,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n5_candidate_runtime import (
    transliterate_r3n5,
)


def _rows():
    return [json.loads(line) for line in DEVELOPMENT_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_independent_observation_agrees_on_representative_cases():
    cases = _rows()[::97]
    canonical = []
    audit = []
    for case in cases:
        bundle = transliterate_r3n5(case["input_text"])
        canonical.append(observe_case(case, bundle))
        audit.append(observe_case_audit(case, bundle))
    keys = (
        "span_found", "identity_top1", "identity_retained", "exact_raw_identity",
        "exactly_one_identity", "finalizer_idempotence", "serialization_roundtrip",
        "path_finalized", "anchor_valid", "devanagari_at_5", "candidate_count",
    )
    for first, second in zip(canonical, audit, strict=True):
        assert all(first[key] == second[key] for key in keys)


def test_independent_metric_arithmetic_agrees_on_representative_cases():
    cases = _rows()
    thresholds = json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))
    canonical_obs = []
    audit_obs = []
    for case in cases:
        bundle = transliterate_r3n5(case["input_text"])
        canonical_obs.append(observe_case(case, bundle))
        audit_obs.append(observe_case_audit(case, bundle))
    canonical = score_observations(cases, canonical_obs, thresholds=thresholds, split="DEVELOPMENT")
    audit = score_observations_audit(cases, audit_obs, thresholds=thresholds, split="DEVELOPMENT")
    assert canonical["ok"] is True
    assert audit["ok"] is True
    assert compare_canonical_audit(canonical, audit) == {"ok": True, "mismatches": []}


def test_development_report_requires_canonical_audit_agreement():
    report = score_development(write=False)
    assert report["ok"] is True
    assert report["audit"]["ok"] is True
    assert report["agreement"] == {"ok": True, "mismatches": []}
    assert report["case_agreement"] == {"ok": True, "mismatches": []}


def test_case_agreement_detects_equal_and_opposite_swaps():
    first = [
        {"case_id": "a", "identity_top1": True},
        {"case_id": "b", "identity_top1": False},
    ]
    second = [
        {"case_id": "a", "identity_top1": False},
        {"case_id": "b", "identity_top1": True},
    ]
    result = compare_case_observations(first, second)
    assert result["ok"] is False
    assert "a.identity_top1" in result["mismatches"]


def test_metric_agreement_detects_threshold_drift_even_when_both_pass():
    base = {
        "scorer_id": "canonical",
        "scorer_version": "v", "formula_version": "f", "scoring_contract_version": "c",
        "target_authority": "t",
        "metrics": {"m": {"numerator": 10, "denominator": 10, "population_id": "p", "applicability": "APPLICABLE", "value": 1.0, "threshold": 0.9, "operation": ">=", "formula_version": "f"}},
        "gates": {"m": {"outcome": "PASS", "pass": True}},
    }
    other = json.loads(json.dumps(base))
    other["scorer_id"] = "audit"
    other["metrics"]["m"]["threshold"] = 0.8
    result = compare_canonical_audit(base, other)
    assert result["ok"] is False
    assert "metric.m.threshold" in result["mismatches"]
