"""Provider health adapter — circuit breaker aware."""

from __future__ import annotations

from datetime import datetime, timezone

from ...application.ports.routing_ports import ProviderHealthPort
from ...application.ports.route_repository_port import RouteDecisionRepositoryPort
from ...application.read_models.routing_read_models import ProviderHealthReadModel
from ...domain.value_objects import CircuitState, HealthScore
from .provider_registry import ProviderRegistry, create_default_provider_registry


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SqliteProviderHealthAdapter(ProviderHealthPort):
    def __init__(
        self,
        repository: RouteDecisionRepositoryPort,
        registry: ProviderRegistry | None = None,
    ) -> None:
        self._repository = repository
        self._registry = registry or create_default_provider_registry()

    async def get_health(self, *, provider_id: str, tenant_id: str = "global") -> HealthScore:
        records = await self._repository.list_provider_health(tenant_id=tenant_id)
        for record in records:
            if record.provider_id == provider_id:
                return HealthScore(
                    availability=record.availability,
                    circuit_state=CircuitState(record.circuit_state),
                    rolling_latency_ms=record.rolling_latency_ms,
                    rolling_failure_rate=record.rolling_failure_rate,
                    score=max(0.0, record.availability * (1.0 - record.rolling_failure_rate)),
                )
        provider = self._registry.get(provider_id)
        default_latency = provider.default_latency_ms if provider else 2000
        await self._repository.save_provider_health(
            record=ProviderHealthReadModel(
                provider_id=provider_id,
                tenant_id=tenant_id,
                circuit_state=CircuitState.CLOSED.value,
                availability=1.0,
                rolling_latency_ms=float(default_latency),
                rolling_failure_rate=0.0,
                last_heartbeat_at=_utc_now(),
                updated_at=_utc_now(),
            )
        )
        return HealthScore(
            availability=1.0,
            circuit_state=CircuitState.CLOSED,
            rolling_latency_ms=float(default_latency),
            rolling_failure_rate=0.0,
            score=1.0,
        )

    async def list_health(self, *, tenant_id: str = "global") -> dict[str, HealthScore]:
        records = await self._repository.list_provider_health(tenant_id=tenant_id)
        if not records:
            for provider in self._registry.list_all():
                await self.get_health(provider_id=provider.provider_id, tenant_id=tenant_id)
            records = await self._repository.list_provider_health(tenant_id=tenant_id)
        return {
            record.provider_id: HealthScore(
                availability=record.availability,
                circuit_state=CircuitState(record.circuit_state),
                rolling_latency_ms=record.rolling_latency_ms,
                rolling_failure_rate=record.rolling_failure_rate,
                score=max(0.0, record.availability * (1.0 - record.rolling_failure_rate)),
            )
            for record in records
        }
