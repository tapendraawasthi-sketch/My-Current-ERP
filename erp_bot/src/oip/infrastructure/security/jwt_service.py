"""JWT authentication — aligned with Sutra backend token shape."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from ...config.settings import OipSettings
from ..persistence.security_sqlite import SqliteSecurityRepository
from .permission_registry import PermissionRegistry, create_default_permission_registry
from .principal import AuthMethod, SecurityPrincipal
from .secret_provider import SecretProvider


class JwtAuthError(Exception):
    pass


class JwtService:
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
        provider = secret_provider or SecretProvider()
        self._secret = (
            settings.jwt_secret
            or provider.get("OIP_JWT_SECRET")
            or provider.get("API_SECRET_KEY")
            or provider.get("JWT_SECRET")
            or "dev-insecure-secret-change-me"
        )
        self._issuer = settings.jwt_issuer
        self._audience = settings.jwt_audience

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def issue_access_token(
        self,
        *,
        user_id: str,
        tenant_id: str,
        company_id: str,
        role: str,
        session_id: str,
        username: str = "",
        branch_id: str | None = None,
        extra_permissions: tuple[str, ...] = (),
    ) -> str:
        jti = str(uuid.uuid4())
        payload = {
            "sub": user_id,
            "tenantId": tenant_id,
            "companyId": company_id,
            "branchId": branch_id,
            "username": username or user_id,
            "role": role,
            "sessionId": session_id,
            "jti": jti,
            "type": "access",
            "iss": self._issuer,
            "aud": self._audience,
            "iat": self._now(),
            "exp": self._now() + timedelta(minutes=self._settings.jwt_access_ttl_minutes),
        }
        return jwt.encode(payload, self._secret, algorithm="HS256")

    async def issue_refresh_token(
        self,
        *,
        user_id: str,
        tenant_id: str,
        company_id: str,
        role: str,
        session_id: str,
        username: str = "",
    ) -> str:
        token_id = str(uuid.uuid4())
        expires = self._now() + timedelta(days=self._settings.jwt_refresh_ttl_days)
        await self._repository.store_refresh_token(
            token_id=token_id,
            tenant_id=tenant_id,
            user_id=user_id,
            company_id=company_id,
            role=role,
            session_id=session_id,
            expires_at=expires,
        )
        payload = {
            "sub": user_id,
            "tenantId": tenant_id,
            "companyId": company_id,
            "username": username or user_id,
            "role": role,
            "sessionId": session_id,
            "tokenId": token_id,
            "type": "refresh",
            "iss": self._issuer,
            "aud": self._audience,
            "iat": self._now(),
            "exp": expires,
        }
        return jwt.encode(payload, self._secret, algorithm="HS256")

    async def verify_access_token(self, token: str) -> SecurityPrincipal:
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                audience=self._audience,
                issuer=self._issuer,
                options={"require": ["exp", "sub", "tenantId"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise JwtAuthError("token_expired") from exc
        except jwt.InvalidTokenError as exc:
            raise JwtAuthError("token_invalid") from exc
        if payload.get("type") == "refresh":
            raise JwtAuthError("refresh_token_not_allowed")
        jti = payload.get("jti", "")
        if jti and await self._repository.is_revoked(jti=jti):
            raise JwtAuthError("token_revoked")
        role = str(payload.get("role", "read_only"))
        permissions = self._permissions.resolve_permissions(role=role)
        return SecurityPrincipal(
            user_id=str(payload["sub"]),
            tenant_id=str(payload["tenantId"]),
            company_id=str(payload.get("companyId") or ""),
            branch_id=payload.get("branchId"),
            role=role,
            permissions=permissions,
            session_id=str(payload.get("sessionId") or ""),
            auth_method=AuthMethod.JWT,
            username=str(payload.get("username") or payload["sub"]),
            roles=(role,),
        )

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, str]:
        try:
            payload = jwt.decode(
                refresh_token,
                self._secret,
                algorithms=["HS256"],
                audience=self._audience,
                issuer=self._issuer,
            )
        except jwt.InvalidTokenError as exc:
            raise JwtAuthError("refresh_token_invalid") from exc
        if payload.get("type") != "refresh":
            raise JwtAuthError("not_a_refresh_token")
        token_id = str(payload.get("tokenId", ""))
        stored = await self._repository.get_refresh_token(token_id)
        if stored is None:
            raise JwtAuthError("refresh_token_revoked")
        access = self.issue_access_token(
            user_id=str(payload["sub"]),
            tenant_id=str(payload["tenantId"]),
            company_id=str(payload.get("companyId") or ""),
            role=str(payload.get("role", "read_only")),
            session_id=str(payload.get("sessionId") or ""),
            username=str(payload.get("username") or payload["sub"]),
        )
        new_refresh = await self.issue_refresh_token(
            user_id=str(payload["sub"]),
            tenant_id=str(payload["tenantId"]),
            company_id=str(payload.get("companyId") or ""),
            role=str(payload.get("role", "read_only")),
            session_id=str(payload.get("sessionId") or ""),
            username=str(payload.get("username") or payload["sub"]),
        )
        await self._repository.revoke_refresh_token(token_id)
        return access, new_refresh

    async def revoke_access_token(self, token: str, *, reason: str = "") -> None:
        payload = jwt.decode(
            token,
            self._secret,
            algorithms=["HS256"],
            options={"verify_exp": False, "verify_aud": False, "verify_iss": False},
        )
        jti = str(payload.get("jti", ""))
        if not jti:
            return
        await self._repository.revoke_token(
            jti=jti,
            tenant_id=str(payload.get("tenantId", "")),
            user_id=str(payload.get("sub", "")),
            reason=reason,
        )

    @staticmethod
    def decode_unverified(token: str, secret: str) -> dict[str, Any]:
        return jwt.decode(token, secret, algorithms=["HS256"], options={"verify_signature": False})
