"""Expiration policy registry."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .retention_registry import RetentionRegistry
from .value_objects import Freshness, RetentionPolicy


@dataclass(frozen=True)
class ExpirationPolicyDefinition:
    name: str
    archive_before_delete: bool


class ExpirationPolicy:
    name = "retention_based"

    def __init__(self, retention_registry: RetentionRegistry) -> None:
        self._retention = retention_registry

    def compute_expiry(self, policy: RetentionPolicy, created_at: datetime) -> datetime | None:
        return self._retention.compute_expiry(policy, created_at)

    def is_expired(self, expires_at: datetime | None, now: datetime) -> bool:
        if expires_at is None:
            return False
        return now >= expires_at

    def freshness_for_age_days(self, age_days: float) -> Freshness:
        if age_days <= 1:
            return Freshness.HOT
        if age_days <= 14:
            return Freshness.WARM
        if age_days <= 90:
            return Freshness.COLD
        return Freshness.ARCHIVED


class ExpirationPolicyRegistry:
    def __init__(self) -> None:
        self._policies: dict[str, ExpirationPolicyDefinition] = {}
        self._handlers: dict[str, ExpirationPolicy] = {}

    def register_policy(self, definition: ExpirationPolicyDefinition) -> None:
        self._policies[definition.name] = definition

    def register_handler(self, handler: ExpirationPolicy) -> None:
        self._handlers[handler.name] = handler

    def get_handler(self, name: str) -> ExpirationPolicy | None:
        return self._handlers.get(name)


def create_default_expiration_policy_registry(retention_registry: RetentionRegistry) -> ExpirationPolicyRegistry:
    registry = ExpirationPolicyRegistry()
    registry.register_policy(ExpirationPolicyDefinition("retention_based", True))
    registry.register_handler(ExpirationPolicy(retention_registry))
    return registry
