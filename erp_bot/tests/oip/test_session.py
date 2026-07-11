"""OIP Phase 1 — Session module tests."""

from __future__ import annotations

import pytest

from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.session.application.commands import CloseSessionCommand, OpenSessionCommand
from src.oip.modules.session.application.queries import GetSessionQuery
from src.oip.shared.ids import CorrelationId, SessionId, TenantId, new_correlation_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_session_test.db"
    settings = OipSettings(
        enabled=True,
        conversation_enabled=True,
        shadow_conversation=True,
        session_enabled=True,
        shadow_session=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


@pytest.mark.asyncio
async def test_open_session_idempotent(oip_container):
    correlation_id = str(new_correlation_id())
    command = OpenSessionCommand(
        tenant_id=TenantId("tenant-a"),
        correlation_id=CorrelationId(correlation_id),
        session_id=SessionId("sess-1"),
        user_id="user-1",
        module="orbix",
        erp_context={"company_name": "Acme"},
    )
    first = await oip_container.command_bus.dispatch(command)
    second = await oip_container.command_bus.dispatch(command)
    assert first["session_id"] == second["session_id"]
    assert first["status"] == "open"
    assert second["erp_context"]["company_name"] == "Acme"


@pytest.mark.asyncio
async def test_close_session(oip_container):
    correlation_id = str(new_correlation_id())
    opened = await oip_container.command_bus.dispatch(
        OpenSessionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            session_id=SessionId("sess-2"),
            user_id="user-1",
            module="orbix",
        )
    )
    closed = await oip_container.command_bus.dispatch(
        CloseSessionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            session_id=SessionId(opened["session_id"]),
        )
    )
    assert closed["status"] == "closed"

    loaded = await oip_container.query_bus.dispatch(
        GetSessionQuery(
            tenant_id=TenantId("tenant-a"),
            session_id=SessionId(opened["session_id"]),
        )
    )
    assert loaded["status"] == "closed"
