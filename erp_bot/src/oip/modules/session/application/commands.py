"""Session module commands."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from ....application.commands import Command
from ....shared.ids import SessionId


class OpenSessionCommand(Command):
    command_type: str = "oip.command.session.open.v1"
    session_id: SessionId
    user_id: str
    company_id: str | None = None
    branch_id: str | None = None
    module: str
    conversation_id: str | None = None
    erp_context: dict[str, Any] = Field(default_factory=dict)


class BindSessionContextCommand(Command):
    command_type: str = "oip.command.session.bind_context.v1"
    session_id: SessionId
    erp_context: dict[str, Any] = Field(default_factory=dict)
    conversation_id: str | None = None


class CloseSessionCommand(Command):
    command_type: str = "oip.command.session.close.v1"
    session_id: SessionId
