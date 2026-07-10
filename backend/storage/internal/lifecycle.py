"""Lifecycle rule registry for future automated object expiration."""

from __future__ import annotations

import threading
from collections import defaultdict

from backend.storage.internal.protocols import LifecycleRule, LifecycleRuleRegistry


class InMemoryLifecycleRuleRegistry(LifecycleRuleRegistry):
    """Thread-safe in-memory lifecycle rules keyed by prefix."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rules: dict[str, list[LifecycleRule]] = defaultdict(list)

    def register(self, rule: LifecycleRule) -> None:
        with self._lock:
            self._rules[rule.prefix].append(rule)

    def rules_for_prefix(self, prefix: str) -> tuple[LifecycleRule, ...]:
        with self._lock:
            matched: list[LifecycleRule] = []
            for rule_prefix, rules in self._rules.items():
                if prefix.startswith(rule_prefix):
                    matched.extend(r for r in rules if r.enabled)
            return tuple(matched)

    def clear(self) -> None:
        with self._lock:
            self._rules.clear()
