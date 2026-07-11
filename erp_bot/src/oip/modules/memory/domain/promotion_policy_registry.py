"""Promotion policy registry."""

from __future__ import annotations

from dataclasses import dataclass

from .importance_registry import ImportanceRegistry
from .value_objects import Freshness, Importance


@dataclass(frozen=True)
class PromotionPolicyDefinition:
    name: str
    min_confidence: float
    min_access_count: int


class PromotionPolicy:
    name = "confidence_access"

    def __init__(self, importance_registry: ImportanceRegistry) -> None:
        self._importance = importance_registry

    def should_promote(self, *, confidence: float, access_count: int, definition: PromotionPolicyDefinition) -> bool:
        return confidence >= definition.min_confidence and access_count >= definition.min_access_count

    def promote_importance(self, current: Importance) -> Importance:
        return self._importance.promote(current)

    def promote_freshness(self, current: Freshness) -> Freshness:
        order = (Freshness.COLD, Freshness.WARM, Freshness.HOT)
        idx = order.index(current) if current in order else 1
        return order[min(idx + 1, len(order) - 1)]


class PromotionPolicyRegistry:
    def __init__(self) -> None:
        self._policies: dict[str, PromotionPolicyDefinition] = {}
        self._handlers: dict[str, PromotionPolicy] = {}

    def register_policy(self, definition: PromotionPolicyDefinition) -> None:
        self._policies[definition.name] = definition

    def register_handler(self, handler: PromotionPolicy) -> None:
        self._handlers[handler.name] = handler

    def get_policy(self, name: str) -> PromotionPolicyDefinition | None:
        return self._policies.get(name)

    def get_handler(self, name: str) -> PromotionPolicy | None:
        return self._handlers.get(name)


def create_default_promotion_policy_registry(importance_registry: ImportanceRegistry) -> PromotionPolicyRegistry:
    registry = PromotionPolicyRegistry()
    registry.register_policy(PromotionPolicyDefinition("confidence_access", 0.85, 3))
    registry.register_handler(PromotionPolicy(importance_registry))
    return registry
