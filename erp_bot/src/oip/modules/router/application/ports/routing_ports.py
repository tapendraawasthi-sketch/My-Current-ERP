"""Application ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ...domain.entities import RouteDecision
from ...domain.provider_metadata import ProviderMetadata
from ...domain.value_objects import HealthScore, RoutingPolicy, RoutingPolicyName
from ....planner.domain.entities import ExecutionPlan


class RoutingPort(ABC):
    @abstractmethod
    async def create_route_decision(self, *, plan: ExecutionPlan, routing_policy: RoutingPolicyName) -> RouteDecision:
        """Produce immutable route decision from execution plan."""


class ProviderRegistryPort(ABC):
    @abstractmethod
    def list_providers(self) -> tuple[ProviderMetadata, ...]:
        """Return registered provider metadata."""

    @abstractmethod
    def get_provider(self, provider_id: str) -> ProviderMetadata | None:
        """Lookup provider metadata."""


class ToolRegistryPort(ABC):
    @abstractmethod
    def resolve_tools(self, *, tool_ids: tuple[str, ...]) -> tuple[dict[str, Any], ...]:
        """Resolve tool metadata for routing."""


class RoutingPolicyPort(ABC):
    @abstractmethod
    def resolve(self, *, policy_name: RoutingPolicyName) -> RoutingPolicy:
        """Resolve routing policy weights."""


class ProviderHealthPort(ABC):
    @abstractmethod
    async def get_health(self, *, provider_id: str, tenant_id: str = "global") -> HealthScore:
        """Return provider health snapshot."""

    @abstractmethod
    async def list_health(self, *, tenant_id: str = "global") -> dict[str, HealthScore]:
        """Return all provider health records."""


class EditionCapabilityPort(ABC):
    @abstractmethod
    def filter_providers(
        self,
        *,
        providers: tuple[ProviderMetadata, ...],
        edition: str,
        deployment_mode: str,
        offline_only: bool,
    ) -> tuple[ProviderMetadata, ...]:
        """Filter providers by edition and deployment mode."""


class PolicyDecisionPort(ABC):
    @abstractmethod
    def evaluate(
        self,
        *,
        plan: ExecutionPlan,
        routing_policy: RoutingPolicyName,
    ) -> dict[str, Any]:
        """Return policy decision metadata."""
