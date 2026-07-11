"""Secured kernel facade — validates identity before orchestration."""

from __future__ import annotations

from ..application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from ..application.ports.inbound.intelligence_ingress_port import IntelligenceIngressPort
from ..config.settings import OipSettings
from ..infrastructure.security.permission_registry import PermissionRegistry
from ..infrastructure.security.session_context import current_principal
from ..infrastructure.security.tenant_guard import resolve_company_id, resolve_tenant_id, resolve_user_id
from ..shared.exceptions import OipForbiddenError


class SecuredIntelligenceKernelFacade(IntelligenceIngressPort):
    def __init__(
        self,
        inner: IntelligenceIngressPort,
        settings: OipSettings,
        permission_registry: PermissionRegistry,
    ) -> None:
        self._inner = inner
        self._settings = settings
        self._permissions = permission_registry

    async def submit(self, request: IntelligenceRequestDto) -> IntelligenceResponseDto:
        if self._settings.auth_required:
            principal = current_principal()
            if principal is None:
                raise OipForbiddenError("authentication_required")
            tenant_id = resolve_tenant_id(request.tenant_id)
            company_id = resolve_company_id(request.company_id)
            user_id = resolve_user_id(request.user_id)
            if not self._permissions.is_allowed(
                role=principal.role,
                permissions=principal.permissions,
                required=("oip:intelligence:submit",),
            ):
                raise OipForbiddenError("permission_denied")
            request = request.model_copy(
                update={
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "user_id": user_id,
                    "metadata": {
                        **(request.metadata or {}),
                        "auth_method": principal.auth_method.value,
                        "role": principal.role,
                        "permissions": list(principal.permissions),
                    },
                }
            )
        return await self._inner.submit(request)

    async def health(self) -> dict:
        return await self._inner.health()

    @property
    def _audit(self):
        return self._inner._audit

    @property
    def _lineage(self):
        return self._inner._lineage
