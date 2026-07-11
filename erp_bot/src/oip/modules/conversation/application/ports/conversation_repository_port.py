"""Conversation repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from ...domain.entities import Conversation, ConversationMessage


class ConversationRepositoryPort(ABC):
    @abstractmethod
    async def get_active_by_session(
        self,
        *,
        tenant_id: str,
        session_id: str,
        module: str,
    ) -> Conversation | None:
        """Return active conversation for session/module if one exists."""

    @abstractmethod
    async def get_by_id(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        """Load conversation aggregate header."""

    @abstractmethod
    async def save(self, conversation: Conversation) -> None:
        """Insert or update conversation header."""

    @abstractmethod
    async def append_message(self, message: ConversationMessage) -> None:
        """Append message and increment conversation message_count."""

    @abstractmethod
    async def get_messages(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        limit: int = 100,
        after_sequence: int = 0,
    ) -> Sequence[ConversationMessage]:
        """Return ordered messages for a conversation."""
