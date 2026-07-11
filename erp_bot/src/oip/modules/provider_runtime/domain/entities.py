"""Provider Runtime domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    CapabilityToken,
    ExecutionArtifact,
    ExecutionBudget,
    ExecutionCancellation,
    ExecutionCheckpoint,
    ExecutionContext,
    ExecutionFailure,
    ExecutionHealth,
    ExecutionLimits,
    ExecutionPolicyName,
    ExecutionResult,
    ExecutionStatus,
    ProviderInvocation,
    ProviderUsage,
    StreamingState,
)


class ExecutionAggregate(BaseModel):
    """Root execution aggregate — immutable after status transitions via model_copy."""

    model_config = ConfigDict(frozen=True)

    execution_id: str
    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    status: ExecutionStatus
    policy_name: ExecutionPolicyName
    edition: str
    deployment_mode: str
    provider_id: str
    fallback_providers: tuple[str, ...] = Field(default_factory=tuple)
    selected_tools: tuple[str, ...] = Field(default_factory=tuple)
    context: ExecutionContext | None = None
    capability_token: CapabilityToken | None = None
    limits: ExecutionLimits = Field(default_factory=ExecutionLimits)
    budget: ExecutionBudget | None = None
    invocations: tuple[ProviderInvocation, ...] = Field(default_factory=tuple)
    usage: ProviderUsage | None = None
    artifacts: tuple[ExecutionArtifact, ...] = Field(default_factory=tuple)
    streaming: StreamingState | None = None
    result: ExecutionResult | None = None
    failure: ExecutionFailure | None = None
    checkpoints: tuple[ExecutionCheckpoint, ...] = Field(default_factory=tuple)
    cancellation: ExecutionCancellation | None = None
    health_snapshot: dict[str, ExecutionHealth] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    timed_out_at: datetime | None = None
    archived_at: datetime | None = None
