"""MAI-21 — typed PlanV1 + constitution-gated tool proposals.

Slice 1: DRAFT PlanV1 annotation when EventFrame is COMPLETE.
Slice 2: propose READ ToolCallV1 entries under constitution gates;
         never execute tools, post, or mutate drafts.
"""

from __future__ import annotations

from typing import Any

from ....contracts.clarification_plan import ClarificationPlanStatus
from ....contracts.event_frame import FrameStatus
from ....contracts.plan_tools import (
    PlanStatus,
    PlanStepV1,
    PlanV1,
    ReadOrMutation,
    StepStatus,
    ToolCallStatus,
    ToolCallV1,
    ToolOrigin,
)
from ....contracts.request import CanonicalAIRequestV1, InteractionModeV1
from ....contracts.typed_plan import TypedPlanAnalysisStatus, TypedPlanBundleV1

RUNTIME_VERSION = "mai-21.0.2-slice2"
AUTHORITY = "ADR_0038"

_TXN_TYPES = frozenset(
    {
        "purchase",
        "sale",
        "sales",
        "purchase_return",
        "sales_return",
        "payment",
        "receipt",
    }
)

_HARD_DENY_TOOLS = frozenset({"erp.confirm_draft"})

# Registered MAI-21 tools → constitution operation (proposal classification).
_TOOL_OPERATION = {
    "erp.read_balance": "READ_ERP_DATA",
    "erp.preview_draft": "GENERATE_PREVIEW",
    "erp.confirm_draft": "EXECUTE_CONFIRMED_COMMAND",
}

_ASK_AUTHORIZABLE_OPS = frozenset(
    {
        "READ_ERP_DATA",
        "GENERATE_PREVIEW",
        "RUN_READONLY_CALCULATION",
        "READ_KNOWLEDGE",
    }
)


def _draft_plan_for_event(
    *,
    event_type: str,
    plan_id: str,
) -> PlanV1 | None:
    if event_type in _TXN_TYPES:
        return PlanV1(
            plan_id=plan_id,
            objective=f"Prepare {event_type} preview (no post)",
            mode="ask",
            ordered_steps=(
                PlanStepV1(
                    step_id="s1",
                    operation_class="transaction_preview",
                    tool_name="erp.preview_draft",
                    expected_output_type="preview",
                    read_or_mutation=ReadOrMutation.READ,
                    status=StepStatus.PENDING,
                ),
            ),
            allowed_tools=("erp.preview_draft",),
            prohibited_tools=("erp.confirm_draft",),
            required_evidence=("event_frame",),
            stop_conditions=("CLARIFICATION_REQUIRED", "USER_CANCEL"),
            planner_version=RUNTIME_VERSION,
            status=PlanStatus.DRAFT,
        )
    if event_type == "report":
        return PlanV1(
            plan_id=plan_id,
            objective="Prepare report read plan (no mutation)",
            mode="ask",
            ordered_steps=(
                PlanStepV1(
                    step_id="s1",
                    operation_class="report_read",
                    tool_name="erp.read_balance",
                    expected_output_type="report",
                    read_or_mutation=ReadOrMutation.READ,
                ),
            ),
            allowed_tools=("erp.read_balance",),
            prohibited_tools=("erp.confirm_draft",),
            required_evidence=("event_frame",),
            stop_conditions=("CLARIFICATION_REQUIRED", "USER_CANCEL"),
            planner_version=RUNTIME_VERSION,
            status=PlanStatus.DRAFT,
        )
    return None


def _operation_for_tool(tool_name: str) -> str:
    if tool_name in _TOOL_OPERATION:
        return _TOOL_OPERATION[tool_name]
    try:
        from ....domain.constitution import operation_from_tool_name

        return operation_from_tool_name(tool_name).value
    except Exception:  # noqa: BLE001
        return "EXECUTE_CONFIRMED_COMMAND"


