"""OIP Phase 1.3 — Router module tests."""

from __future__ import annotations

import pytest

from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.planner.application.commands import CreateExecutionPlanCommand
from src.oip.modules.router.application.commands import (
    ApproveRouteCommand,
    CreateRouteDecisionCommand,
    RejectRouteCommand,
)
from src.oip.modules.router.application.queries import (
    GetProviderHealthQuery,
    GetRouteDecisionQuery,
    GetRoutingMetricsQuery,
    SearchRoutesQuery,
)
from src.oip.modules.router.domain.value_objects import RoutingPolicyName
from src.oip.modules.router.infrastructure.adapters.provider_registry import create_default_provider_registry
from src.oip.shared.ids import CorrelationId, PlanId, RequestId, RouteId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_router_test.db"
    settings = OipSettings(
        enabled=True,
        execution_mode="native",
        orchestrator_enabled=True,
        planner_enabled=True,
        shadow_planner=True,
        router_enabled=True,
        shadow_router=True,
        provider_runtime_enabled=True,
        router_policy="balanced",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


async def _create_plan(container, message: str = "Ram ko balance kati ho?"):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    plan = await container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-router",
            user_id="user-1",
            module="orbix",
            message=message,
        )
    )
    return plan, request_id


@pytest.mark.asyncio
async def test_provider_registry_has_eight_providers():
    registry = create_default_provider_registry()
    ids = registry.list_ids()
    assert len(ids) >= 8
    assert "ollama" in ids
    assert "groq" in ids
    assert "openai" in ids


@pytest.mark.asyncio
async def test_create_route_decision(oip_container):
    plan, _ = await _create_plan(oip_container)
    correlation_id = str(new_correlation_id())
    route = await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(plan["plan_id"]),
            routing_policy=RoutingPolicyName.BALANCED,
        )
    )
    assert route["route_id"]
    assert route["plan_id"] == plan["plan_id"]
    assert route["primary_provider_id"]
    assert len(route["fallback_providers"]) >= 1
    assert route["status"] == "draft"


@pytest.mark.asyncio
async def test_router_prefers_configured_provider(tmp_path):
    db_path = tmp_path / "oip_router_groq_test.db"
    settings = OipSettings(
        enabled=True,
        execution_mode="native",
        orchestrator_enabled=True,
        planner_enabled=True,
        shadow_planner=True,
        router_enabled=True,
        shadow_router=True,
        provider_runtime_enabled=True,
        router_policy="balanced",
        default_provider="groq",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    try:
        plan, _ = await _create_plan(container)
        route = await container.command_bus.dispatch(
            CreateRouteDecisionCommand(
                tenant_id=TenantId("tenant-a"),
                correlation_id=CorrelationId(str(new_correlation_id())),
                plan_id=PlanId(plan["plan_id"]),
            )
        )
        assert route["primary_provider_id"] == "groq"
    finally:
        await container.close()
        await shutdown_container()


@pytest.mark.asyncio
async def test_fallback_chain_never_empty(oip_container):
    plan, _ = await _create_plan(oip_container)
    route = await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    assert route["primary_provider_id"]
    assert route["fallback_providers"]


@pytest.mark.asyncio
async def test_approve_and_reject_route(oip_container):
    plan, _ = await _create_plan(oip_container)
    correlation_id = str(new_correlation_id())
    created = await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    approved = await oip_container.command_bus.dispatch(
        ApproveRouteCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(created["route_id"]),
        )
    )
    assert approved["status"] == "approved"

    plan2, _ = await _create_plan(oip_container, message="VAT report")
    created2 = await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(plan2["plan_id"]),
        )
    )
    rejected = await oip_container.command_bus.dispatch(
        RejectRouteCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(created2["route_id"]),
            reason="policy_denied",
        )
    )
    assert rejected["status"] == "rejected"


@pytest.mark.asyncio
async def test_search_routes(oip_container):
    plan, request_id = await _create_plan(oip_container)
    await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    routes = await oip_container.query_bus.dispatch(
        SearchRoutesQuery(
            tenant_id=TenantId("tenant-a"),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    assert len(routes) == 1
    assert routes[0]["request_id"] == request_id


@pytest.mark.asyncio
async def test_provider_health(oip_container):
    health = await oip_container.query_bus.dispatch(
        GetProviderHealthQuery(tenant_id=TenantId("tenant-a"), provider_id="ollama")
    )
    assert health["provider_id"] == "ollama"
    assert health["health"]["availability"] >= 0.5


@pytest.mark.asyncio
async def test_routing_metrics(oip_container):
    plan, _ = await _create_plan(oip_container)
    await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    metrics = await oip_container.query_bus.dispatch(
        GetRoutingMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["routes_created"] >= 1


@pytest.mark.asyncio
async def test_lineage_on_route_creation(oip_container):
    plan, request_id = await _create_plan(oip_container)
    await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    from src.oip.application.queries import GetLineageTraceQuery

    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    node_types = {n["node_type"] for n in trace}
    assert "RouteDecision" in node_types
    assert "PrimarySelection" in node_types
    assert "FallbackChain" in node_types


@pytest.mark.asyncio
async def test_audit_on_route_creation(oip_container):
    plan, request_id = await _create_plan(oip_container)
    await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            plan_id=PlanId(plan["plan_id"]),
        )
    )
    from src.oip.application.queries import GetAuditChainQuery

    audit = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    events = {row["event_name"] for row in audit}
    assert "router.route.created" in events


@pytest.mark.asyncio
async def test_offline_policy_routes_to_ollama(oip_container):
    plan, _ = await _create_plan(oip_container)
    route = await oip_container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            plan_id=PlanId(plan["plan_id"]),
            routing_policy=RoutingPolicyName.OFFLINE,
        )
    )
    assert route["primary_provider_id"] in {"ollama", "custom"}


@pytest.mark.asyncio
async def test_facade_native_router(oip_container):
    from src.oip.application.dto.intelligence_request import IntelligenceRequestDto

    dto = IntelligenceRequestDto(
        request_id=str(new_request_id()),
        correlation_id=str(new_correlation_id()),
        tenant_id="tenant-a",
        user_id="user-1",
        session_id="sess-facade-router",
        conversation_id="sess-facade-router",
        module="orbix",
        question="Ram ko balance?",
    )
    await oip_container.kernel.submit(dto)

    routes = await oip_container.query_bus.dispatch(
        SearchRoutesQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(dto.request_id))
    )
    assert len(routes) == 1
    assert routes[0]["primary_provider_id"]


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    cursor = await oip_container.connection.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type='table'
          AND (name LIKE 'oip_route%' OR name LIKE 'oip_provider%' OR name LIKE 'oip_routing%')
        """
    )
    rows = await cursor.fetchall()
    names = {row["name"] for row in rows}
    assert "oip_route_decisions" in names
    assert "oip_route_candidates" in names
    assert "oip_provider_health" in names
    assert "oip_routing_metrics" in names
