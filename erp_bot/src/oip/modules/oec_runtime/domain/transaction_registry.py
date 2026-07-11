"""Transaction lifecycle registry."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class TransactionPolicy:
    name: str
    timeout_seconds: float
    auto_rollback: bool = True


class TransactionRegistry:
    def __init__(self) -> None:
        self._policies: dict[str, TransactionPolicy] = {}

    def register(self, policy: TransactionPolicy) -> None:
        self._policies[policy.name] = policy

    def get(self, name: str) -> TransactionPolicy | None:
        return self._policies.get(name)

    def timeout_at(self, policy: TransactionPolicy, opened_at: datetime) -> datetime:
        return opened_at + timedelta(seconds=policy.timeout_seconds)


def create_default_transaction_registry() -> TransactionRegistry:
    registry = TransactionRegistry()
    registry.register(TransactionPolicy("default", 30.0))
    registry.register(TransactionPolicy("long_running", 120.0))
    return registry
