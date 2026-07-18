"""Chat ingress helpers — bind trusted principal; never invent production identity."""

from __future__ import annotations

from typing import Any

from ...domain.constitution import (
    DecisionCode,
    InteractionMode,
    OperationClass,
    PolicyContext,
    evaluate_policy,
)
from ...domain.constitution.trusted_identity import (
    principal_from_security,
    try_dev_principal,
)
from ...infrastructure.security.session_context import current_principal
from ...infrastructure.observability.logging import log_event


def resolve_chat_trusted_principal(*, correlation_id: str = ""):
    principal = current_principal()
    if principal is not None:
        return principal_from_security(principal, correlation_id=correlation_id)
    return try_dev_principal(correlation_id=correlation_id)


def enforce_chat_identity_and_mode(
    *,
    orbix_mode: str,
    auth_required: bool,
    requested_tenant_id: str | None,
    requested_company_id: str | None,
    correlation_id: str,
    operation: OperationClass = OperationClass.READ_CONVERSATION,
) -> tuple[Any, Any | None]:
    """
    Returns (trusted_principal_or_None, policy_denial_or_None).
    When auth_required and no principal → denial.
    Body tenant/company are selectors only when principal exists.
    """
    trusted = resolve_chat_trusted_principal(correlation_id=correlation_id)
    if auth_required and trusted is None:
        decision = evaluate_policy(
            PolicyContext(
                mode=orbix_mode,
                operation=operation,
                principal=None,
                requested_tenant_id=requested_tenant_id,
                requested_company_id=requested_company_id,
                correlation_id=correlation_id,
            )
        )
        if not decision.allowed:
            log_event(
                "mai01.policy_denial",
                **decision.to_audit_dict(),
            )
            return None, decision
        # AUTHENTICATION_REQUIRED path
        denial = evaluate_policy(
            PolicyContext(
                mode=InteractionMode.ASK,
                operation=OperationClass.READ_ERP_DATA,
                principal=None,
                correlation_id=correlation_id,
            )
        )
        log_event("mai01.policy_denial", **denial.to_audit_dict())
        return None, denial

    if trusted is not None and (requested_tenant_id or requested_company_id):
        decision = evaluate_policy(
            PolicyContext(
                mode=orbix_mode,
                operation=operation,
                principal=trusted,
                requested_tenant_id=requested_tenant_id,
                requested_company_id=requested_company_id,
                correlation_id=correlation_id,
            )
        )
        if not decision.allowed and decision.decision_code in {
            DecisionCode.TENANT_SCOPE_MISMATCH,
            DecisionCode.COMPANY_SCOPE_MISMATCH,
        }:
            log_event("mai01.policy_denial", **decision.to_audit_dict())
            return trusted, decision
    return trusted, None


def enforce_draft_operation(
    *,
    orbix_mode: str,
    operation: OperationClass,
    requested_tenant_id: str | None = None,
    requested_company_id: str | None = None,
    correlation_id: str = "",
    originated_from_model: bool = False,
    explicit_confirmation: bool = False,
    natural_language_confirmation_only: bool = False,
):
    trusted = resolve_chat_trusted_principal(correlation_id=correlation_id)
    decision = evaluate_policy(
        PolicyContext(
            mode=orbix_mode,
            operation=operation,
            principal=trusted,
            requested_tenant_id=requested_tenant_id,
            requested_company_id=requested_company_id,
            correlation_id=correlation_id,
            originated_from_model=originated_from_model,
            explicit_confirmation=explicit_confirmation,
            natural_language_confirmation_only=natural_language_confirmation_only,
        )
    )
    log_event(
        "mai01.policy_decision",
        **decision.to_audit_dict(),
    )
    return trusted, decision
