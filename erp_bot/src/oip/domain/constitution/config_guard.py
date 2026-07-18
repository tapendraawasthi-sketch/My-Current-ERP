"""Production/development configuration fail-closed guards for MAI-01."""

from __future__ import annotations

import os
from dataclasses import dataclass

from . import DecisionCode

_FORBIDDEN_PROD_TENANTS = frozenset({"tenant-a", "tenant_a", "default"})
_FORBIDDEN_PROD_COMPANIES = frozenset({"company-a", "company_a"})
_FORBIDDEN_PROD_USERS = frozenset({"orbix-user", "orbix_user", "anonymous", "default"})
_INSECURE_SECRETS = frozenset(
    {
        "",
        "dev-insecure-secret-change-me",
        "change-me",
        "secret",
        "test",
    }
)


@dataclass(frozen=True)
class ConfigValidationError(Exception):
    code: str
    message: str
    config_keys: tuple[str, ...]

    def __str__(self) -> str:  # pragma: no cover - dataclass Exception
        return f"{self.code}: {self.message} (keys={','.join(self.config_keys)})"


def is_production_environment(
    *,
    environ: dict[str, str] | None = None,
) -> bool:
    env = environ if environ is not None else os.environ
    node_env = (env.get("NODE_ENV") or "").strip().lower()
    app_env = (env.get("APP_ENV") or env.get("ENVIRONMENT") or "").strip().lower()
    render = (env.get("RENDER") or "").strip().lower() in {"1", "true", "yes"}
    oip_prod = (env.get("OIP_PRODUCTION") or "").strip().lower() in {"1", "true", "yes"}
    return (
        node_env == "production"
        or app_env in {"production", "prod"}
        or render
        or oip_prod
    )


def insecure_dev_identity_allowed(*, environ: dict[str, str] | None = None) -> bool:
    env = environ if environ is not None else os.environ
    if is_production_environment(environ=env):
        return False
    return (env.get("OIP_ALLOW_INSECURE_DEV_IDENTITY") or "").strip().lower() in {
        "1",
        "true",
        "yes",
    }


def validate_production_security_config(
    *,
    environ: dict[str, str] | None = None,
    auth_required: bool | None = None,
    jwt_secret: str | None = None,
    default_tenant_id: str | None = None,
    default_company_id: str | None = None,
) -> None:
    """Raise ConfigValidationError if production would start insecurely."""
    env = environ if environ is not None else os.environ
    if not is_production_environment(environ=env):
        # Dev bypass must never be set in production — already gated above.
        # If somehow NODE_ENV is not production but RENDER claimed — handled by is_production.
        return

    if (env.get("OIP_ALLOW_INSECURE_DEV_IDENTITY") or "").strip().lower() in {
        "1",
        "true",
        "yes",
    }:
        raise ConfigValidationError(
            code=DecisionCode.INSECURE_PRODUCTION_CONFIGURATION.value,
            message="OIP_ALLOW_INSECURE_DEV_IDENTITY cannot be enabled in production",
            config_keys=("OIP_ALLOW_INSECURE_DEV_IDENTITY",),
        )

    auth_flag = auth_required
    if auth_flag is None:
        auth_flag = (env.get("OIP_AUTH_REQUIRED") or "false").strip().lower() == "true"
    if not auth_flag:
        raise ConfigValidationError(
            code=DecisionCode.INSECURE_PRODUCTION_CONFIGURATION.value,
            message="OIP_AUTH_REQUIRED must be true in production",
            config_keys=("OIP_AUTH_REQUIRED",),
        )

    secret = jwt_secret
    if secret is None:
        secret = (
            env.get("OIP_JWT_SECRET")
            or env.get("API_SECRET_KEY")
            or env.get("JWT_SECRET")
            or ""
        )
    if secret.strip().lower() in _INSECURE_SECRETS or len(secret.strip()) < 16:
        raise ConfigValidationError(
            code=DecisionCode.INSECURE_PRODUCTION_CONFIGURATION.value,
            message="Production requires a strong JWT/API secret",
            config_keys=("OIP_JWT_SECRET", "API_SECRET_KEY", "JWT_SECRET"),
        )

    tenant = (
        default_tenant_id
        if default_tenant_id is not None
        else (env.get("OIP_DEFAULT_SERVICE_TENANT_ID") or "")
    )
    if tenant.strip().lower() in _FORBIDDEN_PROD_TENANTS:
        raise ConfigValidationError(
            code=DecisionCode.INSECURE_PRODUCTION_CONFIGURATION.value,
            message="Production forbids default tenant fallback identities",
            config_keys=("OIP_DEFAULT_SERVICE_TENANT_ID",),
        )

    company = (
        default_company_id
        if default_company_id is not None
        else (env.get("OIP_DEFAULT_SERVICE_COMPANY_ID") or "")
    )
    if company.strip().lower() in _FORBIDDEN_PROD_COMPANIES:
        raise ConfigValidationError(
            code=DecisionCode.INSECURE_PRODUCTION_CONFIGURATION.value,
            message="Production forbids default company fallback identities",
            config_keys=("OIP_DEFAULT_SERVICE_COMPANY_ID",),
        )


def is_forbidden_runtime_fallback_identity(
    *,
    tenant_id: str | None = None,
    company_id: str | None = None,
    user_id: str | None = None,
) -> bool:
    if tenant_id and tenant_id.strip().lower() in _FORBIDDEN_PROD_TENANTS:
        return True
    if company_id and company_id.strip().lower() in _FORBIDDEN_PROD_COMPANIES:
        return True
    if user_id and user_id.strip().lower() in _FORBIDDEN_PROD_USERS:
        return True
    return False
