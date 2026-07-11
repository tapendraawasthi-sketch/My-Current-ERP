"""OIP Phase 2.2 — Production OEC Runtime module tests."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import pytest

from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.integration.contracts.erp_commands import ErpCommandEnvelope, ErpCommandType
from src.oip.modules.action_runtime.infrastructure.adapters.erp_command_adapter import ErpCommandAdapter
from src.oip.modules.oec_runtime.application.commands import (
    ArchiveConnectorCommand,
    CancelExecutionCommand,
    ExecuteERPCommandCommand,
    ExecuteERPQueryCommand,
    RegisterConnectorCommand,
    RetryExecutionCommand,
    UnregisterConnectorCommand,
)
from src.oip.modules.oec_runtime.application.pipeline.context import ExecutionPipelineContext
from src.oip.modules.oec_runtime.application.pipeline.stages import (
    CompensationStage,
    ValidateStage,
    ResolveConnectorStage,
)
from src.oip.modules.oec_runtime.domain.entities import ERPCommandExecution
from src.oip.modules.oec_runtime.application.queries import (
    ConnectorCapabilitiesQuery,
    ConnectorHealthQuery,
    ConnectorMetricsQuery,
    ExecutionHistoryQuery,
    GetConnectorQuery,
    SearchConnectorsQuery,
)
from src.oip.modules.oec_runtime.domain.capability_registry import create_default_capability_registry
from src.oip.modules.oec_runtime.domain.compensation_registry import create_default_compensation_registry
from src.oip.modules.oec_runtime.domain.connector_registry import create_default_connector_registry
from src.oip.modules.oec_runtime.domain.health_registry import create_default_health_registry
from src.oip.modules.oec_runtime.domain.retry_registry import create_default_retry_registry
from src.oip.modules.oec_runtime.domain.snapshot_registry import create_default_snapshot_registry
from src.oip.modules.oec_runtime.domain.transaction_registry import create_default_transaction_registry
from src.oip.modules.oec_runtime.domain.value_objects import ConnectorType, ExecutionStatus, RetryPolicyName
from src.oip.modules.oec_runtime.infrastructure.adapters.circuit_breaker_adapter import CircuitBreakerAdapter
from src.oip.modules.oec_runtime.infrastructure.adapters.connectors import (
    GraphQLConnectorDriver,
    MockConnectorDriver,
    MySQLConnectorDriver,
    OfflineConnectorDriver,
    PostgreSQLConnectorDriver,
    ReplayConnectorDriver,
    RestConnectorDriver,
    SQLServerConnectorDriver,
    SQLiteConnectorDriver,
)
from src.oip.modules.oec_runtime.infrastructure.adapters.idempotency_adapter import IdempotencyAdapter
from src.oip.modules.oec_runtime.infrastructure.factory import build_connector_registry, build_oec_pipeline
from src.oip.modules.oec_runtime.infrastructure.persistence.oec_sqlite import (
    DEFAULT_CONNECTOR_ID,
    TENANT_A,
    SqliteOecRepositoryAdapter,
)
from src.oip.shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_oec_test.db"
    settings = OipSettings(
        enabled=True,
        oec_enabled=True,
        action_runtime_enabled=True,
        quality_enabled=True,
        provider_runtime_enabled=True,
        require_approval=False,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def _execute_cmd(**kwargs) -> ExecuteERPCommandCommand:
    cmd_id = str(uuid.uuid4())
    return ExecuteERPCommandCommand(
        tenant_id=TenantId(kwargs.get("tenant_id", TENANT_A)),
        correlation_id=CorrelationId(str(new_correlation_id())),
        request_id=RequestId(str(new_request_id())),
        command_id=cmd_id,
        command_type_name=kwargs.get("command_type", ErpCommandType.POST_JOURNAL_ENTRY.value),
        company_id=kwargs.get("company_id", "company-1"),
        idempotency_key=kwargs.get("idempotency_key", f"idem-{uuid.uuid4().hex[:8]}"),
        payload=kwargs.get("payload", {"amount": 1000}),
    )


# --- Registries ---


def test_connector_registry_types():
    registry = create_default_connector_registry()
    types = registry.list_types()
    assert len(types) >= 10
    assert registry.resolve_driver_name(ConnectorType.MOCK) == "mock"
    assert registry.resolve_driver_name(ConnectorType.SUTRA) == "sutra"


def test_capability_registry_accounting():
    registry = create_default_capability_registry()
    assert registry.supports_command("Accounting", ErpCommandType.POST_JOURNAL_ENTRY.value)


def test_retry_registry_exponential_delay():
    registry = create_default_retry_registry()
    policy = registry.get(RetryPolicyName.EXPONENTIAL)
    assert policy is not None
    assert registry.compute_delay(policy, 2) > policy.base_delay_seconds


def test_health_registry_evaluate():
    registry = create_default_health_registry()
    from src.oip.modules.oec_runtime.domain.value_objects import HealthState

    assert registry.evaluate(latency_ms=100, availability=0.99) == HealthState.HEALTHY
    assert registry.evaluate(latency_ms=3000, availability=0.5) == HealthState.UNHEALTHY


def test_transaction_registry_timeout():
    registry = create_default_transaction_registry()
    policy = registry.get("default")
    assert policy is not None
    now = datetime.now(timezone.utc)
    expiry = registry.timeout_at(policy, now)
    assert (expiry - now).total_seconds() == 30.0


def test_compensation_registry_reversal():
    registry = create_default_compensation_registry()
    payload = registry.build_reversal_payload(original_payload={"a": 1}, reason="fail")
    assert payload["reversal"] is True


def test_snapshot_registry_validate():
    registry = create_default_snapshot_registry()
    ok, _ = registry.validate(snapshot={"company_id": "c1"}, company_id="c1")
    assert ok is True


# --- Connector drivers ---


@pytest.mark.asyncio
async def test_mock_connector_execute():
    driver = MockConnectorDriver()
    result = await driver.execute_command(
        connector_id="c1", command_type="test", payload={"command_id": "x"}, config={}
    )
    assert result["status"] == "accepted"
    assert "erp_reference" in result


@pytest.mark.asyncio
async def test_rest_connector_requires_base_url():
    driver = RestConnectorDriver()
    with pytest.raises(ValueError, match="base_url"):
        await driver.execute_command(
            connector_id="c1", command_type="test", payload={}, config={}
        )


@pytest.mark.asyncio
async def test_graphql_connector_requires_endpoint():
    driver = GraphQLConnectorDriver()
    with pytest.raises(ValueError, match="endpoint"):
        await driver.execute_command(
            connector_id="c1", command_type="test", payload={}, config={}
        )


@pytest.mark.asyncio
async def test_postgresql_connector_health_without_connection():
    driver = PostgreSQLConnectorDriver()
    health = await driver.health_check(connector_id="c1", config={})
    assert health["state"] == "degraded"


@pytest.mark.asyncio
async def test_mysql_connector_health_without_connection():
    driver = MySQLConnectorDriver()
    health = await driver.health_check(connector_id="c1", config={})
    assert health["state"] == "degraded"


@pytest.mark.asyncio
async def test_sqlserver_connector_health_without_connection():
    driver = SQLServerConnectorDriver()
    health = await driver.health_check(connector_id="c1", config={"connection_string": "invalid://"})
    assert health["state"] == "unhealthy"


@pytest.mark.asyncio
async def test_offline_connector_queues(oip_container):
    repo = oip_container.oec_repository
    registry = build_connector_registry(conn=oip_container.connection, repository=repo)
    driver = registry.get_driver(ConnectorType.OFFLINE)
    assert driver is not None
    result = await driver.execute_command(
        connector_id="offline-1",
        command_type="test",
        payload={"tenant_id": TENANT_A},
        config={},
    )
    assert result["status"] == "queued"


# --- Pipeline ---


@pytest.mark.asyncio
async def test_validate_stage_rejects_missing_idempotency():
    stage = ValidateStage()
    ctx = ExecutionPipelineContext(
        tenant_id=TENANT_A,
        company_id="c1",
        branch_id=None,
        request_id="r1",
        correlation_id="c1",
        command_id="cmd1",
        command_type="test",
        idempotency_key="",
    )
    result = await stage.run(ctx)
    assert result.blocked is True


@pytest.mark.asyncio
async def test_resolve_connector_stage(oip_container):
    stage = ResolveConnectorStage(oip_container.oec_repository)
    ctx = ExecutionPipelineContext(
        tenant_id=TENANT_A,
        company_id="c1",
        branch_id=None,
        request_id="r1",
        correlation_id="c1",
        command_id="cmd1",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        idempotency_key="key1",
    )
    result = await stage.run(ctx)
    assert result.connector is not None
    assert result.connector_id == DEFAULT_CONNECTOR_ID


@pytest.mark.asyncio
async def test_oec_pipeline_stage_names(oip_container):
    pipeline = oip_container.oec_runtime_service._pipeline  # noqa: SLF001
    assert len(pipeline.stage_names) == 12
    assert pipeline.stage_names[0] == "validate"
    assert pipeline.stage_names[-1] == "publish"


# --- Service / commands ---


@pytest.mark.asyncio
async def test_default_connector_seeded(oip_container):
    connector = await oip_container.oec_repository.get_connector(
        tenant_id=TENANT_A, connector_id=DEFAULT_CONNECTOR_ID
    )
    assert connector is not None
    assert connector.is_default is True


@pytest.mark.asyncio
async def test_execute_erp_command(oip_container):
    result = await oip_container.command_bus.dispatch(_execute_cmd())
    assert result["status"] == "accepted"
    assert "erp_reference" in result


@pytest.mark.asyncio
async def test_execute_command_idempotency(oip_container):
    key = f"idem-fixed-{uuid.uuid4().hex[:6]}"
    cmd = _execute_cmd(idempotency_key=key)
    first = await oip_container.command_bus.dispatch(cmd)
    second = await oip_container.command_bus.dispatch(
        ExecuteERPCommandCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            request_id=RequestId(str(new_request_id())),
            command_id=str(uuid.uuid4()),
            command_type_name=ErpCommandType.POST_JOURNAL_ENTRY.value,
            company_id="company-1",
            idempotency_key=key,
            payload={"amount": 1000},
        )
    )
    assert first["erp_reference"] == second["erp_reference"]


@pytest.mark.asyncio
async def test_register_connector(oip_container):
    result = await oip_container.command_bus.dispatch(
        RegisterConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            name="SQLite ERP",
            connector_type="SQLite",
            capabilities=("Accounting",),
        )
    )
    assert result["connector_type"] == "SQLite"


@pytest.mark.asyncio
async def test_get_connector(oip_container):
    result = await oip_container.query_bus.dispatch(
        GetConnectorQuery(tenant_id=TenantId(TENANT_A), connector_id=DEFAULT_CONNECTOR_ID)
    )
    assert result["connector_id"] == DEFAULT_CONNECTOR_ID


@pytest.mark.asyncio
async def test_search_connectors(oip_container):
    result = await oip_container.query_bus.dispatch(
        SearchConnectorsQuery(tenant_id=TenantId(TENANT_A))
    )
    assert len(result["connectors"]) >= 1


@pytest.mark.asyncio
async def test_connector_health(oip_container):
    result = await oip_container.query_bus.dispatch(
        ConnectorHealthQuery(tenant_id=TenantId(TENANT_A), connector_id=DEFAULT_CONNECTOR_ID)
    )
    assert result["state"] in ("healthy", "degraded", "unhealthy", "unknown")


@pytest.mark.asyncio
async def test_connector_metrics(oip_container):
    await oip_container.command_bus.dispatch(_execute_cmd())
    metrics = await oip_container.query_bus.dispatch(
        ConnectorMetricsQuery(tenant_id=TenantId(TENANT_A), connector_id=DEFAULT_CONNECTOR_ID)
    )
    assert metrics["command_throughput"] >= 1


@pytest.mark.asyncio
async def test_execution_history(oip_container):
    await oip_container.command_bus.dispatch(_execute_cmd())
    history = await oip_container.query_bus.dispatch(
        ExecutionHistoryQuery(tenant_id=TenantId(TENANT_A), connector_id=DEFAULT_CONNECTOR_ID)
    )
    assert len(history["executions"]) >= 1


@pytest.mark.asyncio
async def test_archive_connector(oip_container):
    registered = await oip_container.command_bus.dispatch(
        RegisterConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            name="Archive Me",
            connector_type="Mock",
        )
    )
    archived = await oip_container.command_bus.dispatch(
        ArchiveConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            connector_id=registered["connector_id"],
        )
    )
    assert archived["status"] == "archived"


@pytest.mark.asyncio
async def test_retry_execution(oip_container):
    cmd = _execute_cmd()
    await oip_container.command_bus.dispatch(cmd)
    history = await oip_container.query_bus.dispatch(
        ExecutionHistoryQuery(tenant_id=TenantId(TENANT_A), limit=1)
    )
    execution_id = history["executions"][0]["execution_id"]
    retried = await oip_container.command_bus.dispatch(
        RetryExecutionCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            execution_id=execution_id,
        )
    )
    assert retried["retry_count"] >= 1


@pytest.mark.asyncio
async def test_erp_command_adapter_integration(oip_container):
    adapter = ErpCommandAdapter(oip_container.oec_runtime_service)
    envelope = ErpCommandEnvelope(
        command_id=str(uuid.uuid4()),
        command_type=ErpCommandType.POST_JOURNAL_ENTRY,
        tenant_id=TENANT_A,
        company_id="company-1",
        idempotency_key=f"adapter-{uuid.uuid4().hex[:8]}",
        payload={"lines": []},
    )
    response = await adapter.dispatch(envelope)
    assert response["erp_reference"]


@pytest.mark.asyncio
async def test_oec_disabled_raises(tmp_path):
    db_path = tmp_path / "oec_off.db"
    settings = OipSettings(enabled=True, oec_enabled=False, database_url=f"sqlite+aiosqlite:///{db_path}")
    container = await build_container(settings)
    with pytest.raises(ValueError, match="disabled"):
        await container.oec_runtime_service.dispatch_envelope(
            ErpCommandEnvelope(
                command_id="x",
                command_type=ErpCommandType.POST_JOURNAL_ENTRY,
                tenant_id=TENANT_A,
                company_id="c1",
                idempotency_key="k1",
            )
        )
    await container.close()
    await shutdown_container()


@pytest.mark.asyncio
async def test_circuit_breaker_blocks_after_failures(oip_container):
    breaker = CircuitBreakerAdapter(oip_container.oec_repository, failure_threshold=2)
    repo = oip_container.oec_repository
    cid = DEFAULT_CONNECTOR_ID
    assert await breaker.allow_request(tenant_id=TENANT_A, connector_id=cid)
    await breaker.record_failure(tenant_id=TENANT_A, connector_id=cid)
    await breaker.record_failure(tenant_id=TENANT_A, connector_id=cid)
    assert await breaker.allow_request(tenant_id=TENANT_A, connector_id=cid) is False


@pytest.mark.asyncio
async def test_idempotency_adapter(oip_container):
    adapter = IdempotencyAdapter(oip_container.oec_repository)
    assert await adapter.check(tenant_id=TENANT_A, idempotency_key="nonexistent") is None


@pytest.mark.asyncio
async def test_get_context_snapshot_via_oec(oip_container):
    snapshot = await oip_container.oec_runtime_service.get_context_snapshot(
        tenant_id=TENANT_A, company_id="company-1", branch_id=None, user_id="user-1"
    )
    assert snapshot.snapshot_id


@pytest.mark.asyncio
async def test_is_period_open_via_oec(oip_container):
    status = await oip_container.oec_runtime_service.is_period_open(
        tenant_id=TENANT_A, company_id="company-1", branch_id=None, fiscal_period_id=None
    )
    assert status.is_open is True


@pytest.mark.asyncio
async def test_audit_after_command(oip_container):
    cmd = _execute_cmd()
    await oip_container.command_bus.dispatch(cmd)
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId(TENANT_A), request_id=cmd.request_id)
    )
    assert len(chain) >= 1


@pytest.mark.asyncio
async def test_lineage_after_command(oip_container):
    cmd = _execute_cmd()
    await oip_container.command_bus.dispatch(cmd)
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId(TENANT_A), request_id=cmd.request_id)
    )
    node_types = [n["node_type"] for n in trace]
    assert "ERPConfirmation" in node_types


@pytest.mark.asyncio
async def test_concurrent_executions(oip_container):
    cmds = [_execute_cmd() for _ in range(5)]

    async def run(cmd):
        return await oip_container.command_bus.dispatch(cmd)

    results = await asyncio.gather(*[run(c) for c in cmds])
    assert all("erp_reference" in r for r in results)


@pytest.mark.asyncio
async def test_unsupported_connector_type_on_register(oip_container):
    with pytest.raises(ValueError):
        await oip_container.oec_runtime_service.register_connector(
            tenant_id=TENANT_A,
            correlation_id=str(new_correlation_id()),
            name="Bad",
            connector_type="NotARealType",
        )


@pytest.mark.asyncio
async def test_connector_registry_dynamic_lookup(oip_container):
    registry = build_connector_registry(
        conn=oip_container.connection, repository=oip_container.oec_repository
    )
    for ctype in ("mock", "sqlite", "postgresql", "mysql", "sqlserver", "rest", "graphql", "sutra", "offline", "replay"):
        assert registry.get_driver(ctype) is not None or registry.resolve_driver_name(ctype) is not None


# --- Migration & persistence ---


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    conn = oip_container.connection
    tables = (
        "oip_connectors",
        "oip_connector_capabilities",
        "oip_connector_health",
        "oip_connector_transactions",
        "oip_erp_commands",
        "oip_erp_queries",
        "oip_connector_failures",
        "oip_connector_retries",
        "oip_connector_metrics",
        "oip_connector_dead_letter",
        "oip_connector_circuit",
        "oip_connector_compensations",
    )
    for table in tables:
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        assert await cursor.fetchone() is not None


@pytest.mark.asyncio
async def test_transaction_persisted_on_success(oip_container):
    await oip_container.command_bus.dispatch(_execute_cmd())
    cursor = await oip_container.connection.execute(
        "SELECT status FROM oip_connector_transactions WHERE tenant_id = ?",
        (TENANT_A,),
    )
    rows = await cursor.fetchall()
    assert any(row["status"] == "committed" for row in rows)


# --- Additional commands & queries ---


@pytest.mark.asyncio
async def test_connector_capabilities_query(oip_container):
    result = await oip_container.query_bus.dispatch(
        ConnectorCapabilitiesQuery(tenant_id=TenantId(TENANT_A), connector_id=DEFAULT_CONNECTOR_ID)
    )
    assert isinstance(result["capabilities"], list)


@pytest.mark.asyncio
async def test_execute_erp_query(oip_container):
    result = await oip_container.command_bus.dispatch(
        ExecuteERPQueryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            query_type="context_snapshot",
            company_id="company-1",
            payload={"user_id": "user-1"},
        )
    )
    assert "snapshot_id" in result


@pytest.mark.asyncio
async def test_cancel_execution(oip_container):
    await oip_container.command_bus.dispatch(_execute_cmd())
    history = await oip_container.query_bus.dispatch(
        ExecutionHistoryQuery(tenant_id=TenantId(TENANT_A), limit=1)
    )
    execution_id = history["executions"][0]["execution_id"]
    cancelled = await oip_container.command_bus.dispatch(
        CancelExecutionCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            execution_id=execution_id,
        )
    )
    assert cancelled["status"] == "cancelled"


@pytest.mark.asyncio
async def test_unregister_connector(oip_container):
    registered = await oip_container.command_bus.dispatch(
        RegisterConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            name="Unregister Me",
            connector_type="Mock",
        )
    )
    unregistered = await oip_container.command_bus.dispatch(
        UnregisterConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            connector_id=registered["connector_id"],
        )
    )
    assert unregistered["status"] == "unregistered"


@pytest.mark.asyncio
async def test_search_connectors_by_type(oip_container):
    result = await oip_container.query_bus.dispatch(
        SearchConnectorsQuery(tenant_id=TenantId(TENANT_A), connector_type="Mock")
    )
    assert all(c["connector_type"] == "Mock" for c in result["connectors"])


@pytest.mark.asyncio
async def test_duplicate_response_status(oip_container):
    key = f"dup-status-{uuid.uuid4().hex[:6]}"
    first = await oip_container.command_bus.dispatch(_execute_cmd(idempotency_key=key))
    second = await oip_container.command_bus.dispatch(_execute_cmd(idempotency_key=key))
    assert first["status"] == "accepted"
    assert second["status"] == "duplicate"


# --- Connector drivers (extended) ---


@pytest.mark.asyncio
async def test_sqlite_connector_driver(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    result = await driver.execute_command(
        connector_id="sqlite-1",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload={
            "command_id": "c1",
            "tenant_id": TENANT_A,
            "company_id": "company-1",
            "amount": 500,
        },
        config={},
    )
    assert result["status"] == "accepted"
    assert "observability" in result
    assert result["observability"]["connector"] == "sqlite"


@pytest.mark.asyncio
async def test_replay_connector_returns_prior_response(oip_container):
    key = f"replay-{uuid.uuid4().hex[:8]}"
    first = await oip_container.command_bus.dispatch(_execute_cmd(idempotency_key=key))
    driver = ReplayConnectorDriver(oip_container.oec_repository)
    replayed = await driver.execute_command(
        connector_id=DEFAULT_CONNECTOR_ID,
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload={"tenant_id": TENANT_A, "idempotency_key": key},
        config={},
    )
    assert replayed.get("erp_reference") == first["erp_reference"]


@pytest.mark.asyncio
async def test_offline_connector_dead_letter(oip_container):
    driver = OfflineConnectorDriver(oip_container.oec_repository)
    await driver.execute_command(
        connector_id="offline-1",
        command_type="test",
        payload={"tenant_id": TENANT_A},
        config={},
    )
    cursor = await oip_container.connection.execute(
        "SELECT COUNT(*) AS cnt FROM oip_connector_dead_letter WHERE tenant_id = ?",
        (TENANT_A,),
    )
    row = await cursor.fetchone()
    assert row["cnt"] >= 1


# --- Reliability ---


@pytest.mark.asyncio
async def test_circuit_breaker_resets_on_success(oip_container):
    breaker = CircuitBreakerAdapter(oip_container.oec_repository, failure_threshold=3)
    cid = DEFAULT_CONNECTOR_ID
    await breaker.record_failure(tenant_id=TENANT_A, connector_id=cid)
    await breaker.record_success(tenant_id=TENANT_A, connector_id=cid)
    assert await breaker.allow_request(tenant_id=TENANT_A, connector_id=cid) is True


@pytest.mark.asyncio
async def test_execute_command_failure_raises(oip_container):
    with pytest.raises(RuntimeError):
        await oip_container.oec_runtime_service.execute_command(
            tenant_id=TENANT_A,
            request_id=str(new_request_id()),
            correlation_id=str(new_correlation_id()),
            command_id=str(uuid.uuid4()),
            command_type="Unsupported.Command.Type",
            company_id="company-1",
            idempotency_key=f"fail-{uuid.uuid4().hex[:8]}",
            payload={},
        )


@pytest.mark.asyncio
async def test_compensation_stage_persists_record(oip_container):
    stage = CompensationStage(create_default_compensation_registry(), oip_container.oec_repository)
    now = datetime.now(timezone.utc)
    execution = ERPCommandExecution(
        execution_id=str(uuid.uuid4()),
        connector_id=DEFAULT_CONNECTOR_ID,
        tenant_id=TENANT_A,
        company_id="company-1",
        branch_id=None,
        command_id=str(uuid.uuid4()),
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        idempotency_key=f"comp-{uuid.uuid4().hex[:8]}",
        status=ExecutionStatus.RUNNING,
        payload={"amount": 100},
        request_id=str(new_request_id()),
        correlation_id=str(new_correlation_id()),
        created_at=now,
    )
    ctx = ExecutionPipelineContext(
        tenant_id=TENANT_A,
        company_id="company-1",
        branch_id=None,
        request_id=execution.request_id,
        correlation_id=execution.correlation_id,
        command_id=execution.command_id,
        command_type=execution.command_type,
        idempotency_key=execution.idempotency_key,
        payload=execution.payload,
        blocked=True,
        error="erp_down",
        execution=execution,
    )
    result = await stage.run(ctx)
    assert result.compensation is not None
    cursor = await oip_container.connection.execute(
        "SELECT COUNT(*) AS cnt FROM oip_connector_compensations WHERE execution_id = ?",
        (execution.execution_id,),
    )
    row = await cursor.fetchone()
    assert row["cnt"] == 1


def test_capability_registry_all_domains():
    registry = create_default_capability_registry()
    domains = registry.all_domains()
    for name in ("Accounting", "Inventory", "Payroll", "CRM", "HR", "Manufacturing", "Government"):
        assert name in domains


@pytest.mark.asyncio
async def test_register_all_connector_types(oip_container):
    for ctype in ("SQLite", "PostgreSQL", "MySQL", "SQL Server", "REST", "GraphQL", "Offline", "Replay", "Mock"):
        result = await oip_container.command_bus.dispatch(
            RegisterConnectorCommand(
                tenant_id=TenantId(TENANT_A),
                correlation_id=CorrelationId(str(new_correlation_id())),
                name=f"Test {ctype}",
                connector_type=ctype,
            )
        )
        assert result["connector_type"] == ctype


@pytest.mark.asyncio
async def test_metrics_track_query_throughput(oip_container):
    await oip_container.command_bus.dispatch(
        ExecuteERPQueryCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            query_type="period_status",
            company_id="company-1",
        )
    )
    metrics = await oip_container.query_bus.dispatch(
        ConnectorMetricsQuery(tenant_id=TenantId(TENANT_A), connector_id=DEFAULT_CONNECTOR_ID)
    )
    assert metrics["query_throughput"] >= 1
