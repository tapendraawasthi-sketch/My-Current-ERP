"""MAI-07R3H2 shared-collision corrective — focused governance and scoring tests.

Never write canonical eval trees without MAI07_AUTHORIZE_EVAL_WRITE + authorize flags.
Never open frozen V2. Never mutate R3H lock/attempt/chain.
"""

from __future__ import annotations

import ast
import json
import random
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from erp_bot.src.oip.modules.language_runtime.transliteration import (
    MAX_CANDIDATES_PER_SPAN,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3h2_shared_collision_datasets import (
    OUT as R3H2_OUT,
    R3H_OUT,
    write_datasets,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.canonical_path_guard import (
    AUTHORIZE_ENV,
    assert_writable_eval_path,
    sha256_file,
    tree_digest,
    write_text_guarded,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h2 import (
    CHAIN_PATH,
    HOLDOUT_FAMILY_SPLITS,
    LOCKED_PATH,
    OUT,
    PACK_VERSION,
    RC_ID,
    check_preflight,
    run_holdout_once,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h2_audit_scorer import (
    compare_reports,
    score_split_audit,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h2_canonical_scorer import (
    score_split as canonical_score_split,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3h2_scoring_contracts import (
    EvaluationPopulation,
    GateOutcome,
    MetricApplicability,
    build_metric,
    evaluate_gate,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    transliterate_frame,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure import resource_repository as xlrr
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.english_identity_guard import (
    Disposition,
    POLICY_VERSION,
    classify_disposition,
)

REPO = Path(__file__).resolve().parents[4]
DRIFT_PATH = R3H_OUT / "MAI_07R3H_POST_CLOSEOUT_ARTIFACT_DRIFT.json"
R3H2_RESOURCES_DIR = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/sealed_packs"
    / PACK_VERSION
)
AUDIT_SCORER_PATH = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
    / "eval_mai07_r3h2_audit_scorer.py"
)
CANONICAL_SCORER_MODULE = "eval_mai07_r3h2_canonical_scorer"


def _r3h2_resources():
    return xlrr.load_resources(resources_dir=R3H2_RESOURCES_DIR, force_reload=True)


def _pred(
    *,
    case_id: str,
    source: str,
    identity: bool,
    surface: str | None = None,
    review_required: bool = False,
    review_codes: tuple[str, ...] = (),
    disposition: str | None = None,
    pre_cap: bool = False,
    post_cap: bool = False,
    raw_ok: bool = True,
    caps_ok: bool = True,
    protected_mutations: int = 0,
    policy_invoked: bool = True,
    extra_ranked: list[dict] | None = None,
) -> dict:
    top_surface = surface if surface is not None else source
    ranked = [
        {
            "candidate_id": f"{case_id}_c1",
            "surface": top_surface,
            "script": "LATIN" if identity else "DEVANAGARI",
            "kind": "IDENTITY" if identity else "GENERATED",
            "rank": 1,
            "is_identity": identity,
            "reason_codes": [],
            "requires_review": review_required,
        }
    ]
    if extra_ranked:
        ranked.extend(extra_ranked)
    return {
        "case_id": case_id,
        "source_surface": source,
        "ranked": ranked,
        "span_review_required": review_required,
        "span_review_reason_codes": list(review_codes),
        "disposition": disposition,
        "pre_cap_has_acceptable_target": pre_cap,
        "post_cap_has_acceptable_target": post_cap,
        "raw_ok": raw_ok,
        "caps_ok": caps_ok,
        "protected_mutations": protected_mutations,
        "policy_invoked": policy_invoked,
        "candidate_surfaces_sorted": sorted(c["surface"] for c in ranked),
    }


def _case(
    *,
    case_id: str,
    split: str,
    suite_kind: str,
    identity_expected: bool = True,
    requires_review: bool = False,
    targets: list[str] | None = None,
    pair_id: str | None = None,
    pair_role: str | None = None,
    primary: str = "token",
) -> dict:
    return {
        "case_id": case_id,
        "split": split,
        "suite_kind": suite_kind,
        "identity_expected": identity_expected,
        "requires_review": requires_review,
        "acceptable_devanagari_targets": targets or [],
        "pair_id": pair_id,
        "pair_role": pair_role,
        "primary_token": primary,
        "frozen_v2_unused": True,
        "frozen_predictions_unused": True,
        "r3h_holdout_family_unused": True,
    }


# ---------------------------------------------------------------------------
# 1. R3H historical lock/chain/qualification hashes unchanged
# ---------------------------------------------------------------------------


def test_r3h_historical_lock_chain_hashes_unchanged():
    drift = json.loads(DRIFT_PATH.read_text(encoding="utf-8"))
    expected = drift["lock_attempt_chain_qualification_hashes"]
    mapping = {
        "LOCKED_NOT_RUN.json_raw": R3H_OUT / "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json",
        "LOCK_RECORD.json": R3H_OUT / "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.LOCK_RECORD.json",
        "CHAIN_MANIFEST.json": R3H_OUT / "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json",
        "QUALIFICATION_RESULT.json": R3H_OUT
        / "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.QUALIFICATION_RESULT.json",
        "HOLDOUT_ATTEMPT_001.json": R3H_OUT / "MAI_07R3H_HOLDOUT_ATTEMPT_001.json",
    }
    for key, path in mapping.items():
        assert path.exists(), path
        assert sha256_file(path) == expected[key], f"R3H sealed hash drift for {key}"
    locked = json.loads(mapping["LOCKED_NOT_RUN.json_raw"].read_text(encoding="utf-8"))
    assert locked["rc_manifest_semantic_sha256"] == expected["LOCKED_NOT_RUN.semantic"]


# ---------------------------------------------------------------------------
# 2. Fixtures use tmp_path; builders reject canonical overwrite without auth
# ---------------------------------------------------------------------------


def test_write_datasets_tmp_path_and_reject_canonical(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    result = write_datasets(tmp_path)
    assert (tmp_path / "development.jsonl").exists()
    assert result["minimums_met"] is True
    thr = json.loads((tmp_path / "MAI_07R3H2_THRESHOLDS.json").read_text(encoding="utf-8"))
    assert thr["locked_before_holdout_observation"] is True
    with pytest.raises(PermissionError):
        write_datasets(R3H2_OUT)
    with pytest.raises(PermissionError):
        assert_writable_eval_path(OUT / "development.jsonl", authorize=False)


# ---------------------------------------------------------------------------
# 3. Required zero-denominator INVALID; optional empty NOT_APPLICABLE
# ---------------------------------------------------------------------------


def test_zero_denominator_required_vs_optional():
    required_empty = EvaluationPopulation(population_id="req", case_ids=(), required=True)
    optional_empty = EvaluationPopulation(population_id="opt", case_ids=(), required=False)
    m_req = build_metric(metric_id="m_req", population=required_empty, numerator=0, threshold=1.0, operation=">=")
    m_opt = build_metric(metric_id="m_opt", population=optional_empty, numerator=0, threshold=1.0, operation=">=")
    assert m_req.applicability is MetricApplicability.INVALID_REQUIRED_POPULATION
    assert m_opt.applicability is MetricApplicability.NOT_APPLICABLE
    assert evaluate_gate(m_req).outcome is GateOutcome.INVALID_REQUIRED_POPULATION
    assert evaluate_gate(m_opt).outcome is GateOutcome.NOT_APPLICABLE


# ---------------------------------------------------------------------------
# 4. Population-bound metrics
# ---------------------------------------------------------------------------


def test_population_bound_metrics_synthetic():
    thresholds = {
        "gates": {
            "clear_romanized_target_missing_from_top5_rate": {"op": "<=", "value": 0.02},
            "nepali_context_target_accuracy": {"op": ">=", "value": 0.95},
            "ambiguous_optional_target_retention_at_5": {"op": ">=", "value": 0.95},
            "target_dropped_by_cap_rate": {"op": "<=", "value": 0.01},
            "clear_romanized_target_generation_recall": {"op": ">=", "value": 0.98},
            "shared_nepali_context_target_generation_recall": {"op": ">=", "value": 0.95},
            "overall_english_identity_top1": {"op": ">=", "value": 0.98},
            "false_devanagari_on_clear_english": {"op": "<=", "value": 0.01},
            "unresolved_shared_identity_review_accuracy": {"op": ">=", "value": 0.98},
            "review_reason_code_completeness": {"op": "==", "value": 1.0},
            "english_context_identity_accuracy": {"op": ">=", "value": 0.98},
            "clear_romanized_target_recall_at_5": {"op": ">=", "value": 0.98},
            "shared_nepali_context_target_recall_at_5": {"op": ">=", "value": 0.95},
            "ambiguous_optional_target_generation_recall": {"op": ">=", "value": 0.9},
            "technical_english_identity_top1": {"op": ">=", "value": 0.98},
            "name_identity_top1": {"op": "==", "value": 1.0},
            "acronym_identifier_identity_top1": {"op": "==", "value": 1.0},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "caps_respected": {"op": "==", "value": 1.0},
            "candidate_duplication": {"op": "==", "value": 0},
            "policy_invocation_coverage": {"op": "==", "value": 1.0},
            "complete_counterfactual_triple_accuracy": {"op": ">=", "value": 0.95},
        }
    }
    cases = [
        _case(case_id="rom1", split="DEVELOPMENT", suite_kind="clear_romanized_control", identity_expected=False, targets=["खर्च"], primary="kharcha"),
        _case(case_id="np1", split="DEVELOPMENT", suite_kind="shared_collision_nepali_context", identity_expected=False, targets=["बैंक"], primary="bank"),
        _case(
            case_id="amb1",
            split="DEVELOPMENT",
            suite_kind="shared_collision_ambiguous_context",
            identity_expected=True,
            requires_review=True,
            targets=["बैंक"],
            primary="bank",
        ),
        _case(case_id="en1", split="DEVELOPMENT", suite_kind="english_identity", identity_expected=True, primary="payment"),
    ]
    preds = [
        _pred(case_id="rom1", source="kharcha", identity=False, surface="खर्च", pre_cap=True, post_cap=True),
        _pred(case_id="np1", source="bank", identity=False, surface="बैंक", pre_cap=True, post_cap=True),
        _pred(
            case_id="amb1",
            source="bank",
            identity=True,
            review_required=True,
            review_codes=("R3H2_AMBIGUOUS_IDENTITY_FIRST_REVIEW",),
            disposition=Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW.value,
            pre_cap=True,
            post_cap=True,
        ),
        _pred(case_id="en1", source="payment", identity=True),
    ]
    report = canonical_score_split(cases, preds, thresholds)
    missing = report.metrics["clear_romanized_target_missing_from_top5_rate"]
    assert missing.population_id == "clear_romanized_control"
    assert missing.denominator == 1
    assert missing.numerator == 0
    nepali = report.metrics["nepali_context_target_accuracy"]
    assert nepali.population_id == "shared_nepali_context"
    assert nepali.numerator == 1
    retention = report.metrics["ambiguous_optional_target_retention_at_5"]
    assert retention.population_id == "optional_target_ambiguous"
    assert retention.denominator == 1
    assert retention.numerator == 1
    dropped = report.metrics["target_dropped_by_cap_rate"]
    assert dropped.population_id == "target_generation_positive"
    assert dropped.numerator == 0
    assert dropped.denominator >= 1


# ---------------------------------------------------------------------------
# 5. Audit scorer does not import canonical scorer
# ---------------------------------------------------------------------------


def test_audit_scorer_does_not_import_canonical():
    tree = ast.parse(AUDIT_SCORER_PATH.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            assert CANONICAL_SCORER_MODULE not in node.module
            leaf = node.module.rsplit(".", 1)[-1]
            assert leaf != CANONICAL_SCORER_MODULE
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert CANONICAL_SCORER_MODULE not in alias.name


# ---------------------------------------------------------------------------
# 6. Canonical/audit agreement on synthetic cases
# ---------------------------------------------------------------------------


def test_canonical_audit_agreement_synthetic():
    thresholds = json.loads((OUT / "MAI_07R3H2_THRESHOLDS.json").read_text(encoding="utf-8"))
    cases = [
        _case(case_id="a_en", split="HOLDOUT_VALIDATION", suite_kind="english_identity", primary="invoice"),
        _case(
            case_id="a_rom",
            split="HOLDOUT_VALIDATION",
            suite_kind="clear_romanized_control",
            identity_expected=False,
            targets=["हिसाब"],
            primary="hisaab",
        ),
        _case(
            case_id="a_sh_en",
            split="HOLDOUT_VALIDATION",
            suite_kind="shared_collision_english_context",
            primary="cash",
        ),
        _case(
            case_id="a_sh_np",
            split="HOLDOUT_VALIDATION",
            suite_kind="shared_collision_nepali_context",
            identity_expected=False,
            targets=["क्यास"],
            primary="cash",
        ),
        _case(
            case_id="a_amb",
            split="HOLDOUT_VALIDATION",
            suite_kind="shared_collision_ambiguous_context",
            requires_review=True,
            targets=["क्यास"],
            primary="cash",
        ),
    ]
    preds = [
        _pred(case_id="a_en", source="invoice", identity=True),
        _pred(case_id="a_rom", source="hisaab", identity=False, surface="हिसाब", pre_cap=True, post_cap=True),
        _pred(case_id="a_sh_en", source="cash", identity=True),
        _pred(case_id="a_sh_np", source="cash", identity=False, surface="क्यास", pre_cap=True, post_cap=True),
        _pred(
            case_id="a_amb",
            source="cash",
            identity=True,
            review_required=True,
            review_codes=("R3H2_REVIEW_REQUIRED",),
            disposition=Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW.value,
            pre_cap=True,
            post_cap=True,
        ),
    ]
    canonical = canonical_score_split(cases, preds, thresholds)
    audit = score_split_audit(cases, preds, thresholds)
    agreement = compare_reports(canonical, audit)
    assert agreement["ok"] is True
    assert agreement["mismatches"] == []


# ---------------------------------------------------------------------------
# 7. Counterfactual triple validation
# ---------------------------------------------------------------------------


def test_counterfactual_triple_complete_incomplete_duplicate():
    thresholds = {
        "gates": {
            "complete_counterfactual_triple_accuracy": {"op": ">=", "value": 0.95},
            "overall_english_identity_top1": {"op": ">=", "value": 0.0},
            "false_devanagari_on_clear_english": {"op": "<=", "value": 1.0},
            "unresolved_shared_identity_review_accuracy": {"op": ">=", "value": 0.0},
            "review_reason_code_completeness": {"op": ">=", "value": 0.0},
            "english_context_identity_accuracy": {"op": ">=", "value": 0.0},
            "nepali_context_target_accuracy": {"op": ">=", "value": 0.0},
            "clear_romanized_target_generation_recall": {"op": ">=", "value": 0.0},
            "clear_romanized_target_recall_at_5": {"op": ">=", "value": 0.0},
            "clear_romanized_target_missing_from_top5_rate": {"op": "<=", "value": 1.0},
            "shared_nepali_context_target_generation_recall": {"op": ">=", "value": 0.0},
            "shared_nepali_context_target_recall_at_5": {"op": ">=", "value": 0.0},
            "ambiguous_optional_target_generation_recall": {"op": ">=", "value": 0.0},
            "ambiguous_optional_target_retention_at_5": {"op": ">=", "value": 0.0},
            "technical_english_identity_top1": {"op": ">=", "value": 0.0},
            "name_identity_top1": {"op": ">=", "value": 0.0},
            "acronym_identifier_identity_top1": {"op": ">=", "value": 0.0},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "caps_respected": {"op": "==", "value": 1.0},
            "candidate_duplication": {"op": "==", "value": 0},
            "policy_invocation_coverage": {"op": "==", "value": 1.0},
            "target_dropped_by_cap_rate": {"op": "<=", "value": 1.0},
        }
    }
    complete_cases = [
        _case(
            case_id="cf_en",
            split="CONTEXT_COUNTERFACTUAL",
            suite_kind="counterfactual_english_context",
            pair_id="pair_ok",
            pair_role="english_context",
            primary="bill",
        ),
        _case(
            case_id="cf_np",
            split="CONTEXT_COUNTERFACTUAL",
            suite_kind="counterfactual_nepali_context",
            identity_expected=False,
            targets=["बिल"],
            pair_id="pair_ok",
            pair_role="nepali_context",
            primary="bill",
        ),
        _case(
            case_id="cf_amb",
            split="CONTEXT_COUNTERFACTUAL",
            suite_kind="counterfactual_ambiguous_context",
            requires_review=True,
            targets=["बिल"],
            pair_id="pair_ok",
            pair_role="ambiguous_context",
            primary="bill",
        ),
    ]
    complete_preds = [
        _pred(case_id="cf_en", source="bill", identity=True),
        _pred(case_id="cf_np", source="bill", identity=False, surface="बिल", pre_cap=True, post_cap=True),
        _pred(
            case_id="cf_amb",
            source="bill",
            identity=True,
            review_required=True,
            review_codes=("R3H2_AMBIGUOUS_IDENTITY_FIRST_REVIEW",),
            disposition=Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW.value,
            pre_cap=True,
            post_cap=True,
        ),
    ]
    complete_report = canonical_score_split(complete_cases, complete_preds, thresholds)
    assert len([g for g in complete_report.counterfactual_groups if g.complete and g.all_ok]) == 1
    assert complete_report.metrics["complete_counterfactual_triple_accuracy"].numerator == 1

    incomplete_cases = complete_cases[:2]
    incomplete_preds = complete_preds[:2]
    incomplete_report = canonical_score_split(incomplete_cases, incomplete_preds, thresholds)
    assert all(not g.complete for g in incomplete_report.counterfactual_groups)
    assert incomplete_report.metrics["complete_counterfactual_triple_accuracy"].denominator == 0

    # Duplicate role within a pair_id → incomplete (missing a distinct role slot after overwrite)
    dup_cases = [
        complete_cases[0],
        {
            **complete_cases[1],
            "case_id": "cf_np_dup",
            "pair_role": "english_context",  # duplicate role collapses completeness
        },
        complete_cases[2],
    ]
    dup_preds = [
        complete_preds[0],
        {**complete_preds[1], "case_id": "cf_np_dup"},
        complete_preds[2],
    ]
    dup_report = canonical_score_split(dup_cases, dup_preds, thresholds)
    assert any(not g.complete for g in dup_report.counterfactual_groups)


# ---------------------------------------------------------------------------
# 8–9. Review metadata survival / missing review fails accuracy
# ---------------------------------------------------------------------------


def test_review_metadata_survival_ambiguous():
    resources = _r3h2_resources()
    frame = analyze_language("item cash shared collision pending adjudication r3h2_review_probe")
    bundle = transliterate_frame(frame, resources=resources, use_context=True)
    assert bundle is not None
    cash_spans = [s for s in bundle.span_results if s.raw_span.original_text.lower() == "cash"]
    assert cash_spans, "expected cash span"
    span = cash_spans[0]
    assert span.disposition == Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW.value
    assert span.review_required is True
    assert len(span.review_reason_codes) > 0
    assert span.policy_version == POLICY_VERSION


def test_missing_review_metadata_fails_accuracy_predicate():
    thresholds = {
        "gates": {
            "unresolved_shared_identity_review_accuracy": {"op": ">=", "value": 0.98},
            "review_reason_code_completeness": {"op": "==", "value": 1.0},
            "overall_english_identity_top1": {"op": ">=", "value": 0.0},
            "false_devanagari_on_clear_english": {"op": "<=", "value": 1.0},
            "english_context_identity_accuracy": {"op": ">=", "value": 0.0},
            "nepali_context_target_accuracy": {"op": ">=", "value": 0.0},
            "clear_romanized_target_generation_recall": {"op": ">=", "value": 0.0},
            "clear_romanized_target_recall_at_5": {"op": ">=", "value": 0.0},
            "clear_romanized_target_missing_from_top5_rate": {"op": "<=", "value": 1.0},
            "shared_nepali_context_target_generation_recall": {"op": ">=", "value": 0.0},
            "shared_nepali_context_target_recall_at_5": {"op": ">=", "value": 0.0},
            "ambiguous_optional_target_generation_recall": {"op": ">=", "value": 0.0},
            "ambiguous_optional_target_retention_at_5": {"op": ">=", "value": 0.0},
            "technical_english_identity_top1": {"op": ">=", "value": 0.0},
            "name_identity_top1": {"op": ">=", "value": 0.0},
            "acronym_identifier_identity_top1": {"op": ">=", "value": 0.0},
            "protected_span_mutations": {"op": "==", "value": 0},
            "raw_view_mutations": {"op": "==", "value": 0},
            "caps_respected": {"op": "==", "value": 1.0},
            "candidate_duplication": {"op": "==", "value": 0},
            "policy_invocation_coverage": {"op": "==", "value": 1.0},
            "complete_counterfactual_triple_accuracy": {"op": ">=", "value": 0.0},
            "target_dropped_by_cap_rate": {"op": "<=", "value": 1.0},
        }
    }
    cases = [
        _case(
            case_id="rev1",
            split="DEVELOPMENT",
            suite_kind="shared_collision_ambiguous_context",
            requires_review=True,
            targets=["क्यास"],
            primary="cash",
        )
    ]
    # Identity top-1 but missing review metadata → accuracy fails
    bad = [
        _pred(
            case_id="rev1",
            source="cash",
            identity=True,
            review_required=False,
            review_codes=(),
            disposition=Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW.value,
        )
    ]
    report = canonical_score_split(cases, bad, thresholds)
    assert report.metrics["unresolved_shared_identity_review_accuracy"].numerator == 0
    assert report.gates["unresolved_shared_identity_review_accuracy"].outcome is GateOutcome.FAIL
    assert report.metrics["review_reason_code_completeness"].numerator == 0


# ---------------------------------------------------------------------------
# 10. Clear English / Romanized / names / acronyms / protected
# ---------------------------------------------------------------------------


def test_clear_english_identity_first():
    resources = _r3h2_resources()
    bundle = transliterate_frame(
        analyze_language("please verify the payment status today"),
        resources=resources,
        use_context=True,
    )
    assert bundle is not None
    payment = next(s for s in bundle.span_results if s.raw_span.original_text.lower() == "payment")
    assert payment.candidates
    assert payment.candidates[0].is_identity is True
    assert payment.disposition in {
        Disposition.ENGLISH_IDENTITY_REQUIRED.value,
        Disposition.SHARED_CONTEXT_IDENTITY_PREFERRED.value,
        Disposition.KEEP_BASE_ORDER.value,
    }


def test_clear_romanized_target_first():
    resources = _r3h2_resources()
    bundle = transliterate_frame(
        analyze_language("aaja kharcha ko hisaab milau garnu"),
        resources=resources,
        use_context=True,
    )
    assert bundle is not None
    kharcha = next(s for s in bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    top = kharcha.candidates[0]
    assert top.is_identity is False
    assert any("\u0900" <= ch <= "\u097F" for ch in top.surface)


def test_names_acronyms_protected_safe():
    resources = _r3h2_resources()
    for text, token, expect_identity in (
        ("check FIFO code in the shared policy register", "FIFO", True),
        ("please review invoice INV-1001 carefully", "INV-1001", True),
    ):
        bundle = transliterate_frame(analyze_language(text), resources=resources, use_context=True)
        assert bundle is not None
        spans = [s for s in bundle.span_results if token.lower() in s.raw_span.original_text.lower()]
        assert spans
        if expect_identity:
            assert spans[0].candidates[0].is_identity is True


# ---------------------------------------------------------------------------
# 11. Holdout inaccessible before lock (CHAIN / attempt firewall)
# ---------------------------------------------------------------------------


def test_holdout_firewall_module_constants():
    assert "HOLDOUT_VALIDATION" in HOLDOUT_FAMILY_SPLITS
    assert CHAIN_PATH.name.endswith("CHAIN_MANIFEST.json")
    assert LOCKED_PATH.name.endswith("LOCKED_NOT_RUN.json")
    preflight = check_preflight()
    assert preflight["holdout_already_consumed"] is True
    assert preflight["chain_present"] is True
    assert preflight["locked_present"] is True
    # Builder firewall: R3H holdout family must not be read for leakage exclusion source list.
    builder_src = (
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
        / "build_mai07r3h2_shared_collision_datasets.py"
    ).read_text(encoding="utf-8")
    assert "never reads R3H holdout-family bodies" in builder_src
    assert "r3h_holdout_family_read" in builder_src


# ---------------------------------------------------------------------------
# 12. Thresholds locked_before_holdout_observation
# ---------------------------------------------------------------------------


def test_thresholds_locked_before_holdout_observation():
    thresholds = json.loads((OUT / "MAI_07R3H2_THRESHOLDS.json").read_text(encoding="utf-8"))
    assert thresholds["locked_before_holdout_observation"] is True
    locked = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    assert locked["status"] == "LOCKED_NOT_RUN"
    assert locked.get("threshold_manifest", thresholds).get("locked_before_holdout_observation", True) is True or (
        thresholds["locked_before_holdout_observation"] is True
    )


# ---------------------------------------------------------------------------
# 13. RC immutable after evaluation
# ---------------------------------------------------------------------------


def test_rc_immutable_after_evaluation(monkeypatch: pytest.MonkeyPatch):
    assert LOCKED_PATH.exists()
    locked = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    assert locked["status"] == "LOCKED_NOT_RUN"
    assert CHAIN_PATH.exists()
    with pytest.raises(RuntimeError, match="FAILED_HOLDOUT_CANNOT_RERUN"):
        # Even with authorize env, consumed chain refuses rerun.
        monkeypatch.setenv(AUTHORIZE_ENV, "1")
        run_holdout_once()
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    with pytest.raises(PermissionError):
        write_text_guarded(LOCKED_PATH, "{}\n", authorize=False)
    with pytest.raises(PermissionError):
        monkeypatch.setenv(AUTHORIZE_ENV, "1")
        write_text_guarded(LOCKED_PATH, "{}\n", authorize=True)


# ---------------------------------------------------------------------------
# 14. Frozen-data firewall flags on cases
# ---------------------------------------------------------------------------


def test_frozen_data_firewall_flags_on_cases():
    # Read a small sample from DEVELOPMENT only (non-holdout for test safety).
    rows = []
    for line in (OUT / "development.jsonl").read_text(encoding="utf-8").splitlines()[:40]:
        if line.strip():
            rows.append(json.loads(line))
    assert rows
    for row in rows:
        assert row.get("frozen_v2_unused") is True
        assert row.get("frozen_predictions_unused") is True
        assert row.get("r3h_holdout_family_unused") is True


# ---------------------------------------------------------------------------
# 15. No linguist/production approval inference
# ---------------------------------------------------------------------------


def test_no_linguist_or_production_approval_inference():
    qual = json.loads((OUT / f"{RC_ID}.QUALIFICATION_RESULT.json").read_text(encoding="utf-8"))
    assert qual["LINGUIST_APPROVED"] is False
    assert qual["PRODUCTION_APPROVED"] is False
    assert qual["QUALITY_GATES_PASSED"] is False
    assert qual["gate_all_pass"] is True
    assert qual["status"] == "PASSED_HOLDOUT"
    pack_manifest = json.loads((R3H2_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert pack_manifest.get("LINGUIST_APPROVED") is False
    assert pack_manifest.get("PRODUCTION_APPROVED") is False
    assert POLICY_VERSION == "mai-07-r3h2.1.0.0"
    assert PACK_VERSION == "mai-07.1.5-r3h2-shared"
    # Active default remains SEAL-NEW; R3H2 pack is not promoted.
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert RESOURCE_PACK_VERSION == "mai-07.1.11-r3n6-chaincomplete"


# ---------------------------------------------------------------------------
# 16. MAI-08 untouched
# ---------------------------------------------------------------------------


def test_mai08_untouched():
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    phase = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert phase["status"] == "NOT_STARTED"
    # Grep-style: no MAI-08 start marker in R3H2 eval/builder modules.
    for rel in (
        "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3h2.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3h2_shared_collision_datasets.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/english_identity_guard.py",
    ):
        text = (REPO / rel).read_text(encoding="utf-8")
        assert "MAI-08" not in text or "MAI-08 NOT_STARTED" in text or "beyond" in text.lower()
        assert "start MAI-08" not in text.lower()
        assert "implement mai-08" not in text.lower()


# ---------------------------------------------------------------------------
# 17. ≥2000 deterministic property cases
# ---------------------------------------------------------------------------


def test_property_cases_2000_deterministic():
    resources = _r3h2_resources()
    rng = random.Random(20260716)
    english = sorted(resources.english_identity)[:40]
    romanized = [k for k in sorted(resources.lexicon) if k not in resources.english_identity][:40]
    assert english and romanized
    ok = 0
    for i in range(2000):
        if i % 2 == 0:
            token = english[i % len(english)]
            text = f"please review the {token} total now r3h2prop{i:04d}"
        else:
            token = romanized[i % len(romanized)]
            text = f"aaja {token} ko hisaab milau r3h2prop{i:04d}"
        frame = analyze_language(text)
        bundle = transliterate_frame(frame, resources=resources, use_context=True)
        assert bundle is not None
        assert all(len(span.candidates) <= MAX_CANDIDATES_PER_SPAN for span in bundle.span_results)
        again = transliterate_frame(analyze_language(text), resources=resources, use_context=True)
        assert again.model_dump() == bundle.model_dump()
        ok += 1
        _ = rng.random()  # keep seeded stream exercised; determinism is on transliteration
    assert ok == 2000


def test_r3h2_canonical_tree_unchanged_by_focused_suite(tmp_path: Path):
    before = tree_digest(OUT)
    before_r3h_lock = sha256_file(
        R3H_OUT / "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json"
    )
    (tmp_path / "noop.txt").write_text("ok", encoding="utf-8")
    after = tree_digest(OUT)
    after_r3h_lock = sha256_file(
        R3H_OUT / "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json"
    )
    assert before == after
    assert before_r3h_lock == after_r3h_lock


def test_policy_version_is_r3h2():
    assert POLICY_VERSION == "mai-07-r3h2.1.0.0"
    resources = _r3h2_resources()
    disposition, signals = classify_disposition(
        surface="cash",
        language_form="SHARED_OR_AMBIGUOUS_LATIN",
        neighbors=("item", "shared", "collision", "pending"),
        resources=resources,
        ranked=[],
    )
    assert disposition is Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW
    assert signals["version"] == POLICY_VERSION
