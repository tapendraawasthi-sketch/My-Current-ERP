"""Conflict resolver registry for duplicate memories."""

from __future__ import annotations

from dataclasses import dataclass

from .entities import MemoryAggregate
from .value_objects import Importance


@dataclass(frozen=True)
class ConflictResolverDefinition:
    name: str
    description: str


class ConflictResolver:
    name = "prefer_higher_importance"

    def resolve(self, existing: MemoryAggregate, incoming: MemoryAggregate) -> MemoryAggregate:
        existing_rank = self._rank(existing.importance)
        incoming_rank = self._rank(incoming.importance)
        if incoming_rank >= existing_rank:
            return incoming
        return existing

    def _rank(self, level: Importance) -> int:
        order = {
            Importance.LOW: 1,
            Importance.MEDIUM: 2,
            Importance.HIGH: 3,
            Importance.CRITICAL: 4,
        }
        return order.get(level, 1)


class ConflictResolverRegistry:
    def __init__(self) -> None:
        self._resolvers: dict[str, ConflictResolver] = {}

    def register(self, resolver: ConflictResolver, definition: ConflictResolverDefinition) -> None:
        self._resolvers[resolver.name] = resolver

    def get(self, name: str) -> ConflictResolver | None:
        return self._resolvers.get(name)

    def default_name(self) -> str:
        return "prefer_higher_importance"


def create_default_conflict_resolver_registry() -> ConflictResolverRegistry:
    registry = ConflictResolverRegistry()
    resolver = ConflictResolver()
    registry.register(
        resolver,
        ConflictResolverDefinition("prefer_higher_importance", "Keep memory with higher importance"),
    )
    return registry
