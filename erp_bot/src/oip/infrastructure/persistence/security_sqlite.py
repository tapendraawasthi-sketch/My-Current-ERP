"""SQLite persistence for security artifacts."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SqliteSecurityRepository:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def is_revoked(self, *, jti: str) -> bool:
        cursor = await self._conn.execute(
            "SELECT jti FROM oip_token_revocations WHERE jti = ?",
            (jti,),
        )
        return await cursor.fetchone() is not None

    async def revoke_token(
        self,
        *,
        jti: str,
        tenant_id: str,
        user_id: str,
        reason: str = "",
    ) -> None:
        await self._conn.execute(
            """
            INSERT OR IGNORE INTO oip_token_revocations (jti, tenant_id, user_id, revoked_at, reason)
            VALUES (?, ?, ?, ?, ?)
            """,
            (jti, tenant_id, user_id, _utc_now().isoformat(), reason),
        )
        await self._conn.commit()

    async def store_refresh_token(
        self,
        *,
        token_id: str,
        tenant_id: str,
        user_id: str,
        company_id: str | None,
        role: str,
        session_id: str,
        expires_at: datetime,
    ) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_refresh_tokens
            (token_id, tenant_id, user_id, company_id, role, session_id, expires_at, revoked, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                token_id,
                tenant_id,
                user_id,
                company_id,
                role,
                session_id,
                expires_at.isoformat(),
                _utc_now().isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_refresh_token(self, token_id: str) -> dict[str, Any] | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_refresh_tokens WHERE token_id = ? AND revoked = 0",
            (token_id,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def revoke_refresh_token(self, token_id: str) -> None:
        await self._conn.execute(
            "UPDATE oip_refresh_tokens SET revoked = 1 WHERE token_id = ?",
            (token_id,),
        )
        await self._conn.commit()

    async def get_api_key_by_hash(self, key_hash: str) -> dict[str, Any] | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_api_keys WHERE key_hash = ? AND is_active = 1",
            (key_hash,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def save_api_key(
        self,
        *,
        key_id: str,
        tenant_id: str,
        company_id: str | None,
        name: str,
        key_hash: str,
        role: str,
        permissions: tuple[str, ...],
        expires_at: datetime | None = None,
    ) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_api_keys
            (key_id, tenant_id, company_id, name, key_hash, role, permissions_json, is_active, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                key_id,
                tenant_id,
                company_id,
                name,
                key_hash,
                role,
                json.dumps(list(permissions)),
                expires_at.isoformat() if expires_at else None,
                _utc_now().isoformat(),
            ),
        )
        await self._conn.commit()

    async def record_security_event(
        self,
        *,
        tenant_id: str,
        user_id: str | None,
        event_type: str,
        detail: dict[str, Any],
        source_ip: str = "",
        request_id: str | None = None,
        correlation_id: str | None = None,
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_security_events
            (event_id, tenant_id, user_id, event_type, detail_json, source_ip, request_id, correlation_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                tenant_id,
                user_id,
                event_type,
                json.dumps(detail),
                source_ip,
                request_id,
                correlation_id,
                _utc_now().isoformat(),
            ),
        )
        await self._conn.commit()
