"""MAI-21 slice 1 — typed PlanV1 annotation (no tool execution)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.plan_tools import PlanStatus, ReadOrMutation
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.typed_plan import TypedPlanAnalysisStatus
from src.oip.modules.conversation.application.clarification_plan_service import (
    attach_clarification_plan_to_request,
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
from src.oip.modules.conversation.application.typed_plan_service import (
    RUNTIME_VERSION,
    attach_typed_plan_to_request,
    build_typed_plan_bundle,
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
    req = attach_clarification_plan_to_request(req)
    return attach_typed_plan_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-21.0.1-slice1"


def test_complete_purchase_gets_draft_plan() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == TypedPlanAnalysisStatus.COMPLETE
    assert bundle.is_execution_authority is False
    assert bundle.tool_executions == 0
    assert bundle.proposed_tool_calls == ()
    plan = bundle.plan
    assert plan is not None
    assert plan.status == PlanStatus.DRAFT
    assert plan.planner_version == RUNTIME_VERSION
    assert "erp.confirm_draft" in plan.prohibited_tools
    assert plan.ordered_steps
    assert plan.ordered_steps[0].read_or_mutation == ReadOrMutation.READ


def test_incomplete_skips_for_clarification() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == TypedPlanAnalysisStatus.SKIP
    assert "CLARIFICATION_PENDING" in bundle.warnings or "FRAME_NOT_COMPLETE" in (
        bundle.warnings or ()
    )
    assert bundle.plan is None


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == TypedPlanAnalysisStatus.SKIP
    assert bundle.plan is None


def test_report_plan() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == TypedPlanAnalysisStatus.COMPLETE
    assert bundle.plan is not None
    assert "erp.read_balance" in bundle.plan.allowed_tools
    assert "erp.confirm_draft" in bundle.plan.prohibited_tools


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    tp = (dto.metadata or {}).get("typed_plan") or {}
    assert tp.get("is_execution_authority") is False
    assert tp.get("analysis_status") == "COMPLETE"
    assert tp.get("tool_executions") == 0
    assert int(tp.get("step_count") or 0) >= 1


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
    bundle = build_typed_plan_bundle(req)
    assert bundle.analysis_status == TypedPlanAnalysisStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai21"
        / "frozen"
        / "typed_plan_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.typed_plan_bundle
        assert bundle is not None
        assert bundle.is_execution_authority is False
        assert bundle.tool_executions == 0
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_has_plan") is True:
            assert bundle.plan is not None, case["case_id"]
            assert "erp.confirm_draft" in bundle.plan.prohibited_tools
        if case.get("expected_has_plan") is False:
            assert bundle.plan is None, case["case_id"]
