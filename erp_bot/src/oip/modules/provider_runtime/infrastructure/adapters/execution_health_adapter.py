"""Execution health adapter."""

from __future__ import annotations

from ...application.ports.execution_ports import ExecutionHealthPort
from ...domain.value_objects import CircuitState, ExecutionHealth


class DefaultExecutionHealthAdapter(ExecutionHealthPort):
    def __init__(self) -> None:
        self._health: dict[str, ExecutionHealth] = {}
        self._failures: dict[str, int] = {}
        self._successes: dict[str, int] = {}

    async def get_provider_health(self, *, provider_id: str, tenant_id: str) -> ExecutionHealth:
        key = f"{tenant_id}:{provider_id}"
        if key not in self._health:
            self._health[key] = ExecutionHealth(provider_id=provider_id)
        return self._health[key]

    async def record_success(self, *, provider_id: str, tenant_id: str, latency_ms: int) -> None:
        key = f"{tenant_id}:{provider_id}"
        self._successes[key] = self._successes.get(key, 0) + 1
        current = await self.get_provider_health(provider_id=provider_id, tenant_id=tenant_id)
        total = self._successes[key] + self._failures.get(key, 0)
        failure_rate = self._failures.get(key, 0) / max(total, 1)
        self._health[key] = ExecutionHealth(
            provider_id=provider_id,
            circuit_state=CircuitState.CLOSED if failure_rate < 0.5 else CircuitState.OPEN,
            availability=self._successes[key] / max(total, 1),
            rolling_latency_ms=float(latency_ms),
            rolling_failure_rate=failure_rate,
        )

    async def record_failure(self, *, provider_id: str, tenant_id: str, error_code: str) -> None:
        key = f"{tenant_id}:{provider_id}"
        self._failures[key] = self._failures.get(key, 0) + 1
        total = self._successes.get(key, 0) + self._failures[key]
        failure_rate = self._failures[key] / max(total, 1)
        self._health[key] = ExecutionHealth(
            provider_id=provider_id,
            circuit_state=CircuitState.OPEN if failure_rate >= 0.5 else CircuitState.HALF_OPEN,
            availability=self._successes.get(key, 0) / max(total, 1),
            rolling_failure_rate=failure_rate,
        )
