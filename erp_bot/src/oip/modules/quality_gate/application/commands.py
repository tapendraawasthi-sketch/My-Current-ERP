"""Quality Gate commands."""

from __future__ import annotations

from ....application.commands import Command
from ....shared.ids import EvaluationId, ExecutionId


class StartEvaluationCommand(Command):
    command_type: str = "oip.command.quality_gate.start_evaluation.v1"
    execution_id: ExecutionId


class ApproveEvaluationCommand(Command):
    command_type: str = "oip.command.quality_gate.approve_evaluation.v1"
    evaluation_id: EvaluationId


class RejectEvaluationCommand(Command):
    command_type: str = "oip.command.quality_gate.reject_evaluation.v1"
    evaluation_id: EvaluationId
    reason: str = ""


class ArchiveEvaluationCommand(Command):
    command_type: str = "oip.command.quality_gate.archive_evaluation.v1"
    evaluation_id: EvaluationId
