"""Build planning pipeline with default registries."""

from __future__ import annotations

from ..application.pipeline.budget_allocation_stage import BudgetAllocationStage
from ..application.pipeline.capability_analysis_stage import CapabilityAnalysisStage
from ..application.pipeline.constraint_resolution_stage import (
    ConstraintEvaluatorRegistry,
    ConstraintResolutionStage,
    create_default_constraint_registry,
)
from ..application.pipeline.context_requirement_stage import ContextRequirementStage
from ..application.pipeline.execution_budget_stage import ExecutionBudgetStage
from ..application.pipeline.execution_intent_assembly_stage import ExecutionIntentAssemblyStage
from ..application.pipeline.intent_classification_stage import (
    IntentClassificationStage,
    create_default_intent_registry,
)
from ....integration.contracts.execution_intent_registry import create_default_execution_intent_registry
from ..application.pipeline.knowledge_requirement_stage import KnowledgeRequirementStage
from ..application.pipeline.normalize_stage import NormalizeStage
from ..application.pipeline.pipeline import PlanningPipeline
from ..application.pipeline.plan_assembly_stage import (
    ExecutionStrategyRegistry,
    PlanAssemblyStage,
    create_default_strategy_registry,
)
from ..application.pipeline.tool_requirement_stage import ToolRequirementStage
from ..application.ports.capability_registry_port import CapabilityRegistryPort
from ..application.ports.execution_budget_port import ExecutionBudgetPort
from ..application.ports.planning_policy_port import PlanningPolicyPort
from ..application.ports.skill_registry_port import SkillRegistryPort
from ..application.ports.tool_registry_port import ToolRegistryPort
from ..domain.step_registry import ExecutionStepTypeRegistry, create_default_step_registry


def build_planning_pipeline(
    *,
    policy_port: PlanningPolicyPort,
    tool_registry: ToolRegistryPort,
    skill_registry: SkillRegistryPort,
    capability_registry: CapabilityRegistryPort,
    budget_port: ExecutionBudgetPort,
    intent_registry=None,
    execution_intent_registry=None,
    constraint_registry: ConstraintEvaluatorRegistry | None = None,
    strategy_registry: ExecutionStrategyRegistry | None = None,
    step_registry: ExecutionStepTypeRegistry | None = None,
) -> PlanningPipeline:
    intent_registry = intent_registry or create_default_intent_registry()
    execution_intent_registry = execution_intent_registry or create_default_execution_intent_registry()
    constraint_registry = constraint_registry or create_default_constraint_registry()
    strategy_registry = strategy_registry or create_default_strategy_registry()
    step_registry = step_registry or create_default_step_registry()

    stages = (
        NormalizeStage(),
        IntentClassificationStage(intent_registry),
        ExecutionIntentAssemblyStage(execution_intent_registry),
        CapabilityAnalysisStage(capability_registry),
        ConstraintResolutionStage(policy_port, constraint_registry),
        ToolRequirementStage(tool_registry),
        KnowledgeRequirementStage(),
        ContextRequirementStage(),
        BudgetAllocationStage(),
        ExecutionBudgetStage(budget_port, skill_registry),
        PlanAssemblyStage(step_registry, strategy_registry),
    )
    return PlanningPipeline(stages=stages)
