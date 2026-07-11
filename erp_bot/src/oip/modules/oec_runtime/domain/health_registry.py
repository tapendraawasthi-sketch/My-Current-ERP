"""Health evaluation registry."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import HealthState


@dataclass(frozen=True)
class HealthThreshold:
    name: str
    degraded_latency_ms: int = 500
    unhealthy_latency_ms: int = 2000
    min_availability: float = 0.95


class HealthRegistry:
    def __init__(self) -> None:
        self._thresholds: dict[str, HealthThreshold] = {}

    def register(self, threshold: HealthThreshold) -> None:
        self._thresholds[threshold.name] = threshold

    def evaluate(self, *, latency_ms: int, availability: float, name: str = "default") -> HealthState:
        threshold = self._thresholds.get(name) or HealthThreshold(name="default")
        if availability < threshold.min_availability or latency_ms >= threshold.unhealthy_latency_ms:
            return HealthState.UNHEALTHY
        if latency_ms >= threshold.degraded_latency_ms:
            return HealthState.DEGRADED
        return HealthState.HEALTHY


def create_default_health_registry() -> HealthRegistry:
    registry = HealthRegistry()
    registry.register(HealthThreshold("default"))
    registry.register(HealthThreshold("strict", degraded_latency_ms=200, unhealthy_latency_ms=1000, min_availability=0.99))
    return registry
