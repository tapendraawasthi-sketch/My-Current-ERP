"""Session application service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ...domain.entities import IntelligenceSession
from ...domain.value_objects import SessionStatus
from ..ports.session_repository_port import SessionRepositoryPort


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SessionService:
    def __init__(self, repository: SessionRepositoryPort) -> None:
        self._repository = repository

    async def open_or_touch(
        self,
        *,
        tenant_id: str,
        session_id: str,
        user_id: str,
        module: str,
        company_id: str | None = None,
        branch_id: str | None = None,
        conversation_id: str | None = None,
        erp_context: dict[str, Any] | None = None,
    ) -> IntelligenceSession:
        existing = await self._repository.get_by_id(tenant_id=tenant_id, session_id=session_id)
        now = _utc_now()
        if existing is not None and existing.status == SessionStatus.OPEN:
            updated = existing.model_copy(
                update={
                    "updated_at": now,
                    "conversation_id": conversation_id or existing.conversation_id,
                    "erp_context": erp_context or existing.erp_context,
                }
            )
            await self._repository.save(updated)
            return updated

        session = IntelligenceSession(
            session_id=session_id,
            tenant_id=tenant_id,
            user_id=user_id,
            company_id=company_id,
            branch_id=branch_id,
            module=module,
            conversation_id=conversation_id,
            status=SessionStatus.OPEN,
            erp_context=erp_context or {},
            opened_at=now,
            updated_at=now,
        )
        await self._repository.save(session)
        return session

    async def bind_context(
        self,
        *,
        tenant_id: str,
        session_id: str,
        erp_context: dict[str, Any],
        conversation_id: str | None = None,
    ) -> IntelligenceSession:
        session = await self._repository.get_by_id(tenant_id=tenant_id, session_id=session_id)
        if session is None:
            raise ValueError(f"Session not found: {session_id}")
        merged = {**session.erp_context, **erp_context}
        updated = session.model_copy(
            update={
                "erp_context": merged,
                "conversation_id": conversation_id or session.conversation_id,
                "updated_at": _utc_now(),
            }
        )
        await self._repository.save(updated)
        return updated

    async def close(self, *, tenant_id: str, session_id: str) -> IntelligenceSession:
        session = await self._repository.get_by_id(tenant_id=tenant_id, session_id=session_id)
        if session is None:
            raise ValueError(f"Session not found: {session_id}")
        if session.status == SessionStatus.CLOSED:
            return session
        now = _utc_now()
        closed = session.model_copy(
            update={"status": SessionStatus.CLOSED, "updated_at": now, "closed_at": now}
        )
        await self._repository.save(closed)
        return closed

    async def get(self, *, tenant_id: str, session_id: str) -> IntelligenceSession | None:
        return await self._repository.get_by_id(tenant_id=tenant_id, session_id=session_id)
