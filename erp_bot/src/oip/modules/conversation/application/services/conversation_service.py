"""Conversation application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .....application.ports.outbound.outbox_port import OutboxPort
from .....domain.events import DomainEventEnvelope
from ...domain.entities import Conversation, ConversationMessage
from ...domain.events import build_conversation_started_event, build_message_appended_event
from ...domain.value_objects import ConversationStatus, MessageRole
from ..ports.conversation_repository_port import ConversationRepositoryPort


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ConversationService:
    def __init__(
        self,
        repository: ConversationRepositoryPort,
        outbox: OutboxPort | None = None,
    ) -> None:
        self._repository = repository
        self._outbox = outbox

    async def ensure_conversation(
        self,
        *,
        tenant_id: str,
        session_id: str,
        user_id: str,
        module: str,
        correlation_id: str,
        company_id: str | None = None,
        branch_id: str | None = None,
        conversation_id: str | None = None,
    ) -> Conversation:
        existing = await self._repository.get_active_by_session(
            tenant_id=tenant_id,
            session_id=session_id,
            module=module,
        )
        if existing is not None:
            return existing

        now = _utc_now()
        conversation = Conversation(
            conversation_id=conversation_id or str(uuid.uuid4()),
            tenant_id=tenant_id,
            session_id=session_id,
            user_id=user_id,
            company_id=company_id,
            branch_id=branch_id,
            module=module,
            status=ConversationStatus.ACTIVE,
            message_count=0,
            started_at=now,
            updated_at=now,
        )
        await self._repository.save(conversation)
        await self._emit_started(conversation, correlation_id)
        return conversation

    async def record_user_message(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        request_id: str,
        correlation_id: str,
        content: str,
        language: str | None = None,
    ) -> ConversationMessage:
        return await self._record_message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            request_id=request_id,
            correlation_id=correlation_id,
            role=MessageRole.USER,
            content=content,
            language=language,
        )

    async def record_assistant_message(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        request_id: str,
        correlation_id: str,
        content: str,
        language: str | None = None,
    ) -> ConversationMessage:
        return await self._record_message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            request_id=request_id,
            correlation_id=correlation_id,
            role=MessageRole.ASSISTANT,
            content=content,
            language=language,
        )

    async def close_conversation(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation:
        conversation = await self._repository.get_by_id(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )
        if conversation is None:
            raise ValueError(f"Conversation not found: {conversation_id}")
        if conversation.status == ConversationStatus.CLOSED:
            return conversation

        now = _utc_now()
        closed = conversation.model_copy(
            update={
                "status": ConversationStatus.CLOSED,
                "updated_at": now,
                "closed_at": now,
            }
        )
        await self._repository.save(closed)
        return closed

    async def get_conversation(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        return await self._repository.get_by_id(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )

    async def get_active_by_session(
        self,
        *,
        tenant_id: str,
        session_id: str,
        module: str,
    ) -> Conversation | None:
        return await self._repository.get_active_by_session(
            tenant_id=tenant_id,
            session_id=session_id,
            module=module,
        )

    async def get_history(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        limit: int = 100,
        after_sequence: int = 0,
    ):
        return await self._repository.get_messages(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            limit=limit,
            after_sequence=after_sequence,
        )

    async def _record_message(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        request_id: str,
        correlation_id: str,
        role: MessageRole,
        content: str,
        language: str | None,
    ) -> ConversationMessage:
        conversation = await self._repository.get_by_id(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )
        if conversation is None:
            raise ValueError(f"Conversation not found: {conversation_id}")
        if conversation.status != ConversationStatus.ACTIVE:
            raise ValueError(f"Conversation is not active: {conversation_id}")

        sequence_no = conversation.message_count + 1
        message = ConversationMessage(
            message_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            sequence_no=sequence_no,
            role=role,
            content=content,
            language=language,
            request_id=request_id,
            correlation_id=correlation_id,
            created_at=_utc_now(),
        )
        await self._repository.append_message(message)
        await self._emit_message_appended(
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            conversation_id=conversation_id,
            company_id=conversation.company_id,
            message=message,
        )
        return message

    async def _emit_started(self, conversation: Conversation, correlation_id: str) -> None:
        if self._outbox is None:
            return
        event = build_conversation_started_event(
            tenant_id=conversation.tenant_id,
            correlation_id=correlation_id,
            conversation_id=conversation.conversation_id,
            session_id=conversation.session_id,
            user_id=conversation.user_id,
            module=conversation.module,
            company_id=conversation.company_id,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _emit_message_appended(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        conversation_id: str,
        company_id: str | None,
        message: ConversationMessage,
    ) -> None:
        if self._outbox is None:
            return
        event = build_message_appended_event(
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            conversation_id=conversation_id,
            company_id=company_id,
            message_id=message.message_id,
            role=message.role.value,
            sequence_no=message.sequence_no,
            request_id=message.request_id,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))
