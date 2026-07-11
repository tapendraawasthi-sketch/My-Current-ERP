"""Tenant and company isolation guards."""

from __future__ import annotations

from ...shared.exceptions import OipForbiddenError
from .session_context import current_principal


def assert_tenant_access(*, tenant_id: str, company_id: str | None = None) -> None:
    principal = current_principal()
    if principal is None:
        return
    if not tenant_id:
        raise OipForbiddenError("tenant_id_required")
    if principal.tenant_id != tenant_id:
        raise OipForbiddenError("cross_tenant_access_denied")
    if company_id and principal.company_id and principal.company_id != company_id:
        raise OipForbiddenError("cross_company_access_denied")


def resolve_tenant_id(requested: str | None) -> str:
    principal = current_principal()
    if principal is not None:
        if requested and requested != principal.tenant_id:
            raise OipForbiddenError("cross_tenant_access_denied")
        return principal.tenant_id
    if not requested:
        raise OipForbiddenError("tenant_id_required")
    return requested


def resolve_company_id(requested: str | None) -> str:
    principal = current_principal()
    if principal is not None:
        if requested and principal.company_id and requested != principal.company_id:
            raise OipForbiddenError("cross_company_access_denied")
        return requested or principal.company_id
    if not requested:
        raise OipForbiddenError("company_id_required")
    return requested


def resolve_user_id(requested: str | None) -> str:
    principal = current_principal()
    if principal is not None:
        return principal.user_id
    if not requested:
        raise OipForbiddenError("user_id_required")
    return requested
