"""OIP Phase 1.6 — Action Runtime module tests."""

from __future__ import annotations

import pytest

from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.action_runtime.application.commands import (
    ApproveActionCommand,
    CancelActionCommand,
    ProposeActionCommand,
    RejectActionCommand,
)
from src.oip.modules.action_runtime.application.queries import ActionMetricsQuery, GetActionQuery, SearchActionsQuery
from src.oip.modules.action_runtime.domain.action_registry import create_default_action_registry
from src.oip.modules.quality_gate.application.commands import StartEvaluationCommand as StartQualityEvaluationCommand
from src.oip.shared.ids import (
    ActionId,
    CorrelationId,
    EvaluationId,
    ExecutionId,
    RequestId,
    TenantId,
    new_correlation_id,
)
from tests.oip.test_quality_gate import _create_execution


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_action_runtime_test.db"
    settings = OipSettings(
        enabled=True,
        planner_enabled=True,
        shadow_planner=True,
        router_enabled=True,
        shadow_router=True,
        provider_runtime_enabled=True,
        shadow_provider_runtime=True,
        quality_enabled=True,
        shadow_quality=True,
        action_runtime_enabled=True,
        shadow_action_runtime=True,
        require_approval=False,
        compensation_enabled=True,
        minimum_gate="L2",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


async def _create_passing_evaluation(container):
    execution, request_id, correlation_id = await _create_execution(container)
    evaluation = await container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    return evaluation, execution, request_id, correlation_id


@pytest.mark.asyncio
async def test_action_registry_has_types():
    registry = create_default_action_registry()
    types = registry.list_types()
    assert "journal_entry" in types
    assert "invoice" in types
    assert "payment" in types
    assert len(types) >= 13


@pytest.mark.asyncio
async def test_action_pipeline_stage_names(oip_container):
    pipeline = oip_container.action_runtime_service._pipeline
    names = pipeline.stage_names
    assert "quality_decision_gate" in names
    assert "proposal" in names
    assert "execute" in names
    assert "confirmation" in names
    assert "idempotency" in names


@pytest.mark.asyncio
async def test_propose_and_execute_journal_entry(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            payload={"amount": 100, "account_id": "1001"},
            idempotency_key="idem-receipt-1",
        )
    )
    assert action["action_id"]
    assert action["status"] == "executed"
    assert action["success"] is True
    assert action["erp_reference"]


@pytest.mark.asyncio
async def test_pending_approval_flow(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="journal_entry",
            payload={"amount": 5000, "account_id": "2001"},
            idempotency_key="idem-journal-pending",
            metadata={"runtime_context": {"require_approval": True}},
        )
    )
    assert action["status"] == "pending_approval"
    assert action["approval_pending"] is True

    approved = await oip_container.command_bus.dispatch(
        ApproveActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            action_id=ActionId(action["action_id"]),
            approver_id="manager",
        )
    )
    assert approved["status"] in ("executed", "approved")


@pytest.mark.asyncio
async def test_reject_action(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="journal_entry",
            payload={"amount": 100},
            idempotency_key="idem-reject-1",
            metadata={"runtime_context": {"require_approval": True}},
        )
    )
    rejected = await oip_container.command_bus.dispatch(
        RejectActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            action_id=ActionId(action["action_id"]),
            reason="policy violation",
        )
    )
    assert rejected["status"] == "rejected"


@pytest.mark.asyncio
async def test_quality_blocked_never_executes(oip_container):
    execution, request_id, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"journal_unbalanced": True, "company_missing": True}},
        )
    )
    assert evaluation["decision"] == "block"
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            payload={"amount": 50},
            idempotency_key="idem-blocked-1",
        )
    )
    assert action["status"] in ("blocked", "failed")
    assert action["success"] is not True


@pytest.mark.asyncio
async def test_fail_decision_never_executes(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"vat_violation": "Invalid VAT"}},
        )
    )
    assert evaluation["decision"] == "fail"
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-fail-1",
        )
    )
    assert action["status"] in ("blocked", "failed")


@pytest.mark.asyncio
async def test_idempotency_no_double_post(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    idem = "idem-double-post-unique"
    first = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key=idem,
        )
    )
    second = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(new_correlation_id()),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key=idem,
        )
    )
    assert first["status"] == "executed"
    assert second["status"] == "executed"
    assert second["erp_reference"] == first["erp_reference"]


@pytest.mark.asyncio
async def test_snapshot_expiry_blocks(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-snapshot-expired",
            metadata={"runtime_context": {"snapshot_expired": True}},
        )
    )
    assert action["status"] == "failed"
    assert action["failure_kind"] == "snapshot_stale"


