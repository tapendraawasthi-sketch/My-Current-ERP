"""Bridge legacy OIP correlation bind to MAI-03 validated IDs."""

from __future__ import annotations

import contextvars
from dataclasses import dataclass
from typing import Optional

from ...shared.ids import CorrelationId, RequestId, new_correlation_id, new_request_id
from .mai03_identity import sanitize_or_generate_correlation_id, sanitize_or_generate_request_id

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
    return sanitize_or_generate_correlation_id(None)[0].replace("-", "")


def _new_span_id() -> str:
    from .mai03_identity import new_span_hex

    return new_span_hex()


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
    # MAI-03: never reflect invalid inbound IDs.
    safe_corr, _ = sanitize_or_generate_correlation_id(correlation_id)
    safe_req = sanitize_or_generate_request_id(request_id) if request_id else str(new_request_id())
    if request_id and sanitize_or_generate_correlation_id(request_id)[0] != request_id:
        safe_req = str(new_request_id())
    rid = RequestId(safe_req)
    cid = CorrelationId(safe_corr)
    tid = trace_id or _trace_id.get() or safe_corr.replace("-", "")
    # Validate trace_id likewise.
    if correlation_id and sanitize_or_generate_correlation_id(trace_id or "")[1].value == "GENERATED" and trace_id:
        tid = safe_corr.replace("-", "")
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
