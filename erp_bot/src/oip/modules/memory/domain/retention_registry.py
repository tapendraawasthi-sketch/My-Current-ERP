"""Retention policy registry."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .value_objects import RetentionPolicy


@dataclass(frozen=True)
class RetentionDefinition:
    policy: RetentionPolicy
    ttl_days: int | None
    archive_after_days: int | None


class RetentionRegistry:
    def __init__(self) -> None:
        self._policies: dict[str, RetentionDefinition] = {}

    def register(self, definition: RetentionDefinition) -> None:
        self._policies[definition.policy.value] = definition

    def get(self, policy: RetentionPolicy | str) -> RetentionDefinition | None:
        key = policy.value if isinstance(policy, RetentionPolicy) else policy
        return self._policies.get(key)

    def compute_expiry(self, policy: RetentionPolicy | str, created_at: datetime) -> datetime | None:
        definition = self.get(policy)
        if definition is None or definition.ttl_days is None:
            return None
        return created_at + timedelta(days=definition.ttl_days)


def create_default_retention_registry() -> RetentionRegistry:
    registry = RetentionRegistry()
    definitions = (
        RetentionDefinition(RetentionPolicy.FOREVER, None, None),
        RetentionDefinition(RetentionPolicy.TEN_YEARS, 3650, 3285),
        RetentionDefinition(RetentionPolicy.SEVEN_YEARS, 2555, 2190),
        RetentionDefinition(RetentionPolicy.FISCAL_YEAR, 365, 300),
        RetentionDefinition(RetentionPolicy.CONVERSATION, 30, 14),
        RetentionDefinition(RetentionPolicy.SESSION, 7, 3),
        RetentionDefinition(RetentionPolicy.TEMPORARY, 1, None),
    )
    for definition in definitions:
        registry.register(definition)
    return registry


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
