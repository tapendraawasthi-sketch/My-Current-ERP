"""Compensation adapter — reversal actions only."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .....integration.contracts.erp_commands import ErpCommandEnvelope, ErpCommandType
from ...application.ports.action_runtime_ports import CompensationPort, ERPCommandPort
from ...domain.entities import ActionExecution
from ...domain.value_objects import ActionCompensation, ActionRuntimeType


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultCompensationAdapter(CompensationPort):
    async def create_reversal(
        self,
        *,
        action: ActionExecution,
        reason: str,
    ) -> ActionCompensation:
        return ActionCompensation(
            compensation_id=str(uuid.uuid4()),
            action_id=action.action_id,
            reversal_action_id=str(uuid.uuid4()),
            reversal_type=ActionRuntimeType.JOURNAL_ENTRY,
            reason=reason,
            compensated_at=_utc_now_iso(),
        )

    async def dispatch_reversal(
        self,
        *,
        compensation: ActionCompensation,
        original_action: ActionExecution,
        erp_command_port: ERPCommandPort,
    ) -> dict[str, Any]:
        envelope = ErpCommandEnvelope(
            command_id=compensation.reversal_action_id,
            command_type=ErpCommandType.POST_JOURNAL_ENTRY,
            tenant_id=original_action.tenant_id,
            company_id=original_action.company_id,
            branch_id=original_action.branch_id,
            idempotency_key=f"reversal-{original_action.idempotency_key}",
            payload={
                "reversal_of": original_action.action_id,
                "reason": compensation.reason,
                "reversal": True,
            },
        )
        response = await erp_command_port.dispatch(envelope)
        return {
            **response,
            "erp_reference": response.get("erp_reference") or f"rev-{compensation.reversal_action_id[:8]}",
        }
