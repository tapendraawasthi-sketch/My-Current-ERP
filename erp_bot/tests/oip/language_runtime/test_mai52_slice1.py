"""MAI-52 slice 1 — CA-firm engagement / workpaper (never opens engagements)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.ca_firm_engagement_workpaper import (
    CaFirmEngagementWorkpaperReadiness,
    CaFirmEngagementWorkpaperStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.ca_firm_engagement_workpaper_service import (
    RUNTIME_VERSION,
    assert_ca_firm_engagement_workpaper_authority,
    attach_ca_firm_engagement_workpaper_to_request,
    build_ca_firm_engagement_workpaper_bundle,
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
    return attach_ca_firm_engagement_workpaper_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-52.")


def test_ca_firm_engagement_policy_declared() -> None:
    req = _pipeline(
        "CA firm engagement with engagement letter and workpaper workspace"
    )
    bundle = req.ca_firm_engagement_workpaper_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == CaFirmEngagementWorkpaperStatus.COMPLETE
    )
    assert (
        bundle.ca_firm_engagement_workpaper_readiness
        == CaFirmEngagementWorkpaperReadiness.POLICY_DECLARED
    )
    assert "CA_FIRM_ENGAGEMENT" in bundle.in_scope_topics
    assert "ENGAGEMENT_LETTER" in bundle.in_scope_topics
    assert "WORKPAPER_WORKSPACE" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.ca_firm_workspace_enabled is False
    assert bundle.engagement_opened is False
    assert bundle.engagement_signed is False
    assert bundle.workpaper_created is False
    assert bundle.workpaper_posted is False
    assert bundle.client_binder_released is False
    assert bundle.staff_assignment_applied is False
    assert bundle.review_notes_finalized is False
    assert bundle.production_approved is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "ENGAGEMENT_NOT_OPENED" in bundle.reason_codes
    assert_ca_firm_engagement_workpaper_authority(bundle)


def test_review_binder_staff() -> None:
    req = _pipeline(
        "workpaper review with client binder staff assignment and review notes"
    )
    bundle = req.ca_firm_engagement_workpaper_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == CaFirmEngagementWorkpaperStatus.COMPLETE
    )
    assert "WORKPAPER_REVIEW" in bundle.in_scope_topics
    assert "CLIENT_BINDER" in bundle.in_scope_topics
    assert "STAFF_ASSIGNMENT" in bundle.in_scope_topics
    assert "REVIEW_NOTES" in bundle.in_scope_topics
    assert bundle.workpaper_posted is False
    assert bundle.review_notes_finalized is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.ca_firm_engagement_workpaper_bundle
    assert bundle is not None
    assert bundle.analysis_status == CaFirmEngagementWorkpaperStatus.SKIP


def test_private_document_without_ca_skips() -> None:
    req = _pipeline(
        "private document intelligence with user upload and document Q&A"
    )
    bundle = req.ca_firm_engagement_workpaper_bundle
    assert bundle is not None
    assert bundle.analysis_status == CaFirmEngagementWorkpaperStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline(
        "CA firm engagement with engagement letter and workpaper workspace"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("ca_firm_engagement_workpaper") or {}
    assert meta.get("ca_firm_workspace_enabled") is False
    assert meta.get("engagement_opened") is False
    assert meta.get("workpaper_posted") is False
    assert meta.get("production_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="audit workpaper workspace with engagement letter",
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
    bundle = build_ca_firm_engagement_workpaper_bundle(req)
    assert (
        bundle.analysis_status == CaFirmEngagementWorkpaperStatus.COMPLETE
    )
    assert "WORKPAPER_WORKSPACE" in bundle.in_scope_topics
    assert "ENGAGEMENT_LETTER" in bundle.in_scope_topics
    assert bundle.engagement_opened is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai52"
        / "frozen"
        / "ca_firm_engagement_workpaper_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.ca_firm_engagement_workpaper_bundle
        assert bundle is not None
        assert bundle.ca_firm_workspace_enabled is False
        assert bundle.engagement_opened is False
        assert bundle.workpaper_posted is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.ca_firm_engagement_workpaper_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
