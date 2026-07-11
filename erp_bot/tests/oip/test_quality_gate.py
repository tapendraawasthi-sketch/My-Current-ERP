"""OIP Phase 1.5 — Quality Gate module tests."""

from __future__ import annotations

import hashlib

import pytest

from src.oip.application.queries import GetAuditChainQuery, GetLineageTraceQuery
from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.modules.planner.application.commands import CreateExecutionPlanCommand
from src.oip.modules.provider_runtime.application.commands import StartExecutionCommand
from src.oip.modules.quality_gate.application.commands import (
    ApproveEvaluationCommand,
    ArchiveEvaluationCommand,
    RejectEvaluationCommand,
    StartEvaluationCommand as StartQualityEvaluationCommand,
)
from src.oip.modules.quality_gate.application.pipeline.context import QualityPipelineContext
from src.oip.modules.quality_gate.application.pipeline.stages import (
    DecisionAssemblyStage,
    InputValidationStage,
    L0ValidationStage,
    L2ValidationStage,
)
from src.oip.modules.quality_gate.application.queries import (
    GetDecisionQuery,
    GetEvaluationQuery,
    GetFindingsQuery,
    QualityMetricsQuery,
    SearchEvaluationsQuery,
)
from src.oip.modules.quality_gate.domain.value_objects import QualityLevel
from src.oip.modules.quality_gate.infrastructure.adapters.default_accounting_validation import (
    DefaultAccountingValidationAdapter,
)
from src.oip.modules.quality_gate.infrastructure.adapters.default_erp_validation import DefaultERPValidationAdapter
from src.oip.modules.quality_gate.infrastructure.adapters.default_evidence_validation import (
    DefaultEvidenceValidationAdapter,
)
from src.oip.modules.quality_gate.infrastructure.adapters.default_knowledge_authority import (
    DefaultKnowledgeAuthorityAdapter,
)
from src.oip.modules.quality_gate.infrastructure.adapters.default_risk_scoring import DefaultRiskScoringAdapter
from src.oip.modules.quality_gate.infrastructure.factory import build_quality_gate_pipeline
from src.oip.modules.quality_gate.infrastructure.persistence.quality_gate_sqlite import (
    SqliteQualityRepositoryAdapter,
)
from src.oip.modules.router.application.commands import CreateRouteDecisionCommand
from src.oip.shared.ids import (
    CorrelationId,
    EvaluationId,
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
    db_path = tmp_path / "oip_quality_gate_test.db"
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
        l3_enabled=True,
        minimum_gate="L2",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


async def _create_execution(container, message: str = "Show ledger balance"):
    correlation_id = str(new_correlation_id())
    request_id = str(new_request_id())
    plan = await container.command_bus.dispatch(
        CreateExecutionPlanCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            request_id=RequestId(request_id),
            session_id="sess-quality",
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
    execution = await container.command_bus.dispatch(
        StartExecutionCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            route_id=RouteId(route["route_id"]),
        )
    )
    return execution, request_id, correlation_id


@pytest.mark.asyncio
async def test_quality_gate_pipeline_stage_names(oip_container):
    pipeline = oip_container.quality_gate_service._pipeline
    names = pipeline.stage_names
    assert "input_validation" in names
    assert "l0_validation" in names
    assert "l1_validation" in names
    assert "l2_validation" in names
    assert "l3_validation" in names
    assert "risk_scoring" in names
    assert "decision_assembly" in names
    assert "audit" in names
    assert "lineage" in names
    assert "outbox" in names


@pytest.mark.asyncio
async def test_start_evaluation_pass(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    assert evaluation["evaluation_id"]
    assert evaluation["execution_id"] == execution["execution_id"]
    assert evaluation["decision"] == "pass"
    assert evaluation["blocking"] is False


@pytest.mark.asyncio
async def test_start_evaluation_pass_with_warning(oip_container):
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
    assert evaluation["warning_count"] >= 2


@pytest.mark.asyncio
async def test_start_evaluation_review_required(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"force_risk_escalation": True, "ai_inconsistent": True}},
        )
    )
    assert evaluation["decision"] == "review_required"
    assert evaluation["requires_review"] is True
    assert evaluation["risk_score"] is not None
    assert evaluation["risk_score"] >= 0.75


@pytest.mark.asyncio
async def test_start_evaluation_fail(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"vat_violation": "Invalid VAT rate", "inventory_unavailable": True}},
        )
    )
    assert evaluation["decision"] == "fail"
    assert evaluation["violation_count"] >= 1


