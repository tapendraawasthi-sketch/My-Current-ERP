"""OEC Runtime commands."""

from __future__ import annotations

from typing import Any

from ....application.commands import Command
from ....shared.ids import RequestId


class RegisterConnectorCommand(Command):
    command_type: str = "oip.command.oec.register_connector.v1"
    name: str
    connector_type: str
    company_id: str | None = None
    config: dict[str, Any] = {}
    capabilities: tuple[str, ...] = ()
    is_default: bool = False


class ExecuteERPCommandCommand(Command):
    command_type: str = "oip.command.oec.execute_command.v1"
    request_id: RequestId
    connector_id: str | None = None
    command_id: str
    command_type_name: str
    company_id: str
    branch_id: str | None = None
    idempotency_key: str
    payload: dict[str, Any] = {}


class ExecuteERPQueryCommand(Command):
    command_type: str = "oip.command.oec.execute_query.v1"
    connector_id: str | None = None
    query_type: str
    company_id: str
    branch_id: str | None = None
    payload: dict[str, Any] = {}


class RetryExecutionCommand(Command):
    command_type: str = "oip.command.oec.retry_execution.v1"
    execution_id: str


class CancelExecutionCommand(Command):
    command_type: str = "oip.command.oec.cancel_execution.v1"
    execution_id: str


class ArchiveConnectorCommand(Command):
    command_type: str = "oip.command.oec.archive_connector.v1"
    connector_id: str


class UnregisterConnectorCommand(Command):
    command_type: str = "oip.command.oec.unregister_connector.v1"
    connector_id: str
