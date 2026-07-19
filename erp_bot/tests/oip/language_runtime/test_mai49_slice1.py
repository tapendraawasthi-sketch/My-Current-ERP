"""MAI-49 slice 1 — production capability release (never production approved)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.production_capability_release import (
    ProductionCapabilityReleaseReadiness,
    ProductionCapabilityReleaseStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.production_capability_release_service import (
    RUNTIME_VERSION,
    assert_production_capability_release_authority,
    attach_production_capability_release_to_request,
    build_production_capability_release_bundle,
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
    return attach_production_capability_release_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-49.")


def test_production_release_policy_declared() -> None:
    req = _pipeline(
        "production capability release with residual risk and owner sign-off"
    )
    bundle = req.production_capability_release_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == ProductionCapabilityReleaseStatus.COMPLETE
    )
    assert (
        bundle.production_capability_release_readiness
        == ProductionCapabilityReleaseReadiness.POLICY_DECLARED
    )
    assert "PRODUCTION_RELEASE" in bundle.in_scope_topics
    assert "RESIDUAL_RISK" in bundle.in_scope_topics
    assert "OWNER_SIGNOFF" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.production_approved is False
    assert bundle.production_capability_released is False
    assert bundle.release_checklist_complete is False
    assert bundle.residual_risk_accepted is False
    assert bundle.owner_signoff_proven is False
    assert bundle.cutover_authorized is False
    assert bundle.rollback_proven is False
    assert bundle.production_traffic_enabled is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "PRODUCTION_NOT_APPROVED" in bundle.reason_codes
    assert_production_capability_release_authority(bundle)


def test_cutover_and_rollback() -> None:
    req = _pipeline(
        "cutover plan and rollback plan with release gate checklist"
    )
    bundle = req.production_capability_release_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == ProductionCapabilityReleaseStatus.COMPLETE
    )
    assert "CUTOVER_PLAN" in bundle.in_scope_topics
    assert "ROLLBACK_PLAN" in bundle.in_scope_topics
    assert "RELEASE_GATE" in bundle.in_scope_topics
    assert bundle.production_approved is False
    assert bundle.cutover_authorized is False
    assert bundle.rollback_proven is False
    assert bundle.production_traffic_enabled is False
    assert bundle.production_capability_released is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.production_capability_release_bundle
    assert bundle is not None
    assert bundle.analysis_status == ProductionCapabilityReleaseStatus.SKIP


def test_fine_tune_without_release_skips() -> None:
    req = _pipeline(
        "governed improvement and fine-tuning with eval regression suite"
    )
    bundle = req.production_capability_release_bundle
    assert bundle is not None
    assert bundle.analysis_status == ProductionCapabilityReleaseStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline(
        "production capability release with residual risk and owner sign-off"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("production_capability_release") or {}
    assert meta.get("production_approved") is False
    assert meta.get("production_capability_released") is False
    assert meta.get("cutover_authorized") is False
    assert meta.get("production_traffic_enabled") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="prod release with capability checklist and risk acceptance",
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
    bundle = build_production_capability_release_bundle(req)
    assert (
        bundle.analysis_status == ProductionCapabilityReleaseStatus.COMPLETE
    )
    assert "PRODUCTION_RELEASE" in bundle.in_scope_topics
    assert "CAPABILITY_CHECKLIST" in bundle.in_scope_topics
    assert "RESIDUAL_RISK" in bundle.in_scope_topics
    assert bundle.production_approved is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai49"
        / "frozen"
        / "production_capability_release_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.production_capability_release_bundle
        assert bundle is not None
        assert bundle.production_approved is False
        assert bundle.production_capability_released is False
        assert bundle.cutover_authorized is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.production_capability_release_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
