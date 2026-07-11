"""RBAC permission adapter for Action Runtime — registry-based, no switches."""

from __future__ import annotations

import uuid
from typing import Any

from ...modules.action_runtime.application.ports.action_runtime_ports import PermissionPort
from ...modules.action_runtime.domain.value_objects import ActionPermission, ActionRuntimeType
from ...infrastructure.security.permission_registry import PermissionRegistry, create_default_permission_registry
from ...infrastructure.security.session_context import current_principal
from ...infrastructure.security.tenant_guard import assert_tenant_access


class RbacPermissionAdapter(PermissionPort):
    def __init__(self, registry: PermissionRegistry | None = None) -> None:
        self._registry = registry or create_default_permission_registry()

    async def check_permission(
        self,
        *,
        tenant_id: str,
        user_id: str,
        action_type: ActionRuntimeType,
        company_id: str,
        branch_id: str | None,
        context: dict[str, Any],
    ) -> ActionPermission:
        assert_tenant_access(tenant_id=tenant_id, company_id=company_id)
        denied = context.get("permission_denied") or context.get("user_forbidden")
        if denied:
            return ActionPermission(
                permission_id=str(uuid.uuid4()),
                action_id=context.get("action_id", ""),
                user_id=user_id,
                allowed=False,
                scopes=(),
                reason=str(denied),
            )
        principal = current_principal()
        required = tuple(context.get("required_permissions") or ())
        if not required:
            required = ("erp:command:execute",)
        if principal is None:
            return ActionPermission(
                permission_id=str(uuid.uuid4()),
                action_id=context.get("action_id", ""),
                user_id=user_id,
                allowed=True,
                scopes=required,
                reason="auth_not_enforced",
            )
        allowed = self._registry.is_allowed(
            role=principal.role,
            permissions=principal.permissions,
            required=required,
        )
        return ActionPermission(
            permission_id=str(uuid.uuid4()),
            action_id=context.get("action_id", ""),
            user_id=principal.user_id,
            allowed=allowed,
            scopes=principal.permissions,
            reason="" if allowed else "permission_denied",
        )
