"""Routing pipeline context."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ...domain.entities import RouteCandidate
from ...domain.provider_metadata import ProviderMetadata
from ...domain.value_objects import RoutingPolicy, RoutingPolicyName, ToolSelection
from ....planner.domain.entities import ExecutionPlan


@dataclass
class RoutingContext:
    plan: ExecutionPlan
    routing_policy_name: RoutingPolicyName
    edition: str
    deployment_mode: str
    routing_policy: RoutingPolicy | None = None
    policy_decisions: dict[str, Any] = field(default_factory=dict)
    required_capabilities: tuple[str, ...] = field(default_factory=tuple)
    providers: tuple[ProviderMetadata, ...] = field(default_factory=tuple)
    filtered_providers: tuple[ProviderMetadata, ...] = field(default_factory=tuple)
    scored_candidates: tuple[RouteCandidate, ...] = field(default_factory=tuple)
    selected_tools: tuple[ToolSelection, ...] = field(default_factory=tuple)
    primary_provider_id: str = ""
    fallback_providers: tuple[str, ...] = field(default_factory=tuple)
    health_snapshot: dict[str, Any] = field(default_factory=dict)
    reason_codes: tuple[str, ...] = field(default_factory=tuple)
