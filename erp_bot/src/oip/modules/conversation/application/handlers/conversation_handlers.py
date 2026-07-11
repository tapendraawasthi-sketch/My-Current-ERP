"""Conversation command and query handlers."""

from __future__ import annotations

from typing import Any

from ..commands import (
    CloseConversationCommand,
    EnsureConversationCommand,
    RecordAssistantMessageCommand,
    RecordUserMessageCommand,
)
from ..queries import GetConversationBySessionQuery, GetConversationHistoryQuery, GetConversationQuery
from ..services.conversation_service import ConversationService


class EnsureConversationHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, command: EnsureConversationCommand) -> dict[str, Any]:
        conversation = await self._service.ensure_conversation(
            tenant_id=str(command.tenant_id),
            session_id=command.session_id,
            user_id=command.user_id,
            module=command.module,
            correlation_id=str(command.correlation_id),
            company_id=command.company_id,
            branch_id=command.branch_id,
            conversation_id=str(command.conversation_id) if command.conversation_id else None,
        )
        return conversation.model_dump(mode="json")


class RecordUserMessageHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, command: RecordUserMessageCommand) -> dict[str, Any]:
        message = await self._service.record_user_message(
            tenant_id=str(command.tenant_id),
            conversation_id=str(command.conversation_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            content=command.content,
            language=command.language,
        )
        return message.model_dump(mode="json")


class RecordAssistantMessageHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, command: RecordAssistantMessageCommand) -> dict[str, Any]:
        message = await self._service.record_assistant_message(
            tenant_id=str(command.tenant_id),
            conversation_id=str(command.conversation_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            content=command.content,
            language=command.language,
        )
        return message.model_dump(mode="json")


class CloseConversationHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, command: CloseConversationCommand) -> dict[str, Any]:
        conversation = await self._service.close_conversation(
            tenant_id=str(command.tenant_id),
            conversation_id=str(command.conversation_id),
        )
        return conversation.model_dump(mode="json")


class GetConversationHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, query: GetConversationQuery) -> dict[str, Any] | None:
        conversation = await self._service.get_conversation(
            tenant_id=str(query.tenant_id),
            conversation_id=str(query.conversation_id),
        )
        return conversation.model_dump(mode="json") if conversation else None


class GetConversationBySessionHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, query: GetConversationBySessionQuery) -> dict[str, Any] | None:
        conversation = await self._service.get_active_by_session(
            tenant_id=str(query.tenant_id),
            session_id=str(query.session_id),
            module=query.module,
        )
        return conversation.model_dump(mode="json") if conversation else None


class GetConversationHistoryHandler:
    def __init__(self, service: ConversationService) -> None:
        self._service = service

    async def __call__(self, query: GetConversationHistoryQuery) -> list[dict[str, Any]]:
        messages = await self._service.get_history(
            tenant_id=str(query.tenant_id),
            conversation_id=str(query.conversation_id),
            limit=query.limit,
            after_sequence=query.after_sequence,
        )
        return [message.model_dump(mode="json") for message in messages]
