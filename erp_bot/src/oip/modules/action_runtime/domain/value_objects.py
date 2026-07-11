"""Action Runtime domain value objects."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ActionRuntimeType(str, Enum):
    JOURNAL_ENTRY = "journal_entry"
    REPORT_GENERATION = "report_generation"
    VAT_CALCULATION = "vat_calculation"
    LEDGER_BALANCE_QUERY = "ledger_balance_query"
    APPROVAL = "approval"
    INVOICE = "invoice"
    RECEIPT = "receipt"
    PAYMENT = "payment"
    INVENTORY_ADJUSTMENT = "inventory_adjustment"
    STOCK_TRANSFER = "stock_transfer"
    PAYROLL_POSTING = "payroll_posting"
    ASSET_POSTING = "asset_posting"
    TAX_SUBMISSION = "tax_submission"
    BANK_RECONCILIATION = "bank_reconciliation"
    CUSTOMER_CREATION = "customer_creation"
    VENDOR_CREATION = "vendor_creation"
    CUSTOM_ACTION = "custom_action"


class ActionExecutionStatus(str, Enum):
    PROPOSED = "proposed"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    EXECUTED = "executed"
    FAILED = "failed"
    BLOCKED = "blocked"
    COMPENSATED = "compensated"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class ApprovalRole(str, Enum):
    AUTOMATIC = "automatic"
    MANAGER = "manager"
    FINANCE = "finance"
    ADMINISTRATOR = "administrator"


class FailureKind(str, Enum):
    QUALITY_BLOCKED = "quality_blocked"
    POLICY_DENIED = "policy_denied"
    APPROVAL_DENIED = "approval_denied"
    SNAPSHOT_STALE = "snapshot_stale"
    FISCAL_LOCKED = "fiscal_locked"
    PERMISSION_DENIED = "permission_denied"
    CAPABILITY_INVALID = "capability_invalid"
    INVENTORY_LOCKED = "inventory_locked"
    IDEMPOTENCY_CONFLICT = "idempotency_conflict"
    ERP_COMMAND_FAILED = "erp_command_failed"
    GUARD_FAILED = "guard_failed"


class ActionPolicy(BaseModel):
    model_config = ConfigDict(frozen=True)

    policy_id: str
    name: str
    require_approval: bool = False
    approval_roles: tuple[str, ...] = Field(default_factory=tuple)
    max_amount: float | None = None
    allowed_action_types: tuple[str, ...] = Field(default_factory=tuple)
    offline_only: bool = False


class ActionProposal(BaseModel):
    model_config = ConfigDict(frozen=True)

    proposal_id: str
    action_id: str
    execution_id: str
    evaluation_id: str
    tenant_id: str
    action_type: ActionRuntimeType
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str
    proposed_at: str
    quality_decision: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ActionMaterialization(BaseModel):
    model_config = ConfigDict(frozen=True)

    materialization_id: str
    action_id: str
    execution_id: str
    evaluation_id: str
    action_type: ActionRuntimeType
    erp_command_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    materialized_at: str


class ActionConfirmation(BaseModel):
    model_config = ConfigDict(frozen=True)

    confirmation_id: str
    action_id: str
    erp_reference: str
    erp_command_id: str
    confirmed_at: str
    payload: dict[str, Any] = Field(default_factory=dict)


class ActionApproval(BaseModel):
    model_config = ConfigDict(frozen=True)

    approval_id: str
    action_id: str
    role: ApprovalRole
    status: ApprovalStatus
    approver_id: str | None = None
    reason: str = ""
    stage: int = 1
    decided_at: str | None = None


class ActionCompensation(BaseModel):
    model_config = ConfigDict(frozen=True)

    compensation_id: str
    action_id: str
    reversal_action_id: str
    reversal_type: ActionRuntimeType
    reason: str
    compensated_at: str
    erp_reference: str | None = None


class ActionEvidence(BaseModel):
    model_config = ConfigDict(frozen=True)

    evidence_id: str
    action_id: str
    source: str
    content_hash: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ErpContextSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    snapshot_id: str
    version: str
    captured_at: str
    ttl_seconds: int = 300
    content_hash: str
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    fiscal_period_id: str | None = None
    fiscal_period_open: bool = True
    currency_code: str = "NPR"
    metadata: dict[str, Any] = Field(default_factory=dict)

    def is_stale(self) -> bool:
        captured = datetime.fromisoformat(self.captured_at)
        age = (datetime.now(timezone.utc) - captured).total_seconds()
        return age > self.ttl_seconds


class ActionSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    action_snapshot_id: str
    action_id: str
    erp_snapshot: ErpContextSnapshot
    validated_at: str


class ActionResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    result_id: str
    action_id: str
    success: bool
    erp_reference: str | None = None
    output: dict[str, Any] = Field(default_factory=dict)


class ActionFailure(BaseModel):
    model_config = ConfigDict(frozen=True)

    failure_id: str
    action_id: str
    kind: FailureKind
    message: str
    recoverable: bool = False
    occurred_at: str


class ActionRisk(BaseModel):
    model_config = ConfigDict(frozen=True)

    risk_id: str
    action_id: str
    score: float
    factors: tuple[str, ...] = Field(default_factory=tuple)


class ActionExecutionBudget(BaseModel):
    model_config = ConfigDict(frozen=True)

    budget_id: str
    action_id: str
    max_mutations: int = 1
    consumed: int = 0
    exceeded: bool = False


class ActionPermission(BaseModel):
    model_config = ConfigDict(frozen=True)

    permission_id: str
    action_id: str
    user_id: str
    allowed: bool
    scopes: tuple[str, ...] = Field(default_factory=tuple)
    reason: str = ""


class ActionCapability(BaseModel):
    model_config = ConfigDict(frozen=True)

    capability_id: str
    action_id: str
    token_id: str
    valid: bool
    write_scope: tuple[str, ...] = Field(default_factory=tuple)
