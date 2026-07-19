"""MAI-53 slice 2 — compliance obligation / calendar candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.compliance_obligation_calendar_consume_service import (
    RUNTIME_VERSION,
    assert_compliance_obligation_calendar_consume_authority,
    build_compliance_obligation_calendar_candidate,
    compliance_obligation_calendar_consume_observability,
    resolve_compliance_obligation_calendar_consume_mode,
)
from src.oip.modules.conversation.application.compliance_obligation_calendar_service import (
    assert_compliance_obligation_calendar_authority,
    attach_compliance_obligation_calendar_to_request,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-53.0.2-slice2"


def test_calendar_candidate_only() -> None:
    req = _pipeline(
        "compliance obligation with filing deadline and compliance calendar"
    )
    bundle = req.compliance_obligation_calendar_bundle
    assert_compliance_obligation_calendar_authority(bundle)
    mode = resolve_compliance_obligation_calendar_consume_mode(
        bundle, allow_arm_automation=False, allow_submit_filing=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_compliance_obligation_calendar_candidate(bundle)
    assert (
        built["compliance_obligation_calendar_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["compliance_obligation_calendar_consume_ready"] is True
    cand = built["compliance_obligation_calendar_candidate"]
    assert cand is not None
    assert "COMPLIANCE_OBLIGATION" in cand["in_scope_topics"]
    assert cand["obligation_plan"] is None
    assert cand["filing_deadline_plan"] is None
    assert cand["compliance_calendar_plan"] is None
    assert cand["reminder_automation_plan"] is None
    assert cand["obligation_tracking_plan"] is None
    assert cand["due_date_alert_plan"] is None
    assert cand["regulatory_calendar_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["automation_armed"] is False
    assert cand["filing_submitted"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = compliance_obligation_calendar_consume_observability(req)
    assert_compliance_obligation_calendar_consume_authority(obs)
    assert obs["allow_arm_automation"] is False
    assert obs["allow_submit_filing"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "compliance_obligation_calendar_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["REMINDER_AUTOMATION"],
        "pilot_scope": "COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "automation_armed": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_compliance_obligation_calendar_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_compliance_obligation_calendar_consume_mode(
            req.compliance_obligation_calendar_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "compliance obligation with filing deadline and compliance calendar"
    )
    assert (
        resolve_compliance_obligation_calendar_consume_mode(
            req.compliance_obligation_calendar_bundle,
            allow_arm_automation=True,
        )
        == "INVOKE_ARM_AUTOMATION"
    )
    assert (
        resolve_compliance_obligation_calendar_consume_mode(
            req.compliance_obligation_calendar_bundle,
            allow_submit_filing=True,
        )
        == "INVOKE_SUBMIT_FILING"
    )
    obs = compliance_obligation_calendar_consume_observability(
        req, allow_arm_automation=False, allow_submit_filing=False
    )
    assert (
        obs["compliance_obligation_calendar_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_arm_automation"] is False
    assert obs["automation_armed"] is False
    assert obs["filing_submitted"] is False
    assert obs["compliance_calendar_enabled"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "compliance obligation with filing deadline and compliance calendar"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("compliance_obligation_calendar") or {}
    assert (
        meta.get("compliance_obligation_calendar_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert meta.get("compliance_obligation_calendar_consume_ready") is True
    assert meta.get("automation_armed") is False
    assert meta.get("filing_submitted") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_arm_automation") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("compliance_obligation_calendar_candidate") or {}
    assert cand.get("obligation_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai53"
        / "frozen"
        / "compliance_obligation_calendar_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_compliance_obligation_calendar_consume_mode(
                case["synthetic_meta"],
                allow_arm_automation=bool(
                    case.get("allow_arm_automation", False)
                ),
                allow_submit_filing=bool(
                    case.get("allow_submit_filing", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_compliance_obligation_calendar_consume_mode(
                req.compliance_obligation_calendar_bundle,
                allow_arm_automation=bool(
                    case.get("allow_arm_automation", False)
                ),
                allow_submit_filing=bool(
                    case.get("allow_submit_filing", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
