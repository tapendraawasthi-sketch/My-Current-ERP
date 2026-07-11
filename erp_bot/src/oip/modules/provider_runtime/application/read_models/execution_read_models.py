"""Execution read models — replay-safe."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ExecutionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    execution_id: str
    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    status: str
    policy_name: str
    provider_id: str
    fallback_providers: tuple[str, ...] = Field(default_factory=tuple)
    selected_tools: tuple[str, ...] = Field(default_factory=tuple)
    estimated_tokens: int = 0
    output_text: str = ""
    artifact_count: int = 0
    chunk_count: int = 0
    success: bool | None = None
    failure_kind: str | None = None
    created_at: str
    updated_at: str
    started_at: str | None = None
    completed_at: str | None = None


class ExecutionUsageReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    execution_id: str
    provider_id: str
    model: str = ""
    region: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cache_hits: int = 0
    latency_ms: int = 0
    cost_micros: int = 0
    retries: int = 0
    streaming_duration_ms: int = 0
    tool_count: int = 0


class ExecutionArtifactReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifact_id: str
    execution_id: str
    blob_pointer: str
    content_hash: str
    encrypted: bool
    ttl_seconds: int
    provider_id: str
    model: str
    created_at: str


class ExecutionMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    executions_started: int = 0
    executions_completed: int = 0
    executions_failed: int = 0
    executions_cancelled: int = 0
    executions_timed_out: int = 0
    total_tokens: int = 0
    total_cost_micros: int = 0
    avg_latency_ms: float = 0.0
