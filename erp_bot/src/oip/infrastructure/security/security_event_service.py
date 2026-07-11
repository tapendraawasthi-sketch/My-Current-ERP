"""Security event observability."""

from __future__ import annotations

from typing import Any

from ..persistence.security_sqlite import SqliteSecurityRepository
from .session_context import current_client_ip, current_principal


class SecurityEventService:
    def __init__(self, repository: SqliteSecurityRepository) -> None:
        self._repository = repository

    async def record(
        self,
        *,
        event_type: str,
        detail: dict[str, Any] | None = None,
        tenant_id: str | None = None,
        user_id: str | None = None,
        request_id: str | None = None,
        correlation_id: str | None = None,
    ) -> None:
        principal = current_principal()
        await self._repository.record_security_event(
            tenant_id=tenant_id or (principal.tenant_id if principal else "unknown"),
            user_id=user_id or (principal.user_id if principal else None),
            event_type=event_type,
            detail=detail or {},
            source_ip=current_client_ip(),
            request_id=request_id,
            correlation_id=correlation_id,
        )

    async def auth_failure(self, *, reason: str, request_id: str | None = None) -> None:
        await self.record(event_type="auth_failure", detail={"reason": reason}, request_id=request_id)

    async def authz_failure(self, *, permission: str, request_id: str | None = None) -> None:
        await self.record(
            event_type="authz_failure",
            detail={"permission": permission},
            request_id=request_id,
        )

    async def rate_limit_violation(self, *, key: str, request_id: str | None = None) -> None:
        await self.record(
            event_type="rate_limit_violation",
            detail={"key": key},
            request_id=request_id,
        )

    async def token_refresh(self, *, user_id: str, tenant_id: str) -> None:
        await self.record(
            event_type="token_refresh",
            tenant_id=tenant_id,
            user_id=user_id,
            detail={},
        )
