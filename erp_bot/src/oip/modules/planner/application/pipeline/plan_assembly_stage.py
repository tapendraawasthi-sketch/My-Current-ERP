"""Execution plan assembly — strategy registry, step registry."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable, Protocol

from ...domain.entities import ExecutionGoal, ExecutionStep
from ...domain.step_registry import ExecutionStepTypeRegistry
from ...domain.value_objects import ExecutionStepType
from .context import PlanningContext


class ExecutionStrategy(Protocol):
    name: str

    def build_step_sequence(self, context: PlanningContext) -> tuple[ExecutionStepType, ...]:
        """Return ordered step types for plan."""


ExecutionStrategyFn = Callable[[PlanningContext], tuple[ExecutionStepType, ...]]


class ExecutionStrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[str, ExecutionStrategyFn] = {}

    def register(self, name: str, strategy: ExecutionStrategyFn) -> None:
        self._strategies[name] = strategy

    def resolve(self, context: PlanningContext) -> tuple[ExecutionStepType, ...]:
        policy = context.policy
        strategy_name = policy.name.value if policy else "balanced"
        resolver = self._strategies.get(strategy_name) or self._strategies["balanced"]
        return resolver(context)


def create_default_strategy_registry() -> ExecutionStrategyRegistry:
    registry = ExecutionStrategyRegistry()

    def fast_strategy(context: PlanningContext) -> tuple[ExecutionStepType, ...]:
        steps = [ExecutionStepType.REASON, ExecutionStepType.PROVIDER, ExecutionStepType.MATERIALIZE_ACTION]
        if context.knowledge_required:
            steps.insert(1, ExecutionStepType.RETRIEVE)
        steps.append(ExecutionStepType.COMPLETE)
        return tuple(steps)

    def balanced_strategy(context: PlanningContext) -> tuple[ExecutionStepType, ...]:
        steps: list[ExecutionStepType] = [ExecutionStepType.REASON]
        if context.knowledge_required:
            steps.append(ExecutionStepType.RETRIEVE)
        if context.tool_requirements:
            steps.append(ExecutionStepType.TOOL)
        steps.extend(
            [
                ExecutionStepType.PROVIDER,
                ExecutionStepType.QUALITY_GATE,
                ExecutionStepType.MATERIALIZE_ACTION,
            ]
        )
        if context.policy and context.policy.stream_enabled:
            steps.insert(-1, ExecutionStepType.STREAM)
        steps.append(ExecutionStepType.COMPLETE)
        return tuple(steps)

    def accurate_strategy(context: PlanningContext) -> tuple[ExecutionStepType, ...]:
        steps = list(balanced_strategy(context))
        if ExecutionStepType.REASON in steps:
            idx = steps.index(ExecutionStepType.REASON)
            steps.insert(idx + 1, ExecutionStepType.RETRIEVE)
        return tuple(steps)

    registry.register("fast", fast_strategy)
    registry.register("balanced", balanced_strategy)
    registry.register("accurate", accurate_strategy)
    registry.register("accounting", balanced_strategy)
    registry.register("government", accurate_strategy)
    registry.register("offline", fast_strategy)
    registry.register("low_cost", fast_strategy)
    return registry


class PlanAssemblyStage:
    name = "plan_assembly"

    def __init__(
        self,
        step_registry: ExecutionStepTypeRegistry,
        strategy_registry: ExecutionStrategyRegistry,
    ) -> None:
        self._steps = step_registry
        self._strategies = strategy_registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        now = datetime.now(timezone.utc)
        step_types = self._strategies.resolve(context)
        built_steps: list[ExecutionStep] = []
        prev_step_id: str | None = None

        for index, step_type in enumerate(step_types, start=1):
            step_id = str(uuid.uuid4())
            step_context = {
                "intent": context.intent,
                "payload": {"intent": context.intent},
                "depends_on": (prev_step_id,) if prev_step_id else (),
                "estimated_tokens": 256 if step_type == ExecutionStepType.PROVIDER else 64,
                "estimated_latency_ms": 2000 if step_type == ExecutionStepType.PROVIDER else 200,
            }
            if step_type == ExecutionStepType.TOOL and context.tool_requirements:
                step_context["payload"]["tools"] = [t.model_dump() for t in context.tool_requirements]

            definition = self._steps.build(
                step_type,
                plan_id="pending",
                tenant_id=context.request.tenant_id,
                sequence_no=index,
                context=step_context,
            )
            built_steps.append(
                ExecutionStep(
                    step_id=step_id,
                    plan_id="pending",
                    tenant_id=context.request.tenant_id,
                    sequence_no=index,
                    step_type=definition["step_type"],
                    name=definition["name"],
                    payload=definition["payload"],
                    depends_on=tuple(definition.get("depends_on", ())),
                    estimated_tokens=int(definition.get("estimated_tokens", 0)),
                    estimated_latency_ms=int(definition.get("estimated_latency_ms", 0)),
                    created_at=now,
                )
            )
            prev_step_id = step_id

        context.steps = tuple(built_steps)
        context.goal = ExecutionGoal(
            objective=f"Fulfill intent: {context.intent}",
            success_criteria=("actions_materialized", "quality_gate_passed"),
            output_type="actions",
            metadata={"intent": context.intent, "module": context.request.module},
        )
        return context