@pytest.mark.asyncio
async def test_start_evaluation_block(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"journal_unbalanced": True, "company_missing": True}},
        )
    )
    assert evaluation["decision"] == "block"
    assert evaluation["blocking"] is True


@pytest.mark.asyncio
async def test_accounting_validation_journal_balance(oip_container):
    execution, _, _ = await _create_execution(oip_container)
    exec_agg = await oip_container.execution_repository.get_by_id(
        tenant_id="tenant-a", execution_id=execution["execution_id"]
    )
    adapter = DefaultAccountingValidationAdapter()
    findings = await adapter.validate_accounting(
        tenant_id="tenant-a",
        company_id=None,
        execution_result=exec_agg.result,
        context={"evaluation_id": "test", "journal_unbalanced": True},
    )
    assert len(findings) == 1
    assert findings[0].code == "JOURNAL_UNBALANCED"


@pytest.mark.asyncio
async def test_accounting_validation_account_existence(oip_container):
    execution, _, _ = await _create_execution(oip_container)
    exec_agg = await oip_container.execution_repository.get_by_id(
        tenant_id="tenant-a", execution_id=execution["execution_id"]
    )
    adapter = DefaultAccountingValidationAdapter()
    findings = await adapter.validate_accounting(
        tenant_id="tenant-a",
        company_id=None,
        execution_result=exec_agg.result,
        context={"evaluation_id": "test", "account_missing": "1001"},
    )
    assert findings[0].code == "ACCOUNT_NOT_FOUND"


@pytest.mark.asyncio
async def test_evidence_freshness_and_snapshot_expiry(oip_container):
    execution, _, _ = await _create_execution(oip_container)
    exec_agg = await oip_container.execution_repository.get_by_id(
        tenant_id="tenant-a", execution_id=execution["execution_id"]
    )
    adapter = DefaultEvidenceValidationAdapter()
    _, findings = await adapter.validate_evidence(
        tenant_id="tenant-a",
        execution_result=exec_agg.result,
        context={"evaluation_id": "test", "snapshot_age_seconds": 600, "snapshot_ttl_seconds": 300},
    )
    assert any(f.code == "SNAPSHOT_EXPIRED" for f in findings)


@pytest.mark.asyncio
async def test_knowledge_authority(oip_container):
    execution, _, _ = await _create_execution(oip_container)
    exec_agg = await oip_container.execution_repository.get_by_id(
        tenant_id="tenant-a", execution_id=execution["execution_id"]
    )
    evidence_adapter = DefaultEvidenceValidationAdapter()
    evidence, _ = await evidence_adapter.validate_evidence(
        tenant_id="tenant-a",
        execution_result=exec_agg.result,
        context={"evaluation_id": "test", "evidence_authority": "untrusted"},
    )
    authority_adapter = DefaultKnowledgeAuthorityAdapter()
    findings = await authority_adapter.validate_authority(
        tenant_id="tenant-a",
        evidence=evidence,
        context={"evaluation_id": "test", "allowed_authorities": ("erp", "government")},
    )
    assert any(f.code == "AUTHORITY_DENIED" for f in findings)


@pytest.mark.asyncio
async def test_hash_verification(oip_container):
    execution, _, _ = await _create_execution(oip_container)
    exec_agg = await oip_container.execution_repository.get_by_id(
        tenant_id="tenant-a", execution_id=execution["execution_id"]
    )
    adapter = DefaultEvidenceValidationAdapter()
    _, findings = await adapter.validate_evidence(
        tenant_id="tenant-a",
        execution_result=exec_agg.result,
        context={"evaluation_id": "test", "expected_content_hash": "deadbeef"},
    )
    assert any(f.code == "HASH_MISMATCH" for f in findings)


@pytest.mark.asyncio
async def test_risk_scoring(oip_container):
    from src.oip.modules.quality_gate.domain.value_objects import (
        FindingSeverity,
        QualityFinding,
        ViolationKind,
    )

    adapter = DefaultRiskScoringAdapter()
    finding = QualityFinding(
        finding_id="f1",
        evaluation_id="e1",
        rule_id="r1",
        level=QualityLevel.L1,
        severity=FindingSeverity.CRITICAL,
        code="TEST",
        message="test",
        violation_kind=ViolationKind.BUSINESS_RULE,
        created_at="2026-01-01T00:00:00+00:00",
    )
    risk = await adapter.score_risk(
        tenant_id="tenant-a",
        evaluation_id="e1",
        findings=(finding,),
        violations=(),
        context={},
    )
    assert risk.score >= 0.4
    assert risk.level in ("medium", "high", "critical")