@pytest.mark.asyncio
async def test_fiscal_lock_blocks(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-fiscal-lock",
            metadata={"runtime_context": {"fiscal_period_closed": True}},
        )
    )
    assert action["status"] == "failed"
    assert action["failure_kind"] == "fiscal_locked"


@pytest.mark.asyncio
async def test_inventory_lock_blocks(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-inventory-lock",
            metadata={"runtime_context": {"inventory_locked": True}},
        )
    )
    assert action["status"] == "failed"
    assert action["failure_kind"] == "inventory_locked"


@pytest.mark.asyncio
async def test_permission_denied(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-permission-denied",
            metadata={"runtime_context": {"permission_denied": "User lacks write scope"}},
        )
    )
    assert action["status"] == "failed"
    assert action["failure_kind"] == "permission_denied"


@pytest.mark.asyncio
async def test_capability_invalid(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-capability-invalid",
            metadata={"runtime_context": {"capability_invalid": True}},
        )
    )
    assert action["status"] == "failed"
    assert action["failure_kind"] == "capability_invalid"


@pytest.mark.asyncio
async def test_cancel_action(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="journal_entry",
            idempotency_key="idem-cancel-1",
            metadata={"runtime_context": {"require_approval": True}},
        )
    )
    cancelled = await oip_container.command_bus.dispatch(
        CancelActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            action_id=ActionId(action["action_id"]),
            reason="user cancelled",
        )
    )
    assert cancelled["status"] == "cancelled"


@pytest.mark.asyncio
async def test_compensation_on_erp_failure(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-compensate-1",
            metadata={"runtime_context": {"force_erp_failure": True, "compensate_on_failure": True}},
        )
    )
    assert action["status"] == "failed"
    stored = await oip_container.action_repository.get_by_id(
        tenant_id="tenant-a", action_id=action["action_id"]
    )
    assert stored is not None
    assert stored.compensation is not None


@pytest.mark.asyncio
async def test_audit_chain(oip_container):
    evaluation, _, request_id, correlation_id = await _create_passing_evaluation(oip_container)
    await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-audit-1",
        )
    )
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    event_names = [entry["event_name"] for entry in chain]
    assert any("action_runtime" in name for name in event_names)


@pytest.mark.asyncio
async def test_lineage_trace(oip_container):
    evaluation, _, request_id, correlation_id = await _create_passing_evaluation(oip_container)
    await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-lineage-1",
        )
    )
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    node_types = [node["node_type"] for node in trace]
    assert "ActionProposal" in node_types
    assert "ActionExecution" in node_types
    assert "ERPConfirmation" in node_types


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    conn = oip_container.connection
    tables = (
        "oip_action_executions",
        "oip_action_proposals",
        "oip_action_confirmations",
        "oip_action_compensations",
        "oip_action_snapshots",
        "oip_action_approvals",
        "oip_action_metrics",
    )
    for table in tables:
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        assert await cursor.fetchone() is not None


@pytest.mark.asyncio
async def test_action_metrics(oip_container):
    evaluation, _, _, correlation_id = await _create_passing_evaluation(oip_container)
    await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-metrics-1",
        )
    )
    metrics = await oip_container.query_bus.dispatch(
        ActionMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["actions_proposed"] >= 1
    assert metrics["actions_executed"] >= 1


@pytest.mark.asyncio
async def test_search_and_get_action(oip_container):
    evaluation, _, request_id, correlation_id = await _create_passing_evaluation(oip_container)
    created = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-search-1",
        )
    )
    fetched = await oip_container.query_bus.dispatch(
        GetActionQuery(tenant_id=TenantId("tenant-a"), action_id=ActionId(created["action_id"]))
    )
    assert fetched["action_id"] == created["action_id"]
    results = await oip_container.query_bus.dispatch(
        SearchActionsQuery(
            tenant_id=TenantId("tenant-a"),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
        )
    )
    assert len(results) >= 1


@pytest.mark.asyncio
async def test_shadow_facade_health(oip_container):
    health = await oip_container.kernel.health()
    assert health["action_runtime_module"] is True
    assert health["shadow_action_runtime"] is True


@pytest.mark.asyncio
async def test_pass_with_warning_executes(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"approval_required": True, "knowledge_stale": True}},
        )
    )
    assert evaluation["decision"] == "pass_with_warning"
    action = await oip_container.command_bus.dispatch(
        ProposeActionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            action_type="receipt",
            idempotency_key="idem-warning-pass",
        )
    )
    assert action["status"] == "executed"
