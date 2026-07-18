"""Planner HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, PlanId, RequestId, TenantId, new_correlation_id, new_request_id
from ..application.commands import CreateExecutionPlanCommand
from ..application.queries import GetExecutionPlanQuery, GetExecutionStepsQuery, SearchExecutionPlansQuery
from ..domain.value_objects import PlanningPolicyName

router = APIRouter(prefix="/plans", tags=["planner"])


class CreatePlanRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(..., min_length=1)
    tenant_id: str = Field(default="default")
    company_id: str | None = None
    branch_id: str | None = None
    user_id: str = Field(default="anonymous")
    conversation_id: str | None = None
    module: str = Field(default="orbix")
    language: str | None = None
    policy_name: PlanningPolicyName = PlanningPolicyName.BALANCED


@router.post("")
async def create_plan(req: CreatePlanRequest) -> dict[str, Any]:
    container = await get_container()
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id=req.session_id,
            user_id=req.user_id,
            company_id=req.company_id,
            branch_id=req.branch_id,
            conversation_id=req.conversation_id or req.session_id,
            module=req.module,
            language=req.language,
            message=req.message,
            policy_name=req.policy_name,
        )
    )
    return {"plan": result, "request_id": request_id, "correlation_id": correlation_id}


@router.get("/{plan_id}")
async def get_plan(plan_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    plan = await container.query_bus.dispatch(
        GetExecutionPlanQuery(tenant_id=TenantId(tenant_id), plan_id=PlanId(plan_id))
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"plan": plan}


@router.get("")
async def list_plans(
    tenant_id: str = "default",
    company_id: str | None = None,
    conversation_id: str | None = None,
    request_id: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    plans = await container.query_bus.dispatch(
        SearchExecutionPlansQuery(
            tenant_id=TenantId(tenant_id),
            company_id=company_id,
            conversation_id=conversation_id,
            request_id=RequestId(request_id) if request_id else None,
            limit=limit,
        )
    )
    return {"plans": plans}


@router.get("/{plan_id}/steps")
async def get_plan_steps(plan_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    steps = await container.query_bus.dispatch(
        GetExecutionStepsQuery(tenant_id=TenantId(tenant_id), plan_id=PlanId(plan_id))
    )
    return {"plan_id": plan_id, "steps": steps}
