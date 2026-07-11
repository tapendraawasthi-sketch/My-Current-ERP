"""Action Runtime HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import ActionId, CorrelationId, EvaluationId, TenantId, new_correlation_id
from ..application.commands import (
    ApproveActionCommand,
    CancelActionCommand,
    ProposeActionCommand,
    RejectActionCommand,
)
from ..application.queries import ActionMetricsQuery, GetActionQuery, SearchActionsQuery

router = APIRouter(prefix="/actions", tags=["action-runtime"])


class ProposeActionRequest(BaseModel):
    evaluation_id: str = Field(..., min_length=1)
    tenant_id: str = Field(default="default")
    action_type: str = ""
    execution_intent: dict[str, Any] | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    user_id: str = Field(default="system")
    idempotency_key: str = ""
    auto_execute: bool = True
    runtime_context: dict[str, Any] = Field(default_factory=dict)


class RejectActionRequest(BaseModel):
    tenant_id: str = Field(default="default")
    approver_id: str = Field(default="manager")
    reason: str = ""


class CancelActionRequest(BaseModel):
    tenant_id: str = Field(default="default")
    reason: str = ""


class ApproveActionRequest(BaseModel):
    tenant_id: str = Field(default="default")
    approver_id: str = Field(default="manager")


@router.post("")
async def propose_action(req: ProposeActionRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(req.evaluation_id),
            action_type=req.action_type,
            payload=req.payload,
            user_id=req.user_id,
            idempotency_key=req.idempotency_key,
            auto_execute=req.auto_execute,
            metadata={
                "runtime_context": req.runtime_context,
                **({"execution_intent": req.execution_intent} if req.execution_intent else {}),
            },
        )
    )
    return {"action": result, "correlation_id": correlation_id}


@router.get("")
async def list_actions(
    tenant_id: str = "default",
    evaluation_id: str | None = None,
    execution_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    from ....shared.ids import EvaluationId, ExecutionId

    actions = await container.query_bus.dispatch(
        SearchActionsQuery(
            tenant_id=TenantId(tenant_id),
            evaluation_id=EvaluationId(evaluation_id) if evaluation_id else None,
            execution_id=ExecutionId(execution_id) if execution_id else None,
            status=status,
            limit=limit,
        )
    )
    return {"actions": actions}


@router.get("/metrics")
async def action_metrics(tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    metrics = await container.query_bus.dispatch(ActionMetricsQuery(tenant_id=TenantId(tenant_id)))
    return {"metrics": metrics}


@router.get("/{action_id}")
async def get_action(action_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    action = await container.query_bus.dispatch(
        GetActionQuery(tenant_id=TenantId(tenant_id), action_id=ActionId(action_id))
    )
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    return {"action": action}


@router.post("/{action_id}/approve")
async def approve_action(action_id: str, req: ApproveActionRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        ApproveActionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            action_id=ActionId(action_id),
            approver_id=req.approver_id,
        )
    )
    return {"action": result, "correlation_id": correlation_id}


@router.post("/{action_id}/reject")
async def reject_action(action_id: str, req: RejectActionRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        RejectActionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            action_id=ActionId(action_id),
            approver_id=req.approver_id,
            reason=req.reason,
        )
    )
    return {"action": result, "correlation_id": correlation_id}


@router.post("/{action_id}/cancel")
async def cancel_action(action_id: str, req: CancelActionRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        CancelActionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            action_id=ActionId(action_id),
            reason=req.reason,
        )
    )
    return {"action": result, "correlation_id": correlation_id}
