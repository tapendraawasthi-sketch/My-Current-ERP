"""Quality Gate HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, EvaluationId, ExecutionId, TenantId, new_correlation_id
from ..application.commands import StartEvaluationCommand
from ..application.queries import (
    GetDecisionQuery,
    GetEvaluationQuery,
    GetFindingsQuery,
    QualityMetricsQuery,
    SearchEvaluationsQuery,
)

router = APIRouter(prefix="/quality", tags=["quality-gate"])


class EvaluateRequest(BaseModel):
    execution_id: str = Field(..., min_length=1)
    tenant_id: str = Field(default="default")
    validation_context: dict[str, Any] = Field(default_factory=dict)


@router.post("/evaluate")
async def evaluate_execution(req: EvaluateRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        StartEvaluationCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(req.execution_id),
            metadata={"validation_context": req.validation_context},
        )
    )
    return {"evaluation": result, "correlation_id": correlation_id}


@router.get("")
async def list_evaluations(
    tenant_id: str = "default",
    request_id: str | None = None,
    conversation_id: str | None = None,
    decision: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    evaluations = await container.query_bus.dispatch(
        SearchEvaluationsQuery(
            tenant_id=TenantId(tenant_id),
            request_id=None,
            conversation_id=conversation_id,
            decision=decision,
            limit=limit,
        )
    )
    return {"evaluations": evaluations}


@router.get("/metrics")
async def quality_metrics(tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    metrics = await container.query_bus.dispatch(
        QualityMetricsQuery(tenant_id=TenantId(tenant_id))
    )
    return {"metrics": metrics}


@router.get("/{evaluation_id}")
async def get_evaluation(evaluation_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    evaluation = await container.query_bus.dispatch(
        GetEvaluationQuery(
            tenant_id=TenantId(tenant_id),
            evaluation_id=EvaluationId(evaluation_id),
        )
    )
    if evaluation is None:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    decision = await container.query_bus.dispatch(
        GetDecisionQuery(
            tenant_id=TenantId(tenant_id),
            evaluation_id=EvaluationId(evaluation_id),
        )
    )
    return {"evaluation": evaluation, "decision": decision}


@router.get("/{evaluation_id}/findings")
async def get_findings(evaluation_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    findings = await container.query_bus.dispatch(
        GetFindingsQuery(
            tenant_id=TenantId(tenant_id),
            evaluation_id=EvaluationId(evaluation_id),
        )
    )
    return {"findings": findings}
