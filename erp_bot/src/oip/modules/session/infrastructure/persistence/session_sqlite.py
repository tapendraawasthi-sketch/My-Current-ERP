"""SQLite session repository adapter."""

from __future__ import annotations

import json
from datetime import datetime

import aiosqlite

from ...application.ports.session_repository_port import SessionRepositoryPort
from ...domain.entities import IntelligenceSession
from ...domain.value_objects import SessionStatus


class SqliteSessionRepositoryAdapter(SessionRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def get_by_id(self, *, tenant_id: str, session_id: str) -> IntelligenceSession | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_sessions
            WHERE tenant_id = ? AND session_id = ?
            """,
            (tenant_id, session_id),
        )
        row = await cursor.fetchone()
        return self._row_to_session(row) if row else None

    async def save(self, session: IntelligenceSession) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_sessions (
                session_id, tenant_id, user_id, company_id, branch_id, module,
                conversation_id, status, erp_context_json, opened_at, updated_at, closed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                conversation_id = excluded.conversation_id,
                status = excluded.status,
                erp_context_json = excluded.erp_context_json,
                updated_at = excluded.updated_at,
                closed_at = excluded.closed_at
            """,
            (
                session.session_id,
                session.tenant_id,
                session.user_id,
                session.company_id,
                session.branch_id,
                session.module,
                session.conversation_id,
                session.status.value,
                json.dumps(session.erp_context),
                session.opened_at.isoformat(),
                session.updated_at.isoformat(),
                session.closed_at.isoformat() if session.closed_at else None,
            ),
        )
        await self._conn.commit()

    @staticmethod
    def _row_to_session(row: aiosqlite.Row) -> IntelligenceSession:
        return IntelligenceSession(
            session_id=row["session_id"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            company_id=row["company_id"],
            branch_id=row["branch_id"],
            module=row["module"],
            conversation_id=row["conversation_id"],
            status=SessionStatus(row["status"]),
            erp_context=json.loads(row["erp_context_json"]),
            opened_at=datetime.fromisoformat(row["opened_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            closed_at=datetime.fromisoformat(row["closed_at"]) if row["closed_at"] else None,
        )
