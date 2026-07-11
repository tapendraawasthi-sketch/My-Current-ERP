"""FastAPI security dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config.settings import get_oip_settings
from ..infrastructure.di.container import get_container
from ..infrastructure.observability.correlation import bind_trace, current_trace
from ..infrastructure.security.api_key_service import ApiKeyAuthError
from ..infrastructure.security.jwt_service import JwtAuthError
from ..infrastructure.security.permission_registry import PermissionRegistry
from ..infrastructure.security.principal import SecurityPrincipal
from ..infrastructure.security.rate_limiter import RateLimiter
from ..infrastructure.security.session_context import bind_client_ip, bind_principal, current_principal
from ..shared.exceptions import OipForbiddenError

_bearer = HTTPBearer(auto_error=False)
_EXEMPT_SUFFIXES = ("/health", "/auth/token", "/auth/refresh", "/ops/live", "/ops/ready", "/ops/metrics")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


def _is_exempt(path: str) -> bool:
    return any(path.endswith(suffix) for suffix in _EXEMPT_SUFFIXES)


async def get_optional_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> SecurityPrincipal | None:
    bind_client_ip(_client_ip(request))
    bind_trace(
        request_id=request.headers.get("x-request-id"),
        correlation_id=request.headers.get("x-correlation-id"),
        trace_id=request.headers.get("x-trace-id"),
        parent_span_id=request.headers.get("x-span-id"),
    )
    api_key = request.headers.get("x-api-key") or request.headers.get("x-oip-api-key")
    container = await get_container()
    if api_key:
        try:
            principal = await container.api_key_service.validate_api_key(api_key)
            bind_principal(principal)
            return principal
        except ApiKeyAuthError as exc:
            await container.security_event_service.auth_failure(
                reason=str(exc),
                request_id=str(current_trace().request_id),
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if credentials and credentials.credentials:
        try:
            principal = await container.jwt_service.verify_access_token(credentials.credentials)
            bind_principal(principal)
            return principal
        except JwtAuthError as exc:
            await container.security_event_service.auth_failure(
                reason=str(exc),
                request_id=str(current_trace().request_id),
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return None


async def require_authenticated_principal(
    request: Request,
    principal: Annotated[SecurityPrincipal | None, Depends(get_optional_principal)] = None,
) -> SecurityPrincipal:
    settings = get_oip_settings()
    if _is_exempt(request.url.path):
        return principal  # type: ignore[return-value]
    if not settings.auth_required:
        return principal  # type: ignore[return-value]
    if principal is None:
        container = await get_container()
        await container.security_event_service.auth_failure(reason="authentication_required")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required")
    return principal


def require_permission(permission: str):
    async def _checker(
        request: Request,
        principal: Annotated[SecurityPrincipal | None, Depends(require_authenticated_principal)] = None,
    ) -> SecurityPrincipal | None:
        if _is_exempt(request.url.path):
            return principal
        settings = get_oip_settings()
        if not settings.auth_required:
            return principal
        if principal is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required")
        registry: PermissionRegistry = (await get_container()).permission_registry
        allowed = registry.is_allowed(
            role=principal.role,
            permissions=principal.permissions,
            required=(permission,),
        )
        if not allowed:
            container = await get_container()
            await container.security_event_service.authz_failure(
                permission=permission,
                request_id=str(current_trace().request_id),
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permission_denied")
        return principal

    return _checker


async def enforce_rate_limit(request: Request) -> None:
    if _is_exempt(request.url.path):
        return
    container = await get_container()
    key = current_principal().user_id if current_principal() else _client_ip(request)
    result = container.rate_limiter.check(key)
    if not result.allowed:
        await container.security_event_service.rate_limit_violation(key=key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate_limit_exceeded",
            headers={"Retry-After": str(int(result.retry_after_seconds) + 1)},
        )


async def enforce_tenancy(request: Request) -> None:
    if _is_exempt(request.url.path):
        return
    settings = get_oip_settings()
    if not settings.tenant_enforcement:
        return
    principal = current_principal()
    if principal is None:
        return
    tenant_param = request.query_params.get("tenant_id")
    company_param = request.query_params.get("company_id")
    try:
        if tenant_param:
            from ..infrastructure.security.tenant_guard import assert_tenant_access

            assert_tenant_access(tenant_id=tenant_param, company_id=company_param)
        if company_param and principal.company_id and company_param != principal.company_id:
            raise OipForbiddenError("cross_company_access_denied")
    except OipForbiddenError as exc:
        container = await get_container()
        await container.security_event_service.authz_failure(
            permission="tenant_isolation",
            request_id=str(current_trace().request_id),
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
