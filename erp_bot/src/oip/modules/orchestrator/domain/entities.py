"""Orchestrator domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    ExecutionMode,
    RetryState,
    RollbackState,
    WorkflowMetrics,
    WorkflowStageName,
    WorkflowState,
)


class WorkflowExecution(BaseModel):
    """Immutable workflow execution aggregate."""

    model_config = ConfigDict(frozen=True)

    workflow_id: str
    request_id: str
    conversation_id: str | None = None
    session_id: str
    tenant_id: str
    company_id: str | None = None
    branch_id: str | None = None
    user_id: str
    correlation_id: str
    idempotency_key: str = ""
    execution_mode: ExecutionMode
    workflow_state: WorkflowState
    current_stage: WorkflowStageName | None = None
    completed_stages: tuple[str, ...] = Field(default_factory=tuple)
    failed_stage: str | None = None
    rollback_state: RollbackState = Field(default_factory=RollbackState)
    retry_state: RetryState = Field(default_factory=RetryState)
    module: str = "orbix"
    message: str = ""
    snapshots: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    metrics: WorkflowMetrics = Field(default_factory=WorkflowMetrics)
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
