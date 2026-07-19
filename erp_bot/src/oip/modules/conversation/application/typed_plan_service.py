"""MAI-21 slice 1 — typed PlanV1 annotation from EventFrame + ClarificationPlan.

Annotation only: never executes tools, posts, or mutates drafts.
Tool loop / PlannerService execution remains later slices.
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
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.typed_plan import TypedPlanAnalysisStatus, TypedPlanBundleV1

RUNTIME_VERSION = "mai-21.0.1-slice1"
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

    return TypedPlanBundleV1(
        analysis_status=TypedPlanAnalysisStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        event_type=frame.event_type,
        clarification_status=clarify_status,
        plan=plan,
        proposed_tool_calls=(),
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
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "tool_executions": bundle.tool_executions,
        "is_execution_authority": False,
    }


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "attach_typed_plan_to_request",
    "build_typed_plan_bundle",
    "typed_plan_to_metadata",
]
