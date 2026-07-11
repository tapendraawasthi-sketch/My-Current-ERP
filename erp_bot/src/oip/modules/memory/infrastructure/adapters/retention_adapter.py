"""Retention adapter."""

from __future__ import annotations

from datetime import datetime

from ...application.ports.memory_ports import RetentionPort
from ...domain.retention_registry import RetentionRegistry


class RetentionAdapter(RetentionPort):
    def __init__(self, registry: RetentionRegistry) -> None:
        self._registry = registry

    def compute_expiry(self, policy: str, created_at: datetime) -> datetime | None:
        return self._registry.compute_expiry(policy, created_at)
