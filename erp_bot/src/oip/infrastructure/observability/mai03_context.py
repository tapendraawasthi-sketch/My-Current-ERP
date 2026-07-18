"""MAI-03 TraceContext — request-scoped, contextvars isolation."""

from __future__ import annotations

import contextvars
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Iterator

from .mai03_identity import (
    TRACE_SCHEMA_VERSION,
    CorrelationSource,
    make_trace_reference,
    new_opaque_id,
    new_span_hex,
    sanitize_or_generate_correlation_id,
    sanitize_or_generate_request_id,
)

_ctx: contextvars.ContextVar["TraceContextV1 | None"] = contextvars.ContextVar(
    "mai03_trace_context", default=None
)


@dataclass(frozen=True)
class TraceContextV1:
    schema_version: str
    trace_id: str
    request_id: str
    parent_span_id: str | None
    current_span_id: str | None
    trace_reference: str
    correlation_source: CorrelationSource
    tenant_scope_reference: str | None
    company_scope_reference: str | None
    principal_reference: str | None
    conversation_reference: str | None
    contract_schema_version: str
    constitution_policy_version: str
    created_at: datetime
    correlation_id: str


def create_trace_context(
    *,
    inbound_correlation_id: str | None = None,
    inbound_request_id: str | None = None,
    tenant_scope_reference: str | None = None,
    company_scope_reference: str | None = None,
    principal_reference: str | None = None,
    conversation_reference: str | None = None,
    contract_schema_version: str = "1.0.0",
    constitution_policy_version: str = "mai-01.1.0",
    correlation_source: CorrelationSource | None = None,
) -> TraceContextV1:
    cid, source = sanitize_or_generate_correlation_id(inbound_correlation_id)
    if correlation_source is not None:
        source = correlation_source
    rid = new_opaque_id()  # always new request id for this hop
    if inbound_request_id:
        candidate = sanitize_or_generate_request_id(inbound_request_id)
        if candidate != cid:
            rid = candidate
    span = new_span_hex()
    trace_id = cid.replace("-", "") if "-" in cid else cid
    return TraceContextV1(
        schema_version=TRACE_SCHEMA_VERSION,
        trace_id=trace_id,
        request_id=rid,
        parent_span_id=None,
        current_span_id=span,
        trace_reference=make_trace_reference(trace_id=trace_id, request_id=rid),
        correlation_source=source,
        tenant_scope_reference=tenant_scope_reference,
        company_scope_reference=company_scope_reference,
        principal_reference=principal_reference,
        conversation_reference=conversation_reference,
        contract_schema_version=contract_schema_version,
        constitution_policy_version=constitution_policy_version,
        created_at=datetime.now(timezone.utc),
        correlation_id=cid,
    )


def get_trace_context() -> TraceContextV1 | None:
    return _ctx.get()


def require_trace_context() -> TraceContextV1:
    ctx = _ctx.get()
    if ctx is None:
        raise RuntimeError("TRACE_CONTEXT_MISSING")
    return ctx


def set_trace_context(ctx: TraceContextV1) -> contextvars.Token[TraceContextV1 | None]:
    return _ctx.set(ctx)


def clear_trace_context() -> None:
    _ctx.set(None)


def bind_scope_references(
    ctx: TraceContextV1,
    *,
    tenant_scope_reference: str | None = None,
    company_scope_reference: str | None = None,
    principal_reference: str | None = None,
    conversation_reference: str | None = None,
) -> TraceContextV1:
    return replace(
        ctx,
        tenant_scope_reference=tenant_scope_reference
        if tenant_scope_reference is not None
        else ctx.tenant_scope_reference,
        company_scope_reference=company_scope_reference
        if company_scope_reference is not None
        else ctx.company_scope_reference,
        principal_reference=principal_reference
        if principal_reference is not None
        else ctx.principal_reference,
        conversation_reference=conversation_reference
        if conversation_reference is not None
        else ctx.conversation_reference,
    )


def child_span_context(ctx: TraceContextV1) -> TraceContextV1:
    return replace(
        ctx,
        parent_span_id=ctx.current_span_id,
        current_span_id=new_span_hex(),
        correlation_source=CorrelationSource.INTERNAL_CONTINUATION,
    )


@contextmanager
def trace_context_scope(ctx: TraceContextV1) -> Iterator[TraceContextV1]:
    token = set_trace_context(ctx)
    try:
        yield ctx
    finally:
        _ctx.reset(token)


def derive_background_context(ctx: TraceContextV1) -> TraceContextV1:
    new_rid = new_opaque_id()
    return replace(
        ctx,
        request_id=new_rid,
        parent_span_id=ctx.current_span_id,
        current_span_id=new_span_hex(),
        correlation_source=CorrelationSource.INTERNAL_CONTINUATION,
        trace_reference=make_trace_reference(trace_id=ctx.trace_id, request_id=new_rid),
    )
