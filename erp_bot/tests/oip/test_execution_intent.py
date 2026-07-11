"""OIP Phase 2.5 — ExecutionIntent propagation tests."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from src.oip.integration.contracts.execution_intent import ExecutionIntent
from src.oip.integration.contracts.execution_intent_registry import create_default_execution_intent_registry
from src.oip.integration.contracts.erp_commands import ErpCommandType
from src.oip.modules.action_runtime.domain.action_registry import create_default_action_registry
from src.oip.modules.oec_runtime.domain.execution_intent_registry import (
    create_default_execution_intent_connector_registry,
)
from src.oip.modules.planner.application.dto.planning_request import PlanningRequestDto
from src.oip.modules.planner.domain.value_objects import PlanningPolicyName
from src.oip.modules.planner.infrastructure.factory import build_planning_pipeline
from src.oip.modules.planner.infrastructure.adapters.default_capability_registry import (
    DefaultCapabilityRegistryAdapter,
)
from src.oip.modules.planner.infrastructure.adapters.default_skill_registry import DefaultSkillRegistryAdapter
from src.oip.modules.planner.infrastructure.adapters.default_tool_registry import DefaultToolRegistryAdapter
from src.oip.modules.planner.infrastructure.adapters.default_planning_policy import DefaultPlanningPolicyAdapter
from src.oip.modules.planner.infrastructure.adapters.default_execution_budget import DefaultExecutionBudgetAdapter
from src.oip.modules.quality_gate.application.pipeline.execution_intent_validation_stage import (
    ExecutionIntentValidationStage,
)
from src.oip.modules.quality_gate.application.pipeline.context import QualityPipelineContext
from src.oip.modules.quality_gate.domain.value_objects import QualityLevel
from src.oip.modules.provider_runtime.domain.entities import ExecutionAggregate
from src.oip.modules.provider_runtime.domain.value_objects import ExecutionPolicyName, ExecutionResult, ExecutionStatus


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _planning_pipeline():
    return build_planning_pipeline(
        policy_port=DefaultPlanningPolicyAdapter(),
        tool_registry=DefaultToolRegistryAdapter(),
        skill_registry=DefaultSkillRegistryAdapter(),
        capability_registry=DefaultCapabilityRegistryAdapter(),
        budget_port=DefaultExecutionBudgetAdapter(),
    )


async def _plan_for_message(message: str, *, module: str = "khata") -> ExecutionIntent:
    request = PlanningRequestDto(
        request_id="req-intent-1",
        correlation_id="corr-intent-1",
        tenant_id="tenant-a",
        company_id="company-a",
        user_id="user-1",
        session_id="sess-1",
        module=module,
        message=message,
        policy_name=PlanningPolicyName.BALANCED,
    )
    context = await _planning_pipeline().execute(request)
    assert context.execution_intent is not None
    return context.execution_intent


@pytest.mark.asyncio
async def test_planner_journal_entry_execution_intent():
    intent = await _plan_for_message("journal entry cash sale 500")
    assert intent.intent_type == "journal_entry"
    assert intent.mutating is True
    assert intent.read_only is False
    assert intent.approval_required is True
    assert intent.erp_command_type == ErpCommandType.POST_JOURNAL_ENTRY.value
    assert intent.action_type == "journal_entry"


@pytest.mark.asyncio
async def test_planner_report_generation_execution_intent():
    intent = await _plan_for_message("Generate profit and loss report for March")
    assert intent.intent_type == "report_generation"
    assert intent.read_only is True
    assert intent.mutating is False
    assert intent.erp_command_type == ErpCommandType.GENERATE_FINANCIAL_REPORT.value


@pytest.mark.asyncio
async def test_planner_vat_calculation_execution_intent():
    intent = await _plan_for_message("Calculate VAT 13% for this quarter")
    assert intent.intent_type == "vat_calculation"
    assert intent.read_only is True
    assert intent.erp_command_type == ErpCommandType.CALCULATE_VAT.value


@pytest.mark.asyncio
async def test_planner_ledger_balance_query_execution_intent():
    intent = await _plan_for_message("What is cash account balance?")
    assert intent.intent_type == "ledger_balance_query"
    assert intent.read_only is True
    assert intent.erp_command_type == ErpCommandType.QUERY_LEDGER_BALANCE.value


@pytest.mark.asyncio
async def test_planner_workflow_approval_execution_intent():
    intent = await _plan_for_message("Approve pending action PA-104")
    assert intent.intent_type == "workflow_approval"
    assert intent.mutating is True
    assert intent.approval_required is True
    assert intent.erp_command_type == ErpCommandType.APPROVE_PENDING_ACTION.value
    assert intent.action_type == "approval"


@pytest.mark.asyncio
async def test_execution_intent_registry_immutable():
    registry = create_default_execution_intent_registry()
    first = registry.resolve(source_intent="journal_entry", confidence=0.9)
    second = registry.resolve(source_intent="journal_entry", confidence=0.4)
    assert first.confidence == 0.9
    assert second.confidence == 0.4
    with pytest.raises(Exception):
        first.confidence = 0.1  # type: ignore[misc]


@pytest.mark.asyncio
async def test_quality_validates_mutating_execution_intent():
    registry = create_default_execution_intent_registry()
    intent = registry.resolve(source_intent="journal_entry", confidence=0.88)
    now = _utc_now()
    execution = ExecutionAggregate(
        execution_id="exec-1",
        route_id="route-1",
        plan_id="plan-1",
        request_id="req-1",
        tenant_id="tenant-a",
        company_id="company-a",
        conversation_id="conv-1",
        correlation_id="corr-1",
        status=ExecutionStatus.COMPLETED,
        policy_name=ExecutionPolicyName.BALANCED,
        edition="standard",
        deployment_mode="cloud",
        provider_id="stub",
        metadata={},
        created_at=now,
        updated_at=now,
    )
    result = ExecutionResult(
        result_id="res-1",
        execution_id="exec-1",
        success=True,
        output_text="ok",
        output_json={},
    )
    ctx = QualityPipelineContext(
        evaluation_id="eval-1",
        execution=execution,
        execution_result=result,
        minimum_gate=QualityLevel.L2,
        l3_enabled=False,
        validation_context={"execution_intent": intent.model_dump(mode="json")},
    )
    ctx = await ExecutionIntentValidationStage().run(ctx)
    assert ctx.blocked is False
    assert ctx.validation_context.get("execution_intent_validated") is True


def test_action_registry_maps_intent_action_types():
    registry = create_default_action_registry()
    for action_type, command in (
        ("journal_entry", ErpCommandType.POST_JOURNAL_ENTRY),
        ("report_generation", ErpCommandType.GENERATE_FINANCIAL_REPORT),
        ("vat_calculation", ErpCommandType.CALCULATE_VAT),
        ("ledger_balance_query", ErpCommandType.QUERY_LEDGER_BALANCE),
        ("approval", ErpCommandType.APPROVE_PENDING_ACTION),
    ):
        definition = registry.require(action_type)
        assert definition.erp_command_type == command


def test_oec_intent_registry_resolves_connector_operations():
    registry = create_default_execution_intent_connector_registry()
    intent_registry = create_default_execution_intent_registry()

    journal = intent_registry.resolve(source_intent="journal_entry")
    journal_op = registry.resolve_from_intent(journal)
    assert journal_op.connector_operation == "execute_command"
    assert journal_op.mutating is True

    report = intent_registry.resolve(source_intent="report_generation")
    report_op = registry.resolve_from_intent(report)
    assert report_op.connector_operation == "execute_query"
    assert report_op.mutating is False


def test_execution_intent_from_dict_roundtrip():
    registry = create_default_execution_intent_registry()
    intent = registry.resolve(source_intent="vat_calculation", confidence=0.77)
    restored = ExecutionIntent.from_dict(intent.model_dump(mode="json"))
    assert restored is not None
    assert restored.intent_type == "vat_calculation"
    assert restored.confidence == 0.77


def test_orchestrator_module_stages_has_no_hardcoded_journal_entry():
    from pathlib import Path

    source = Path("src/oip/modules/orchestrator/infrastructure/adapters/stages/module_stages.py").read_text()
    assert 'action_type="journal_entry"' not in source
