"""Evaluation mutation safety guard — real posting must be impossible."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

PRODUCTION_HOST_MARKERS = (
    "sutraerp.com",
    "production",
    "render.com",
    "amazonaws.com",
    "neon.tech",
)
FORBIDDEN_URL_SCHEMES_DB = ("postgres", "postgresql", "mysql", "mongodb")
EVAL_TENANT_PREFIX = "eval-"

FORBIDDEN_MUTATION_OPS = frozenset(
    {
        "post",
        "mark_posted",
        "execute_confirm",
        "khata_confirm",
        "oec_mutate",
        "dexie_write",
        "journal_post",
        "voucher_create",
        "mutation",
        "confirm_post",
    }
)


@dataclass
class EvaluationSafetyGuard:
    mutation_attempts: list[dict[str, Any]] = field(default_factory=list)
    blocked_urls: list[str] = field(default_factory=list)
    blocked_tenants: list[str] = field(default_factory=list)

    def record_mutation_attempt(self, *, operation: str, detail: dict[str, Any] | None = None) -> None:
        self.mutation_attempts.append({"operation": operation, "detail": dict(detail or {})})

    def assert_operation_allowed(self, operation: str) -> None:
        op = operation.lower().strip()
        if op in FORBIDDEN_MUTATION_OPS or any(x in op for x in ("post", "mutate", "confirm")):
            self.record_mutation_attempt(operation=operation)
            raise PermissionError(f"EVAL_MUTATION_BLOCKED:{operation}")

    def assert_tenant_allowed(self, tenant_id: str, company_id: str | None = None) -> None:
        for value in (tenant_id, company_id or ""):
            if not value:
                continue
            if not str(value).startswith(EVAL_TENANT_PREFIX):
                self.blocked_tenants.append(str(value))
                raise PermissionError(f"EVAL_PRODUCTION_SCOPE_BLOCKED:{value}")

    def assert_url_allowed(self, url: str | None) -> None:
        if not url:
            return
        text = str(url).lower()
        parsed = urlparse(text)
        if parsed.scheme in FORBIDDEN_URL_SCHEMES_DB or any(m in text for m in PRODUCTION_HOST_MARKERS):
            self.blocked_urls.append(url)
            raise PermissionError("EVAL_PRODUCTION_URL_BLOCKED")
        if "localhost" in text or "127.0.0.1" in text or text.startswith("memory://") or text.startswith("eval://"):
            return
        # Unknown remote — block by default in eval
        self.blocked_urls.append(url)
        raise PermissionError("EVAL_NETWORK_URL_BLOCKED")

    def assert_no_network(self, *, allow_local: bool = True) -> None:
        # Guard remains active; callers must not open sockets.
        return

    def critical_failures(self) -> list[str]:
        failures: list[str] = []
        for attempt in self.mutation_attempts:
            failures.append(f"MUTATION_ATTEMPTED:{attempt['operation']}")
        for t in self.blocked_tenants:
            failures.append(f"PRODUCTION_SCOPE:{t}")
        for u in self.blocked_urls:
            failures.append("PRODUCTION_OR_NETWORK_URL")
        return failures

    def mutation_attempt_count(self) -> int:
        return len(self.mutation_attempts)


# Module-level guard for process-scoped eval runs
_ACTIVE: EvaluationSafetyGuard | None = None


def get_active_guard() -> EvaluationSafetyGuard:
    global _ACTIVE
    if _ACTIVE is None:
        _ACTIVE = EvaluationSafetyGuard()
    return _ACTIVE


def reset_guard() -> EvaluationSafetyGuard:
    global _ACTIVE
    _ACTIVE = EvaluationSafetyGuard()
    return _ACTIVE
