"""MAI-01 pure policy matrix tests — fail closed constitution."""

from __future__ import annotations

import pytest

from src.oip.domain.constitution import (
    DecisionCode,
    InteractionMode,
    OperationClass,
    PolicyContext,
    TrustedPrincipal,
    evaluate_policy,
)
from src.oip.domain.constitution.config_guard import (
    ConfigValidationError,
    insecure_dev_identity_allowed,
    validate_production_security_config,
)


def _principal(
    *,
    tenant: str = "t1",
    company: str = "c1",
    roles: tuple[str, ...] = ("accountant",),
    permissions: tuple[str, ...] = (
        "oip:read",
        "oip:action:propose",
        "erp:command:execute",
        "khata:confirm",
        "orbix:draft:mark_posted",
        "sync:events:write",
    ),
) -> TrustedPrincipal:
    return TrustedPrincipal(
        principal_id="u1",
        tenant_id=tenant,
        allowed_company_ids=(company,),
        active_company_id=company,
        roles=roles,
        permissions=permissions,
        authentication_method="jwt",
        identity_type="user",
    )


def _eval(**kwargs):
    return evaluate_policy(PolicyContext(**kwargs))


@pytest.mark.parametrize(
    "operation",
    [
        OperationClass.READ_KNOWLEDGE,
        OperationClass.READ_ERP_DATA,
        OperationClass.RUN_READONLY_CALCULATION,
        OperationClass.CREATE_EPHEMERAL_EXAMPLE,
        OperationClass.READ_PRODUCT_HELP,
    ],
)
def test_ask_read_ops_allowed_when_authenticated_or_ephemeral(operation):
    if operation is OperationClass.CREATE_EPHEMERAL_EXAMPLE:
        d = _eval(mode=InteractionMode.ASK, operation=operation, principal=None)
        assert d.allowed
        return
    if operation is OperationClass.READ_PRODUCT_HELP:
        d = _eval(mode=InteractionMode.ASK, operation=operation, principal=None)
        assert d.allowed
        return
    d = _eval(mode=InteractionMode.ASK, operation=operation, principal=_principal())
    assert d.allowed
    assert d.decision_code is DecisionCode.POLICY_ALLOWED


def test_ask_persistent_draft_denied():
    d = _eval(
        mode=InteractionMode.ASK,
        operation=OperationClass.CREATE_PERSISTED_DRAFT,
        principal=_principal(),
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.MODE_FORBIDS_OPERATION


def test_ask_preview_denied():
    d = _eval(
        mode=InteractionMode.ASK,
        operation=OperationClass.GENERATE_PREVIEW,
        principal=_principal(),
    )
    assert not d.allowed


def test_ask_execute_denied():
    d = _eval(
        mode=InteractionMode.ASK,
        operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
        principal=_principal(),
        explicit_confirmation=True,
    )
    assert not d.allowed


def test_ask_mark_posted_denied():
    d = _eval(
        mode=InteractionMode.ASK,
        operation=OperationClass.MARK_POSTED,
        principal=_principal(),
    )
    assert not d.allowed


def test_ask_mutation_tool_denied():
    d = _eval(
        mode=InteractionMode.ASK,
        operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
        principal=_principal(),
        originated_from_model=True,
    )
    assert not d.allowed
    assert d.decision_code in {
        DecisionCode.MODE_FORBIDS_OPERATION,
        DecisionCode.MODEL_ORIGINATED_MUTATION_DENIED,
    }


def test_accountant_unauthenticated_draft_denied():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.CREATE_PERSISTED_DRAFT,
        principal=None,
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.AUTHENTICATION_REQUIRED


def test_accountant_unauthorized_draft_denied():
    p = _principal(permissions=("oip:read",), roles=("read_only",))
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.CREATE_PERSISTED_DRAFT,
        principal=p,
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.AUTHORIZATION_REQUIRED


def test_accountant_create_draft_allowed():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.CREATE_PERSISTED_DRAFT,
        principal=_principal(),
        requested_tenant_id="t1",
        requested_company_id="c1",
    )
    assert d.allowed


