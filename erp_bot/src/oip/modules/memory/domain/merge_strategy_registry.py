"""Merge strategy registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .entities import MemoryAggregate
from .value_objects import MemoryHash, PayloadHash


@dataclass(frozen=True)
class MergeStrategyDefinition:
    name: str
    description: str


class MergeStrategy:
    name = "union"

    def merge(
        self,
        primary: MemoryAggregate,
        secondary: MemoryAggregate,
        *,
        merged_summary: str,
        merged_hash: MemoryHash,
    ) -> dict[str, Any]:
        tags = tuple(sorted(set(primary.tags + secondary.tags)))
        entities = primary.entities + secondary.entities
        return {
            "summary": merged_summary,
            "content": f"{primary.content}\n---\n{secondary.content}".strip(),
            "tags": tags,
            "entities": entities,
            "memory_hash": merged_hash,
            "confidence": max(primary.confidence, secondary.confidence),
            "importance": primary.importance if primary.importance.value >= secondary.importance.value else secondary.importance,
        }


class MergeStrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[str, MergeStrategy] = {}
        self._definitions: dict[str, MergeStrategyDefinition] = {}

    def register(self, strategy: MergeStrategy, definition: MergeStrategyDefinition) -> None:
        self._strategies[strategy.name] = strategy
        self._definitions[strategy.name] = definition

    def get(self, name: str) -> MergeStrategy | None:
        return self._strategies.get(name)

    def default_name(self) -> str:
        return "union"


def create_default_merge_strategy_registry() -> MergeStrategyRegistry:
    registry = MergeStrategyRegistry()
    strategy = MergeStrategy()
    registry.register(strategy, MergeStrategyDefinition("union", "Combine tags, entities, and content"))
    return registry
