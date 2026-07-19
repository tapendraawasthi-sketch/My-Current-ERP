"""MAI-21 slice 2 — constitution-gated tool proposals (no execution)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.plan_tools import (
    PlanStatus,
    PlanV1,
    ReadOrMutation,
    ToolCallStatus,
)
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
    assert_typed_plan_authority,
    attach_typed_plan_to_request,
    authorize_tool_proposal,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-21.0.2-slice2"


def test_purchase_proposes_authorized_preview() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == TypedPlanAnalysisStatus.COMPLETE
    assert bundle.tool_executions == 0
    assert bundle.is_execution_authority is False
    assert len(bundle.proposed_tool_calls) >= 1
    call = bundle.proposed_tool_calls[0]
    assert call.tool_name == "erp.preview_draft"
    assert call.status == ToolCallStatus.AUTHORIZED
    assert call.read_or_mutation == ReadOrMutation.READ
    assert bundle.plan is not None
    assert bundle.plan.status == PlanStatus.READY
    assert_typed_plan_authority(bundle)


def test_report_proposes_authorized_read() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.proposed_tool_calls
    assert bundle.proposed_tool_calls[0].tool_name == "erp.read_balance"
    assert bundle.proposed_tool_calls[0].status == ToolCallStatus.AUTHORIZED


def test_confirm_draft_always_denied() -> None:
    plan = PlanV1(
        plan_id="p1",
        objective="bad",
        allowed_tools=("erp.confirm_draft",),
        prohibited_tools=(),
        planner_version=RUNTIME_VERSION,
    )
    status = authorize_tool_proposal(
        tool_name="erp.confirm_draft",
        read_or_mutation=ReadOrMutation.READ,
        plan=plan,
        mode=InteractionModeV1.ASK,
    )
    assert status == ToolCallStatus.DENIED


def test_mutation_always_denied() -> None:
    plan = PlanV1(
        plan_id="p1",
        objective="bad",
        allowed_tools=("erp.preview_draft",),
        prohibited_tools=("erp.confirm_draft",),
        planner_version=RUNTIME_VERSION,
    )
    status = authorize_tool_proposal(
        tool_name="erp.preview_draft",
        read_or_mutation=ReadOrMutation.MUTATION,
        plan=plan,
        mode=InteractionModeV1.ASK,
    )
    assert status == ToolCallStatus.DENIED


def test_incomplete_no_proposals() -> None:
    req = _pipeline("bought 50 kg rice from Ram")
    bundle = req.typed_plan_bundle
    assert bundle is not None
    assert bundle.analysis_status == TypedPlanAnalysisStatus.SKIP
    assert bundle.proposed_tool_calls == ()


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    tp = (dto.metadata or {}).get("typed_plan") or {}
    assert tp.get("is_execution_authority") is False
    assert tp.get("tool_executions") == 0
    assert int(tp.get("authorized_tool_call_count") or 0) >= 1
    assert int(tp.get("proposed_tool_call_count") or 0) >= 1


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai21"
        / "frozen"
        / "typed_plan_tools_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.typed_plan_bundle
        assert bundle is not None
        assert bundle.tool_executions == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_authorized_min") is not None:
            authorized = sum(
                1
                for c in bundle.proposed_tool_calls
                if c.status == ToolCallStatus.AUTHORIZED
            )
            assert authorized >= case["expected_authorized_min"], case["case_id"]
        if case.get("expected_confirm_absent"):
            assert all(
                c.tool_name != "erp.confirm_draft"
                for c in bundle.proposed_tool_calls
            ), case["case_id"]
