"""Correlation and distributed trace context — OpenTelemetry-compatible IDs."""

from __future__ import annotations

import contextvars
import uuid
from dataclasses import dataclass
from typing import Optional

from ...shared.ids import CorrelationId, RequestId, new_correlation_id, new_request_id

_request_id: contextvars.ContextVar[Optional[RequestId]] = contextvars.ContextVar(
    "oip_request_id", default=None
)
_correlation_id: contextvars.ContextVar[Optional[CorrelationId]] = contextvars.ContextVar(
    "oip_correlation_id", default=None
)
_trace_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("oip_trace_id", default=None)
_span_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("oip_span_id", default=None)
_parent_span_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "oip_parent_span_id", default=None
)


def _new_trace_id() -> str:
    return uuid.uuid4().hex


def _new_span_id() -> str:
    return uuid.uuid4().hex[:16]


@dataclass(frozen=True)
class TraceContext:
    trace_id: str
    span_id: str
    parent_span_id: str | None
    request_id: RequestId
    correlation_id: CorrelationId


def bind_trace(
    *,
    request_id: str | None = None,
    correlation_id: str | None = None,
    trace_id: str | None = None,
    span_id: str | None = None,
    parent_span_id: str | None = None,
) -> TraceContext:
    rid = RequestId(request_id) if request_id else new_request_id()
    cid = CorrelationId(correlation_id) if correlation_id else new_correlation_id()
    tid = trace_id or _trace_id.get() or _new_trace_id()
    sid = span_id or _new_span_id()
    parent = parent_span_id or _span_id.get()
    _request_id.set(rid)
    _correlation_id.set(cid)
    _trace_id.set(tid)
    _span_id.set(sid)
    _parent_span_id.set(parent)
    return TraceContext(
        trace_id=tid,
        span_id=sid,
        parent_span_id=parent,
        request_id=rid,
        correlation_id=cid,
    )


def current_trace() -> TraceContext:
    rid = _request_id.get() or new_request_id()
    cid = _correlation_id.get() or new_correlation_id()
    return TraceContext(
        trace_id=_trace_id.get() or _new_trace_id(),
        span_id=_span_id.get() or _new_span_id(),
        parent_span_id=_parent_span_id.get(),
        request_id=rid,
        correlation_id=cid,
    )


def clear_trace() -> None:
    _request_id.set(None)
    _correlation_id.set(None)
    _trace_id.set(None)
    _span_id.set(None)
    _parent_span_id.set(None)
