"""Action Runtime commands."""

from __future__ import annotations

from typing import Any

from ....application.commands import Command
from ....shared.ids import ActionId, EvaluationId


class ProposeActionCommand(Command):
    command_type: str = "oip.command.action_runtime.propose_action.v1"
    evaluation_id: EvaluationId
    action_type: str = ""
    payload: dict[str, Any] = {}
    user_id: str = "system"
    idempotency_key: str = ""
    auto_execute: bool = True


class ApproveActionCommand(Command):
    command_type: str = "oip.command.action_runtime.approve_action.v1"
    action_id: ActionId
    approver_id: str = "manager"


class RejectActionCommand(Command):
    command_type: str = "oip.command.action_runtime.reject_action.v1"
    action_id: ActionId
    approver_id: str = "manager"
    reason: str = ""


class CancelActionCommand(Command):
    command_type: str = "oip.command.action_runtime.cancel_action.v1"
    action_id: ActionId
    reason: str = ""
