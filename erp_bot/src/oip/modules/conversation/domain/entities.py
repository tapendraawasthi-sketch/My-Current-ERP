"""Conversation domain entities."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import ConversationStatus, MessageRole


class ConversationMessage(BaseModel):
    model_config = ConfigDict(frozen=True)

    message_id: str
    conversation_id: str
    tenant_id: str
    sequence_no: int
    role: MessageRole
    content: str
    language: str | None = None
    request_id: str | None = None
    correlation_id: str | None = None
    created_at: datetime


class Conversation(BaseModel):
    model_config = ConfigDict(frozen=True)

    conversation_id: str
    tenant_id: str
    session_id: str
    user_id: str
    company_id: str | None = None
    branch_id: str | None = None
    module: str
    status: ConversationStatus = ConversationStatus.ACTIVE
    message_count: int = 0
    started_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
