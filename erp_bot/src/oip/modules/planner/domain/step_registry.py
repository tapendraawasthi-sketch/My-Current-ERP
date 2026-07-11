"""Execution step type registry — no switch statements."""

from __future__ import annotations

from typing import Callable, Protocol

from .value_objects import ExecutionStepType


class StepBuilder(Protocol):
    def build(
        self,
        *,
        plan_id: str,
        tenant_id: str,
        sequence_no: int,
        context: dict,
    ) -> dict:
        """Return step definition dict for assembly."""


StepBuilderFn = Callable[..., dict]


class ExecutionStepTypeRegistry:
    def __init__(self) -> None:
        self._builders: dict[ExecutionStepType, StepBuilderFn] = {}

    def register(self, step_type: ExecutionStepType, builder: StepBuilderFn) -> None:
        if step_type in self._builders:
            raise ValueError(f"Step builder already registered: {step_type}")
        self._builders[step_type] = builder

    def build(
        self,
        step_type: ExecutionStepType,
        *,
        plan_id: str,
        tenant_id: str,
        sequence_no: int,
        context: dict | None = None,
    ) -> dict:
        builder = self._builders.get(step_type)
        if builder is None:
            raise KeyError(f"No step builder registered for type: {step_type}")
        return builder(
            plan_id=plan_id,
            tenant_id=tenant_id,
            sequence_no=sequence_no,
            context=context or {},
        )

    def supported_types(self) -> tuple[ExecutionStepType, ...]:
        return tuple(self._builders.keys())


def create_default_step_registry() -> ExecutionStepTypeRegistry:
    registry = ExecutionStepTypeRegistry()

    def _base(step_type: ExecutionStepType, name: str, extra: dict | None = None) -> StepBuilderFn:
        def builder(*, plan_id: str, tenant_id: str, sequence_no: int, context: dict) -> dict:
            payload = {"step_type": step_type.value, **(extra or {}), **context.get("payload", {})}
            return {
                "step_type": step_type,
                "name": name,
                "payload": payload,
                "depends_on": context.get("depends_on", ()),
                "estimated_tokens": context.get("estimated_tokens", 0),
                "estimated_latency_ms": context.get("estimated_latency_ms", 0),
            }

        return builder

    registry.register(
        ExecutionStepType.REASON,
        _base(ExecutionStepType.REASON, "reason", {"purpose": "plan_reasoning"}),
    )
    registry.register(
        ExecutionStepType.RETRIEVE,
        _base(ExecutionStepType.RETRIEVE, "retrieve", {"purpose": "knowledge_retrieval"}),
    )
    registry.register(
        ExecutionStepType.TOOL,
        _base(ExecutionStepType.TOOL, "tool", {"purpose": "tool_invocation"}),
    )
    registry.register(
        ExecutionStepType.PROVIDER,
        _base(ExecutionStepType.PROVIDER, "provider", {"purpose": "llm_inference"}),
    )
    registry.register(
        ExecutionStepType.QUALITY_GATE,
        _base(ExecutionStepType.QUALITY_GATE, "quality_gate", {"purpose": "output_validation"}),
    )
    registry.register(
        ExecutionStepType.MATERIALIZE_ACTION,
        _base(ExecutionStepType.MATERIALIZE_ACTION, "materialize_action", {"purpose": "action_emission"}),
    )
    registry.register(
        ExecutionStepType.STREAM,
        _base(ExecutionStepType.STREAM, "stream", {"purpose": "stream_response"}),
    )
    registry.register(
        ExecutionStepType.COMPLETE,
        _base(ExecutionStepType.COMPLETE, "complete", {"purpose": "finalize"}),
    )
    return registry
