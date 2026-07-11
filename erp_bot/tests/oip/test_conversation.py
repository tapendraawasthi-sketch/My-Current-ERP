"""OIP Phase 1 — Conversation module tests."""

from __future__ import annotations

import pytest

from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.conversation.application.commands import (
    CloseConversationCommand,
    EnsureConversationCommand,
    RecordAssistantMessageCommand,
    RecordUserMessageCommand,
)
from src.oip.modules.conversation.application.queries import GetConversationHistoryQuery
from src.oip.shared.ids import ConversationId, CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_conversation_test.db"
    settings = OipSettings(
        enabled=True,
        execution_mode="native",
        orchestrator_enabled=True,
        conversation_enabled=True,
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        shadow_audit=True,
        shadow_lineage=True,
        shadow_conversation=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


@pytest.mark.asyncio
async def test_ensure_conversation_idempotent(oip_container):
    correlation_id = str(new_correlation_id())
    command = EnsureConversationCommand(
        tenant_id=TenantId("tenant-a"),
        correlation_id=CorrelationId(correlation_id),
        session_id="sess-1",
        user_id="user-1",
        module="orbix",
    )
    first = await oip_container.command_bus.dispatch(command)
    second = await oip_container.command_bus.dispatch(command)
    assert first["conversation_id"] == second["conversation_id"]
    assert first["status"] == "active"


@pytest.mark.asyncio
async def test_record_user_and_assistant_messages(oip_container):
    correlation_id = str(new_correlation_id())
    conversation = await oip_container.command_bus.dispatch(
        EnsureConversationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            session_id="sess-2",
            user_id="user-1",
            module="orbix",
        )
    )
    conversation_id = ConversationId(conversation["conversation_id"])
    request_id = RequestId(str(new_request_id()))

    await oip_container.command_bus.dispatch(
        RecordUserMessageCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            conversation_id=conversation_id,
            request_id=request_id,
            content="What is my balance?",
        )
    )
    await oip_container.command_bus.dispatch(
        RecordAssistantMessageCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            conversation_id=conversation_id,
            request_id=request_id,
            content="Your balance is NPR 10,000.",
        )
    )

    history = await oip_container.query_bus.dispatch(
        GetConversationHistoryQuery(
            tenant_id=TenantId("tenant-a"),
            conversation_id=conversation_id,
        )
    )
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
    assert history[0]["sequence_no"] == 1
    assert history[1]["sequence_no"] == 2


@pytest.mark.asyncio
async def test_close_conversation(oip_container):
    correlation_id = str(new_correlation_id())
    conversation = await oip_container.command_bus.dispatch(
        EnsureConversationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            session_id="sess-3",
            user_id="user-1",
            module="orbix",
        )
    )
    closed = await oip_container.command_bus.dispatch(
        CloseConversationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            conversation_id=ConversationId(conversation["conversation_id"]),
        )
    )
    assert closed["status"] == "closed"
    assert closed["closed_at"] is not None


@pytest.mark.asyncio
async def test_facade_records_conversation_via_native_pipeline(oip_container):
    from src.oip.application.dto.intelligence_request import IntelligenceRequestDto

    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    dto = IntelligenceRequestDto(
        request_id=request_id,
        correlation_id=correlation_id,
        tenant_id="tenant-a",
        user_id="user-1",
        session_id="sess-facade",
        conversation_id="sess-facade",
        module="orbix",
        question="Show balance",
    )
    await oip_container.kernel.submit(dto)

    conversation = await oip_container.conversation_service.get_active_by_session(
        tenant_id="tenant-a",
        session_id="sess-facade",
        module="orbix",
    )
    assert conversation is not None
    history = await oip_container.conversation_service.get_history(
        tenant_id="tenant-a",
        conversation_id=conversation.conversation_id,
    )
    assert len(history) >= 1
    assert history[0].content == "Show balance"
