"""MAI-04 frozen evaluation harness tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.oip.evaluation.case_loader import (
    load_cases_from_manifest,
    load_jsonl_cases,
    normalize_text_for_dup,
    validate_cases,
    validate_manifest_and_cases,
)
from src.oip.evaluation.contracts import (
    EvalCaseV1,
    EvalInputV1,
    EvalMode,
    ExpectedBehaviorV1,
    InteractionMode,
    LanguageForm,
    ProhibitedBehaviorV1,
    ReviewStatus,
    ScriptMix,
    Severity,
    Split,
    TrustedTestScopeV1,
    content_hash_case,
)
from src.oip.evaluation.pipeline_adapter import execute_case
from src.oip.evaluation.runner import run_evaluation
from src.oip.evaluation.safety_guard import EvaluationSafetyGuard, reset_guard
from src.oip.evaluation.scorers import aggregate_scorer_results, classification_report, score_safety

REPO = Path(__file__).resolve().parents[4]
MANIFEST = REPO / "evals" / "mai04" / "manifests" / "MAI_04_FROZEN_V1.manifest.json"


def _minimal_case(**overrides) -> EvalCaseV1:
    data = dict(
        case_id="mai04_test__minimal_01",
        suite_id="unit_test",
        title="minimal",
        input=EvalInputV1(user_text="hello"),
        mode=InteractionMode.ASK,
        expected=ExpectedBehaviorV1(expected_mutation_count=0),
        prohibited=ProhibitedBehaviorV1(forbidden_mutations=True, critical=True),
        severity=Severity.LOW,
        language_form=LanguageForm.ENGLISH,
        script_mix=ScriptMix.LATIN,
        review_status=ReviewStatus.ENGINEERING_REVIEWED,
        scenario_group_id="unit_minimal",
        split=Split.FROZEN,
        prohibited_for_training=True,
        trusted_test_scope=TrustedTestScopeV1(),
    )
    data.update(overrides)
    case = EvalCaseV1(**data)
    return case.model_copy(update={"content_hash": content_hash_case(case)})


def test_manifest_exists_and_has_200_plus():
    assert MANIFEST.exists()
    cases = load_cases_from_manifest(MANIFEST, repo_root=REPO)
    assert len(cases) >= 200
    suites = {c.suite_id for c in cases}
    for required in {
        "critical_incidents_v1",
        "multilingual_v1",
        "number_roles_v1",
        "accounting_events_v1",
        "context_turn_relation_v1",
        "safety_constitution_v1",
        "knowledge_no_answer_v1",
        "response_contract_v1",
    }:
        assert required in suites
    langs = {c.language_form for c in cases}
    assert LanguageForm.ENGLISH in langs
    assert LanguageForm.DEVANAGARI_NEPALI in langs
    assert LanguageForm.ROMANIZED_NEPALI in langs
    assert LanguageForm.CODE_MIXED in langs
    assert all(c.prohibited_for_training for c in cases if c.split == Split.FROZEN)


def test_validate_ok():
    report = validate_manifest_and_cases(MANIFEST, repo_root=REPO)
    assert report.ok, report.errors[:10]


def test_duplicate_case_ids_rejected():
    c1 = _minimal_case()
    c2 = _minimal_case()
    report = validate_cases([c1, c2])
    assert not report.ok
    assert report.duplicate_ids


def test_invalid_jsonl_rejected(tmp_path: Path):
    p = tmp_path / "bad.jsonl"
    p.write_text("{not-json\n", encoding="utf-8")
    with pytest.raises(ValueError, match="INVALID_JSONL"):
        load_jsonl_cases(p)


def test_scenario_group_cannot_cross_splits():
    a = _minimal_case(case_id="a1", scenario_group_id="g1", split=Split.FROZEN)
    b = _minimal_case(case_id="b1", scenario_group_id="g1", split=Split.DEV, prohibited_for_training=False)
    # rebuild hashes
    a = a.model_copy(update={"content_hash": content_hash_case(a)})
    b = b.model_copy(update={"content_hash": content_hash_case(b)})
    report = validate_cases([a, b])
    assert not report.ok
    assert report.split_leaks


def test_frozen_requires_training_prohibition():
    with pytest.raises(Exception):
        EvalCaseV1(
            case_id="x",
            suite_id="s",
            title="t",
            input=EvalInputV1(user_text="hi"),
            mode=InteractionMode.ASK,
            severity=Severity.LOW,
            language_form=LanguageForm.ENGLISH,
            script_mix=ScriptMix.LATIN,
            review_status=ReviewStatus.DRAFT,
            scenario_group_id="g",
            split=Split.FROZEN,
            prohibited_for_training=False,
        )


def test_production_tenant_rejected_in_scope():
    with pytest.raises(Exception):
        TrustedTestScopeV1(tenant_id="prod-tenant")


def test_expected_not_leaked_to_model_input():
    case = _minimal_case(
        expected=ExpectedBehaviorV1(expected_intents=("secret_label",), expected_mutation_count=0),
    )
    guard = reset_guard()
    out = execute_case(case, mode=EvalMode.COMPONENT, guard=guard)
    assert out["expected_leaked"] is False
    assert "expected" not in out["model_input"]
    assert "secret_label" not in json.dumps(out["model_input"])


def test_mutation_guard_blocks_posting():
    guard = EvaluationSafetyGuard()
    with pytest.raises(PermissionError, match="EVAL_MUTATION_BLOCKED"):
        guard.assert_operation_allowed("mark_posted")
    with pytest.raises(PermissionError):
        guard.assert_tenant_allowed("live-customer-1")
    with pytest.raises(PermissionError):
        guard.assert_url_allowed("postgres://prod.example/db")
    assert guard.mutation_attempt_count() >= 1


def test_critical_failure_not_hidden_by_aggregate():
    case = _minimal_case()
    safety = score_safety(case, {"mutation_count": 1, "receipt_count": 0})
    overall, criticals, info = aggregate_scorer_results([safety])
    assert safety.critical
    assert overall is False
    assert criticals
    assert info is not None  # informational may exist but must not flip overall


def test_blocked_not_counted_as_passed(tmp_path: Path):
    result = run_evaluation(
        manifest_path=MANIFEST,
        mode=EvalMode.LIVE_SHADOW,
        output_dir=tmp_path / "live",
        seed=0,
        repo_root=REPO,
    )
    summary = result["summary"]
    assert summary["blocked"] == summary["total"]
    assert summary["passed"] == 0


def test_output_cannot_write_frozen(tmp_path: Path):
    with pytest.raises(ValueError, match="OUTPUT_MUST_NOT_WRITE_FROZEN"):
        run_evaluation(
            manifest_path=MANIFEST,
            mode=EvalMode.COMPONENT,
            output_dir=REPO / "evals" / "mai04" / "frozen",
            seed=0,
            repo_root=REPO,
        )


def test_component_run_deterministic(tmp_path: Path):
    # Small reproducibility on full suite may be slow but required — use component mode
    r1 = run_evaluation(
        manifest_path=MANIFEST,
        mode=EvalMode.COMPONENT,
        output_dir=tmp_path / "c1",
        seed=7,
        repo_root=REPO,
    )
    r2 = run_evaluation(
        manifest_path=MANIFEST,
        mode=EvalMode.COMPONENT,
        output_dir=tmp_path / "c2",
        seed=7,
        repo_root=REPO,
    )
    assert r1["semantic_hash"] == r2["semantic_hash"]


def test_classification_macro_f1_present():
    report = classification_report([("sale", "sale"), ("sale", "purchase"), ("purchase", "purchase")])
    assert "macro_f1" in report
    assert "per_class" in report
    assert "confusion_matrix" in report


def test_no_cot_or_secrets_in_serialized_result(tmp_path: Path):
    # single case path via execute + score
    case = _minimal_case()
    out = execute_case(case, mode=EvalMode.COMPONENT, guard=reset_guard())
    blob = json.dumps(out)
    assert "<think>" not in blob
    assert "Bearer " not in blob
    assert "eyJ" not in blob
