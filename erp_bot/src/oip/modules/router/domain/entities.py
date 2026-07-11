"""Router domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    CapabilityMatch,
    CostEstimate,
    FallbackChain,
    HealthScore,
    LatencyEstimate,
    ProviderSelection,
    QualityEstimate,
    RouteReason,
    RouteStatus,
    RoutingPolicyName,
    RoutingScore,
    ToolSelection,
)


class RouteCandidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    candidate_id: str
    route_id: str
    tenant_id: str
    provider_id: str
    rank_order: int
    score: RoutingScore
    capability_match: CapabilityMatch
    latency_estimate: LatencyEstimate
    cost_estimate: CostEstimate
    quality_estimate: QualityEstimate
    health_score: HealthScore
    reason_codes: tuple[RouteReason, ...] = Field(default_factory=tuple)
    selected: bool = False
    created_at: datetime


class ExecutionRoute(BaseModel):
    model_config = ConfigDict(frozen=True)

    route_id: str
    plan_id: str
    step_type: str
    provider_id: str
    tool_ids: tuple[str, ...] = Field(default_factory=tuple)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RouteDecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    status: RouteStatus
    routing_policy: RoutingPolicyName
    edition: str
    deployment_mode: str
    primary_provider: ProviderSelection
    fallback_chain: FallbackChain
    selected_tools: tuple[ToolSelection, ...] = Field(default_factory=tuple)
    candidates: tuple[RouteCandidate, ...] = Field(default_factory=tuple)
    estimated_cost_micros: int = 0
    estimated_latency_ms: int = 0
    estimated_tokens: int = 0
    expected_quality: float = 0.0
    policy_decisions: dict[str, Any] = Field(default_factory=dict)
    reason_codes: tuple[RouteReason, ...] = Field(default_factory=tuple)
    health_snapshot: dict[str, HealthScore] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    expired_at: datetime | None = None
    archived_at: datetime | None = None
