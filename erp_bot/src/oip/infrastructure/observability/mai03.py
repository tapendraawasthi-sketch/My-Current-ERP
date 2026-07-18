"""MAI-03 public facade for active Orbix path."""

from __future__ import annotations

from typing import Any

from .mai03_context import (
    TraceContextV1,
    bind_scope_references,
    clear_trace_context,
    create_trace_context,
    derive_background_context,
    get_trace_context,
    require_trace_context,
    set_trace_context,
    trace_context_scope,
)
from .mai03_identity import (
    MAX_CORRELATION_HEADER_LENGTH,
    REDACTION_VERSION,
    TRACE_SCHEMA_VERSION,
    CorrelationSource,
    is_valid_correlation_id,
    is_valid_trace_reference,
    make_trace_reference,
    sanitize_or_generate_correlation_id,
)
from .mai03_recorder import (
    get_memory_trace_sink,
    get_trace_recorder,
    reset_trace_recorder_for_tests,
)
from .mai03_lookup import (
    TRACE_LOOKUP_DENIED,
    TRACE_LOOKUP_UNAUTHORIZED,
    TRACE_LOOKUP_UNAVAILABLE,
    VIEW_DEBUG_TRACES_PERMISSION,
    lookup_trace,
)
from .mai03_redaction import redact_exception, redact_for_trace, redact_mapping, validate_safe_event
from .mai03_stages import TraceStage, TraceStatus

HEADER_CORRELATION = "x-correlation-id"
HEADER_REQUEST = "x-request-id"


def extract_inbound_correlation(headers: Any) -> str | None:
    """Read correlation hint from headers-like mapping (case-insensitive)."""
    if headers is None:
        return None
    try:
        raw = headers.get(HEADER_CORRELATION) or headers.get("X-Correlation-ID")
    except Exception:  # noqa: BLE001
        raw = None
    if raw is None and hasattr(headers, "items"):
        for k, v in headers.items():
            if str(k).lower() == HEADER_CORRELATION:
                raw = v
                break
    if raw is None:
        return None
    text = str(raw).strip()
    if len(text) > MAX_CORRELATION_HEADER_LENGTH:
        return None
    return text


def start_request_trace(
    *,
    headers: Any = None,
    conversation_id: str | None = None,
    route: str = "/orbix/chat/stream",
) -> TraceContextV1:
    inbound = extract_inbound_correlation(headers)
    ctx = create_trace_context(
        inbound_correlation_id=inbound,
        conversation_reference=conversation_id,
    )
    set_trace_context(ctx)
    # Keep legacy contextvars in sync for existing span helpers.
    from .correlation import bind_trace

    bind_trace(
        request_id=ctx.request_id,
        correlation_id=ctx.correlation_id,
        trace_id=ctx.trace_id,
        span_id=ctx.current_span_id,
    )
    recorder = get_trace_recorder()
    recorder.reset_terminal_guard()
    recorder.start_stage(
        TraceStage.GATEWAY_RECEIVED,
        component="api",
        route=route,
        safe_attributes={"correlation_source": ctx.correlation_source.value},
    )
    return ctx


__all__ = [
    "HEADER_CORRELATION",
    "HEADER_REQUEST",
    "MAX_CORRELATION_HEADER_LENGTH",
    "REDACTION_VERSION",
    "TRACE_SCHEMA_VERSION",
    "CorrelationSource",
    "TraceContextV1",
    "TraceStage",
    "TraceStatus",
    "bind_scope_references",
    "clear_trace_context",
    "create_trace_context",
    "derive_background_context",
    "extract_inbound_correlation",
    "get_memory_trace_sink",
    "get_trace_context",
    "get_trace_recorder",
    "is_valid_correlation_id",
    "is_valid_trace_reference",
    "lookup_trace",
    "make_trace_reference",
    "redact_exception",
    "redact_for_trace",
    "redact_mapping",
    "require_trace_context",
    "reset_trace_recorder_for_tests",
    "sanitize_or_generate_correlation_id",
    "set_trace_context",
    "start_request_trace",
    "trace_context_scope",
    "validate_safe_event",
    "TRACE_LOOKUP_DENIED",
    "TRACE_LOOKUP_UNAUTHORIZED",
    "TRACE_LOOKUP_UNAVAILABLE",
    "VIEW_DEBUG_TRACES_PERMISSION",
]
