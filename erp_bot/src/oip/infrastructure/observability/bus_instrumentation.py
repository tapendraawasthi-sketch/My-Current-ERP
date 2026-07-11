"""Instrumented CQRS buses — tracing and metrics without modifying bus contracts."""

from __future__ import annotations

import time
from typing import Any

from ...application.bus.command_bus import CommandBus
from ...application.bus.query_bus import QueryBus
from .metrics import get_metrics_registry
from .tracing import span


class InstrumentedCommandBus:
    def __init__(self, inner: CommandBus) -> None:
        self._inner = inner

    def register(self, command_type: str, handler) -> None:
        self._inner.register(command_type, handler)

    async def dispatch(self, command: Any) -> Any:
        command_type = getattr(command, "command_type", command.__class__.__name__)
        metrics = get_metrics_registry()
        started = time.perf_counter()
        with span("command.dispatch", command_type=command_type):
            try:
                result = await self._inner.dispatch(command)
                metrics.inc_counter("oip_requests_total", bus="command", operation=command_type)
                return result
            except Exception as exc:
                metrics.inc_counter(
                    "oip_failures_total",
                    component="command_bus",
                    reason=exc.__class__.__name__,
                )
                raise
            finally:
                metrics.observe_histogram(
                    "oip_workflow_latency_seconds",
                    time.perf_counter() - started,
                )


class InstrumentedQueryBus:
    def __init__(self, inner: QueryBus) -> None:
        self._inner = inner

    def register(self, query_type: str, handler) -> None:
        self._inner.register(query_type, handler)

    async def dispatch(self, query: Any) -> Any:
        query_type = getattr(query, "query_type", query.__class__.__name__)
        metrics = get_metrics_registry()
        with span("query.dispatch", query_type=query_type):
            try:
                result = await self._inner.dispatch(query)
                metrics.inc_counter("oip_requests_total", bus="query", operation=query_type)
                return result
            except Exception as exc:
                metrics.inc_counter(
                    "oip_failures_total",
                    component="query_bus",
                    reason=exc.__class__.__name__,
                )
                raise
