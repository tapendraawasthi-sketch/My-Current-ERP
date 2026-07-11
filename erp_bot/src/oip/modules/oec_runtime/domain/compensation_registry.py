"""Compensation strategy registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CompensationStrategy:
    name: str
    description: str


class CompensationRegistry:
    def __init__(self) -> None:
        self._strategies: dict[str, CompensationStrategy] = {}

    def register(self, strategy: CompensationStrategy) -> None:
        self._strategies[strategy.name] = strategy

    def get(self, name: str) -> CompensationStrategy | None:
        return self._strategies.get(name)

    def build_reversal_payload(self, *, original_payload: dict[str, Any], reason: str) -> dict[str, Any]:
        return {
            "reversal": True,
            "reason": reason,
            "original": original_payload,
        }


def create_default_compensation_registry() -> CompensationRegistry:
    registry = CompensationRegistry()
    registry.register(CompensationStrategy("reverse_command", "Dispatch inverse ERP command"))
    registry.register(CompensationStrategy("mark_void", "Mark original transaction void"))
    return registry
