"""Default capability token adapter for action runtime."""

from __future__ import annotations

import uuid
from typing import Any

from ...application.ports.action_runtime_ports import ActionCapabilityTokenPort
from ...domain.value_objects import ActionCapability, ActionRuntimeType


class DefaultActionCapabilityAdapter(ActionCapabilityTokenPort):
    async def validate_capability(
        self,
        *,
        tenant_id: str,
        action_id: str,
        token_id: str | None,
        action_type: ActionRuntimeType,
        context: dict[str, Any],
    ) -> ActionCapability:
        invalid = context.get("capability_invalid") or context.get("missing_capability")
        if invalid and not token_id:
            valid = False
        elif context.get("capability_invalid"):
            valid = False
        else:
            valid = True
        return ActionCapability(
            capability_id=str(uuid.uuid4()),
            action_id=action_id,
            token_id=token_id or "implicit",
            valid=valid,
            write_scope=("erp", action_type.value),
        )
