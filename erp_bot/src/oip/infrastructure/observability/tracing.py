"""OpenTelemetry-compatible tracing — span propagation and metrics."""

from __future__ import annotations

from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Iterator
from uuid import uuid4

from .correlation import _new_span_id, bind_trace, current_trace
from .logging import log_event
from .metrics import get_metrics_registry


@contextmanager
def span(name: str, **attributes: Any) -> Iterator[dict[str, Any]]:
    parent = current_trace()
    child_span_id = _new_span_id()
    bind_trace(
        request_id=str(parent.request_id),
        correlation_id=str(parent.correlation_id),
        trace_id=parent.trace_id,
        span_id=child_span_id,
        parent_span_id=parent.span_id,
    )
    started = datetime.now(timezone.utc)
    started_perf = datetime.now(timezone.utc)
    log_event(
        "span.start",
        span_id=child_span_id,
        span_name=name,
        trace_id=parent.trace_id,
        parent_span_id=parent.span_id,
        **attributes,
    )
    ctx = {
        "trace_id": parent.trace_id,
        "span_id": child_span_id,
        "parent_span_id": parent.span_id,
        "span_name": name,
        "request_id": str(parent.request_id),
        "correlation_id": str(parent.correlation_id),
    }
    try:
        yield ctx
    finally:
        elapsed_ms = int((datetime.now(timezone.utc) - started_perf).total_seconds() * 1000)
        elapsed_s = elapsed_ms / 1000.0
        metrics = get_metrics_registry()
        stage = attributes.get("stage") or name
        if stage:
            metrics.observe_histogram("oip_stage_latency_seconds", elapsed_s, stage=stage)
        log_event(
            "span.end",
            span_id=child_span_id,
            span_name=name,
            trace_id=parent.trace_id,
            parent_span_id=parent.span_id,
            latency_ms=elapsed_ms,
        )
        bind_trace(
            request_id=str(parent.request_id),
            correlation_id=str(parent.correlation_id),
            trace_id=parent.trace_id,
            span_id=parent.span_id,
            parent_span_id=parent.parent_span_id,
        )


@asynccontextmanager
async def async_span(name: str, **attributes: Any) -> AsyncIterator[dict[str, Any]]:
    with span(name, **attributes) as ctx:
        yield ctx


def new_root_trace(**kwargs: Any) -> dict[str, Any]:
    trace_id = uuid4().hex
    ctx = bind_trace(trace_id=trace_id, **kwargs)
    return {
        "trace_id": ctx.trace_id,
        "span_id": ctx.span_id,
        "request_id": str(ctx.request_id),
        "correlation_id": str(ctx.correlation_id),
    }
