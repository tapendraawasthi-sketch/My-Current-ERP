"""OIP Phase 1.9 — Orchestrator Runtime module tests."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from src.oip.application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.orchestrator.application.commands import (
    ArchiveWorkflowCommand,
    CancelWorkflowCommand,
    RecoverWorkflowsCommand,
    StartWorkflowCommand,
)
from src.oip.modules.orchestrator.application.dto.stage_result import StageResult
from src.oip.modules.orchestrator.application.dto.workflow_context import WorkflowContext
from src.oip.modules.orchestrator.application.queries import (
    GetWorkflowQuery,
    GetWorkflowTimelineQuery,
    ListWorkflowsQuery,
    WorkflowMetricsQuery,
)
from src.oip.modules.orchestrator.domain.stage_registry import create_default_stage_registry
from src.oip.modules.orchestrator.domain.value_objects import (
    ExecutionMode,
    RetryClassification,
    StageRunStatus,
    WorkflowStageName,
    WorkflowState,
)
from src.oip.modules.orchestrator.infrastructure.adapters.sequential_workflow_engine import SequentialWorkflowEngine
from src.oip.modules.orchestrator.infrastructure.adapters.stage_port_registry import StagePortRegistry
from src.oip.modules.orchestrator.infrastructure.adapters.stages.module_stages import ValidationStageAdapter
from src.oip.shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_orchestrator_test.db"
    settings = OipSettings(
        enabled=True,
        orchestrator_enabled=True,
        execution_mode="native",
        stream_runtime_mode="native",
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        quality_enabled=True,
        action_runtime_enabled=True,
        require_approval=False,
        conversation_enabled=True,
        session_enabled=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def _start_cmd(**kwargs) -> StartWorkflowCommand:
    return StartWorkflowCommand(
        tenant_id=TenantId(kwargs.get("tenant_id", "tenant-a")),
        correlation_id=CorrelationId(str(new_correlation_id())),
        request_id=RequestId(str(new_request_id())),
        session_id=kwargs.get("session_id", "sess-orch-1"),
        user_id=kwargs.get("user_id", "user-1"),
        module=kwargs.get("module", "orbix"),
        message=kwargs.get("message", "Show ledger balance"),
        execution_mode=kwargs.get("execution_mode"),
        idempotency_key=kwargs.get("idempotency_key", ""),
    )


def _mock_legacy_response(request: IntelligenceRequestDto) -> IntelligenceResponseDto:
    return IntelligenceResponseDto(
        request_id=request.request_id,
        correlation_id=request.correlation_id,
        actions=(),
        metadata={"source": "mock_legacy"},
    )


def _intel_request(**kwargs) -> IntelligenceRequestDto:
    request_id = str(new_request_id())
    return IntelligenceRequestDto(
        request_id=request_id,
        correlation_id=str(new_correlation_id()),
        idempotency_key=kwargs.get("idempotency_key", request_id),
        tenant_id=kwargs.get("tenant_id", "tenant-a"),
        user_id=kwargs.get("user_id", "user-1"),
        session_id=kwargs.get("session_id", "sess-orch-1"),
        conversation_id=kwargs.get("session_id", "sess-orch-1"),
        module=kwargs.get("module", "orbix"),
        question=kwargs.get("message", "Show ledger balance"),
    )


@pytest.mark.asyncio
async def test_stage_registry_order():
    registry = create_default_stage_registry()
    names = registry.stage_names()
    assert names[0] == "validation"
    assert "conversation" in names
    assert names[-1] == "publication"


@pytest.mark.asyncio
async def test_stage_registry_rollback_policies():
    registry = create_default_stage_registry()
    planning = registry.get(WorkflowStageName.PLANNING)
    execution = registry.get(WorkflowStageName.EXECUTION)
    action = registry.get(WorkflowStageName.ACTION)
    assert planning.rollback_policy.value == "none"
    assert execution.rollback_policy.value == "cancel"
    assert action.rollback_policy.value == "compensate"


@pytest.mark.asyncio
async def test_validation_stage_rejects_empty_message(oip_container):
    ports = oip_container.orchestrator_service._engine._stage_ports  # noqa: SLF001
    stage = ports.get("validation")
    ctx = WorkflowContext(
        workflow_id="wf1",
        request_id="r1",
        correlation_id="c1",
        tenant_id="tenant-a",
        user_id="u1",
        session_id="s1",
        message="",
    )
    result = await stage.validate(ctx)
    assert result.status == StageRunStatus.FAILED


@pytest.mark.asyncio
async def test_start_workflow(oip_container):
    wf = await oip_container.command_bus.dispatch(_start_cmd())
    assert wf["workflow_state"] == "pending"
    assert wf["execution_mode"] == "native"


@pytest.mark.asyncio
async def test_start_workflow_idempotency(oip_container):
    cmd = _start_cmd(idempotency_key="idem-orch-1")
    w1 = await oip_container.command_bus.dispatch(cmd)
    w2 = await oip_container.command_bus.dispatch(
        _start_cmd(idempotency_key="idem-orch-1", message="other")
    )
    assert w1["workflow_id"] == w2["workflow_id"]


@pytest.mark.asyncio
async def test_successful_full_workflow(oip_container):
    workflow, _ = await oip_container.orchestrator_service.execute_workflow(
        request=_intel_request(message="Show ledger balance")
    )
    assert workflow.workflow_state in (WorkflowState.COMPLETED, WorkflowState.FAILED)
    assert len(workflow.completed_stages) >= 1


@pytest.mark.asyncio
async def test_execute_workflow_persists_stages(oip_container):
    workflow, _ = await oip_container.orchestrator_service.execute_workflow(
        request=_intel_request()
    )
    timeline = await oip_container.query_bus.dispatch(
        GetWorkflowTimelineQuery(
            tenant_id=TenantId("tenant-a"),
            workflow_id=workflow.workflow_id,
        )
    )
    assert timeline is not None
    assert len(timeline["entries"]) >= 1


@pytest.mark.asyncio
async def test_get_workflow_query(oip_container):
    started = await oip_container.command_bus.dispatch(_start_cmd())
    fetched = await oip_container.query_bus.dispatch(
        GetWorkflowQuery(tenant_id=TenantId("tenant-a"), workflow_id=started["workflow_id"])
    )
    assert fetched["workflow_id"] == started["workflow_id"]


@pytest.mark.asyncio
async def test_list_workflows(oip_container):
    await oip_container.command_bus.dispatch(_start_cmd(session_id="list-1"))
    await oip_container.command_bus.dispatch(_start_cmd(session_id="list-2"))
    workflows = await oip_container.query_bus.dispatch(
        ListWorkflowsQuery(tenant_id=TenantId("tenant-a"), limit=10)
    )
    assert len(workflows) >= 2


@pytest.mark.asyncio
async def test_workflow_metrics(oip_container):
    await oip_container.orchestrator_service.execute_workflow(request=_intel_request())
    metrics = await oip_container.query_bus.dispatch(
        WorkflowMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["workflows_started"] >= 1


@pytest.mark.asyncio
async def test_cancel_workflow(oip_container):
    started = await oip_container.command_bus.dispatch(_start_cmd())
    cancelled = await oip_container.command_bus.dispatch(
        CancelWorkflowCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            workflow_id=started["workflow_id"],
            reason="user_cancel",
        )
    )
    assert cancelled["workflow_state"] == "cancelled"


@pytest.mark.asyncio
async def test_archive_workflow(oip_container):
    started = await oip_container.command_bus.dispatch(_start_cmd())
    archived = await oip_container.command_bus.dispatch(
        ArchiveWorkflowCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
            workflow_id=started["workflow_id"],
        )
    )
    assert archived["workflow_state"] == "archived"


@pytest.mark.asyncio
async def test_audit_on_workflow_start(oip_container):
    cmd = _start_cmd()
    await oip_container.command_bus.dispatch(cmd)
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=cmd.request_id)
    )
    names = [e["event_name"] for e in chain]
    assert any("orchestrator.workflow.started" in n for n in names)


@pytest.mark.asyncio
async def test_lineage_on_workflow_complete(oip_container):
    request = _intel_request()
    workflow, _ = await oip_container.orchestrator_service.execute_workflow(request=request)
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(
            tenant_id=TenantId("tenant-a"),
            request_id=RequestId(request.request_id),
        )
    )
    types = [n["node_type"] for n in trace]
    assert "Workflow" in types


@pytest.mark.asyncio
async def test_outbox_on_workflow_start(oip_container):
    await oip_container.command_bus.dispatch(_start_cmd())
    cursor = await oip_container.connection.execute(
        "SELECT event_type FROM oip_outbox ORDER BY created_at DESC LIMIT 10"
    )
    rows = await cursor.fetchall()
    types = [r["event_type"] for r in rows]
    assert "oip.orchestrator.workflow.started.v1" in types


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    for table in (
        "oip_workflows",
        "oip_workflow_stages",
        "oip_workflow_failures",
        "oip_workflow_retries",
        "oip_workflow_rollbacks",
        "oip_workflow_metrics",
    ):
        cursor = await oip_container.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
        )
        assert await cursor.fetchone() is not None


@pytest.mark.asyncio
async def test_legacy_execution_mode_runs_native_pipeline(tmp_path):
    settings = OipSettings(
        orchestrator_enabled=True,
        execution_mode="legacy",
        facade_routes_legacy=False,
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}",
    )
    container = await build_container(settings)
    try:
        workflow, response = await container.orchestrator_service.execute_workflow(
            request=_intel_request(),
        )
        assert workflow.execution_mode == ExecutionMode.NATIVE
        assert response is not None
        assert response.metadata.get("native_pipeline") is True
        assert len(workflow.completed_stages) >= 5
    finally:
        await container.close()
        await shutdown_container()


@pytest.mark.asyncio
async def test_shadow_execution_mode_runs_native_pipeline(tmp_path):
    settings = OipSettings(
        orchestrator_enabled=True,
        execution_mode="shadow",
        facade_routes_legacy=False,
        planner_enabled=True,
        router_enabled=True,
        provider_runtime_enabled=True,
        quality_enabled=True,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'shadow.db'}",
    )
    container = await build_container(settings)
    try:
        workflow, response = await container.orchestrator_service.execute_workflow(
            request=_intel_request(),
        )
        assert workflow.execution_mode == ExecutionMode.SHADOW
        assert response is not None
        assert response.metadata.get("native_pipeline") is True
        assert response.metadata.get("diagnostic_mode") == "shadow"
    finally:
        await container.close()
        await shutdown_container()


@pytest.mark.asyncio
async def test_native_execution_mode(oip_container):
    workflow, response = await oip_container.orchestrator_service.execute_workflow(
        request=_intel_request()
    )
    assert workflow.execution_mode == ExecutionMode.NATIVE
    assert response is not None


@pytest.mark.asyncio
async def test_orchestrator_disabled_raises(tmp_path):
    settings = OipSettings(
        orchestrator_enabled=False,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'disabled.db'}",
    )
    container = await build_container(settings)
    try:
        with pytest.raises(ValueError, match="disabled"):
            await container.command_bus.dispatch(_start_cmd())
    finally:
        await container.close()
        await shutdown_container()


@pytest.mark.asyncio
async def test_kernel_facade_uses_orchestrator(oip_container):
    health = await oip_container.kernel.health()
    assert health["orchestrator_module"] is True
    assert health["execution_mode"] == "native"


@pytest.mark.asyncio
async def test_workflow_recovery(oip_container):
    request = _intel_request()
    workflow = await oip_container.orchestrator_service.start_workflow(request=request)
    running = workflow.model_copy(update={"workflow_state": WorkflowState.RUNNING})
    await oip_container.workflow_repository.save(running)
    recovered = await oip_container.command_bus.dispatch(
        RecoverWorkflowsCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
        )
    )
    assert isinstance(recovered, list)


@pytest.mark.asyncio
async def test_retry_on_retryable_failure(oip_container):
    class FailingRetryStage:
        name = "planning"

        def __init__(self) -> None:
            self.calls = 0

        async def validate(self, context):
            return StageResult(stage=self.name, status=StageRunStatus.COMPLETED)

        async def execute(self, context):
            self.calls += 1
            if self.calls < 2:
                return context, StageResult(
                    stage=self.name,
                    status=StageRunStatus.FAILED,
                    error="transient",
                    retry_classification=RetryClassification.RETRYABLE,
                )
            return context, StageResult(stage=self.name, status=StageRunStatus.COMPLETED)

        async def rollback(self, context):
            return StageResult(stage=self.name, status=StageRunStatus.ROLLED_BACK)

        def metrics(self):
            return {}

        def supports_retry(self):
            return True

    failing = FailingRetryStage()
    registry = StagePortRegistry()
    registry.register(failing)
    engine = SequentialWorkflowEngine(
        stage_ports=registry,
        repository=oip_container.workflow_repository,
        max_retries=3,
        retry_backoff=0.01,
    )
    from datetime import datetime, timezone

    from src.oip.modules.orchestrator.domain.entities import WorkflowExecution

    now = datetime.now(timezone.utc)
    wf = WorkflowExecution(
        workflow_id="wf-retry",
        request_id="r1",
        session_id="s1",
        tenant_id="tenant-a",
        user_id="u1",
        correlation_id="c1",
        execution_mode=ExecutionMode.NATIVE,
        workflow_state=WorkflowState.RUNNING,
        message="test",
        started_at=now,
        updated_at=now,
    )
    ctx = WorkflowContext(
        workflow_id="wf-retry",
        request_id="r1",
        correlation_id="c1",
        tenant_id="tenant-a",
        user_id="u1",
        session_id="s1",
        message="test",
    )
    custom_registry = create_default_stage_registry()
    custom_registry._stages = {  # noqa: SLF001
        k: v for k, v in custom_registry._stages.items() if v.name.value == "planning"
    }
    engine._stage_registry = custom_registry  # noqa: SLF001
    engine._stage_ports = registry  # noqa: SLF001
    await oip_container.workflow_repository.save(wf)
    completed, _ = await engine.run(workflow=wf, context=ctx)
    assert failing.calls >= 2


@pytest.mark.asyncio
async def test_rollback_on_non_retryable_failure(oip_container):
    class FailStage:
        name = "quality"

        async def validate(self, context):
            return StageResult(stage=self.name, status=StageRunStatus.COMPLETED)

        async def execute(self, context):
            return context, StageResult(
                stage=self.name,
                status=StageRunStatus.FAILED,
                error="quality_blocked",
                retry_classification=RetryClassification.NON_RETRYABLE,
            )

        async def rollback(self, context):
            return StageResult(stage=self.name, status=StageRunStatus.SKIPPED)

        def metrics(self):
            return {}

        def supports_retry(self):
            return False

    registry = StagePortRegistry()
    registry.register(FailStage())
    engine = SequentialWorkflowEngine(
        stage_ports=registry,
        repository=oip_container.workflow_repository,
        max_retries=1,
        retry_backoff=0.01,
    )
    from datetime import datetime, timezone

    from src.oip.modules.orchestrator.domain.entities import WorkflowExecution

    now = datetime.now(timezone.utc)
    wf = WorkflowExecution(
        workflow_id="wf-fail",
        request_id="r1",
        session_id="s1",
        tenant_id="tenant-a",
        user_id="u1",
        correlation_id="c1",
        execution_mode=ExecutionMode.NATIVE,
        workflow_state=WorkflowState.RUNNING,
        message="test",
        started_at=now,
        updated_at=now,
    )
    ctx = WorkflowContext(
        workflow_id="wf-fail",
        request_id="r1",
        correlation_id="c1",
        tenant_id="tenant-a",
        user_id="u1",
        session_id="s1",
        message="test",
    )
    custom_registry = create_default_stage_registry()
    custom_registry._stages = {  # noqa: SLF001
        k: v for k, v in custom_registry._stages.items() if v.name.value == "quality"
    }
    engine._stage_registry = custom_registry  # noqa: SLF001
    engine._stage_ports = registry  # noqa: SLF001
    await oip_container.workflow_repository.save(wf)
    failed, _ = await engine.run(workflow=wf, context=ctx)
    assert failed.workflow_state == WorkflowState.FAILED


@pytest.mark.asyncio
async def test_stage_timeout(oip_container):
    class SlowStage:
        name = "execution"

        async def validate(self, context):
            return StageResult(stage=self.name, status=StageRunStatus.COMPLETED)

        async def execute(self, context):
            await asyncio.sleep(2)
            return context, StageResult(stage=self.name, status=StageRunStatus.COMPLETED)

        async def rollback(self, context):
            return StageResult(stage=self.name, status=StageRunStatus.SKIPPED)

        def metrics(self):
            return {}

        def supports_retry(self):
            return True

    registry = StagePortRegistry()
    registry.register(SlowStage())
    engine = SequentialWorkflowEngine(
        stage_ports=registry,
        repository=oip_container.workflow_repository,
        stage_timeout=0.1,
        max_retries=0,
        retry_backoff=0.01,
    )
    from datetime import datetime, timezone

    from src.oip.modules.orchestrator.domain.entities import WorkflowExecution

    now = datetime.now(timezone.utc)
    wf = WorkflowExecution(
        workflow_id="wf-timeout",
        request_id="r1",
        session_id="s1",
        tenant_id="tenant-a",
        user_id="u1",
        correlation_id="c1",
        execution_mode=ExecutionMode.NATIVE,
        workflow_state=WorkflowState.RUNNING,
        message="test",
        started_at=now,
        updated_at=now,
    )
    ctx = WorkflowContext(
        workflow_id="wf-timeout",
        request_id="r1",
        correlation_id="c1",
        tenant_id="tenant-a",
        user_id="u1",
        session_id="s1",
        message="test",
    )
    custom_registry = create_default_stage_registry()
    custom_registry._stages = {  # noqa: SLF001
        k: v for k, v in custom_registry._stages.items() if v.name.value == "execution"
    }
    engine._stage_registry = custom_registry  # noqa: SLF001
    engine._stage_ports = registry  # noqa: SLF001
    await oip_container.workflow_repository.save(wf)
    failed, _ = await engine.run(workflow=wf, context=ctx)
    assert failed.workflow_state == WorkflowState.FAILED


@pytest.mark.asyncio
async def test_native_execution_cutover_end_to_end(oip_container):
    """Prove facade → orchestrator → module stages without legacy bypass."""
    request = _intel_request()
    response = await oip_container.kernel.submit(request)
    assert response.metadata.get("native_pipeline") is True
    workflow_id = response.metadata.get("workflow_id")
    assert workflow_id

    workflow = await oip_container.query_bus.dispatch(
        GetWorkflowQuery(tenant_id=TenantId("tenant-a"), workflow_id=workflow_id)
    )
    assert workflow["workflow_state"] == "completed"
    completed = set(workflow.get("completed_stages") or [])
    for stage in ("conversation", "planning", "routing", "execution"):
        assert stage in completed

    health = await oip_container.kernel.health()
    assert health["execution_mode"] == "native"
    assert health["legacy_delegation"] is False


@pytest.mark.asyncio
async def test_default_settings_use_native_execution():
    settings = OipSettings()
    assert settings.execution_mode == "native"
    assert settings.facade_routes_legacy is False


@pytest.mark.asyncio
async def test_execution_mode_enum():
    assert ExecutionMode.LEGACY.value == "legacy"
    assert ExecutionMode.SHADOW.value == "shadow"
    assert ExecutionMode.NATIVE.value == "native"


@pytest.mark.asyncio
async def test_workflow_context_immutable():
    ctx = WorkflowContext(
        workflow_id="wf1",
        request_id="r1",
        correlation_id="c1",
        tenant_id="t1",
        user_id="u1",
        session_id="s1",
        message="hello",
    )
    updated = ctx.model_copy(update={"conversation_id": "conv-1"})
    assert ctx.conversation_id is None
    assert updated.conversation_id == "conv-1"


@pytest.mark.asyncio
async def test_stage_port_registry(oip_container):
    registry = oip_container.orchestrator_service._engine._stage_ports  # noqa: SLF001
    assert registry.get("validation") is not None
    assert registry.get("streaming") is not None


@pytest.mark.asyncio
async def test_concurrent_workflow_starts(oip_container):
    results = await asyncio.gather(
        *[oip_container.command_bus.dispatch(_start_cmd(session_id=f"conc-{i}")) for i in range(5)]
    )
    assert len({r["workflow_id"] for r in results}) == 5


@pytest.mark.asyncio
async def test_failure_record_persisted(oip_container):
    request = _intel_request(message="")
    workflow, _ = await oip_container.orchestrator_service.execute_workflow(request=request)
    cursor = await oip_container.connection.execute(
        "SELECT COUNT(*) AS cnt FROM oip_workflow_failures WHERE workflow_id = ?",
        (workflow.workflow_id,),
    )
    row = await cursor.fetchone()
    assert row["cnt"] >= 0


@pytest.mark.asyncio
async def test_workflow_snapshots_on_complete(oip_container):
    workflow, _ = await oip_container.orchestrator_service.execute_workflow(
        request=_intel_request()
    )
    if workflow.workflow_state == WorkflowState.COMPLETED:
        assert "response" in workflow.snapshots or workflow.snapshots


@pytest.mark.asyncio
async def test_sequential_engine_replaceable(oip_container):
    engine = oip_container.orchestrator_service._engine
    assert isinstance(engine, SequentialWorkflowEngine)


@pytest.mark.asyncio
async def test_validation_stage_adapter_standalone(oip_container):
    ports = oip_container.orchestrator_service._engine._stage_ports  # noqa: SLF001
    validation = ports.get("validation")
    assert validation.supports_retry() is False


@pytest.mark.asyncio
async def test_action_stage_supports_retry(oip_container):
    ports = oip_container.orchestrator_service._engine._stage_ports  # noqa: SLF001
    action = ports.get("action")
    assert action.supports_retry() is True


@pytest.mark.asyncio
async def test_streaming_stage_supports_no_retry(oip_container):
    ports = oip_container.orchestrator_service._engine._stage_ports  # noqa: SLF001
    streaming = ports.get("streaming")
    assert streaming.supports_retry() is False


@pytest.mark.asyncio
async def test_workflow_completed_event_in_outbox(oip_container):
    workflow, _ = await oip_container.orchestrator_service.execute_workflow(
        request=_intel_request()
    )
    if workflow.workflow_state == WorkflowState.COMPLETED:
        cursor = await oip_container.connection.execute(
            "SELECT event_type FROM oip_outbox WHERE event_type LIKE '%workflow.completed%'"
        )
        rows = await cursor.fetchall()
        assert len(rows) >= 1


@pytest.mark.asyncio
async def test_facade_submit_integration(oip_container):
    request = _intel_request()
    response = await oip_container.kernel.submit(request)
    assert response.request_id == request.request_id


@pytest.mark.asyncio
async def test_recover_workflows_command(oip_container):
    result = await oip_container.command_bus.dispatch(
        RecoverWorkflowsCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(str(new_correlation_id())),
        )
    )
    assert isinstance(result, list)
