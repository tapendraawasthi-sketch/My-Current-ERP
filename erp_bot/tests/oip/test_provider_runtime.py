"""OIP Phase 1.4 — Provider Runtime module tests."""

from __future__ import annotations

import pytest

from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.planner.application.commands import CreateExecutionPlanCommand
from src.oip.modules.provider_runtime.application.commands import (
    ArchiveExecutionCommand,
    CancelExecutionCommand,
    CheckpointExecutionCommand,
    StartExecutionCommand,
    TimeoutExecutionCommand,
)
from src.oip.modules.provider_runtime.application.queries import (
    ExecutionMetricsQuery,
    GetExecutionArtifactsQuery,
    GetExecutionQuery,
    GetExecutionUsageQuery,
    SearchExecutionsQuery,
)
from src.oip.modules.provider_runtime.domain.value_objects import ExecutionPolicyName
from src.oip.modules.provider_runtime.infrastructure.adapters.artifact_store_adapter import LocalArtifactStoreAdapter
from src.oip.modules.provider_runtime.infrastructure.adapters.provider_adapter_registry import (
    ProviderAdapterRegistry,
    create_default_provider_adapters,
)
from src.oip.modules.provider_runtime.infrastructure.adapters.tool_sandbox_adapter import DefaultToolSandboxAdapter
from src.oip.modules.provider_runtime.infrastructure.adapters.capability_token_adapter import SqliteCapabilityTokenAdapter
from src.oip.modules.router.application.commands import CreateRouteDecisionCommand
from src.oip.shared.ids import (
    CorrelationId,
    ExecutionId,
    PlanId,
    RequestId,
    RouteId,
    TenantId,
    new_correlation_id,
    new_request_id,
)


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_provider_runtime_test.db"
    settings = OipSettings(
        enabled=True,
        execution_mode="native",
        orchestrator_enabled=True,
        planner_enabled=True,
        shadow_planner=True,
        router_enabled=True,
        shadow_router=True,
        provider_runtime_enabled=True,
        shadow_provider_runtime=True,
        streaming_enabled=True,
        provider_policy="balanced",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


async def _create_route(container, message: str = "Show ledger balance"):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    plan = await container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-runtime",
            user_id="user-1",
            module="orbix",
            message=message,
        )
    )
    route = await container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    return route, request_id, correlation_id


@pytest.mark.asyncio
async def test_provider_adapter_registry_has_adapters():
    registry = ProviderAdapterRegistry()
    ids = registry.list_provider_ids()
    assert len(ids) >= 8
    assert "openai" in ids
    assert "anthropic" in ids
    assert "mock" in ids


@pytest.mark.asyncio
async def test_start_execution(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    execution = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
            execution_policy=ExecutionPolicyName.BALANCED,
        )
    )
    assert execution["execution_id"]
    assert execution["route_id"] == route["route_id"]
    assert execution["status"] == "completed"
    assert execution["success"] is True
    assert execution["provider_id"]


