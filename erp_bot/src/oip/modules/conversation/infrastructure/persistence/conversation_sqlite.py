"""SQLite conversation repository adapter."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

import aiosqlite

from ...application.ports.conversation_repository_port import ConversationRepositoryPort
from ...domain.entities import Conversation, ConversationMessage
from ...domain.value_objects import ConversationStatus, MessageRole


class SqliteConversationRepositoryAdapter(ConversationRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def get_active_by_session(
        self,
        *,
        tenant_id: str,
        session_id: str,
        module: str,
    ) -> Conversation | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_conversations
            WHERE tenant_id = ? AND session_id = ? AND module = ? AND status = 'active'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (tenant_id, session_id, module),
        )
        row = await cursor.fetchone()
        return self._row_to_conversation(row) if row else None

    async def get_by_id(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_conversations
            WHERE tenant_id = ? AND conversation_id = ?
            """,
            (tenant_id, conversation_id),
        )
        row = await cursor.fetchone()
        return self._row_to_conversation(row) if row else None

    async def save(self, conversation: Conversation) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_conversations (
                conversation_id, tenant_id, session_id, user_id, company_id, branch_id,
                module, status, message_count, started_at, updated_at, closed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(conversation_id) DO UPDATE SET
                status = excluded.status,
                message_count = excluded.message_count,
                updated_at = excluded.updated_at,
                closed_at = excluded.closed_at
            """,
            (
                conversation.conversation_id,
                conversation.tenant_id,
                conversation.session_id,
                conversation.user_id,
                conversation.company_id,
                conversation.branch_id,
                conversation.module,
                conversation.status.value,
                conversation.message_count,
                conversation.started_at.isoformat(),
                conversation.updated_at.isoformat(),
                conversation.closed_at.isoformat() if conversation.closed_at else None,
            ),
        )
        await self._conn.commit()

    async def append_message(self, message: ConversationMessage) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_conversation_messages (
                message_id, conversation_id, tenant_id, sequence_no, role, content,
                language, request_id, correlation_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message.message_id,
                message.conversation_id,
                message.tenant_id,
                message.sequence_no,
                message.role.value,
                message.content,
                message.language,
                message.request_id,
                message.correlation_id,
                message.created_at.isoformat(),
            ),
        )
        await self._conn.execute(
            """
            UPDATE oip_conversations
            SET message_count = message_count + 1,
                updated_at = ?
            WHERE conversation_id = ? AND tenant_id = ?
            """,
            (message.created_at.isoformat(), message.conversation_id, message.tenant_id),
        )
        await self._conn.commit()

    async def get_messages(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        limit: int = 100,
        after_sequence: int = 0,
    ) -> Sequence[ConversationMessage]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_conversation_messages
            WHERE tenant_id = ? AND conversation_id = ? AND sequence_no > ?
            ORDER BY sequence_no ASC
            LIMIT ?
            """,
            (tenant_id, conversation_id, after_sequence, limit),
        )
        rows = await cursor.fetchall()
        return [self._row_to_message(row) for row in rows]

    @staticmethod
    def _row_to_conversation(row: aiosqlite.Row) -> Conversation:
        return Conversation(
            conversation_id=row["conversation_id"],
            tenant_id=row["tenant_id"],
            session_id=row["session_id"],
            user_id=row["user_id"],
            company_id=row["company_id"],
            branch_id=row["branch_id"],
            module=row["module"],
            status=ConversationStatus(row["status"]),
            message_count=int(row["message_count"]),
            started_at=datetime.fromisoformat(row["started_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            closed_at=datetime.fromisoformat(row["closed_at"]) if row["closed_at"] else None,
        )

    @staticmethod
    def _row_to_message(row: aiosqlite.Row) -> ConversationMessage:
        return ConversationMessage(
            message_id=row["message_id"],
            conversation_id=row["conversation_id"],
            tenant_id=row["tenant_id"],
            sequence_no=int(row["sequence_no"]),
            role=MessageRole(row["role"]),
            content=row["content"],
            language=row["language"],
            request_id=row["request_id"],
            correlation_id=row["correlation_id"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
