"""Action Runtime read models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ActionExecutionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    action_id: str
    execution_id: str
    evaluation_id: str
    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    user_id: str
    status: str
    action_type: str
    quality_decision: str
    idempotency_key: str
    erp_reference: str | None = None
    success: bool | None = None
    failure_kind: str | None = None
    approval_pending: bool = False
    compensated: bool = False
    created_at: str
    updated_at: str
    executed_at: str | None = None


class ActionMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    actions_proposed: int = 0
    actions_executed: int = 0
    actions_failed: int = 0
    actions_rejected: int = 0
    actions_cancelled: int = 0
    actions_compensated: int = 0
    actions_blocked: int = 0
    idempotency_hits: int = 0