def authorize_tool_proposal(
    *,
    tool_name: str,
    read_or_mutation: ReadOrMutation,
    plan: PlanV1,
    mode: InteractionModeV1 | str | None,
) -> ToolCallStatus:
    """Constitution-style gate for a proposed tool call (never executes)."""
    name = (tool_name or "").strip()
    if not name:
        return ToolCallStatus.DENIED
    if name in _HARD_DENY_TOOLS or name in (plan.prohibited_tools or ()):
        return ToolCallStatus.DENIED
    if read_or_mutation != ReadOrMutation.READ:
        return ToolCallStatus.DENIED
    if name not in (plan.allowed_tools or ()):
        return ToolCallStatus.DENIED

    op = _operation_for_tool(name)
    if op in {
        "EXECUTE_CONFIRMED_COMMAND",
        "MARK_POSTED",
        "SYNC_ACCOUNTING_EVENT",
        "MANAGE_SECURITY",
        "UNKNOWN_OPERATION",
    }:
        return ToolCallStatus.DENIED

    mode_val = (
        mode.value if isinstance(mode, InteractionModeV1) else str(mode or "ask")
    ).lower()
    if mode_val == "ask" and op in _ASK_AUTHORIZABLE_OPS:
        return ToolCallStatus.AUTHORIZED
    if mode_val == "accountant" and op in _ASK_AUTHORIZABLE_OPS | {
        "CREATE_PERSISTED_DRAFT",
        "GENERATE_PREVIEW",
    }:
        # Still proposal-only; confirm/post remains denied above.
        return ToolCallStatus.AUTHORIZED
    return ToolCallStatus.DENIED


def _propose_tool_calls(
    plan: PlanV1,
    *,
    request: CanonicalAIRequestV1,
) -> tuple[ToolCallV1, ...]:
    calls: list[ToolCallV1] = []
    for i, step in enumerate(plan.ordered_steps):
        tool = step.tool_name
        if not tool:
            continue
        status = authorize_tool_proposal(
            tool_name=tool,
            read_or_mutation=step.read_or_mutation,
            plan=plan,
            mode=request.mode,
        )
        args: dict[str, Any] = {}
        if tool == "erp.preview_draft" and request.active_draft_reference:
            args["draft_id"] = request.active_draft_reference
        if tool == "erp.read_balance":
            args["account_id"] = "pending"
        calls.append(
            ToolCallV1(
                tool_call_id=f"tc-{request.request_id}-{i+1}",
                tool_name=tool,
                tool_schema_version="1.0.0",
                typed_arguments=args,
                tenant_scope_reference=request.trusted_scope.tenant_id,
                policy_decision_reference=AUTHORITY,
                read_or_mutation=ReadOrMutation.READ,
                origin=ToolOrigin.PLANNER,
                status=status,
            )
        )
    return tuple(calls)


