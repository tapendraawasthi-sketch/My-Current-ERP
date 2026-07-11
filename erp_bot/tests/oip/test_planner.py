"""OIP Phase 1.2 — Planner module tests."""

from __future__ import annotations

import pytest

from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.planner.application.commands import (
    ArchiveExecutionPlanCommand,
    CancelExecutionPlanCommand,
    CreateExecutionPlanCommand,
    ValidateExecutionPlanCommand,
)
from src.oip.modules.planner.application.dto.planning_request import PlanningRequestDto
from src.oip.modules.planner.application.pipeline.budget_allocation_stage import BudgetAllocationStage
from src.oip.modules.planner.application.pipeline.constraint_resolution_stage import (
    ConstraintResolutionStage,
    create_default_constraint_registry,
)
from src.oip.modules.planner.application.pipeline.intent_classification_stage import (
    IntentClassificationStage,
    create_default_intent_registry,
)
from src.oip.modules.planner.application.pipeline.normalize_stage import NormalizeStage
from src.oip.modules.planner.application.pipeline.pipeline import PlanningPipeline
from src.oip.modules.planner.application.queries import (
    GetExecutionPlanQuery,
    GetExecutionStepsQuery,
    GetPlannerMetricsQuery,
    SearchExecutionPlansQuery,
)
from src.oip.modules.planner.domain.step_registry import create_default_step_registry
from src.oip.modules.planner.domain.value_objects import ExecutionStepType, PlanningPolicyName
from src.oip.modules.planner.infrastructure.adapters.default_capability_registry import (
    DefaultCapabilityRegistryAdapter,
)
from src.oip.modules.planner.infrastructure.adapters.default_execution_budget import (
    DefaultExecutionBudgetAdapter,
)
from src.oip.modules.planner.infrastructure.adapters.default_planning_policy import (
    DefaultPlanningPolicyAdapter,
)
from src.oip.modules.planner.infrastructure.adapters.default_skill_registry import (
    DefaultSkillRegistryAdapter,
)
from src.oip.modules.planner.infrastructure.adapters.default_tool_registry import (
    DefaultToolRegistryAdapter,
)
from src.oip.modules.planner.infrastructure.factory import build_planning_pipeline
from src.oip.shared.ids import CorrelationId, PlanId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_planner_test.db"
    settings = OipSettings(
        enabled=True,
        execution_mode="native",
        orchestrator_enabled=True,
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        shadow_planner=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def _planning_request(**overrides) -> PlanningRequestDto:
    defaults = {
        "request_id": str(new_request_id()),
        "correlation_id": str(new_correlation_id()),
        "tenant_id": "tenant-a",
        "user_id": "user-1",
        "session_id": "sess-1",
        "conversation_id": "conv-1",
        "module": "orbix",
        "message": "Ram ko balance kati ho?",
        "policy_name": PlanningPolicyName.BALANCED,
    }
    defaults.update(overrides)
    return PlanningRequestDto(**defaults)


@pytest.mark.asyncio
async def test_normalize_stage():
    from src.oip.modules.planner.application.pipeline.context import PlanningContext

    stage = NormalizeStage()
    ctx = PlanningContext(request=_planning_request(message="  hello   world  "))
    ctx = await stage.run(ctx)
    assert ctx.normalized_message == "hello world"


@pytest.mark.asyncio
async def test_intent_classification_balance():
    stage = IntentClassificationStage(create_default_intent_registry())
    from src.oip.modules.planner.application.pipeline.context import PlanningContext

    ctx = PlanningContext(request=_planning_request(message="Ram ko balance kati ho?"))
    ctx.normalized_message = "ram ko balance kati ho?"
    ctx = await stage.run(ctx)
    assert ctx.intent == "ledger_balance_query"
    assert ctx.task_profile is not None
    assert ctx.task_profile.requires_tools is True


@pytest.mark.asyncio
async def test_step_registry_no_switch():
    registry = create_default_step_registry()
    assert ExecutionStepType.REASON in registry.supported_types()
    built = registry.build(
        ExecutionStepType.PROVIDER,
        plan_id="plan-1",
        tenant_id="tenant-a",
        sequence_no=1,
        context={"payload": {"model": "any"}},
    )
    assert built["step_type"] == ExecutionStepType.PROVIDER


@pytest.mark.asyncio
async def test_budget_allocation_priority_order():
    from src.oip.modules.planner.application.pipeline.context import PlanningContext
    from src.oip.modules.planner.domain.value_objects import PlanningPolicy

    stage = BudgetAllocationStage()
    ctx = PlanningContext(request=_planning_request())
    ctx.policy = DefaultPlanningPolicyAdapter().resolve(
        policy_name=PlanningPolicyName.BALANCED,
        module="orbix",
    )
    ctx.knowledge_required = True
    ctx.memory_required = True
    ctx.task_profile = type(
        "TP",
        (),
        {"requires_erp_snapshot": True, "complexity": "medium"},
    )()
    ctx = await stage.run(ctx)
    assert ctx.context_budget is not None
    assert ctx.context_budget.erp_snapshot_tokens > 0
    assert ctx.context_budget.knowledge_tokens > 0
    assert ctx.context_budget.total_tokens > 0


@pytest.mark.asyncio
async def test_create_execution_plan(oip_container):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    plan = await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-1",
            user_id="user-1",
            conversation_id="conv-1",
            module="orbix",
            message="Ram ko balance kati ho?",
            policy_name=PlanningPolicyName.BALANCED,
        )
    )
    assert plan["plan_id"]
    assert plan["intent"] == "ledger_balance_query"
    assert plan["step_count"] >= 4
    assert plan["knowledge_required"] in {True, False}
    assert plan["status"] == "draft"


