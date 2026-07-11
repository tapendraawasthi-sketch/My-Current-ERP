"""Importance registry — rank and scoring without switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import Importance


@dataclass(frozen=True)
class ImportanceDefinition:
    level: Importance
    rank: int
    score_weight: float


class ImportanceRegistry:
    def __init__(self) -> None:
        self._levels: dict[str, ImportanceDefinition] = {}

    def register(self, definition: ImportanceDefinition) -> None:
        self._levels[definition.level.value] = definition

    def get(self, level: Importance | str) -> ImportanceDefinition | None:
        key = level.value if isinstance(level, Importance) else level
        return self._levels.get(key)

    def rank(self, level: Importance | str) -> int:
        definition = self.get(level)
        return definition.rank if definition else 1

    def score_weight(self, level: Importance | str) -> float:
        definition = self.get(level)
        return definition.score_weight if definition else 0.25

    def promote(self, current: Importance | str) -> Importance:
        order = (Importance.LOW, Importance.MEDIUM, Importance.HIGH, Importance.CRITICAL)
        current_level = current if isinstance(current, Importance) else Importance(current)
        idx = order.index(current_level)
        return order[min(idx + 1, len(order) - 1)]

    def demote(self, current: Importance | str) -> Importance:
        order = (Importance.LOW, Importance.MEDIUM, Importance.HIGH, Importance.CRITICAL)
        current_level = current if isinstance(current, Importance) else Importance(current)
        idx = order.index(current_level)
        return order[max(idx - 1, 0)]


def create_default_importance_registry() -> ImportanceRegistry:
    registry = ImportanceRegistry()
    definitions = (
        ImportanceDefinition(Importance.CRITICAL, 4, 1.0),
        ImportanceDefinition(Importance.HIGH, 3, 0.75),
        ImportanceDefinition(Importance.MEDIUM, 2, 0.5),
        ImportanceDefinition(Importance.LOW, 1, 0.25),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
