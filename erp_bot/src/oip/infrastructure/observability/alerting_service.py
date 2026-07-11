"""Operational alerting — structured alerts for production incidents."""

from __future__ import annotations

from typing import Any

from ..persistence.outbox_sqlite import SqliteOutboxAdapter
from ..security.security_event_service import SecurityEventService
from .logging import log_event
from .metrics import get_metrics_registry
from .readiness_service import ReadinessService


class AlertingService:
    def __init__(
        self,
        *,
        readiness: ReadinessService,
        outbox: SqliteOutboxAdapter,
        security_events: SecurityEventService | None = None,
    ) -> None:
        self._readiness = readiness
        self._outbox = outbox
        self._security = security_events

    async def evaluate(self) -> list[dict[str, Any]]:
        alerts: list[dict[str, Any]] = []
        stats = await self._outbox.get_queue_stats()
        if stats["dead_letter"] > 10:
            alert = {
                "alert_type": "dead_letter_growth",
                "severity": "warning",
                "detail": stats,
            }
            alerts.append(alert)
            await self._readiness.record_alert(**alert)
        if stats["unpublished"] > 500:
            alert = {
                "alert_type": "queue_overflow",
                "severity": "critical",
                "detail": stats,
            }
            alerts.append(alert)
            await self._readiness.record_alert(**alert)
        metrics = get_metrics_registry()
        log_event("ops.alerting.evaluated", alert_count=len(alerts))
        return alerts

    async def provider_failure(self, *, provider: str, error: str) -> None:
        await self._readiness.record_alert(
            alert_type="provider_failure",
            severity="warning",
            detail={"provider": provider, "error": error},
        )

    async def erp_failure(self, *, connector_id: str, error: str) -> None:
        await self._readiness.record_alert(
            alert_type="erp_failure",
            severity="warning",
            detail={"connector_id": connector_id, "error": error},
        )

    async def circuit_breaker_open(self, *, connector_id: str) -> None:
        await self._readiness.record_alert(
            alert_type="circuit_breaker_open",
            severity="critical",
            detail={"connector_id": connector_id},
        )

    async def high_latency(self, *, component: str, latency_ms: float, threshold_ms: float) -> None:
        if latency_ms <= threshold_ms:
            return
        await self._readiness.record_alert(
            alert_type="high_latency",
            severity="warning",
            detail={"component": component, "latency_ms": latency_ms, "threshold_ms": threshold_ms},
        )
