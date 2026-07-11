"""Security-enriched audit recording."""

from __future__ import annotations

from typing import Any

from .audit_service import AuditService
from ...infrastructure.security.credential_vault import CredentialVault
from ...infrastructure.security.session_context import current_client_ip, current_principal


class SecurityAuditService:
    def __init__(self, audit_service: AuditService, credential_vault: CredentialVault | None = None) -> None:
        self._audit = audit_service
        self._vault = credential_vault or CredentialVault()

    async def record(
        self,
        *,
        tenant_id: str,
        request_id: str | None,
        correlation_id: str,
        event_name: str,
        payload_redacted: dict[str, Any],
    ) -> None:
        principal = current_principal()
        enriched = dict(payload_redacted)
        enriched["security"] = {
            "authenticated_user": principal.user_id if principal else None,
            "tenant_id": tenant_id,
            "company_id": principal.company_id if principal else enriched.get("company_id"),
            "role": principal.role if principal else None,
            "auth_method": principal.auth_method.value if principal else None,
            "source_ip": current_client_ip(),
            "request_id": request_id,
            "correlation_id": correlation_id,
        }
        safe_payload = self._vault.redact_config(enriched)
        await self._audit.record(
            tenant_id=tenant_id,
            request_id=request_id,
            correlation_id=correlation_id,
            event_name=event_name,
            payload_redacted=safe_payload,
        )

    async def get_chain(self, *, tenant_id: str, request_id: str | None = None, limit: int = 100):
        return await self._audit.get_chain(tenant_id=tenant_id, request_id=request_id, limit=limit)
