"""Memory type registry — classify memories without switch statements."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import MemoryCategory, MemoryType, RetentionPolicy


@dataclass(frozen=True)
class MemoryTypeDefinition:
    memory_type: MemoryType
    category: MemoryCategory
    default_retention: RetentionPolicy
    default_importance_rank: int


class MemoryTypeRegistry:
    def __init__(self) -> None:
        self._types: dict[str, MemoryTypeDefinition] = {}

    def register(self, definition: MemoryTypeDefinition) -> None:
        self._types[definition.memory_type.value] = definition

    def get(self, memory_type: MemoryType | str) -> MemoryTypeDefinition | None:
        key = memory_type.value if isinstance(memory_type, MemoryType) else memory_type
        return self._types.get(key)

    def resolve_category(self, memory_type: MemoryType | str) -> MemoryCategory:
        definition = self.get(memory_type)
        return definition.category if definition else MemoryCategory.SEMANTIC

    def resolve_retention(self, memory_type: MemoryType | str) -> RetentionPolicy:
        definition = self.get(memory_type)
        return definition.default_retention if definition else RetentionPolicy.CONVERSATION

    def all_types(self) -> tuple[MemoryTypeDefinition, ...]:
        return tuple(self._types.values())


def create_default_memory_type_registry() -> MemoryTypeRegistry:
    registry = MemoryTypeRegistry()
    definitions = (
        MemoryTypeDefinition(MemoryType.CONVERSATION, MemoryCategory.CONVERSATION, RetentionPolicy.CONVERSATION, 2),
        MemoryTypeDefinition(MemoryType.EXECUTION, MemoryCategory.EXECUTION, RetentionPolicy.SESSION, 3),
        MemoryTypeDefinition(MemoryType.KNOWLEDGE, MemoryCategory.KNOWLEDGE, RetentionPolicy.FOREVER, 4),
        MemoryTypeDefinition(MemoryType.ERP_CONTEXT, MemoryCategory.ERP, RetentionPolicy.SEVEN_YEARS, 4),
        MemoryTypeDefinition(MemoryType.PREFERENCE, MemoryCategory.PREFERENCE, RetentionPolicy.FOREVER, 3),
        MemoryTypeDefinition(MemoryType.PATTERN, MemoryCategory.PATTERN, RetentionPolicy.TEN_YEARS, 3),
        MemoryTypeDefinition(MemoryType.FAILURE, MemoryCategory.FAILURE, RetentionPolicy.SEVEN_YEARS, 4),
        MemoryTypeDefinition(MemoryType.BUSINESS, MemoryCategory.BUSINESS, RetentionPolicy.FISCAL_YEAR, 3),
        MemoryTypeDefinition(MemoryType.SEMANTIC, MemoryCategory.SEMANTIC, RetentionPolicy.CONVERSATION, 2),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
