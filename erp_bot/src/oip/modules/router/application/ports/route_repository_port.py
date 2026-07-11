"""Route decision repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from ...domain.entities import RouteDecision
from ...domain.value_objects import RouteStatus
from ..read_models.routing_read_models import ProviderHealthReadModel, RoutingMetricsReadModel


class RouteDecisionRepositoryPort(ABC):
    @abstractmethod
    async def save(self, decision: RouteDecision) -> None:
        """Persist immutable route decision."""

    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, route_id: str) -> RouteDecision | None:
        """Load route decision."""

    @abstractmethod
    async def search(
        self,
        *,
        tenant_id: str,
        company_id: str | None = None,
        conversation_id: str | None = None,
        request_id: str | None = None,
        plan_id: str | None = None,
        provider_id: str | None = None,
        status: RouteStatus | None = None,
        limit: int = 50,
    ) -> Sequence[RouteDecision]:
        """Search route decisions."""

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, metric: str, **kwargs) -> None:
        """Update routing metrics read model."""

    @abstractmethod
    async def get_metrics(
        self,
        *,
        tenant_id: str,
        metric_date: str | None = None,
    ) -> RoutingMetricsReadModel:
        """Load routing metrics."""

    @abstractmethod
    async def save_provider_health(self, *, record: ProviderHealthReadModel) -> None:
        """Upsert provider health read model."""

    @abstractmethod
    async def list_provider_health(self, *, tenant_id: str = "global") -> list[ProviderHealthReadModel]:
        """List provider health records."""