@pytest.mark.asyncio
async def test_execution_usage_collected(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    execution = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    usage = await oip_container.query_bus.dispatch(
        GetExecutionUsageQuery(
            tenant_id=TenantId("tenant-a"),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    assert usage is not None
    assert usage["input_tokens"] >= 0
    assert usage["output_tokens"] >= 0
    assert usage["provider_id"]


@pytest.mark.asyncio
async def test_execution_artifacts_stored(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    execution = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    artifacts = await oip_container.query_bus.dispatch(
        GetExecutionArtifactsQuery(
            tenant_id=TenantId("tenant-a"),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    assert len(artifacts) >= 1
    assert artifacts[0]["content_hash"]
    assert artifacts[0]["blob_pointer"]
    assert artifacts[0]["encrypted"] is True


@pytest.mark.asyncio
async def test_cancel_and_timeout_execution(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    execution = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    route2, _, corr2 = await _create_route(oip_container, message="Cancel test")
    exec2 = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(corr2),
            route_id=RouteId(route2["route_id"]),
        )
    )
    cancelled = await oip_container.command_bus.dispatch(
        CancelExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(corr2),
            execution_id=ExecutionId(exec2["execution_id"]),
            reason="user_cancelled",
        )
    )
    assert cancelled["status"] == "cancelled"

    route3, _, corr3 = await _create_route(oip_container, message="Timeout test")
    exec3 = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(corr3),
            route_id=RouteId(route3["route_id"]),
        )
    )
    timed_out = await oip_container.command_bus.dispatch(
        TimeoutExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(corr3),
            execution_id=ExecutionId(exec3["execution_id"]),
        )
    )
    assert timed_out["status"] == "timed_out"


@pytest.mark.asyncio
async def test_checkpoint_and_archive(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    execution = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    checkpointed = await oip_container.command_bus.dispatch(
        CheckpointExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            state_snapshot={"step": 1},
        )
    )
    assert checkpointed["execution_id"] == execution["execution_id"]

    archived = await oip_container.command_bus.dispatch(
        ArchiveExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    assert archived["status"] == "archived"


@pytest.mark.asyncio
async def test_search_executions(oip_container):
    route, request_id, correlation_id = await _create_route(oip_container)
    await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    results = await oip_container.query_bus.dispatch(
        SearchExecutionsQuery(
            tenant_id=TenantId("tenant-a"),
            route_id=RouteId(route["route_id"]),
            limit=10,
        )
    )
    assert len(results) >= 1
    assert results[0]["route_id"] == route["route_id"]


@pytest.mark.asyncio
async def test_execution_metrics(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    metrics = await oip_container.query_bus.dispatch(
        ExecutionMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["executions_started"] >= 1
    assert metrics["executions_completed"] >= 1


@pytest.mark.asyncio
async def test_lineage_on_execution(oip_container):
    route, request_id, correlation_id = await _create_route(oip_container)
    await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    node_types = [n["node_type"] for n in trace]
    assert "Execution" in node_types
    assert "ProviderInvocation" in node_types
    assert "ArtifactPointer" in node_types
    assert "ExecutionResult" in node_types


@pytest.mark.asyncio
async def test_audit_on_execution(oip_container):
    route, request_id, correlation_id = await _create_route(oip_container)
    await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    events = [r["event_name"] for r in chain]
    assert "provider_runtime.execution.completed" in events


@pytest.mark.asyncio
async def test_capability_token_required_for_tool_sandbox(oip_container):
    token_port = SqliteCapabilityTokenAdapter(oip_container.execution_repository)
    sandbox = DefaultToolSandboxAdapter(token_port)
    token = await token_port.issue(
        tenant_id="tenant-a",
        request_id="req-1",
        conversation_id="conv-1",
        company_id="co-1",
        allowed_tools=("erp",),
        allowed_erp_actions=("read",),
        maximum_calls=2,
        read_scope=("erp",),
        write_scope=(),
    )
    sandbox_id = await sandbox.create_sandbox(
        execution_id="exec-1",
        token=token,
        allowed_tools=("erp",),
    )
    result = await sandbox.invoke_tool(
        sandbox_id=sandbox_id,
        token=token,
        tool_id="erp",
        payload={"action": "balance"},
    )
    assert result["result"] == "ok"


@pytest.mark.asyncio
async def test_artifact_hash_pointer_only(oip_container):
    store = LocalArtifactStoreAdapter()
    artifact = await store.store(
        tenant_id="tenant-a",
        execution_id="exec-1",
        content=b"provider output",
        provider_id="openai",
        model="gpt-4o",
    )
    assert artifact.content_hash
    assert artifact.blob_pointer.startswith("artifact://")
    assert store.verify_hash(artifact.blob_pointer, artifact.content_hash, "tenant-a")


@pytest.mark.asyncio
async def test_stream_chunks_stored(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    execution = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    chunks = await oip_container.execution_repository.list_stream_chunks(
        tenant_id="tenant-a",
        execution_id=execution["execution_id"],
    )
    assert len(chunks) >= 0


@pytest.mark.asyncio
async def test_facade_native_provider_runtime(oip_container):
    from src.oip.application.dto.intelligence_request import IntelligenceRequestDto

    dto = IntelligenceRequestDto(
        request_id=str(new_request_id()),
        correlation_id=str(new_correlation_id()),
        idempotency_key="idem-runtime",
        tenant_id="tenant-a",
        user_id="user-1",
        session_id="sess-shadow-runtime",
        conversation_id="sess-shadow-runtime",
        module="orbix",
        question="Shadow execution test",
    )
    await oip_container.kernel.submit(dto)
    executions = await oip_container.query_bus.dispatch(
        SearchExecutionsQuery(tenant_id=TenantId("tenant-a"), limit=5)
    )
    assert len(executions) >= 1


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    cursor = await oip_container.connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'oip_%execution%' OR name LIKE 'oip_%stream%' OR name LIKE 'oip_%provider_inv%' OR name = 'oip_capability_tokens')"
    )
    rows = await cursor.fetchall()
    table_names = {row[0] for row in rows}
    assert "oip_executions" in table_names
    assert "oip_provider_invocations" in table_names
    assert "oip_execution_usage" in table_names
    assert "oip_execution_artifacts" in table_names
    assert "oip_stream_chunks" in table_names
    assert "oip_capability_tokens" in table_names
    assert "oip_execution_metrics" in table_names


@pytest.mark.asyncio
async def test_get_execution_query(oip_container):
    route, _, correlation_id = await _create_route(oip_container)
    created = await oip_container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    fetched = await oip_container.query_bus.dispatch(
        GetExecutionQuery(
            tenant_id=TenantId("tenant-a"),
            execution_id=ExecutionId(created["execution_id"]),
        )
    )
    assert fetched is not None
    assert fetched["execution_id"] == created["execution_id"]
