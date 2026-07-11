"""Immutable workflow context — IDs, references, snapshots only."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WorkflowContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    workflow_id: str
    request_id: str
    correlation_id: str
    idempotency_key: str = ""
    tenant_id: str
    company_id: str | None = None
    branch_id: str | None = None
    user_id: str
    session_id: str
    conversation_id: str | None = None
    module: str = "orbix"
    language: str | None = None
    message: str = ""
    execution_mode: str = "shadow"
    conversation_ref: dict[str, Any] | None = None
    session_ref: dict[str, Any] | None = None
    plan_ref: dict[str, Any] | None = None
    route_ref: dict[str, Any] | None = None
    knowledge_ref: dict[str, Any] | None = None
    memory_store_ref: dict[str, Any] | None = None
    execution_ref: dict[str, Any] | None = None
    memory_update_ref: dict[str, Any] | None = None
    quality_ref: dict[str, Any] | None = None
    action_ref: dict[str, Any] | None = None
    memory_consolidation_ref: dict[str, Any] | None = None
    stream_ref: dict[str, Any] | None = None
    response_ref: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
