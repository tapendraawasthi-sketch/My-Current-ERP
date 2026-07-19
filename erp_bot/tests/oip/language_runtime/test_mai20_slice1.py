"""MAI-20 slice 1 — information-gain clarification plan annotation."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.clarification_plan import ClarificationPlanStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.modules.conversation.application.clarification_plan_service import (
    RUNTIME_VERSION,
    attach_clarification_plan_to_request,
    build_clarification_plan_bundle,
)
from src.oip.modules.conversation.application.event_frame_extraction_service import (
    attach_event_frame_extraction_to_request,
)
from src.oip.modules.conversation.application.event_spec_registry_service import (
    attach_event_spec_registry_to_request,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
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
    req = attach_router_decision_to_request(req)
    req = attach_event_spec_registry_to_request(req)
    req = attach_event_frame_extraction_to_request(req)
    return attach_clarification_plan_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-20.0.1-slice1"


def test_complete_purchase_not_needed() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    plan = req.clarification_plan_bundle
    assert plan is not None
    assert plan.analysis_status == ClarificationPlanStatus.NOT_NEEDED
    assert plan.primary_field is None
    assert plan.is_execution_authority is False
    assert plan.silent_applications == 0
    assert plan.draft_mutations == 0


def test_qty_only_asks_amount_not_silent_money() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    frame = req.event_frame
    plan = req.clarification_plan_bundle
    assert frame is not None
    assert "amount" in frame.missing_required_fields
    assert plan is not None
    assert plan.analysis_status == ClarificationPlanStatus.ASK
    assert plan.primary_field in {"amount", "quantity_candidate"}
    assert plan.question_text
    assert plan.is_execution_authority is False
    # Ambiguous qty outranks missing amount when present.
    if "quantity_candidate" in (frame.ambiguous_fields or ()):
        assert plan.primary_field == "quantity_candidate"
        assert plan.targets[0].information_gain_rank == 1


def test_ood_skip() -> None:
    req = _pipeline("asdf qwer zxcv")
    plan = req.clarification_plan_bundle
    assert plan is not None
    assert plan.analysis_status == ClarificationPlanStatus.SKIP
    assert plan.primary_field is None


def test_report_complete_not_needed() -> None:
    req = _pipeline("show balance sheet")
    plan = req.clarification_plan_bundle
    assert plan is not None
    assert plan.analysis_status == ClarificationPlanStatus.NOT_NEEDED


def test_adapter_metadata() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    cp = (dto.metadata or {}).get("clarification_plan") or {}
    assert cp.get("is_execution_authority") is False
    assert cp.get("analysis_status") == "ASK"
    assert cp.get("primary_field")
    assert int(cp.get("target_count") or 0) >= 1


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai20"
        / "frozen"
        / "clarification_plan_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        plan = req.clarification_plan_bundle
        assert plan is not None
        assert plan.is_execution_authority is False
        if case.get("expected_status"):
            assert plan.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_status_one_of"):
            assert plan.analysis_status.value in case[
                "expected_status_one_of"
            ], case["case_id"]
        if "expected_primary" in case and case["expected_primary"] is None:
            assert plan.primary_field is None, case["case_id"]
        elif case.get("expected_primary"):
            assert plan.primary_field == case["expected_primary"], case[
                "case_id"
            ]
        if case.get("expected_primary_one_of"):
            assert plan.primary_field in case["expected_primary_one_of"], case[
                "case_id"
            ]


def test_build_without_frame_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="hello",
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
    bundle = build_clarification_plan_bundle(req)
    assert bundle.analysis_status == ClarificationPlanStatus.SKIP
