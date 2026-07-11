"""Conversation module commands."""

from __future__ import annotations

from pydantic import Field

from ....application.commands import Command
from ....shared.ids import ConversationId, RequestId


class EnsureConversationCommand(Command):
    command_type: str = "oip.command.conversation.ensure.v1"
    session_id: str
    user_id: str
    company_id: str | None = None
    branch_id: str | None = None
    module: str
    conversation_id: ConversationId | None = None


class RecordUserMessageCommand(Command):
    command_type: str = "oip.command.conversation.record_user_message.v1"
    conversation_id: ConversationId
    request_id: RequestId
    content: str
    language: str | None = None


class RecordAssistantMessageCommand(Command):
    command_type: str = "oip.command.conversation.record_assistant_message.v1"
    conversation_id: ConversationId
    request_id: RequestId
    content: str
    language: str | None = None


class CloseConversationCommand(Command):
    command_type: str = "oip.command.conversation.close.v1"
    conversation_id: ConversationId
