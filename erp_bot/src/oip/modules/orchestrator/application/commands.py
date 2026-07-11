"""Orchestrator commands."""

from __future__ import annotations

from typing import Any

from ....application.commands import Command
from ....shared.ids import RequestId


class StartWorkflowCommand(Command):
    command_type: str = "oip.command.orchestrator.start_workflow.v1"
    request_id: RequestId
    session_id: str
    user_id: str = "anonymous"
    company_id: str | None = None
    branch_id: str | None = None
    conversation_id: str | None = None
    module: str = "orbix"
    language: str | None = None
    message: str
    execution_mode: str | None = None
    metadata: dict[str, Any] = {}


class CancelWorkflowCommand(Command):
    command_type: str = "oip.command.orchestrator.cancel_workflow.v1"
    workflow_id: str
    reason: str = ""


class ArchiveWorkflowCommand(Command):
    command_type: str = "oip.command.orchestrator.archive_workflow.v1"
    workflow_id: str


class RecoverWorkflowsCommand(Command):
    command_type: str = "oip.command.orchestrator.recover_workflows.v1"
