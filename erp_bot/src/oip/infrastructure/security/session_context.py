"""Request-scoped security session context."""

from __future__ import annotations

import contextvars
from dataclasses import dataclass
from typing import Optional

from .principal import SecurityPrincipal

_principal: contextvars.ContextVar[Optional[SecurityPrincipal]] = contextvars.ContextVar(
    "oip_security_principal", default=None
)
_client_ip: contextvars.ContextVar[str] = contextvars.ContextVar("oip_client_ip", default="")


@dataclass(frozen=True)
class SecuritySessionContext:
    principal: SecurityPrincipal | None
    client_ip: str
    trace_id: str
    correlation_id: str


def bind_principal(principal: SecurityPrincipal | None) -> None:
    _principal.set(principal)


def bind_client_ip(client_ip: str) -> None:
    _client_ip.set(client_ip)


def current_principal() -> SecurityPrincipal | None:
    return _principal.get()


def require_principal() -> SecurityPrincipal:
    principal = current_principal()
    if principal is None:
        raise PermissionError("authentication_required")
    return principal


def current_client_ip() -> str:
    return _client_ip.get() or ""


def clear_security_context() -> None:
    _principal.set(None)
    _client_ip.set("")
