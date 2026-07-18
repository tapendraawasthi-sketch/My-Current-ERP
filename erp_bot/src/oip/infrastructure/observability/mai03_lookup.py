"""MAI-03 trace lookup policy — authorization without durable production store."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .mai03_identity import is_valid_trace_reference
from .mai03_recorder import TraceSinkPort, get_memory_trace_sink

VIEW_DEBUG_TRACES_PERMISSION = "view_debug_traces"
TRACE_LOOKUP_UNAVAILABLE = "TRACE_LOOKUP_UNAVAILABLE"
TRACE_LOOKUP_DENIED = "TRACE_LOOKUP_DENIED"
TRACE_LOOKUP_UNAUTHORIZED = "TRACE_LOOKUP_UNAUTHORIZED"
TRACE_LOOKUP_INVALID_REFERENCE = "TRACE_LOOKUP_INVALID_REFERENCE"


class TrustedLookupPrincipal(Protocol):
    tenant_id: str
    active_company_id: str | None
    permissions: tuple[str, ...] | list[str] | frozenset[str] | set[str]


@dataclass(frozen=True)
class TraceLookupResult:
    ok: bool
    code: str
    http_status: int
    payload: dict[str, Any] | None = None


def _has_perm(principal: TrustedLookupPrincipal, perm: str) -> bool:
    perms = {str(p) for p in (principal.permissions or ())}
    return perm in perms


def lookup_trace(
    trace_reference: str,
    *,
    principal: TrustedLookupPrincipal | None,
    sink: TraceSinkPort | None = None,
    queryable: bool = False,
) -> TraceLookupResult:
    """
    Policy for GET /oip/v1/traces/{trace_reference}.

    Production default: structured-log sink is not queryable → TRACE_LOOKUP_UNAVAILABLE.
    In-memory sink may be used only when queryable=True (tests/dev).
    """
    if principal is None:
        return TraceLookupResult(False, TRACE_LOOKUP_UNAUTHORIZED, 401)
    if not _has_perm(principal, VIEW_DEBUG_TRACES_PERMISSION):
        return TraceLookupResult(False, TRACE_LOOKUP_DENIED, 403)
    if not is_valid_trace_reference(trace_reference):
        return TraceLookupResult(False, TRACE_LOOKUP_INVALID_REFERENCE, 400)

    if not queryable:
        return TraceLookupResult(
            False,
            TRACE_LOOKUP_UNAVAILABLE,
            503,
            payload={
                "safe_error_code": TRACE_LOOKUP_UNAVAILABLE,
                "message": "Queryable trace sink is not configured",
            },
        )

    active_sink = sink or get_memory_trace_sink()
    trusted_scope = {
        "tenant_id": str(principal.tenant_id),
        "company_id": str(principal.active_company_id or ""),
    }
    summary = active_sink.query(trace_reference, trusted_scope=trusted_scope)
    if summary is None:
        # Deny without existence leak for wrong tenant / missing
        return TraceLookupResult(False, TRACE_LOOKUP_DENIED, 403)
    return TraceLookupResult(True, "OK", 200, payload=summary)


def models_and_tools_may_not_lookup() -> bool:
    """Documented invariant: model/tool runtimes must not invoke lookup."""
    return True
