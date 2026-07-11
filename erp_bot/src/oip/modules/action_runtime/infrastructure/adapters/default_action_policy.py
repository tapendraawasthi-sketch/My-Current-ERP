"""Default action policy adapter."""

from __future__ import annotations

from typing import Any

from ...application.ports.action_runtime_ports import ActionPolicyPort
from ...domain.value_objects import ActionPolicy, ActionRuntimeType


class DefaultActionPolicyAdapter(ActionPolicyPort):
    async def resolve_policy(
        self,
        *,
        tenant_id: str,
        action_type: ActionRuntimeType,
        payload: dict[str, Any],
    ) -> ActionPolicy:
        return ActionPolicy(
            policy_id=f"policy-{tenant_id}",
            name="default",
            require_approval=payload.get("_require_approval", False),
            approval_roles=("manager", "finance"),
            max_amount=payload.get("max_amount"),
            allowed_action_types=(action_type.value,),
        )

    async def validate(
        self,
        *,
        policy: ActionPolicy,
        action_type: ActionRuntimeType,
        payload: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[bool, str]:
        if context.get("policy_denied"):
            return False, str(context["policy_denied"])
        if policy.allowed_action_types and action_type.value not in policy.allowed_action_types:
            return False, f"Action type {action_type.value} not allowed by policy"
        amount = float(payload.get("amount", 0) or 0)
        if policy.max_amount is not None and amount > policy.max_amount:
            return False, f"Amount {amount} exceeds policy limit {policy.max_amount}"
        return True, ""
