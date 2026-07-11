"""Capability token adapter."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from ...application.ports.execution_ports import CapabilityTokenPort
from ...domain.value_objects import CapabilityToken


class SqliteCapabilityTokenAdapter(CapabilityTokenPort):
    def __init__(self, repository) -> None:
        self._repository = repository
        self._revoked: set[str] = set()

    async def issue(
        self,
        *,
        tenant_id: str,
        request_id: str,
        conversation_id: str | None,
        company_id: str | None,
        allowed_tools: tuple[str, ...],
        allowed_erp_actions: tuple[str, ...],
        maximum_calls: int,
        read_scope: tuple[str, ...],
        write_scope: tuple[str, ...],
        ttl_seconds: int = 3600,
    ) -> CapabilityToken:
        token_id = str(uuid.uuid4())
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat()
        return CapabilityToken(
            token_id=token_id,
            request_id=request_id,
            conversation_id=conversation_id,
            company_id=company_id,
            tenant_id=tenant_id,
            expires_at=expires_at,
            allowed_tools=allowed_tools,
            allowed_erp_actions=allowed_erp_actions,
            maximum_calls=maximum_calls,
            read_scope=read_scope,
            write_scope=write_scope,
        )

    async def validate(self, *, token: CapabilityToken) -> bool:
        if token.revoked or token.token_id in self._revoked:
            return False
        expires = datetime.fromisoformat(token.expires_at)
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= expires:
            return False
        return True

    async def revoke(self, *, token_id: str, tenant_id: str) -> None:
        self._revoked.add(token_id)
