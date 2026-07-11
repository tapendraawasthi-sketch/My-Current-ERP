"""Provider Runtime domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    STREAMING = "streaming"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"
    ARCHIVED = "archived"


class ExecutionPolicyName(str, Enum):
    FAST = "fast"
    BALANCED = "balanced"
    QUALITY = "quality"
    ACCOUNTING = "accounting"
    GOVERNMENT = "government"
    OFFLINE = "offline"
    LOW_COST = "low_cost"
    HYBRID = "hybrid"


class FailureKind(str, Enum):
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    TIMEOUT = "timeout"
    BUDGET_EXCEEDED = "budget_exceeded"
    TOOL_DENIED = "tool_denied"
    CAPABILITY_INVALID = "capability_invalid"
    PROVIDER_THROTTLED = "provider_throttled"
    CIRCUIT_OPEN = "circuit_open"
    STREAMING_ABORTED = "streaming_aborted"
    USER_CANCELLED = "user_cancelled"


class RetryClass(str, Enum):
    RETRYABLE = "retryable"
    NON_RETRYABLE = "non_retryable"


class StreamingMode(str, Enum):
    SSE = "sse"
    WEBSOCKET = "websocket"
    OFFLINE_REPLAY = "offline_replay"
    NONE = "none"


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class ExecutionPolicy(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: ExecutionPolicyName
    max_latency_ms: int = 30_000
    max_cost_micros: int = 500_000
    max_tokens: int = 16_000
    streaming_enabled: bool = True
    require_capability_token: bool = True
    offline_only: bool = False


class ExecutionLimits(BaseModel):
    model_config = ConfigDict(frozen=True)

    max_tokens: int = 16_000
    max_cost_micros: int = 500_000
    max_latency_ms: int = 30_000
    max_tool_calls: int = 10
    max_retries: int = 2


class ExecutionBudget(BaseModel):
    model_config = ConfigDict(frozen=True)

    budget_id: str
    execution_id: str
    tenant_id: str
    allocated_tokens: int = 0
    allocated_cost_micros: int = 0
    allocated_latency_ms: int = 0
    consumed_tokens: int = 0
    consumed_cost_micros: int = 0
    consumed_latency_ms: int = 0
    remaining_tokens: int = 0
    remaining_cost_micros: int = 0
    exceeded: bool = False


class CapabilityToken(BaseModel):
    model_config = ConfigDict(frozen=True)

    token_id: str
    request_id: str
    conversation_id: str | None = None
    company_id: str | None = None
    tenant_id: str
    expires_at: str
    allowed_tools: tuple[str, ...] = Field(default_factory=tuple)
    allowed_erp_actions: tuple[str, ...] = Field(default_factory=tuple)
    maximum_calls: int = 10
    read_scope: tuple[str, ...] = Field(default_factory=tuple)
    write_scope: tuple[str, ...] = Field(default_factory=tuple)
    revoked: bool = False


class ExecutionContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    context_id: str
    execution_id: str
    tenant_id: str
    request_id: str
    conversation_id: str | None = None
    company_id: str | None = None
    route_id: str
    plan_id: str
    provider_id: str
    model_hint: str | None = None
    policy_name: ExecutionPolicyName
    edition: str
    deployment_mode: str
    capability_token_id: str
    sandbox_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProviderUsage(BaseModel):
    model_config = ConfigDict(frozen=True)

    usage_id: str
    execution_id: str
    tenant_id: str
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


class ExecutionArtifact(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifact_id: str
    execution_id: str
    tenant_id: str
    blob_pointer: str
    content_hash: str
    encrypted: bool = True
    ttl_seconds: int = 86_400
    provider_id: str = ""
    model: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ProviderInvocation(BaseModel):
    model_config = ConfigDict(frozen=True)

    invocation_id: str
    execution_id: str
    tenant_id: str
    provider_id: str
    model: str = ""
    attempt: int = 1
    success: bool = False
    latency_ms: int = 0
    error_code: str | None = None
    retry_class: RetryClass | None = None
    created_at: str


class StreamingState(BaseModel):
    model_config = ConfigDict(frozen=True)

    streaming_id: str
    execution_id: str
    mode: StreamingMode = StreamingMode.NONE
    chunk_count: int = 0
    provisional: bool = True
    started_at: str | None = None
    completed_at: str | None = None
    aborted: bool = False


class ExecutionFailure(BaseModel):
    model_config = ConfigDict(frozen=True)

    failure_id: str
    execution_id: str
    kind: FailureKind
    retry_class: RetryClass
    message: str = ""
    provider_id: str | None = None
    occurred_at: str


class ExecutionCompensation(BaseModel):
    model_config = ConfigDict(frozen=True)

    compensation_id: str
    execution_id: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


class ExecutionTimeout(BaseModel):
    model_config = ConfigDict(frozen=True)

    timeout_id: str
    execution_id: str
    deadline_ms: int
    exceeded: bool = False


class ExecutionCancellation(BaseModel):
    model_config = ConfigDict(frozen=True)

    cancellation_id: str
    execution_id: str
    reason: str = ""
    cancelled_by: str = "system"


class ExecutionCheckpoint(BaseModel):
    model_config = ConfigDict(frozen=True)

    checkpoint_id: str
    execution_id: str
    sequence_no: int
    state_snapshot: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ExecutionHealth(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider_id: str
    circuit_state: CircuitState = CircuitState.CLOSED
    availability: float = 1.0
    rolling_latency_ms: float = 0.0
    rolling_failure_rate: float = 0.0


class ExecutionResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    result_id: str
    execution_id: str
    success: bool
    output_text: str = ""
    output_json: dict[str, Any] = Field(default_factory=dict)
    artifact_id: str | None = None
    usage: ProviderUsage | None = None
    failure: ExecutionFailure | None = None
