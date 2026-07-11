"""Recall strategy registry — pluggable retrieval modes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from .value_objects import RecallMode

if TYPE_CHECKING:
    from ..application.pipeline.context import RecallPipelineContext


class RecallStrategy(Protocol):
    name: str

    async def recall(self, context: RecallPipelineContext) -> RecallPipelineContext: ...


@dataclass(frozen=True)
class RecallStrategyDefinition:
    mode: RecallMode
    strategy_name: str


class RecallStrategyRegistry:
    def __init__(self) -> None:
        self._modes: dict[str, RecallStrategyDefinition] = {}
        self._strategies: dict[str, RecallStrategy] = {}

    def register_mode(self, definition: RecallStrategyDefinition) -> None:
        self._modes[definition.mode.value] = definition

    def register_strategy(self, strategy: RecallStrategy) -> None:
        self._strategies[strategy.name] = strategy

    def resolve_strategy_name(self, mode: RecallMode | str) -> str | None:
        key = mode.value if isinstance(mode, RecallMode) else mode
        definition = self._modes.get(key)
        return definition.strategy_name if definition else None

    def get_strategy(self, mode: RecallMode | str) -> RecallStrategy | None:
        name = self.resolve_strategy_name(mode)
        return self._strategies.get(name) if name else None


def create_default_recall_strategy_registry() -> RecallStrategyRegistry:
    registry = RecallStrategyRegistry()
    mappings = (
        RecallStrategyDefinition(RecallMode.EXACT, "exact"),
        RecallStrategyDefinition(RecallMode.SEMANTIC, "semantic"),
        RecallStrategyDefinition(RecallMode.HYBRID, "hybrid"),
        RecallStrategyDefinition(RecallMode.TIMELINE, "timeline"),
        RecallStrategyDefinition(RecallMode.PATTERN, "pattern"),
        RecallStrategyDefinition(RecallMode.CONTEXT, "context"),
    )
    for mapping in mappings:
        registry.register_mode(mapping)
    return registry
