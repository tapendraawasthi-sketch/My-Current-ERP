"""Build TrustedPrincipal from verified SecurityPrincipal / JWT — never from body."""

from __future__ import annotations

from typing import Any

from ...infrastructure.security.principal import SecurityPrincipal
from . import TrustedPrincipal
from .config_guard import insecure_dev_identity_allowed, is_forbidden_runtime_fallback_identity


def principal_from_security(
    principal: SecurityPrincipal,
    *,
    correlation_id: str = "",
    allowed_company_ids: tuple[str, ...] | None = None,
) -> TrustedPrincipal:
    companies: list[str] = []
    if principal.company_id:
        companies.append(principal.company_id)
    if allowed_company_ids:
        for cid in allowed_company_ids:
            if cid and cid not in companies:
                companies.append(cid)
    return TrustedPrincipal(
        principal_id=principal.user_id,
        tenant_id=principal.tenant_id,
        allowed_company_ids=tuple(companies),
        active_company_id=principal.company_id or None,
        roles=principal.roles or (principal.role,),
        permissions=principal.permissions,
        authentication_method=principal.auth_method.value
        if hasattr(principal.auth_method, "value")
        else str(principal.auth_method),
        identity_type="service" if principal.service_account_id else "user",
        is_test_identity=False,
        correlation_id=correlation_id,
    )


def try_dev_principal(
    *,
    correlation_id: str = "",
    role: str = "accountant",
    permissions: tuple[str, ...] = (),
) -> TrustedPrincipal | None:
    """Explicit non-production test/dev identity. Never available in production."""
    if not insecure_dev_identity_allowed():
        return None
    return TrustedPrincipal(
        principal_id="dev-test-user",
        tenant_id="dev-tenant",
        allowed_company_ids=("dev-company",),
        active_company_id="dev-company",
        roles=(role,),
        permissions=permissions
        or (
            "oip:read",
            "oip:action:propose",
            "erp:command:execute",
            "khata:confirm",
            "orbix:draft:mark_posted",
            "sync:events:write",
        ),
        authentication_method="dev_insecure",
        identity_type="test",
        is_test_identity=True,
        correlation_id=correlation_id,
    )


def reject_body_established_identity(
    *,
    body_tenant_id: str | None,
    body_company_id: str | None,
    body_user_id: str | None,
    trusted: TrustedPrincipal | None,
) -> tuple[str | None, str | None, str | None]:
    """
    Body fields are resource selectors only.
    Returns (tenant, company, user) from trusted principal when present.
    """
    if trusted is None:
        return None, None, None
    tenant = trusted.tenant_id
    company = trusted.active_company_id
    user = trusted.principal_id
    # Resource selectors must match trusted scope (validated by evaluate_policy).
    _ = body_tenant_id, body_company_id, body_user_id
    return tenant, company, user


def assert_no_forbidden_fallback(**kwargs: Any) -> None:
    if is_forbidden_runtime_fallback_identity(**kwargs):
        raise PermissionError("INSECURE_PRODUCTION_CONFIGURATION")
