"""Provider Runtime HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, ExecutionId, RouteId, TenantId, new_correlation_id
from ..application.commands import StartExecutionCommand
from ..application.queries import (
    ExecutionMetricsQuery,
    GetExecutionArtifactsQuery,
    GetExecutionQuery,
    GetExecutionStatusQuery,
    GetExecutionUsageQuery,
    SearchExecutionsQuery,
)
from ..domain.value_objects import ExecutionPolicyName

router = APIRouter(prefix="/executions", tags=["provider-runtime"])


class StartExecutionRequest(BaseModel):
    route_id: str = Field(..., min_length=1)
    tenant_id: str = Field(default="default")
    execution_policy: ExecutionPolicyName = ExecutionPolicyName.BALANCED


@router.post("")
async def start_execution(req: StartExecutionRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(req.route_id),
            execution_policy=req.execution_policy,
        )
    )
    return {"execution": result, "correlation_id": correlation_id}


@router.get("")
async def list_executions(
    tenant_id: str = "default",
    route_id: str | None = None,
    plan_id: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    executions = await container.query_bus.dispatch(
        SearchExecutionsQuery(
            tenant_id=TenantId(tenant_id),
            route_id=RouteId(route_id) if route_id else None,
            plan_id=plan_id,
            limit=limit,
        )
    )
    return {"executions": executions}


@router.get("/metrics")
async def execution_metrics(tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    metrics = await container.query_bus.dispatch(
        ExecutionMetricsQuery(tenant_id=TenantId(tenant_id))
    )
    return {"metrics": metrics}


@router.get("/{execution_id}")
async def get_execution(execution_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    execution = await container.query_bus.dispatch(
        GetExecutionQuery(
            tenant_id=TenantId(tenant_id),
            execution_id=ExecutionId(execution_id),
        )
    )
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    status = await container.query_bus.dispatch(
        GetExecutionStatusQuery(
            tenant_id=TenantId(tenant_id),
            execution_id=ExecutionId(execution_id),
        )
    )
    return {"execution": execution, "status": status}


@router.get("/{execution_id}/usage")
async def get_execution_usage(execution_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    usage = await container.query_bus.dispatch(
        GetExecutionUsageQuery(
            tenant_id=TenantId(tenant_id),
            execution_id=ExecutionId(execution_id),
        )
    )
    if usage is None:
        raise HTTPException(status_code=404, detail="Usage not found")
    return {"usage": usage}


@router.get("/{execution_id}/artifacts")
async def get_execution_artifacts(execution_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    artifacts = await container.query_bus.dispatch(
        GetExecutionArtifactsQuery(
            tenant_id=TenantId(tenant_id),
            execution_id=ExecutionId(execution_id),
        )
    )
    return {"artifacts": artifacts}


@router.get("/{execution_id}/stream")
async def stream_execution(execution_id: str, tenant_id: str = "default"):
    container = await get_container()
    chunks = await container.execution_repository.list_stream_chunks(
        tenant_id=tenant_id,
        execution_id=execution_id,
    )

    async def event_generator():
        for chunk in chunks:
            text = chunk.get("chunk_text", "")
            yield f"data: {text}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