@pytest.mark.asyncio
async def test_get_findings_query(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"knowledge_stale": True}},
        )
    )
    findings = await oip_container.query_bus.dispatch(
        GetFindingsQuery(
            tenant_id=TenantId("tenant-a"),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
        )
    )
    assert isinstance(findings, list)
    assert len(findings) >= 1


@pytest.mark.asyncio
async def test_get_decision_query(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    decision = await oip_container.query_bus.dispatch(
        GetDecisionQuery(
            tenant_id=TenantId("tenant-a"),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
        )
    )
    assert decision["decision"] == "pass"


@pytest.mark.asyncio
async def test_search_evaluations(oip_container):
    execution, request_id, correlation_id = await _create_execution(oip_container)
    await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    results = await oip_container.query_bus.dispatch(
        SearchEvaluationsQuery(
            tenant_id=TenantId("tenant-a"),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    assert len(results) >= 1


@pytest.mark.asyncio
async def test_quality_metrics(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    metrics = await oip_container.query_bus.dispatch(
        QualityMetricsQuery(tenant_id=TenantId("tenant-a"))
    )
    assert metrics["evaluations_started"] >= 1
    assert metrics["evaluations_passed"] >= 1


@pytest.mark.asyncio
async def test_approve_reject_archive(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    evaluation = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    approved = await oip_container.command_bus.dispatch(
        ApproveEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
        )
    )
    assert approved["status"] == "approved"

    rejected = await oip_container.command_bus.dispatch(
        RejectEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
            reason="policy",
        )
    )
    assert rejected["status"] == "rejected"

    archived = await oip_container.command_bus.dispatch(
        ArchiveEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            evaluation_id=EvaluationId(evaluation["evaluation_id"]),
        )
    )
    assert archived["status"] == "archived"


@pytest.mark.asyncio
async def test_audit_chain(oip_container):
    execution, request_id, correlation_id = await _create_execution(oip_container)
    await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    chain = await oip_container.query_bus.dispatch(
        GetAuditChainQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    event_names = [entry["event_name"] for entry in chain]
    assert any("quality_gate" in name for name in event_names)


@pytest.mark.asyncio
async def test_lineage_trace(oip_container):
    execution, request_id, correlation_id = await _create_execution(oip_container)
    await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
            metadata={"validation_context": {"knowledge_stale": True}},
        )
    )
    trace = await oip_container.query_bus.dispatch(
        GetLineageTraceQuery(tenant_id=TenantId("tenant-a"), request_id=RequestId(request_id))
    )
    node_types = [node["node_type"] for node in trace]
    assert "QualityEvaluation" in node_types
    assert "QualityDecision" in node_types


@pytest.mark.asyncio
async def test_migration_tables_exist(oip_container):
    conn = oip_container.connection
    tables = (
        "oip_quality_evaluations",
        "oip_quality_findings",
        "oip_quality_rules",
        "oip_quality_evidence",
        "oip_quality_metrics",
        "oip_quality_risks",
    )
    for table in tables:
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        row = await cursor.fetchone()
        assert row is not None, f"Missing table {table}"


@pytest.mark.asyncio
async def test_quality_rules_seeded(oip_container):
    rules = await oip_container.quality_repository.list_rules()
    assert len(rules) >= 20
    l0_rules = await oip_container.quality_repository.list_rules(level="L0")
    l3_rules = await oip_container.quality_repository.list_rules(level="L3")
    assert len(l0_rules) >= 5
    assert all(not r.mandatory for r in l3_rules) or any(not r.mandatory for r in l3_rules)


@pytest.mark.asyncio
async def test_l3_disabled_not_mandatory(tmp_path):
    db_path = tmp_path / "oip_quality_no_l3.db"
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
        l3_enabled=False,
        minimum_gate="L2",
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    try:
        correlation_id = str(new_correlation_id())
        request_id = str(new_request_id())
        plan = await container.command_bus.dispatch(
            CreateExecutionPlanCommand(
                tenant_id=TenantId("tenant-a"),
                correlation_id=CorrelationId(correlation_id),
                request_id=RequestId(request_id),
                session_id="sess-no-l3",
                user_id="user-1",
                module="orbix",
                message="test",
            )
        )
        route = await container.command_bus.dispatch(
            CreateRouteDecisionCommand(
                tenant_id=TenantId("tenant-a"),
                correlation_id=CorrelationId(correlation_id),
                plan_id=PlanId(plan["plan_id"]),
            )
        )
        execution = await container.command_bus.dispatch(
            StartExecutionCommand(
                tenant_id=TenantId("tenant-a"),
                correlation_id=CorrelationId(correlation_id),
                route_id=RouteId(route["route_id"]),
            )
        )
        evaluation = await container.command_bus.dispatch(
            StartQualityEvaluationCommand(
                tenant_id=TenantId("tenant-a"),
                correlation_id=CorrelationId(correlation_id),
                execution_id=ExecutionId(execution["execution_id"]),
                metadata={"validation_context": {"ai_hallucination": True}},
            )
        )
        assert evaluation["l3_enabled"] is False
        assert evaluation["decision"] == "pass"
    finally:
        await container.close()
        await shutdown_container()


@pytest.mark.asyncio
async def test_shadow_facade_health(oip_container):
    health = await oip_container.kernel.health()
    assert health["quality_gate_module"] is True
    assert health["shadow_quality"] is True


@pytest.mark.asyncio
async def test_get_evaluation_query(oip_container):
    execution, _, correlation_id = await _create_execution(oip_container)
    started = await oip_container.command_bus.dispatch(
        StartQualityEvaluationCommand(
            tenant_id=TenantId("tenant-a"),
            correlation_id=CorrelationId(correlation_id),
            execution_id=ExecutionId(execution["execution_id"]),
        )
    )
    fetched = await oip_container.query_bus.dispatch(
        GetEvaluationQuery(
            tenant_id=TenantId("tenant-a"),
            evaluation_id=EvaluationId(started["evaluation_id"]),
        )
    )
    assert fetched["evaluation_id"] == started["evaluation_id"]


@pytest.mark.asyncio
async def test_input_validation_stage_unit():
    from src.oip.modules.provider_runtime.domain.entities import ExecutionAggregate
    from src.oip.modules.provider_runtime.domain.value_objects import (
        ExecutionPolicyName,
        ExecutionResult,
        ExecutionStatus,
    )

    execution = ExecutionAggregate(
        execution_id="ex-1",
        route_id="r-1",
        plan_id="p-1",
        request_id="req-1",
        tenant_id="tenant-a",
        correlation_id="corr-1",
        status=ExecutionStatus.COMPLETED,
        policy_name=ExecutionPolicyName.BALANCED,
        edition="cloud",
        deployment_mode="cloud_saas",
        provider_id="mock",
        created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        updated_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )
    result = ExecutionResult(result_id="res-1", execution_id="ex-1", success=True, output_text="ok")
    ctx = QualityPipelineContext(
        evaluation_id="eval-1",
        execution=execution,
        execution_result=result,
        minimum_gate=QualityLevel.L2,
        l3_enabled=False,
    )
    stage = InputValidationStage()
    updated = await stage.run(ctx)
    assert updated.blocked is False


@pytest.mark.asyncio
async def test_decision_assembly_stage_unit():
    from src.oip.modules.provider_runtime.domain.entities import ExecutionAggregate
    from src.oip.modules.provider_runtime.domain.value_objects import (
        ExecutionPolicyName,
        ExecutionResult,
        ExecutionStatus,
    )

    execution = ExecutionAggregate(
        execution_id="ex-1",
        route_id="r-1",
        plan_id="p-1",
        request_id="req-1",
        tenant_id="tenant-a",
        correlation_id="corr-1",
        status=ExecutionStatus.COMPLETED,
        policy_name=ExecutionPolicyName.BALANCED,
        edition="cloud",
        deployment_mode="cloud_saas",
        provider_id="mock",
        created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        updated_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )
    result = ExecutionResult(result_id="res-1", execution_id="ex-1", success=True, output_text="ok")
    ctx = QualityPipelineContext(
        evaluation_id="eval-1",
        execution=execution,
        execution_result=result,
        minimum_gate=QualityLevel.L2,
        l3_enabled=False,
    )
    ctx.highest_gate_reached = QualityLevel.L2
    ctx.risk = await DefaultRiskScoringAdapter().score_risk(
        tenant_id="tenant-a",
        evaluation_id="eval-1",
        findings=(),
        violations=(),
        context={},
    )
    updated = await DecisionAssemblyStage().run(ctx)
    assert updated.decision is not None
    assert updated.decision.outcome.value == "pass"
