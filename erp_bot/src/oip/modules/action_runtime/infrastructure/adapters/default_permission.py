"""Default permission adapter."""

from __future__ import annotations

import uuid
from typing import Any

from ...application.ports.action_runtime_ports import PermissionPort
from ...domain.value_objects import ActionPermission, ActionRuntimeType


class DefaultPermissionAdapter(PermissionPort):
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
        denied = context.get("permission_denied") or context.get("user_forbidden")
        allowed = not bool(denied)
        return ActionPermission(
            permission_id=str(uuid.uuid4()),
            action_id=context.get("action_id", ""),
            user_id=user_id,
            allowed=allowed,
            scopes=("erp:write", action_type.value),
            reason=str(denied) if denied else "",
        )
