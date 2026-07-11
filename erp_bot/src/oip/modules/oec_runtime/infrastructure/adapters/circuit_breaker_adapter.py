"""Circuit breaker adapter."""

from __future__ import annotations

from datetime import datetime, timezone

from ...application.ports.oec_ports import CircuitBreakerPort, OecRepositoryPort
from ...domain.value_objects import CircuitState


class CircuitBreakerAdapter(CircuitBreakerPort):
    def __init__(self, repository: OecRepositoryPort, *, failure_threshold: int = 5) -> None:
        self._repository = repository
        self._threshold = failure_threshold

    async def allow_request(self, *, tenant_id: str, connector_id: str) -> bool:
        state = await self._repository.get_circuit_state(tenant_id=tenant_id, connector_id=connector_id)
        return state != CircuitState.OPEN.value

    async def record_success(self, *, tenant_id: str, connector_id: str) -> None:
        await self._repository.record_circuit_state(
            tenant_id=tenant_id, connector_id=connector_id, state=CircuitState.CLOSED.value
        )

    async def record_failure(self, *, tenant_id: str, connector_id: str) -> None:
        current = await self._repository.get_circuit_state(tenant_id=tenant_id, connector_id=connector_id)
        if current == CircuitState.OPEN.value:
            return
        failures = await self._repository.increment_circuit_failures(
            tenant_id=tenant_id, connector_id=connector_id
        )
        if failures >= self._threshold:
            await self._repository.record_circuit_state(
                tenant_id=tenant_id, connector_id=connector_id, state=CircuitState.OPEN.value
            )
