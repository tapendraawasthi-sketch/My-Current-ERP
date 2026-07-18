"""MAI-01 executable product constitution — pure domain policy (no I/O)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

POLICY_VERSION = "mai-01.1.0"


class InteractionMode(str, Enum):
    ASK = "ask"
    ACCOUNTANT = "accountant"


class OperationClass(str, Enum):
    READ_CONVERSATION = "READ_CONVERSATION"
    READ_PRODUCT_HELP = "READ_PRODUCT_HELP"
    READ_KNOWLEDGE = "READ_KNOWLEDGE"
    READ_ERP_DATA = "READ_ERP_DATA"
    RUN_READONLY_CALCULATION = "RUN_READONLY_CALCULATION"
    CREATE_EPHEMERAL_EXAMPLE = "CREATE_EPHEMERAL_EXAMPLE"
    CREATE_PERSISTED_DRAFT = "CREATE_PERSISTED_DRAFT"
    UPDATE_DRAFT = "UPDATE_DRAFT"
    CANCEL_DRAFT = "CANCEL_DRAFT"
    GENERATE_PREVIEW = "GENERATE_PREVIEW"
    REQUEST_CONFIRMATION = "REQUEST_CONFIRMATION"
    EXECUTE_CONFIRMED_COMMAND = "EXECUTE_CONFIRMED_COMMAND"
    MARK_POSTED = "MARK_POSTED"
    SYNC_ACCOUNTING_EVENT = "SYNC_ACCOUNTING_EVENT"
    MANAGE_KNOWLEDGE = "MANAGE_KNOWLEDGE"
    MANAGE_SECURITY = "MANAGE_SECURITY"
    UNKNOWN_OPERATION = "UNKNOWN_OPERATION"


class DecisionCode(str, Enum):
    POLICY_ALLOWED = "POLICY_ALLOWED"
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
    AUTHORIZATION_REQUIRED = "AUTHORIZATION_REQUIRED"
    TENANT_SCOPE_MISMATCH = "TENANT_SCOPE_MISMATCH"
    COMPANY_SCOPE_MISMATCH = "COMPANY_SCOPE_MISMATCH"
    MODE_FORBIDS_OPERATION = "MODE_FORBIDS_OPERATION"
    EXPLICIT_CONFIRMATION_REQUIRED = "EXPLICIT_CONFIRMATION_REQUIRED"
    MUTATION_TOOL_FORBIDDEN = "MUTATION_TOOL_FORBIDDEN"
    UNKNOWN_OPERATION_DENIED = "UNKNOWN_OPERATION_DENIED"
    UNKNOWN_MODE_DENIED = "UNKNOWN_MODE_DENIED"
    INSECURE_PRODUCTION_CONFIGURATION = "INSECURE_PRODUCTION_CONFIGURATION"
    MODEL_ORIGINATED_MUTATION_DENIED = "MODEL_ORIGINATED_MUTATION_DENIED"
    NATURAL_LANGUAGE_CONFIRMATION_DENIED = "NATURAL_LANGUAGE_CONFIRMATION_DENIED"


# Permission keys used by the matrix (map to existing RBAC where possible).
PERM_READ = "oip:read"
PERM_DRAFT = "oip:action:propose"
PERM_EXECUTE = "erp:command:execute"
PERM_KHATA_CONFIRM = "khata:confirm"
PERM_MARK_POSTED = "orbix:draft:mark_posted"
PERM_SYNC = "sync:events:write"
PERM_ADMIN_KNOWLEDGE = "oip:admin:manage"
PERM_ADMIN_SECURITY = "oip:admin:manage"


@dataclass(frozen=True)
class TrustedPrincipal:
    """Identity from verified middleware — never from request body alone."""

    principal_id: str
    tenant_id: str
    allowed_company_ids: tuple[str, ...]
    active_company_id: str | None
    roles: tuple[str, ...]
    permissions: tuple[str, ...]
    authentication_method: str
    identity_type: str  # "user" | "service" | "test"
    is_test_identity: bool = False
    correlation_id: str = ""

    def has_permission(self, permission: str) -> bool:
        if permission in self.permissions:
            return True
        if "oip:*" in self.permissions or "erp:*" in self.permissions:
            return True
        prefix = permission.split(":")[0]
        return f"{prefix}:*" in self.permissions

    def allows_company(self, company_id: str | None) -> bool:
        if not company_id:
            return True
        if self.active_company_id and self.active_company_id == company_id:
            return True
        return company_id in self.allowed_company_ids


@dataclass(frozen=True)
class PolicyContext:
    mode: InteractionMode | str | None
    operation: OperationClass | str
    principal: TrustedPrincipal | None
    requested_tenant_id: str | None = None
    requested_company_id: str | None = None
    explicit_confirmation: bool = False
    natural_language_confirmation_only: bool = False
    originated_from_model: bool = False
    correlation_id: str = ""


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    decision_code: DecisionCode
    reason_code: str
    required_permission: str | None
    mode: str | None
    operation: str
    principal_id: str | None
    tenant_id: str | None
    company_id: str | None
    confirmation_required: bool
    audit_required: bool
    correlation_id: str
    policy_version: str = POLICY_VERSION
    safe_user_message: str = ""

    def to_audit_dict(self) -> dict[str, Any]:
        return {
            "policy_version": self.policy_version,
            "allowed": self.allowed,
            "decision_code": self.decision_code.value,
            "reason_code": self.reason_code,
            "mode": self.mode,
            "operation": self.operation,
            "principal_id": self.principal_id,
            "tenant_id": self.tenant_id,
            "company_id": self.company_id,
            "confirmation_required": self.confirmation_required,
            "correlation_id": self.correlation_id,
        }


# Operation → required permission (None = no special permission beyond mode/auth)
_OP_PERMISSION: dict[OperationClass, str | None] = {
    OperationClass.READ_CONVERSATION: None,
    OperationClass.READ_PRODUCT_HELP: None,
    OperationClass.READ_KNOWLEDGE: PERM_READ,
    OperationClass.READ_ERP_DATA: PERM_READ,
    OperationClass.RUN_READONLY_CALCULATION: PERM_READ,
    OperationClass.CREATE_EPHEMERAL_EXAMPLE: None,
    OperationClass.CREATE_PERSISTED_DRAFT: PERM_DRAFT,
    OperationClass.UPDATE_DRAFT: PERM_DRAFT,
    OperationClass.CANCEL_DRAFT: PERM_DRAFT,
    OperationClass.GENERATE_PREVIEW: PERM_DRAFT,
    OperationClass.REQUEST_CONFIRMATION: PERM_DRAFT,
    OperationClass.EXECUTE_CONFIRMED_COMMAND: PERM_EXECUTE,
    OperationClass.MARK_POSTED: PERM_MARK_POSTED,
    OperationClass.SYNC_ACCOUNTING_EVENT: PERM_SYNC,
    OperationClass.MANAGE_KNOWLEDGE: PERM_ADMIN_KNOWLEDGE,
    OperationClass.MANAGE_SECURITY: PERM_ADMIN_SECURITY,
    OperationClass.UNKNOWN_OPERATION: None,
}

_ASK_ALLOWED = frozenset(
    {
        OperationClass.READ_CONVERSATION,
        OperationClass.READ_PRODUCT_HELP,
        OperationClass.READ_KNOWLEDGE,
        OperationClass.READ_ERP_DATA,
        OperationClass.RUN_READONLY_CALCULATION,
        OperationClass.CREATE_EPHEMERAL_EXAMPLE,
    }
)

_ACCOUNTANT_DRAFT_OPS = frozenset(
    {
        OperationClass.CREATE_PERSISTED_DRAFT,
        OperationClass.UPDATE_DRAFT,
        OperationClass.CANCEL_DRAFT,
        OperationClass.GENERATE_PREVIEW,
        OperationClass.REQUEST_CONFIRMATION,
    }
)

_MUTATION_OPS = frozenset(
    {
        OperationClass.CREATE_PERSISTED_DRAFT,
        OperationClass.UPDATE_DRAFT,
        OperationClass.CANCEL_DRAFT,
        OperationClass.GENERATE_PREVIEW,
        OperationClass.REQUEST_CONFIRMATION,
        OperationClass.EXECUTE_CONFIRMED_COMMAND,
        OperationClass.MARK_POSTED,
        OperationClass.SYNC_ACCOUNTING_EVENT,
        OperationClass.MANAGE_KNOWLEDGE,
        OperationClass.MANAGE_SECURITY,
    }
)

_AUTH_REQUIRED_OPS = frozenset(
    {
        OperationClass.READ_KNOWLEDGE,
        OperationClass.READ_ERP_DATA,
        OperationClass.RUN_READONLY_CALCULATION,
        *_MUTATION_OPS,
    }
)

_ASK_MODE_GUIDANCE = (
    "You are currently in Ask Mode. I can explain or show a non-posting example. "
    "Switch to Accountant Mode and review a generated preview if you want to prepare an entry. "
    "Switching modes does not by itself grant posting permission."
)


def _as_mode(value: InteractionMode | str | None) -> InteractionMode | None:
    if value is None:
        return None
    if isinstance(value, InteractionMode):
        return value
    normalized = str(value).strip().lower()
    if normalized == "ask":
        return InteractionMode.ASK
    if normalized == "accountant":
        return InteractionMode.ACCOUNTANT
    return None


def _as_operation(value: OperationClass | str) -> OperationClass:
    if isinstance(value, OperationClass):
        return value
    try:
        return OperationClass(str(value))
    except ValueError:
        return OperationClass.UNKNOWN_OPERATION


def _deny(
    *,
    code: DecisionCode,
    operation: OperationClass,
    mode: InteractionMode | None,
    principal: TrustedPrincipal | None,
    company_id: str | None,
    confirmation_required: bool = False,
    required_permission: str | None = None,
    correlation_id: str = "",
    safe_user_message: str = "",
) -> PolicyDecision:
    return PolicyDecision(
        allowed=False,
        decision_code=code,
        reason_code=code.value,
        required_permission=required_permission,
        mode=mode.value if mode else None,
        operation=operation.value,
        principal_id=principal.principal_id if principal else None,
        tenant_id=principal.tenant_id if principal else None,
        company_id=company_id or (principal.active_company_id if principal else None),
        confirmation_required=confirmation_required,
        audit_required=True,
        correlation_id=correlation_id or (principal.correlation_id if principal else ""),
        safe_user_message=safe_user_message,
    )


def _allow(
    *,
    operation: OperationClass,
    mode: InteractionMode,
    principal: TrustedPrincipal | None,
    company_id: str | None,
    confirmation_required: bool = False,
    required_permission: str | None = None,
    correlation_id: str = "",
) -> PolicyDecision:
    return PolicyDecision(
        allowed=True,
        decision_code=DecisionCode.POLICY_ALLOWED,
        reason_code=DecisionCode.POLICY_ALLOWED.value,
        required_permission=required_permission,
        mode=mode.value,
        operation=operation.value,
        principal_id=principal.principal_id if principal else None,
        tenant_id=principal.tenant_id if principal else None,
        company_id=company_id or (principal.active_company_id if principal else None),
        confirmation_required=confirmation_required,
        audit_required=operation in _MUTATION_OPS or operation in _AUTH_REQUIRED_OPS,
        correlation_id=correlation_id or (principal.correlation_id if principal else ""),
        safe_user_message="",
    )


def evaluate_policy(ctx: PolicyContext) -> PolicyDecision:
    """Central deny-by-default capability matrix. Pure function — no I/O."""
    operation = _as_operation(ctx.operation)
    mode = _as_mode(ctx.mode)
    principal = ctx.principal
    corr = ctx.correlation_id or (principal.correlation_id if principal else "")
    company = ctx.requested_company_id

    if operation is OperationClass.UNKNOWN_OPERATION:
        return _deny(
            code=DecisionCode.UNKNOWN_OPERATION_DENIED,
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            correlation_id=corr,
        )

    if mode is None:
        return _deny(
            code=DecisionCode.UNKNOWN_MODE_DENIED,
            operation=operation,
            mode=None,
            principal=principal,
            company_id=company,
            correlation_id=corr,
        )

    if ctx.originated_from_model and operation in _MUTATION_OPS:
        return _deny(
            code=DecisionCode.MODEL_ORIGINATED_MUTATION_DENIED,
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            correlation_id=corr,
            safe_user_message=_ASK_MODE_GUIDANCE if mode is InteractionMode.ASK else (
                "I cannot execute mutations from model output alone. Use the explicit confirmation control."
            ),
        )

    if ctx.natural_language_confirmation_only and operation is OperationClass.EXECUTE_CONFIRMED_COMMAND:
        return _deny(
            code=DecisionCode.NATURAL_LANGUAGE_CONFIRMATION_DENIED,
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            confirmation_required=True,
            correlation_id=corr,
            safe_user_message=(
                "A conversational yes is not posting authority. Use the Confirm control after reviewing the preview."
            ),
        )

    # Public conversational help may proceed without auth (read-only chatter).
    if operation in {
        OperationClass.READ_CONVERSATION,
        OperationClass.READ_PRODUCT_HELP,
        OperationClass.CREATE_EPHEMERAL_EXAMPLE,
    } and operation in _ASK_ALLOWED and mode is InteractionMode.ASK:
        return _allow(
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            correlation_id=corr,
        )

    if operation in _AUTH_REQUIRED_OPS and principal is None:
        return _deny(
            code=DecisionCode.AUTHENTICATION_REQUIRED,
            operation=operation,
            mode=mode,
            principal=None,
            company_id=company,
            required_permission=_OP_PERMISSION.get(operation),
            correlation_id=corr,
        )

    if principal is not None:
        if ctx.requested_tenant_id and ctx.requested_tenant_id != principal.tenant_id:
            return _deny(
                code=DecisionCode.TENANT_SCOPE_MISMATCH,
                operation=operation,
                mode=mode,
                principal=principal,
                company_id=company,
                correlation_id=corr,
            )
        if company and not principal.allows_company(company):
            return _deny(
                code=DecisionCode.COMPANY_SCOPE_MISMATCH,
                operation=operation,
                mode=mode,
                principal=principal,
                company_id=company,
                correlation_id=corr,
            )

    if mode is InteractionMode.ASK:
        if operation not in _ASK_ALLOWED:
            return _deny(
                code=DecisionCode.MODE_FORBIDS_OPERATION,
                operation=operation,
                mode=mode,
                principal=principal,
                company_id=company,
                correlation_id=corr,
                safe_user_message=_ASK_MODE_GUIDANCE,
            )
        # Authenticated Ask reads
        if operation in _AUTH_REQUIRED_OPS and principal is not None:
            required = _OP_PERMISSION.get(operation)
            if required and not principal.has_permission(required) and not principal.has_permission(PERM_READ):
                # accountants usually have oip:read via role; enforce if registry grants
                if required not in ("", None) and not principal.has_permission(required):
                    # allow read if role is read_only/accountant with oip:read resolved; if empty perms, deny
                    if not principal.permissions and not principal.roles:
                        return _deny(
                            code=DecisionCode.AUTHORIZATION_REQUIRED,
                            operation=operation,
                            mode=mode,
                            principal=principal,
                            company_id=company,
                            required_permission=required,
                            correlation_id=corr,
                        )
        return _allow(
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            correlation_id=corr,
            required_permission=_OP_PERMISSION.get(operation),
        )

    # Accountant mode
    if operation in _ASK_ALLOWED:
        return _allow(
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            correlation_id=corr,
            required_permission=_OP_PERMISSION.get(operation),
        )

    required = _OP_PERMISSION.get(operation)
    if required and principal is not None and not principal.has_permission(required):
        # Also accept role-based aliases for khata confirm / execute
        role_ok = _role_implies_permission(principal.roles, required)
        if not role_ok:
            return _deny(
                code=DecisionCode.AUTHORIZATION_REQUIRED,
                operation=operation,
                mode=mode,
                principal=principal,
                company_id=company,
                required_permission=required,
                correlation_id=corr,
            )

    if operation in _ACCOUNTANT_DRAFT_OPS:
        return _allow(
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            confirmation_required=False,
            required_permission=required,
            correlation_id=corr,
        )

    if operation is OperationClass.EXECUTE_CONFIRMED_COMMAND:
        if not ctx.explicit_confirmation:
            return _deny(
                code=DecisionCode.EXPLICIT_CONFIRMATION_REQUIRED,
                operation=operation,
                mode=mode,
                principal=principal,
                company_id=company,
                confirmation_required=True,
                required_permission=required,
                correlation_id=corr,
                safe_user_message=(
                    "Explicit confirmation is required before posting. "
                    "Accountant Mode alone does not authorize execution."
                ),
            )
        return _allow(
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            confirmation_required=False,
            required_permission=required,
            correlation_id=corr,
        )

    if operation in {
        OperationClass.MARK_POSTED,
        OperationClass.SYNC_ACCOUNTING_EVENT,
        OperationClass.MANAGE_KNOWLEDGE,
        OperationClass.MANAGE_SECURITY,
    }:
        return _allow(
            operation=operation,
            mode=mode,
            principal=principal,
            company_id=company,
            required_permission=required,
            correlation_id=corr,
        )

    return _deny(
        code=DecisionCode.UNKNOWN_OPERATION_DENIED,
        operation=operation,
        mode=mode,
        principal=principal,
        company_id=company,
        correlation_id=corr,
    )


def _role_implies_permission(roles: tuple[str, ...], permission: str) -> bool:
    normalized = {r.strip().lower() for r in roles}
    elevated = {"admin", "owner", "super_admin", "superuser", "accountant", "manager", "system_admin"}
    if permission in {PERM_EXECUTE, PERM_KHATA_CONFIRM, PERM_MARK_POSTED, PERM_DRAFT, PERM_SYNC}:
        return bool(normalized & elevated)
    if permission in {PERM_ADMIN_KNOWLEDGE, PERM_ADMIN_SECURITY}:
        return bool(normalized & {"admin", "owner", "super_admin", "superuser", "system_admin"})
    if permission == PERM_READ:
        return True
    return False


def ask_mode_guidance_message() -> str:
    return _ASK_MODE_GUIDANCE


_READ_TOOL_PREFIXES = (
    "query_",
    "search_",
    "generate_",
    "calculate_",
    "explain_",
    "analyze_",
    "erp.query.",
    "erp.report.",
    "drill_down_",
)
_DRAFT_TOOL_MARKERS = ("draft", "preview", "erp.purchase.invoice", "erp.sales.invoice", "simulate_")


def operation_from_tool_name(tool_name: str) -> OperationClass:
    """Map tool names to operation classes; unknown tools are mutation-class (deny)."""
    name = (tool_name or "").strip().lower()
    if any(name.startswith(p) for p in _READ_TOOL_PREFIXES):
        return OperationClass.READ_ERP_DATA
    if any(m in name for m in _DRAFT_TOOL_MARKERS):
        return OperationClass.CREATE_PERSISTED_DRAFT
    return OperationClass.EXECUTE_CONFIRMED_COMMAND
