"""MAI-01 orchestrator/tool/policy denial regression tests."""

from __future__ import annotations

from src.oip.domain.constitution import (
    DecisionCode,
    InteractionMode,
    OperationClass,
    PolicyContext,
    TrustedPrincipal,
    evaluate_policy,
    operation_from_tool_name,
)
from src.orbix.mode_policy import is_tool_allowed


def test_ask_mode_cannot_call_mutation_tool():
    assert not is_tool_allowed("ask", "post_purchase", can_post=True)
    assert not is_tool_allowed("ask", "erp.journal.post", can_post=True)
    op = operation_from_tool_name("post_purchase")
    d = evaluate_policy(
        PolicyContext(
            mode=InteractionMode.ASK,
            operation=op,
            principal=TrustedPrincipal(
                principal_id="u",
                tenant_id="t",
                allowed_company_ids=("c",),
                active_company_id="c",
                roles=("accountant",),
                permissions=("erp:command:execute",),
                authentication_method="jwt",
                identity_type="user",
            ),
            originated_from_model=True,
        )
    )
    assert not d.allowed


def test_model_cannot_set_execution_by_itself():
    d = evaluate_policy(
        PolicyContext(
            mode=InteractionMode.ACCOUNTANT,
            operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
            principal=TrustedPrincipal(
                principal_id="u",
                tenant_id="t",
                allowed_company_ids=("c",),
                active_company_id="c",
                roles=("accountant",),
                permissions=("erp:command:execute",),
                authentication_method="jwt",
                identity_type="user",
            ),
            originated_from_model=True,
            explicit_confirmation=True,
        )
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.MODEL_ORIGINATED_MUTATION_DENIED


def test_planner_cannot_override_policy_denial():
    # Planner proposing execute without confirmation remains denied.
    d = evaluate_policy(
        PolicyContext(
            mode=InteractionMode.ACCOUNTANT,
            operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
            principal=TrustedPrincipal(
                principal_id="u",
                tenant_id="t",
                allowed_company_ids=("c",),
                active_company_id="c",
                roles=("accountant",),
                permissions=("erp:command:execute",),
                authentication_method="jwt",
                identity_type="user",
            ),
            explicit_confirmation=False,
        )
    )
    assert d.decision_code is DecisionCode.EXPLICIT_CONFIRMATION_REQUIRED


def test_body_tenant_cannot_replace_trusted_scope():
    d = evaluate_policy(
        PolicyContext(
            mode=InteractionMode.ASK,
            operation=OperationClass.READ_ERP_DATA,
            principal=TrustedPrincipal(
                principal_id="u",
                tenant_id="tenant-real",
                allowed_company_ids=("c1",),
                active_company_id="c1",
                roles=("accountant",),
                permissions=("oip:read",),
                authentication_method="jwt",
                identity_type="user",
            ),
            requested_tenant_id="tenant-spoof",
        )
    )
    assert d.decision_code is DecisionCode.TENANT_SCOPE_MISMATCH
