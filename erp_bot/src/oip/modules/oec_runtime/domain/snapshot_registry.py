"""Snapshot validation registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SnapshotPolicy:
    name: str
    max_age_seconds: float
    require_company_match: bool = True


class SnapshotRegistry:
    def __init__(self) -> None:
        self._policies: dict[str, SnapshotPolicy] = {}

    def register(self, policy: SnapshotPolicy) -> None:
        self._policies[policy.name] = policy

    def get(self, name: str) -> SnapshotPolicy | None:
        return self._policies.get(name)

    def validate(
        self,
        *,
        snapshot: dict[str, Any],
        company_id: str,
        policy_name: str = "default",
    ) -> tuple[bool, str]:
        policy = self.get(policy_name) or SnapshotPolicy("default", 300.0)
        if policy.require_company_match and snapshot.get("company_id") not in (None, company_id):
            return False, "company_mismatch"
        captured = snapshot.get("captured_at") or snapshot.get("created_at")
        if captured is None:
            return True, ""
        from datetime import datetime, timezone

        try:
            ts = datetime.fromisoformat(str(captured).replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - ts).total_seconds()
            if age > policy.max_age_seconds:
                return False, "snapshot_expired"
        except ValueError:
            pass
        return True, ""


def create_default_snapshot_registry() -> SnapshotRegistry:
    registry = SnapshotRegistry()
    registry.register(SnapshotPolicy("default", 300.0))
    registry.register(SnapshotPolicy("strict", 60.0))
    return registry
