"""Execution pipeline context."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ...domain.entities import ExecutionAggregate
from ...domain.value_objects import (
    CapabilityToken,
    ExecutionArtifact,
    ExecutionBudget,
    ExecutionContext,
    ExecutionPolicy,
    ExecutionPolicyName,
    ExecutionResult,
    ProviderUsage,
    StreamingState,
)
from ....router.domain.entities import RouteDecision


@dataclass
class ExecutionPipelineContext:
    route: RouteDecision
    policy_name: ExecutionPolicyName
    policy: ExecutionPolicy | None = None
    execution: ExecutionAggregate | None = None
    capability_token: CapabilityToken | None = None
    sandbox_id: str = ""
    context: ExecutionContext | None = None
    budget: ExecutionBudget | None = None
    prompt: str = ""
    provider_response: dict[str, Any] = field(default_factory=dict)
    stream_chunks: list[str] = field(default_factory=list)
    streaming: StreamingState | None = None
    usage: ProviderUsage | None = None
    artifact: ExecutionArtifact | None = None
    result: ExecutionResult | None = None
    failure_message: str = ""
    streaming_enabled: bool = True
    retry_count: int = 0
    resolved_provider_id: str = ""
