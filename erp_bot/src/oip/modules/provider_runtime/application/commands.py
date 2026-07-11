"""Provider Runtime commands."""

from __future__ import annotations

from ....application.commands import Command
from ....shared.ids import ExecutionId, RouteId
from ..domain.value_objects import ExecutionPolicyName


class StartExecutionCommand(Command):
    command_type: str = "oip.command.provider_runtime.start_execution.v1"
    route_id: RouteId
    execution_policy: ExecutionPolicyName = ExecutionPolicyName.BALANCED


class CancelExecutionCommand(Command):
    command_type: str = "oip.command.provider_runtime.cancel_execution.v1"
    execution_id: ExecutionId
    reason: str = ""


class RetryExecutionCommand(Command):
    command_type: str = "oip.command.provider_runtime.retry_execution.v1"
    execution_id: ExecutionId


class TimeoutExecutionCommand(Command):
    command_type: str = "oip.command.provider_runtime.timeout_execution.v1"
    execution_id: ExecutionId


class CheckpointExecutionCommand(Command):
    command_type: str = "oip.command.provider_runtime.checkpoint_execution.v1"
    execution_id: ExecutionId
    state_snapshot: dict = {}


class ArchiveExecutionCommand(Command):
    command_type: str = "oip.command.provider_runtime.archive_execution.v1"
    execution_id: ExecutionId
