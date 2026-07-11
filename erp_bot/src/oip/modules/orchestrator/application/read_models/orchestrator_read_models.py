"""Orchestrator read models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WorkflowReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    workflow_id: str
    request_id: str
    conversation_id: str | None = None
    session_id: str
    tenant_id: str
    company_id: str | None = None
    execution_mode: str
    workflow_state: str
    current_stage: str | None = None
    completed_stages: tuple[str, ...] = Field(default_factory=tuple)
    failed_stage: str | None = None
    module: str
    started_at: str
    updated_at: str
    completed_at: str | None = None
    snapshots: dict = Field(default_factory=dict)


class WorkflowTimelineEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    stage: str
    status: str
    started_at: str
    completed_at: str | None = None
    duration_ms: int = 0
    retry_count: int = 0
    error: str = ""


class WorkflowTimelineReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    workflow_id: str
    request_id: str
    workflow_state: str
    entries: tuple[WorkflowTimelineEntry, ...] = Field(default_factory=tuple)


class WorkflowMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    workflows_started: int = 0
    workflows_completed: int = 0
    workflows_failed: int = 0
    workflows_cancelled: int = 0
    retries_scheduled: int = 0
    rollbacks_performed: int = 0
    active_workflows: int = 0
