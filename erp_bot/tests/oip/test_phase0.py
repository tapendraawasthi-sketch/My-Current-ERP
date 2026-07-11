"""OIP Phase 0 — constitutional foundation tests."""

from __future__ import annotations

import pytest

from src.oip import IntelligenceKernelFacade
from src.oip.application.commands import SubmitIntelligenceRequestCommand
from src.oip.application.dto.intelligence_request import IntelligenceRequestDto
from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path, monkeypatch):
    db_path = tmp_path / "oip_test.db"
    settings = OipSettings(
        enabled=True,
        facade_routes_legacy=False,
        execution_mode="native",
        orchestrator_enabled=True,
        shadow_audit=True,
        shadow_lineage=True,
        conversation_enabled=True,
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    monkeypatch.setenv("OIP_DATABASE_URL", settings.database_url)
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


@pytest.mark.asyncio
async def test_import_kernel_facade():
    assert IntelligenceKernelFacade is not None


@pytest.mark.asyncio
async def test_outbox_enqueue_and_dispatch(oip_container):
    command = SubmitIntelligenceRequestCommand(
        tenant_id=TenantId("tenant-a"),
        correlation_id=CorrelationId(str(new_correlation_id())),
        session_id="sess-1",
        user_id="user-1",
        module="orbix",
        message="hello",
    )
    result = await oip_container.command_bus.dispatch(command)
    assert result["status"] == "accepted"
    assert result["outbox_message_id"]

    published = await oip_container.outbox_dispatcher.dispatch_pending(limit=10)
    assert published == 1


@pytest.mark.asyncio
async def test_audit_hash_chain(oip_container):
    tenant = "tenant-a"
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())

    await oip_container.kernel._audit.record(
        tenant_id=tenant,
        request_id=request_id,
        correlation_id=correlation_id,
        event_name="test.event.one",
        payload_redacted={"step": 1},
    )
    await oip_container.kernel._audit.record(
        tenant_id=tenant,
        request_id=request_id,
        correlation_id=correlation_id,
        event_name="test.event.two",
        payload_redacted={"step": 2},
    )

    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId(tenant), request_id=RequestId(request_id))
    )
    assert len(chain) == 2
    assert chain[0]["prev_hash"] != chain[1]["record_hash"]
    assert chain[1]["prev_hash"] == chain[0]["record_hash"]


@pytest.mark.asyncio
async def test_lineage_trace(oip_container):
    tenant = "tenant-a"
    request_id = str(new_request_id())

    await oip_container.kernel._lineage.append_node(
        tenant_id=tenant,
        request_id=request_id,
        node_type="Request",
        payload={"module": "orbix"},
    )
    await oip_container.kernel._lineage.append_node(
        tenant_id=tenant,
        request_id=request_id,
        node_type="Response",
        payload={"action_count": 1},
    )

    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId(tenant), request_id=RequestId(request_id))
    )
    assert len(trace) == 2
    assert trace[0]["node_type"] == "Request"
    assert trace[1]["node_type"] == "Response"


@pytest.mark.asyncio
async def test_facade_native_pipeline_writes_audit_and_lineage(oip_container):
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    dto = IntelligenceRequestDto(
        request_id=request_id,
        correlation_id=correlation_id,
        tenant_id="tenant-a",
        user_id="user-1",
        session_id="sess-1",
        conversation_id="sess-1",
        module="orbix",
        question="What is my balance?",
    )
    response = await oip_container.kernel.submit(dto)
    assert response.metadata.get("native_pipeline") is True
    assert response.metadata.get("workflow_id")

    audit = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    assert len(audit) >= 2
    event_names = {row["event_name"] for row in audit}
    assert "intelligence.request.received" in event_names
    assert "intelligence.response.completed" in event_names

    lineage = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    assert len(lineage) >= 2


@pytest.mark.asyncio
async def test_oec_snapshot_via_runtime(oip_container):
    snapshot = await oip_container.oec_runtime_service.get_context_snapshot(
        tenant_id="tenant-a",
        company_id="c1",
        branch_id=None,
        user_id="u1",
    )
    assert snapshot.tenant_id == "tenant-a"
    assert snapshot.company_id == "c1"
    assert snapshot.snapshot_id


@pytest.mark.asyncio
async def test_kernel_health(oip_container):
    health = await oip_container.kernel.health()
    assert health["status"] == "ok"
    assert health["kernel"] == "oip"
    assert health["legacy_delegation"] is False
    assert health["execution_mode"] == "native"
    assert health["native_execution_default"] is True
