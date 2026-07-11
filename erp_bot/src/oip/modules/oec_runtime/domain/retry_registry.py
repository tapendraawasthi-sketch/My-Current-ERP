"""Retry policy registry."""

from __future__ import annotations

from dataclasses import dataclass

from .value_objects import RetryPolicyName


@dataclass(frozen=True)
class RetryPolicyDefinition:
    name: RetryPolicyName
    max_attempts: int
    base_delay_seconds: float
    max_delay_seconds: float
    jitter: bool = True


class RetryRegistry:
    def __init__(self) -> None:
        self._policies: dict[str, RetryPolicyDefinition] = {}

    def register(self, definition: RetryPolicyDefinition) -> None:
        self._policies[definition.name.value] = definition

    def get(self, name: RetryPolicyName | str) -> RetryPolicyDefinition | None:
        key = name.value if isinstance(name, RetryPolicyName) else name
        return self._policies.get(key)

    def compute_delay(self, policy: RetryPolicyDefinition, attempt: int) -> float:
        if policy.name == RetryPolicyName.LINEAR:
            delay = policy.base_delay_seconds * attempt
        elif policy.name == RetryPolicyName.EXPONENTIAL:
            delay = policy.base_delay_seconds * (2 ** (attempt - 1))
        else:
            delay = policy.base_delay_seconds
        return min(delay, policy.max_delay_seconds)


def create_default_retry_registry() -> RetryRegistry:
    registry = RetryRegistry()
    policies = (
        RetryPolicyDefinition(RetryPolicyName.NONE, 1, 0.0, 0.0),
        RetryPolicyDefinition(RetryPolicyName.LINEAR, 3, 1.0, 5.0),
        RetryPolicyDefinition(RetryPolicyName.EXPONENTIAL, 5, 0.5, 30.0),
        RetryPolicyDefinition(RetryPolicyName.CIRCUIT_BREAKER, 3, 2.0, 60.0),
    )
    for policy in policies:
        registry.register(policy)
    return registry