def build_typed_plan_bundle(request: CanonicalAIRequestV1) -> TypedPlanBundleV1:
    frame = request.event_frame
    clarify = request.clarification_plan_bundle
    clarify_status = (
        clarify.analysis_status.value if clarify is not None else None
    )

    if frame is None:
        return TypedPlanBundleV1(
            analysis_status=TypedPlanAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            clarification_status=clarify_status,
            warnings=("NO_EVENT_FRAME",),
        )

    if clarify is not None and clarify.analysis_status == ClarificationPlanStatus.ASK:
        return TypedPlanBundleV1(
            analysis_status=TypedPlanAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            clarification_status=clarify_status,
            warnings=("CLARIFICATION_PENDING",),
        )

    if frame.status != FrameStatus.COMPLETE:
        return TypedPlanBundleV1(
            analysis_status=TypedPlanAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            clarification_status=clarify_status,
            warnings=("FRAME_NOT_COMPLETE",),
        )

    if frame.event_type in {"unknown", "dialogue", "accounting_qa"}:
        return TypedPlanBundleV1(
            analysis_status=TypedPlanAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            clarification_status=clarify_status,
            warnings=("NON_PLANABLE_EVENT",),
        )

    plan = _draft_plan_for_event(
        event_type=frame.event_type,
        plan_id=f"plan-{request.request_id}",
    )
    if plan is None:
        return TypedPlanBundleV1(
            analysis_status=TypedPlanAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            clarification_status=clarify_status,
            warnings=("NO_PLAN_TEMPLATE",),
        )

    proposals = _propose_tool_calls(plan, request=request)
    authorized = any(c.status == ToolCallStatus.AUTHORIZED for c in proposals)
    plan_status = PlanStatus.READY if authorized else PlanStatus.DRAFT
    plan = plan.model_copy(update={"status": plan_status})

    warnings: list[str] = []
    if any(c.status == ToolCallStatus.DENIED for c in proposals):
        warnings.append("SOME_TOOL_PROPOSALS_DENIED")

    return TypedPlanBundleV1(
        analysis_status=TypedPlanAnalysisStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        event_type=frame.event_type,
        clarification_status=clarify_status,
        plan=plan,
        proposed_tool_calls=proposals,
        warnings=tuple(warnings),
        silent_applications=0,
        draft_mutations=0,
        tool_executions=0,
    )


def attach_typed_plan_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_typed_plan_bundle(request)
    return request.model_copy(update={"typed_plan_bundle": bundle})


def typed_plan_to_metadata(bundle: TypedPlanBundleV1 | None) -> dict[str, Any]:
    if bundle is None:
        return {}
    plan = bundle.plan
    authorized = sum(
        1
        for c in bundle.proposed_tool_calls
        if c.status == ToolCallStatus.AUTHORIZED
    )
    denied = sum(
        1 for c in bundle.proposed_tool_calls if c.status == ToolCallStatus.DENIED
    )
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "event_type": bundle.event_type,
        "clarification_status": bundle.clarification_status,
        "plan_id": plan.plan_id if plan else None,
        "plan_status": plan.status.value if plan else None,
        "objective": plan.objective if plan else None,
        "step_count": len(plan.ordered_steps) if plan else 0,
        "allowed_tools": list(plan.allowed_tools) if plan else [],
        "prohibited_tools": list(plan.prohibited_tools) if plan else [],
        "proposed_tool_call_count": len(bundle.proposed_tool_calls),
        "authorized_tool_call_count": authorized,
        "denied_tool_call_count": denied,
        "proposed_tools": [
            {
                "tool_call_id": c.tool_call_id,
                "tool_name": c.tool_name,
                "status": c.status.value,
                "read_or_mutation": c.read_or_mutation.value,
            }
            for c in bundle.proposed_tool_calls
        ],
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "tool_executions": bundle.tool_executions,
        "is_execution_authority": False,
    }


def assert_typed_plan_authority(bundle: TypedPlanBundleV1 | None) -> None:
    """Ingress fail-closed checks for slice 2 proposals."""
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.silent_applications != 0
        or bundle.draft_mutations != 0
        or bundle.tool_executions != 0
    ):
        raise RuntimeError("TYPED_PLAN_AUTHORITY")
    for call in bundle.proposed_tool_calls:
        if call.read_or_mutation != ReadOrMutation.READ:
            raise RuntimeError("TYPED_PLAN_MUTATION_PROPOSAL")
        if call.tool_name in _HARD_DENY_TOOLS:
            raise RuntimeError("TYPED_PLAN_CONFIRM_PROPOSAL")
        if call.status in {
            ToolCallStatus.EXECUTING,
            ToolCallStatus.COMPLETED,
        }:
            raise RuntimeError("TYPED_PLAN_EXECUTION")


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "assert_typed_plan_authority",
    "attach_typed_plan_to_request",
    "authorize_tool_proposal",
    "build_typed_plan_bundle",
    "typed_plan_to_metadata",
]