@pytest.mark.asyncio
async def test_validate_and_cancel_plan(oip_container):
    correlation_id = str(new_correlation_id())
    created = await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(str(new_request_id())),
            session_id="sess-2",
            user_id="user-1",
            module="orbix",
            message="What is VAT?",
            policy_name=PlanningPolicyName.ACCURATE,
        )
    )
    validated = await oip_container.command_bus.dispatch(
        ValidateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(created["plan_id"]),
        )
    )
    assert validated["status"] == "validated"

    cancelled = await oip_container.command_bus.dispatch(
        CancelExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(created["plan_id"]),
            reason="user_abort",
        )
    )
    assert cancelled["status"] == "cancelled"


@pytest.mark.asyncio
async def test_get_plan_steps_and_search(oip_container):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    created = await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-3",
            user_id="user-1",
            conversation_id="conv-3",
            module="khata",
            message="Saman bechyo Rs 5000",
            policy_name=PlanningPolicyName.ACCOUNTING,
        )
    )
    steps = await oip_container.query_bus.dispatch(
        GetExecutionStepsQuery(
            tenant_id=TenantId("tenant-a"),
            plan_id=PlanId(created["plan_id"]),
        )
    )
    assert len(steps) >= 4
    assert steps[0]["sequence_no"] == 1

    found = await oip_container.query_bus.dispatch(
        SearchExecutionPlansQuery(
            tenant_id=TenantId("tenant-a"),
            request_id=RequestId(request_id),
        )
    )
    assert len(found) == 1
    assert found[0]["plan_id"] == created["plan_id"]


@pytest.mark.asyncio
async def test_planner_metrics(oip_container):
    correlation_id = str(new_correlation_id())
    await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(str(new_request_id())),
            session_id="sess-4",
            user_id="user-1",
            module="orbix",
            message="hello",
        )
    )
    metrics = await oip_container.query_bus.dispatch(
        GetPlannerMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["plans_created"] >= 1


@pytest.mark.asyncio
async def test_lineage_on_plan_creation(oip_container):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-5",
            user_id="user-1",
            module="orbix",
            message="balance?",
        )
    )
    from src.oip.application.queries import GetLineageTraceQuery

    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    node_types = {node["node_type"] for node in trace}
    assert "Planner" in node_types
    assert "ExecutionPlan" in node_types
    assert "ExecutionStep" in node_types


@pytest.mark.asyncio
async def test_audit_on_plan_creation(oip_container):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-6",
            user_id="user-1",
            module="orbix",
            message="balance?",
        )
    )
    from src.oip.application.queries import GetAuditChainQuery

    audit = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    events = {row["event_name"] for row in audit}
    assert "planner.plan.created" in events


@pytest.mark.asyncio
async def test_outbox_event_on_plan_creation(oip_container):
    correlation_id = str(new_correlation_id())
    await oip_container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(str(new_request_id())),
            session_id="sess-7",
            user_id="user-1",
            module="orbix",
            message="hello",
        )
    )
    published = await oip_container.outbox_dispatcher.dispatch_pending(limit=20)
    assert published >= 1


@pytest.mark.asyncio
async def test_planning_policies():
    adapter = DefaultPlanningPolicyAdapter()
    fast = adapter.resolve(policy_name=PlanningPolicyName.FAST, module="orbix")
    gov = adapter.resolve(policy_name=PlanningPolicyName.GOVERNMENT, module="orbix")
    offline = adapter.resolve(policy_name=PlanningPolicyName.OFFLINE, module="orbix")
    assert fast.max_latency_ms < gov.max_latency_ms
    assert offline.offline_only is True


@pytest.mark.asyncio
async def test_tool_requirements_journal_entry():
    tools = DefaultToolRegistryAdapter().detect_requirements(
        intent="journal_entry",
        module="khata",
        message="saman bechyo",
    )
    assert len(tools) >= 2
    assert any(t.tool_id == "erp.journal.draft" for t in tools)


@pytest.mark.asyncio
async def test_facade_native_planner(oip_container):
    from src.oip.application.dto.intelligence_request import IntelligenceRequestDto

    dto = IntelligenceRequestDto(
        request_id=str(new_request_id()),
        correlation_id=str(new_correlation_id()),
        tenant_id="tenant-a",
        user_id="user-1",
        session_id="sess-facade-planner",
        conversation_id="sess-facade-planner",
        module="orbix",
        question="Ram ko balance?",
    )
    await oip_container.kernel.submit(dto)

    plans = await oip_container.query_bus.dispatch(
        SearchExecutionPlansQuery(
            tenant_id=TenantId("tenant-a"),
            request_id=RequestId(dto.request_id),
        )
    )
    assert len(plans) == 1
    assert plans[0]["intent"] == "ledger_balance_query"


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    cursor = await oip_container.connection.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type='table'
          AND (name LIKE 'oip_%planner%'
               OR name LIKE 'oip_execution_%'
               OR name LIKE 'oip_planning_%')
        """
    )
    rows = await cursor.fetchall()
    table_names = {row["name"] for row in rows}
    assert "oip_execution_plans" in table_names
    assert "oip_execution_steps" in table_names
    assert "oip_planning_constraints" in table_names
    assert "oip_execution_budgets" in table_names
    assert "oip_planner_metrics" in table_names
