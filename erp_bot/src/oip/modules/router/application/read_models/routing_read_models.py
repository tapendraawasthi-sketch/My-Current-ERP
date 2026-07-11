"""Routing read models — replay-safe."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RouteDecisionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    status: str
    routing_policy: str
    edition: str
    deployment_mode: str
    primary_provider_id: str
    fallback_providers: tuple[str, ...] = Field(default_factory=tuple)
    selected_tools: list[dict[str, Any]] = Field(default_factory=list)
    estimated_cost_micros: int = 0
    estimated_latency_ms: int = 0
    estimated_tokens: int = 0
    expected_quality: float = 0.0
    reason_codes: tuple[str, ...] = Field(default_factory=tuple)
    candidate_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProviderHealthReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider_id: str
    tenant_id: str = "global"
    circuit_state: str = "closed"
    availability: float = 1.0
    rolling_latency_ms: float = 0.0
    rolling_failure_rate: float = 0.0
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_heartbeat_at: datetime
    updated_at: datetime


class RoutingMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    routes_created: int = 0
    routes_approved: int = 0
    routes_rejected: int = 0
    routes_expired: int = 0
    routes_archived: int = 0
    avg_estimated_latency_ms: float = 0.0
    avg_estimated_cost_micros: float = 0.0
