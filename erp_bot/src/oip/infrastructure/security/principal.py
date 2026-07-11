"""Authenticated security principal."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class AuthMethod(str, Enum):
    JWT = "jwt"
    API_KEY = "api_key"
    SERVICE_ACCOUNT = "service_account"


@dataclass(frozen=True)
class SecurityPrincipal:
    user_id: str
    tenant_id: str
    company_id: str
    branch_id: str | None
    role: str
    permissions: tuple[str, ...]
    session_id: str
    auth_method: AuthMethod
    username: str = ""
    service_account_id: str | None = None
    roles: tuple[str, ...] = field(default_factory=tuple)

    def has_permission(self, permission: str) -> bool:
        if permission in self.permissions:
            return True
        prefix = permission.split(":")[0]
        return f"{prefix}:*" in self.permissions or "oip:*" in self.permissions or "erp:*" in self.permissions

    def has_any_permission(self, required: tuple[str, ...]) -> bool:
        if not required:
            return True
        return any(self.has_permission(item) for item in required)
