"""MAI-47 slice 1 — human review / pilot ops (never claims review complete)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.human_review_pilot_operations import (
    HumanReviewPilotOperationsReadiness,
    HumanReviewPilotOperationsStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.human_review_pilot_operations_service import (
    RUNTIME_VERSION,
    assert_human_review_pilot_operations_authority,
    attach_human_review_pilot_operations_to_request,
    build_human_review_pilot_operations_bundle,
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
    return attach_human_review_pilot_operations_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-47.")


def test_human_review_policy_declared() -> None:
    req = _pipeline(
        "human review and pilot operations with gold suite acceptance criteria"
    )
    bundle = req.human_review_pilot_operations_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == HumanReviewPilotOperationsStatus.COMPLETE
    )
    assert (
        bundle.human_review_pilot_operations_readiness
        == HumanReviewPilotOperationsReadiness.POLICY_DECLARED
    )
    assert "HUMAN_REVIEW" in bundle.in_scope_topics
    assert "PILOT_OPS" in bundle.in_scope_topics
    assert "GOLD_SUITE" in bundle.in_scope_topics
    assert "ACCEPTANCE_CRITERIA" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.human_review_complete is False
    assert bundle.pilot_approved is False
    assert bundle.production_pilot_authorized is False
    assert bundle.reviewer_signoff_proven is False
    assert bundle.gold_suite_accepted is False
    assert bundle.ops_runbook_live is False
    assert bundle.go_live_authorized is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "HUMAN_REVIEW_NOT_COMPLETE" in bundle.reason_codes
    assert_human_review_pilot_operations_authority(bundle)


def test_runbook_and_go_live() -> None:
    req = _pipeline(
        "ops runbook and go-live checklist with reviewer sign-off"
    )
    bundle = req.human_review_pilot_operations_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == HumanReviewPilotOperationsStatus.COMPLETE
    )
    assert "OPS_RUNBOOK" in bundle.in_scope_topics
    assert "GO_LIVE_CHECKLIST" in bundle.in_scope_topics
    assert "REVIEWER_SIGNOFF" in bundle.in_scope_topics


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.human_review_pilot_operations_bundle
    assert bundle is not None
    assert bundle.analysis_status == HumanReviewPilotOperationsStatus.SKIP


def test_dr_without_review_skips() -> None:
    req = _pipeline(
        "backup schedule and restore from backup with RPO RTO targets"
    )
    bundle = req.human_review_pilot_operations_bundle
    assert bundle is not None
    assert bundle.analysis_status == HumanReviewPilotOperationsStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline(
        "human review and pilot operations with gold suite acceptance criteria"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("human_review_pilot_operations") or {}
    assert meta.get("human_review_complete") is False
    assert meta.get("pilot_approved") is False
    assert meta.get("production_pilot_authorized") is False
    assert meta.get("go_live_authorized") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="honesty review and specialist sign-off for pilot ops",
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
    bundle = build_human_review_pilot_operations_bundle(req)
    assert (
        bundle.analysis_status == HumanReviewPilotOperationsStatus.COMPLETE
    )
    assert "HUMAN_REVIEW" in bundle.in_scope_topics
    assert "REVIEWER_SIGNOFF" in bundle.in_scope_topics
    assert "PILOT_OPS" in bundle.in_scope_topics
    assert bundle.human_review_complete is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai47"
        / "frozen"
        / "human_review_pilot_operations_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.human_review_pilot_operations_bundle
        assert bundle is not None
        assert bundle.human_review_complete is False
        assert bundle.production_pilot_authorized is False
        assert bundle.go_live_authorized is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.human_review_pilot_operations_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
