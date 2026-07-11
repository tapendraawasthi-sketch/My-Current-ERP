"""Conversation domain events."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from ....domain.events import DomainEvent
from ....shared.ids import CorrelationId, TenantId


class ConversationStartedEvent(DomainEvent):
    event_type: str = "oip.conversation.started.v1"
    payload: dict[str, Any] = Field(default_factory=dict)


class ConversationMessageAppendedEvent(DomainEvent):
    event_type: str = "oip.conversation.message.appended.v1"
    payload: dict[str, Any] = Field(default_factory=dict)


class ConversationClosedEvent(DomainEvent):
    event_type: str = "oip.conversation.closed.v1"
    payload: dict[str, Any] = Field(default_factory=dict)


def build_conversation_started_event(
    *,
    tenant_id: str,
    correlation_id: str,
    conversation_id: str,
    session_id: str,
    user_id: str,
    module: str,
    company_id: str | None,
) -> ConversationStartedEvent:
    from ....domain.events import make_partition_key

    return ConversationStartedEvent(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, conversation_id),
        payload={
            "conversation_id": conversation_id,
            "session_id": session_id,
            "user_id": user_id,
            "module": module,
        },
    )


def build_message_appended_event(
    *,
    tenant_id: str,
    correlation_id: str,
    conversation_id: str,
    company_id: str | None,
    message_id: str,
    role: str,
    sequence_no: int,
    request_id: str | None,
) -> ConversationMessageAppendedEvent:
    from ....domain.events import make_partition_key

    return ConversationMessageAppendedEvent(
        tenant_id=TenantId(tenant_id),
        correlation_id=CorrelationId(correlation_id),
        partition_key=make_partition_key(tenant_id, company_id, conversation_id),
        payload={
            "conversation_id": conversation_id,
            "message_id": message_id,
            "role": role,
            "sequence_no": sequence_no,
            "request_id": request_id,
        },
    )
