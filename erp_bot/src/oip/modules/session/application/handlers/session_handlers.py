"""Session command and query handlers."""

from __future__ import annotations

from typing import Any

from ..commands import BindSessionContextCommand, CloseSessionCommand, OpenSessionCommand
from ..queries import GetSessionQuery
from ..services.session_service import SessionService


class OpenSessionHandler:
    def __init__(self, service: SessionService) -> None:
        self._service = service

    async def __call__(self, command: OpenSessionCommand) -> dict[str, Any]:
        session = await self._service.open_or_touch(
            tenant_id=str(command.tenant_id),
            session_id=str(command.session_id),
            user_id=command.user_id,
            module=command.module,
            company_id=command.company_id,
            branch_id=command.branch_id,
            conversation_id=command.conversation_id,
            erp_context=command.erp_context,
        )
        return session.model_dump(mode="json")


class BindSessionContextHandler:
    def __init__(self, service: SessionService) -> None:
        self._service = service

    async def __call__(self, command: BindSessionContextCommand) -> dict[str, Any]:
        session = await self._service.bind_context(
            tenant_id=str(command.tenant_id),
            session_id=str(command.session_id),
            erp_context=command.erp_context,
            conversation_id=command.conversation_id,
        )
        return session.model_dump(mode="json")


class CloseSessionHandler:
    def __init__(self, service: SessionService) -> None:
        self._service = service

    async def __call__(self, command: CloseSessionCommand) -> dict[str, Any]:
        session = await self._service.close(
            tenant_id=str(command.tenant_id),
            session_id=str(command.session_id),
        )
        return session.model_dump(mode="json")


class GetSessionHandler:
    def __init__(self, service: SessionService) -> None:
        self._service = service

    async def __call__(self, query: GetSessionQuery) -> dict[str, Any] | None:
        session = await self._service.get(
            tenant_id=str(query.tenant_id),
            session_id=str(query.session_id),
        )
        return session.model_dump(mode="json") if session else None