def test_accountant_preview_allowed():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.GENERATE_PREVIEW,
        principal=_principal(),
    )
    assert d.allowed


def test_accountant_execute_without_confirmation_denied():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
        principal=_principal(),
        explicit_confirmation=False,
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.EXPLICIT_CONFIRMATION_REQUIRED


def test_accountant_nl_yes_only_denied():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
        principal=_principal(),
        explicit_confirmation=False,
        natural_language_confirmation_only=True,
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.NATURAL_LANGUAGE_CONFIRMATION_DENIED


def test_accountant_explicit_confirmation_may_allow():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.EXECUTE_CONFIRMED_COMMAND,
        principal=_principal(),
        explicit_confirmation=True,
    )
    assert d.allowed


def test_cross_tenant_denied():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.READ_ERP_DATA,
        principal=_principal(tenant="t1"),
        requested_tenant_id="t2",
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.TENANT_SCOPE_MISMATCH


def test_cross_company_denied():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.CREATE_PERSISTED_DRAFT,
        principal=_principal(company="c1"),
        requested_company_id="c2",
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.COMPANY_SCOPE_MISMATCH


def test_unknown_mode_denied():
    d = _eval(mode="wizard", operation=OperationClass.READ_CONVERSATION, principal=None)
    assert not d.allowed
    assert d.decision_code is DecisionCode.UNKNOWN_MODE_DENIED


def test_unknown_operation_denied():
    d = _eval(
        mode=InteractionMode.ASK,
        operation="INVENT_SOMETHING",
        principal=_principal(),
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.UNKNOWN_OPERATION_DENIED


def test_model_originated_mutation_denied():
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.CREATE_PERSISTED_DRAFT,
        principal=_principal(),
        originated_from_model=True,
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.MODEL_ORIGINATED_MUTATION_DENIED


def test_admin_without_permission_denied():
    p = _principal(roles=("accountant",), permissions=("oip:read", "oip:action:propose"))
    d = _eval(
        mode=InteractionMode.ACCOUNTANT,
        operation=OperationClass.MANAGE_SECURITY,
        principal=p,
    )
    assert not d.allowed
    assert d.decision_code is DecisionCode.AUTHORIZATION_REQUIRED


def test_production_rejects_auth_required_false():
    with pytest.raises(ConfigValidationError) as exc:
        validate_production_security_config(
            environ={"RENDER": "true", "OIP_AUTH_REQUIRED": "false", "OIP_JWT_SECRET": "x" * 32},
        )
    assert "OIP_AUTH_REQUIRED" in exc.value.config_keys


def test_production_rejects_tenant_a_default():
    with pytest.raises(ConfigValidationError) as exc:
        validate_production_security_config(
            environ={
                "NODE_ENV": "production",
                "OIP_AUTH_REQUIRED": "true",
                "OIP_JWT_SECRET": "x" * 32,
                "OIP_DEFAULT_SERVICE_TENANT_ID": "tenant-a",
            },
        )
    assert "OIP_DEFAULT_SERVICE_TENANT_ID" in exc.value.config_keys


def test_production_rejects_insecure_dev_flag():
    with pytest.raises(ConfigValidationError):
        validate_production_security_config(
            environ={
                "NODE_ENV": "production",
                "OIP_AUTH_REQUIRED": "true",
                "OIP_JWT_SECRET": "x" * 32,
                "OIP_ALLOW_INSECURE_DEV_IDENTITY": "true",
            },
        )


def test_dev_insecure_flag_blocked_in_production_helper():
    assert not insecure_dev_identity_allowed(environ={"RENDER": "true", "OIP_ALLOW_INSECURE_DEV_IDENTITY": "true"})


def test_dev_insecure_allowed_only_non_prod():
    assert insecure_dev_identity_allowed(
        environ={"OIP_ALLOW_INSECURE_DEV_IDENTITY": "true", "NODE_ENV": "development"}
    )
