"""MAI-53 slice 1 — compliance obligation / calendar (never arms automation)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.compliance_obligation_calendar import (
    ComplianceObligationCalendarReadiness,
    ComplianceObligationCalendarStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.compliance_obligation_calendar_service import (
    RUNTIME_VERSION,
    assert_compliance_obligation_calendar_authority,
    attach_compliance_obligation_calendar_to_request,
    build_compliance_obligation_calendar_bundle,
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
    return attach_compliance_obligation_calendar_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-53.")


def test_compliance_calendar_policy_declared() -> None:
    req = _pipeline(
        "compliance obligation with filing deadline and compliance calendar"
    )
    bundle = req.compliance_obligation_calendar_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == ComplianceObligationCalendarStatus.COMPLETE
    )
    assert (
        bundle.compliance_obligation_calendar_readiness
        == ComplianceObligationCalendarReadiness.POLICY_DECLARED
    )
    assert "COMPLIANCE_OBLIGATION" in bundle.in_scope_topics
    assert "FILING_DEADLINE" in bundle.in_scope_topics
    assert "COMPLIANCE_CALENDAR" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.compliance_calendar_enabled is False
    assert bundle.obligation_created is False
    assert bundle.deadline_scheduled is False
    assert bundle.reminder_sent is False
    assert bundle.automation_armed is False
    assert bundle.calendar_synced is False
    assert bundle.filing_submitted is False
    assert bundle.obligation_closed is False
    assert bundle.production_approved is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "AUTOMATION_NOT_ARMED" in bundle.reason_codes
    assert_compliance_obligation_calendar_authority(bundle)


def test_reminder_tracking_alert() -> None:
    req = _pipeline(
        "reminder automation with obligation tracking and due date alert"
    )
    bundle = req.compliance_obligation_calendar_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == ComplianceObligationCalendarStatus.COMPLETE
    )
    assert "REMINDER_AUTOMATION" in bundle.in_scope_topics
    assert "OBLIGATION_TRACKING" in bundle.in_scope_topics
    assert "DUE_DATE_ALERT" in bundle.in_scope_topics
    assert bundle.reminder_sent is False
    assert bundle.automation_armed is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.compliance_obligation_calendar_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == ComplianceObligationCalendarStatus.SKIP
    )


def test_ca_firm_without_compliance_skips() -> None:
    req = _pipeline(
        "CA firm engagement with engagement letter and workpaper workspace"
    )
    bundle = req.compliance_obligation_calendar_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == ComplianceObligationCalendarStatus.SKIP
    )


def test_adapter_metadata() -> None:
    req = _pipeline(
        "compliance obligation with filing deadline and compliance calendar"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("compliance_obligation_calendar") or {}
    assert meta.get("compliance_calendar_enabled") is False
    assert meta.get("obligation_created") is False
    assert meta.get("automation_armed") is False
    assert meta.get("filing_submitted") is False
    assert meta.get("production_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="regulatory calendar with automated reminder",
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
    bundle = build_compliance_obligation_calendar_bundle(req)
    assert (
        bundle.analysis_status
        == ComplianceObligationCalendarStatus.COMPLETE
    )
    assert "REGULATORY_CALENDAR" in bundle.in_scope_topics
    assert "REMINDER_AUTOMATION" in bundle.in_scope_topics
    assert bundle.automation_armed is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai53"
        / "frozen"
        / "compliance_obligation_calendar_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.compliance_obligation_calendar_bundle
        assert bundle is not None
        assert bundle.compliance_calendar_enabled is False
        assert bundle.obligation_created is False
        assert bundle.automation_armed is False
        assert bundle.filing_submitted is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.compliance_obligation_calendar_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
