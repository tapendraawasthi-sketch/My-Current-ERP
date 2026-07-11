"""Orchestrator HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id
from ..application.commands import ArchiveWorkflowCommand, CancelWorkflowCommand, StartWorkflowCommand
from ..application.queries import GetWorkflowQuery, GetWorkflowTimelineQuery, ListWorkflowsQuery, WorkflowMetricsQuery

router = APIRouter(prefix="/workflows", tags=["orchestrator"])


class StartWorkflowRequest(BaseModel):
    tenant_id: str = Field(default="default")
    session_id: str = Field(..., min_length=1)
    user_id: str = Field(default="anonymous")
    company_id: str | None = None
    branch_id: str | None = None
    conversation_id: str | None = None
    module: str = Field(default="orbix")
    language: str | None = None
    message: str = Field(..., min_length=1)
    execution_mode: str | None = None
    idempotency_key: str = ""


class CancelWorkflowRequest(BaseModel):
    tenant_id: str = Field(default="default")
    reason: str = ""


@router.post("")
async def start_workflow(req: StartWorkflowRequest) -> dict[str, Any]:
    container = await get_container()
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        StartWorkflowCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id=req.session_id,
            user_id=req.user_id,
            company_id=req.company_id,
            branch_id=req.branch_id,
            conversation_id=req.conversation_id,
            module=req.module,
            language=req.language,
            message=req.message,
            execution_mode=req.execution_mode,
            idempotency_key=req.idempotency_key or request_id,
        )
    )


@router.get("")
async def list_workflows(
    tenant_id: str = "default",
    state: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    workflows = await container.query_bus.dispatch(
        ListWorkflowsQuery(tenant_id=TenantId(tenant_id), state=state, limit=limit)
    )
    return {"workflows": workflows}


@router.get("/metrics")
async def workflow_metrics(tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        WorkflowMetricsQuery(tenant_id=TenantId(tenant_id))
    )


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    workflow = await container.query_bus.dispatch(
        GetWorkflowQuery(tenant_id=TenantId(tenant_id), workflow_id=workflow_id)
    )
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"workflow": workflow}


@router.get("/{workflow_id}/timeline")
async def get_workflow_timeline(workflow_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    timeline = await container.query_bus.dispatch(
        GetWorkflowTimelineQuery(tenant_id=TenantId(tenant_id), workflow_id=workflow_id)
    )
    if timeline is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"timeline": timeline}


@router.post("/{workflow_id}/cancel")
async def cancel_workflow(
    workflow_id: str, req: CancelWorkflowRequest
) -> dict[str, Any]:
    container = await get_container()
    workflow = await container.command_bus.dispatch(
        CancelWorkflowCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(str(new_correlation_id())),
            workflow_id=workflow_id,
            reason=req.reason,
        )
    )
    return {"workflow": workflow}


@router.post("/{workflow_id}/archive")
async def archive_workflow(workflow_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    workflow = await container.command_bus.dispatch(
        ArchiveWorkflowCommand(
            tenant_id=TenantId(tenant_id),
            correlation_id=CorrelationId(str(new_correlation_id())),
            workflow_id=workflow_id,
        )
    )
    return {"workflow": workflow}
