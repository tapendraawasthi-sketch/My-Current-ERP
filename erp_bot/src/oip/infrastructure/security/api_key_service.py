"""API key and service account authentication."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

from ...config.settings import OipSettings
from ..persistence.security_sqlite import SqliteSecurityRepository
from .permission_registry import PermissionRegistry, create_default_permission_registry
from .principal import AuthMethod, SecurityPrincipal
from .secret_provider import SecretProvider


class ApiKeyAuthError(Exception):
    pass


class ApiKeyService:
    def __init__(
        self,
        settings: OipSettings,
        repository: SqliteSecurityRepository,
        permission_registry: PermissionRegistry | None = None,
        secret_provider: SecretProvider | None = None,
    ) -> None:
        self._settings = settings
        self._repository = repository
        self._permissions = permission_registry or create_default_permission_registry()
        self._provider = secret_provider or SecretProvider()

    @staticmethod
    def hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode()).hexdigest()

    async def validate_api_key(self, raw_key: str) -> SecurityPrincipal:
        if not raw_key:
            raise ApiKeyAuthError("api_key_missing")
        key_hash = self.hash_key(raw_key)
        row = await self._repository.get_api_key_by_hash(key_hash)
        if row is None:
            env_match = self._validate_env_key(raw_key)
            if env_match is not None:
                return env_match
            raise ApiKeyAuthError("api_key_invalid")
        expires_at = row.get("expires_at")
        if expires_at:
            expiry = datetime.fromisoformat(expires_at)
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry < datetime.now(timezone.utc):
                raise ApiKeyAuthError("api_key_expired")
        extra = tuple(json.loads(row["permissions_json"]))
        role = str(row["role"])
        permissions = self._permissions.resolve_permissions(role=role, extra=extra)
        return SecurityPrincipal(
            user_id=f"service:{row['key_id']}",
            tenant_id=str(row["tenant_id"]),
            company_id=str(row.get("company_id") or ""),
            branch_id=None,
            role=role,
            permissions=permissions,
            session_id=str(row["key_id"]),
            auth_method=AuthMethod.SERVICE_ACCOUNT,
            username=str(row["name"]),
            service_account_id=str(row["key_id"]),
            roles=(role,),
        )

    def _validate_env_key(self, raw_key: str) -> SecurityPrincipal | None:
        raw_map = self._provider.get_json("OIP_API_KEYS")
        if not raw_map:
            csv = self._provider.get("OIP_API_KEYS", "")
            if not csv:
                return None
            raw_map = {item.strip(): "service_account" for item in csv.split(",") if item.strip()}
        for configured_key, role in raw_map.items():
            if configured_key == raw_key:
                role_name = role if isinstance(role, str) else "service_account"
                permissions = self._permissions.resolve_permissions(role=role_name)
                return SecurityPrincipal(
                    user_id="service:env",
                    tenant_id=self._settings.default_service_tenant_id,
                    company_id=self._settings.default_service_company_id,
                    branch_id=None,
                    role=role_name,
                    permissions=permissions,
                    session_id=str(uuid.uuid4()),
                    auth_method=AuthMethod.API_KEY,
                    username="env-service-account",
                    service_account_id="env",
                    roles=(role_name,),
                )
        return None

    async def create_api_key(
        self,
        *,
        tenant_id: str,
        company_id: str | None,
        name: str,
        role: str,
        permissions: tuple[str, ...] = (),
        expires_at: datetime | None = None,
    ) -> tuple[str, str]:
        raw_key = f"oip_{uuid.uuid4().hex}"
        key_id = str(uuid.uuid4())
        await self._repository.save_api_key(
            key_id=key_id,
            tenant_id=tenant_id,
            company_id=company_id,
            name=name,
            key_hash=self.hash_key(raw_key),
            role=role,
            permissions=permissions,
            expires_at=expires_at,
        )
        return key_id, raw_key
