"""Data retention policies for NIOS platform."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class RetentionPolicy:
    domain: str
    retain_days: int
    archive_after_days: int | None = None
    delete_after_days: int | None = None


DEFAULT_POLICIES: list[RetentionPolicy] = [
    RetentionPolicy("governance_audit", retain_days=2555, archive_after_days=365, delete_after_days=2555),
    RetentionPolicy("chat_episodes", retain_days=365, archive_after_days=90),
    RetentionPolicy("world_state_history", retain_days=730, archive_after_days=180),
    RetentionPolicy("kg_observations", retain_days=365),
    RetentionPolicy("benchmark_results", retain_days=90),
    RetentionPolicy("ocr_extractions", retain_days=180),
]


class RetentionEngine:
    def __init__(self) -> None:
        self.policies = {p.domain: p for p in DEFAULT_POLICIES}

    def get_policy(self, domain: str) -> RetentionPolicy | None:
        return self.policies.get(domain)

    def cutoff_date(self, domain: str) -> str | None:
        policy = self.get_policy(domain)
        if not policy:
            return None
        cutoff = datetime.now(timezone.utc) - timedelta(days=policy.retain_days)
        return cutoff.isoformat()

    def should_archive(self, domain: str, created_at: str) -> bool:
        policy = self.get_policy(domain)
        if not policy or not policy.archive_after_days:
            return False
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            return False
        age = datetime.now(timezone.utc) - created
        return age.days >= policy.archive_after_days

    def list_policies(self) -> list[dict]:
        return [
            {
                "domain": p.domain,
                "retain_days": p.retain_days,
                "archive_after_days": p.archive_after_days,
                "delete_after_days": p.delete_after_days,
            }
            for p in self.policies.values()
        ]


retention_engine = RetentionEngine()
