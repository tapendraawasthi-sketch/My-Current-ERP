from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application import (
    eval_mai07_r3n6_audit_scorer as audit_scorer_module,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application import (
    eval_mai07_r3n6_canonical_scorer as canonical_scorer_module,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application import (
    eval_mai07_r3n6_development as development_module,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n6_audit_scorer import (
    compare_canonical_audit,
    compare_case_observations,
    observe_case_audit,
    score_observations_audit,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n6_canonical_scorer import (
    observe_case,
    score_observations,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n6_scoring_contracts import (
    ALLOWED_EXPECTED_BEHAVIORS,
    CONTRACT_VERSION,
    FORMULA_VERSION,
    REQUIRED_GATE_SPEC,
    REQUIRED_METRIC_KEYS,
    REQUIRED_REPORT_GATE_KEYS,
    SCORER_VERSION,
    ScoringContractError,
    observation_persistence_status,
)


def _observation() -> dict:
    return {
        "case_id": "case-1",
        "populations": ["ENGLISH_IDENTITY_REQUIRED"],
        "expected_behavior": "IDENTITY_TOP1",
        "target_contract_valid": True,
        "runtime_contract_valid": True,
        "span_found": True,
        "identity_top1": True,
        "identity_retained": True,
        "exact_raw_identity": True,
        "exactly_one_identity": True,
        "finalizer_idempotence": True,
        "serialization_roundtrip": True,
        "path_finalized": True,
        "anchor_valid": True,
        "false_devanagari_top1": False,
        "devanagari_at_5": False,
        "raw_text_unchanged": True,
        "caps_ok": True,
        "candidate_count": 1,
    }


def _thresholds() -> dict:
    return {"gates": copy.deepcopy(REQUIRED_GATE_SPEC)}


def test_source_locked_gate_spec_matches_canonical_r3n6_threshold_file():
    repo = Path(__file__).resolve().parents[4]
    threshold_path = (
        repo
        / "evals"
        / "mai07_r3n6_fresh_holdout"
        / "MAI_07R3N6_THRESHOLDS.json"
    )
    thresholds = json.loads(threshold_path.read_text(encoding="utf-8"))
    assert thresholds["gates"] == REQUIRED_GATE_SPEC


def _reports() -> tuple[dict, dict]:
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    canonical_observations = [_observation()]
    audit_observations = [copy.deepcopy(canonical_observations[0])]
    canonical = score_observations(
        cases,
        canonical_observations,
        thresholds=_thresholds(),
        split="SAFETY_CHALLENGE",
    )
    audit = score_observations_audit(
        cases,
        audit_observations,
        thresholds=_thresholds(),
        split="SAFETY_CHALLENGE",
    )
    return canonical, audit


def test_complete_reports_agree_and_every_nested_row_is_r3n6_bound():
    canonical, audit = _reports()
    assert compare_canonical_audit(canonical, audit) == {
        "ok": True,
        "mismatches": [],
    }
    for report in (canonical, audit):
        assert report["scorer_version"] == SCORER_VERSION
        assert report["formula_version"] == FORMULA_VERSION
        assert report["scoring_contract_version"] == CONTRACT_VERSION
        assert "split_expected_pass" in report["metrics"]
        for metric in report["metrics"].values():
            assert metric["scorer_version"] == SCORER_VERSION
            assert metric["formula_version"] == FORMULA_VERSION
            assert metric["scoring_contract_version"] == CONTRACT_VERSION
        for gate in report["gates"].values():
            assert gate["scorer_version"] == SCORER_VERSION
            assert gate["formula_version"] == FORMULA_VERSION
            assert gate["scoring_contract_version"] == CONTRACT_VERSION
            assert gate["metric"]["scorer_version"] == SCORER_VERSION
            assert gate["metric"]["formula_version"] == FORMULA_VERSION
            assert (
                gate["metric"]["scoring_contract_version"]
                == CONTRACT_VERSION
            )


def test_comparator_detects_scorer_metadata_drift():
    canonical, audit = _reports()
    audit["metrics"]["english_identity_top1"]["scorer_version"] = (
        "mai-07-r3n5.scorer.1.0.0"
    )
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    assert (
        "audit.metric.english_identity_top1.scorer_version"
        in result["mismatches"]
    )
    assert (
        "metric.english_identity_top1.scorer_version"
        in result["mismatches"]
    )


def test_case_comparator_detects_expected_behavior_drift():
    canonical = [_observation()]
    audit = [copy.deepcopy(canonical[0])]
    audit[0]["expected_behavior"] = "IDENTITY_RETAINED"
    result = compare_case_observations(canonical, audit)
    assert result["ok"] is False
    assert "case-1.expected_behavior" in result["mismatches"]


def test_report_comparator_detects_missing_metric():
    canonical, audit = _reports()
    del audit["metrics"]["split_expected_pass"]
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    assert "metric_keyset" in result["mismatches"]
    assert "metric.split_expected_pass.missing" in result["mismatches"]


def test_case_comparator_detects_populations_mismatch():
    canonical = [_observation()]
    audit = [copy.deepcopy(canonical[0])]
    audit[0]["populations"] = ["ROMANIZED_NEPALI_REQUIRED"]
    result = compare_case_observations(canonical, audit)
    assert result["ok"] is False
    assert "case-1.populations" in result["mismatches"]


def test_audit_report_persists_the_observations_it_scored():
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    observations = [_observation()]
    report = score_observations_audit(
        cases,
        observations,
        thresholds=_thresholds(),
        split="SAFETY_CHALLENGE",
    )
    assert report["observations"] == observations
    assert report["observations"] is observations


def test_split_expected_pass_is_independent_and_compared():
    canonical, audit = _reports()
    assert canonical["metrics"]["split_expected_pass"]["numerator"] == 1
    assert audit["metrics"]["split_expected_pass"]["numerator"] == 1
    audit["metrics"]["split_expected_pass"]["numerator"] = 0
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    assert (
        "metric.split_expected_pass.numerator" in result["mismatches"]
    )


def test_wrong_runtime_fails_closed_in_both_observers():
    raw = "Alpha"
    case = {
        "case_id": "wrong-runtime",
        "input_text": raw,
        "highlighted_span": raw,
        "populations": ["ENGLISH_IDENTITY_REQUIRED"],
        "expected_behavior": "IDENTITY_TOP1",
        "target_schema_version": "mai07_r3n5_target_span_v1",
        "target_offset_unit": "UNICODE_CODE_POINT",
        "target_start": 0,
        "target_end_exclusive": len(raw),
        "target_raw_surface": raw,
        "target_raw_surface_sha256": hashlib.sha256(
            raw.encode("utf-8")
        ).hexdigest(),
        "target_source_text_sha256": hashlib.sha256(
            raw.encode("utf-8")
        ).hexdigest(),
    }
    bundle = SimpleNamespace(
        runtime_version="mai-07.1.10-r3n5-targetspan",
        span_results=(),
    )
    canonical = observe_case(case, bundle)
    audit = observe_case_audit(case, bundle)
    assert canonical["runtime_contract_valid"] is False
    assert audit["runtime_contract_valid"] is False
    assert canonical["span_found"] is False
    assert audit["span_found"] is False
    assert canonical["caps_ok"] is False
    assert audit["caps_ok"] is False
    assert compare_case_observations([canonical], [audit])["ok"] is True


def test_expected_behavior_vocabulary_is_explicit_and_unknown_fails_closed():
    assert ALLOWED_EXPECTED_BEHAVIORS == {
        "ACRONYM_IDENTITY_TOP1",
        "CAP_OK",
        "IDENTITY_RETAINED",
        "IDENTITY_TOP1",
        "NO_RAW_MUTATION",
        "PROTECTED_IDENTITY",
        "ROMANIZED_SCRIPT_AT_5",
        "SHARED_CONSERVATIVE",
    }
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "MISSPELLED_FUTURE_BEHAVIOR",
        }
    ]
    observation = _observation()
    observation["expected_behavior"] = "MISSPELLED_FUTURE_BEHAVIOR"
    canonical = score_observations(
        cases,
        [observation],
        thresholds=_thresholds(),
        split="SAFETY_CHALLENGE",
    )
    audit = score_observations_audit(
        cases,
        [copy.deepcopy(observation)],
        thresholds=_thresholds(),
        split="SAFETY_CHALLENGE",
    )
    for report in (canonical, audit):
        metric = report["metrics"]["split_expected_pass"]
        assert metric["numerator"] == 0
        assert metric["denominator"] == 1
        assert metric["value"] == 0.0


def test_complete_report_keysets_are_authoritative():
    canonical, audit = _reports()
    for report in (canonical, audit):
        assert set(report["metrics"]) == set(REQUIRED_METRIC_KEYS)
        assert set(report["gates"]) == set(REQUIRED_REPORT_GATE_KEYS)


@pytest.mark.parametrize(
    ("module", "scorer"),
    [
        (canonical_scorer_module, score_observations),
        (audit_scorer_module, score_observations_audit),
    ],
)
def test_each_score_path_rejects_incomplete_inherited_report(
    monkeypatch,
    module,
    scorer,
):
    inherited_name = (
        "_score_observations_r3n4"
        if module is canonical_scorer_module
        else "_score_observations_audit_r3n4"
    )
    monkeypatch.setattr(
        module,
        inherited_name,
        lambda *args, **kwargs: {
            "metrics": {},
            "gates": {},
            "ok": True,
            "failed_gates": [],
        },
    )
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    with pytest.raises(
        ScoringContractError, match="r3n6_report_structure_invalid"
    ):
        scorer(
            cases,
            [_observation()],
            thresholds=_thresholds(),
            split="SAFETY_CHALLENGE",
        )


def test_comparator_rejects_metric_missing_from_both_reports():
    canonical, audit = _reports()
    del canonical["metrics"]["split_expected_pass"]
    del audit["metrics"]["split_expected_pass"]
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    assert "canonical.metrics.required_keyset" in result["mismatches"]
    assert "audit.metrics.required_keyset" in result["mismatches"]


def test_comparator_rejects_gate_missing_from_both_reports():
    canonical, audit = _reports()
    del canonical["gates"]["english_identity_top1"]
    del audit["gates"]["english_identity_top1"]
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    assert "canonical.gates.required_keyset" in result["mismatches"]
    assert "audit.gates.required_keyset" in result["mismatches"]


@pytest.mark.parametrize(
    "scorer",
    [score_observations, score_observations_audit],
)
def test_empty_threshold_gates_fail_closed(scorer):
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    with pytest.raises(
        ScoringContractError, match="r3n6_threshold_gate_keyset_mismatch"
    ):
        scorer(
            cases,
            [_observation()],
            thresholds={"gates": {}},
            split="SAFETY_CHALLENGE",
        )


@pytest.mark.parametrize(
    "scorer",
    [score_observations, score_observations_audit],
)
def test_wrong_threshold_gate_spec_fails_closed(scorer):
    thresholds = _thresholds()
    thresholds["gates"]["english_identity_top1"]["value"] = 0.97
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    with pytest.raises(
        ScoringContractError,
        match="r3n6_threshold_gate_value_mismatch:english_identity_top1",
    ):
        scorer(
            cases,
            [_observation()],
            thresholds=thresholds,
            split="SAFETY_CHALLENGE",
        )


def test_comparator_rejects_symmetric_report_threshold_drift():
    canonical, audit = _reports()
    for report in (canonical, audit):
        report["metrics"]["english_identity_top1"]["threshold"] = 0.97
        report["gates"]["english_identity_top1"]["metric"][
            "threshold"
        ] = 0.97
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    assert (
        "canonical.metric.english_identity_top1.threshold"
        in result["mismatches"]
    )
    assert (
        "audit.metric.english_identity_top1.threshold"
        in result["mismatches"]
    )


@pytest.mark.parametrize("scorer", [score_observations, score_observations_audit])
@pytest.mark.parametrize("observations", [[], [_observation(), _observation()]])
def test_scorers_reject_missing_or_duplicate_observations(
    scorer,
    observations,
):
    cases = [
        {
            "case_id": "case-1",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    with pytest.raises(
        ScoringContractError,
        match="r3n6_(canonical|audit)_observation_bijection_invalid",
    ):
        scorer(
            cases,
            copy.deepcopy(observations),
            thresholds=_thresholds(),
            split="SAFETY_CHALLENGE",
        )


@pytest.mark.parametrize("mutation", ["missing", "duplicate"])
def test_report_comparator_rejects_missing_or_duplicate_audit_evidence(
    mutation,
):
    canonical, audit = _reports()
    if mutation == "missing":
        audit["observations"] = []
    else:
        audit["observations"].append(copy.deepcopy(audit["observations"][0]))
    result = compare_canonical_audit(canonical, audit)
    assert result["ok"] is False
    if mutation == "missing":
        assert "audit.observations.count" in result["mismatches"]
    else:
        assert "audit.observations.case_id.duplicate" in result["mismatches"]


def test_observation_persistence_requires_exact_case_bijection():
    cases = [{"case_id": "case-1"}, {"case_id": "case-2"}]
    canonical = [{"case_id": "case-1"}, {"case_id": "case-2"}]
    audit = [{"case_id": "case-1"}, {"case_id": "case-1"}]
    status = observation_persistence_status(cases, canonical, audit)
    assert status["ok"] is False
    assert "audit_observations.case_id.duplicate" in status["mismatches"]
    assert "audit_observations.case_id_bijection" in status["mismatches"]


def test_development_ok_requires_persisted_observation_predicate(
    monkeypatch,
    tmp_path,
):
    cases = [
        {
            "case_id": "case-1",
            "input_text": "Alpha",
            "populations": ["ENGLISH_IDENTITY_REQUIRED"],
            "expected_behavior": "IDENTITY_TOP1",
        }
    ]
    observation = _observation()
    threshold_path = tmp_path / "thresholds.json"
    threshold_path.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(development_module, "THRESHOLDS_PATH", threshold_path)
    monkeypatch.setattr(development_module, "_load_jsonl", lambda path: cases)
    monkeypatch.setattr(
        development_module, "transliterate_r3n6", lambda raw: object()
    )
    monkeypatch.setattr(
        development_module,
        "observe_case",
        lambda case, bundle: copy.deepcopy(observation),
    )
    monkeypatch.setattr(
        development_module,
        "observe_case_audit",
        lambda case, bundle: copy.deepcopy(observation),
    )

    expected_metric = {"numerator": 1, "denominator": 1}
    monkeypatch.setattr(
        development_module,
        "score_observations",
        lambda *args, **kwargs: {
            "ok": True,
            "metrics": {"split_expected_pass": expected_metric},
            "observations": [copy.deepcopy(observation)],
        },
    )
    monkeypatch.setattr(
        development_module,
        "score_observations_audit",
        lambda *args, **kwargs: {
            "ok": True,
            "metrics": {"split_expected_pass": expected_metric},
            "observations": [],
        },
    )
    monkeypatch.setattr(
        development_module,
        "compare_canonical_audit",
        lambda canonical, audit: {"ok": True, "mismatches": []},
    )
    monkeypatch.setattr(
        development_module,
        "compare_case_observations",
        lambda canonical, audit: {"ok": True, "mismatches": []},
    )

    report = development_module.score_development()
    assert report["observation_persistence"]["ok"] is False
    assert report["ok"] is False
