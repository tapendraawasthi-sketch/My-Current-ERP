"""MAI-48 slice 1 — governed improvement / fine-tuning (never applies)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.governed_improvement_fine_tuning import (
    GovernedImprovementFineTuningReadiness,
    GovernedImprovementFineTuningStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.governed_improvement_fine_tuning_service import (
    RUNTIME_VERSION,
    assert_governed_improvement_fine_tuning_authority,
    attach_governed_improvement_fine_tuning_to_request,
    build_governed_improvement_fine_tuning_bundle,
)


def _pipeline(text: str):
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    return attach_governed_improvement_fine_tuning_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-48.0.1-slice1"


def test_governed_improvement_policy_declared() -> None:
    req = _pipeline(
        "governed improvement and fine-tuning with eval regression suite"
    )
    bundle = req.governed_improvement_fine_tuning_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == GovernedImprovementFineTuningStatus.COMPLETE
    )
    assert (
        bundle.governed_improvement_fine_tuning_readiness
        == GovernedImprovementFineTuningReadiness.POLICY_DECLARED
    )
    assert "GOVERNED_IMPROVEMENT" in bundle.in_scope_topics
    assert "FINE_TUNING" in bundle.in_scope_topics
    assert "EVAL_REGRESSION" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.improvement_applied is False
    assert bundle.fine_tuning_executed is False
    assert bundle.training_data_exported is False
    assert bundle.model_weights_changed is False
    assert bundle.production_model_swapped is False
    assert bundle.regression_suite_passed is False
    assert bundle.governed_change_approved is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "FINE_TUNING_NOT_EXECUTED" in bundle.reason_codes
    assert_governed_improvement_fine_tuning_authority(bundle)


def test_prompt_and_model_swap() -> None:
    req = _pipeline(
        "prompt iteration and model swap with dataset curation ablation study"
    )
    bundle = req.governed_improvement_fine_tuning_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == GovernedImprovementFineTuningStatus.COMPLETE
    )
    assert "PROMPT_ITERATION" in bundle.in_scope_topics
    assert "MODEL_SWAP" in bundle.in_scope_topics
    assert "DATASET_CURATION" in bundle.in_scope_topics
    assert "ABLATION_STUDY" in bundle.in_scope_topics


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.governed_improvement_fine_tuning_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == GovernedImprovementFineTuningStatus.SKIP
    )


def test_review_without_improve_skips() -> None:
    req = _pipeline(
        "human review and pilot operations with gold suite acceptance criteria"
    )
    bundle = req.governed_improvement_fine_tuning_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == GovernedImprovementFineTuningStatus.SKIP
    )


def test_adapter_metadata() -> None:
    req = _pipeline(
        "governed improvement and fine-tuning with eval regression suite"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("governed_improvement_fine_tuning") or {}
    assert meta.get("improvement_applied") is False
    assert meta.get("fine_tuning_executed") is False
    assert meta.get("production_model_swapped") is False
    assert meta.get("governed_change_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="LoRA fine-tuning with training dataset curation",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    bundle = build_governed_improvement_fine_tuning_bundle(req)
    assert (
        bundle.analysis_status
        == GovernedImprovementFineTuningStatus.COMPLETE
    )
    assert "FINE_TUNING" in bundle.in_scope_topics
    assert "DATASET_CURATION" in bundle.in_scope_topics
    assert bundle.fine_tuning_executed is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai48"
        / "frozen"
        / "governed_improvement_fine_tuning_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.governed_improvement_fine_tuning_bundle
        assert bundle is not None
        assert bundle.improvement_applied is False
        assert bundle.fine_tuning_executed is False
        assert bundle.production_model_swapped is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.governed_improvement_fine_tuning_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
