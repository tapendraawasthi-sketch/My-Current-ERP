"""Draft reference, preview, and receipt — distinct semantics; no accounting calcs."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, MoneyV1, default_schema_version
from .errors import ContractErrorCode, ContractValidationError
from .registry import get_contract_registry


class DraftStatus(str, Enum):
    OPEN = "OPEN"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    READY_FOR_PREVIEW = "READY_FOR_PREVIEW"
    PREVIEWED = "PREVIEWED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    SUPERSEDED = "SUPERSEDED"


class PreviewStatus(str, Enum):
    READY = "READY"
    STALE = "STALE"
    EXPIRED = "EXPIRED"
    INVALID = "INVALID"


class ReceiptStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    POSTED_LOCAL = "POSTED_LOCAL"
    SYNC_PENDING = "SYNC_PENDING"
    SYNCED = "SYNCED"
    CONFLICT = "CONFLICT"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class JournalSide(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class DraftReferenceV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    draft_id: str = Field(min_length=1, max_length=128)
    draft_version: str = "1"
    event_type: str = "unknown"
    tenant_scope_reference: str = Field(min_length=1)
    company_scope_reference: str | None = None
    owner_principal_reference: str = Field(min_length=1)
    conversation_id: str = Field(min_length=1)
    status: DraftStatus = DraftStatus.OPEN
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("created_at", "expires_at")
    @classmethod
    def _aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return v


class JournalEffectV1(ContractBase):
    account_id: str = Field(min_length=1)
    account_display_name: str = ""
    side: JournalSide
    amount: MoneyV1
    narration: str | None = None
    source_reference: str | None = None


class PreviewV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    preview_id: str = Field(min_length=1)
    draft_reference: DraftReferenceV1
    preview_version: str = "1"
    preview_hash: str = Field(min_length=1)
    summary: str = ""
    journal_effects: tuple[JournalEffectV1, ...] = ()
    inventory_effects: tuple[dict[str, Any], ...] = ()
    tax_effects: tuple[dict[str, Any], ...] = ()
    party_references: tuple[dict[str, Any], ...] = ()
    document_references: tuple[dict[str, Any], ...] = ()
    date_and_period: dict[str, Any] = Field(default_factory=dict)
    totals: dict[str, Any] = Field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    source_references: tuple[str, ...] = ()
    rule_versions: dict[str, str] = Field(default_factory=dict)
    snapshot_revisions: dict[str, str] = Field(default_factory=dict)
    required_permissions: tuple[str, ...] = ()
    approval_requirements: tuple[str, ...] = ()
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = None
    status: PreviewStatus = PreviewStatus.READY
    # Hard exclusions
    receipt_id: None = None
    execution_success: None = None
    authoritative_record_ids: None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @model_validator(mode="before")
    @classmethod
    def _not_receipt(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in ("receipt_id", "authoritative_record_ids", "execution_success"):
                if data.get(key) not in (None, False, ()):
                    raise ContractValidationError(
                        ContractErrorCode.INVALID_PREVIEW,
                        f"Preview cannot contain {key}",
                        field=key,
                    )
        return data

    @property
    def is_receipt(self) -> bool:
        return False


class ReceiptV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    receipt_id: str = Field(min_length=1)
    command_id: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=1)
    draft_reference: DraftReferenceV1
    preview_reference: str | None = None
    authority_source: str = Field(min_length=1)
    connector_or_domain_source: str = Field(min_length=1)
    status: ReceiptStatus
    authoritative_record_ids: tuple[str, ...] = ()
    audit_reference: str | None = None
    sync_state: Literal["local_only", "pending", "synced", "conflict"] | None = None
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warnings: tuple[str, ...] = ()
    oec_fields: dict[str, Any] | None = None  # optional until OEC convergence

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @model_validator(mode="after")
    def _sync_consistent(self) -> ReceiptV1:
        if self.status is ReceiptStatus.SYNCED and self.sync_state == "pending":
            raise ContractValidationError(
                ContractErrorCode.INVALID_RECEIPT,
                "SYNC_PENDING cannot serialize as synced",
                field="status",
            )
        if self.status is ReceiptStatus.SYNC_PENDING and self.sync_state == "synced":
            raise ContractValidationError(
                ContractErrorCode.INVALID_RECEIPT,
                "SYNC_PENDING cannot serialize as synced",
                field="sync_state",
            )
        if not self.authority_source.strip():
            raise ContractValidationError(
                ContractErrorCode.INVALID_RECEIPT,
                "Receipt requires a real authority source",
                field="authority_source",
            )
        return self

    @classmethod
    def from_model_prose(cls, *_args: Any, **_kwargs: Any) -> ReceiptV1:
        raise ContractValidationError(
            ContractErrorCode.INVALID_RECEIPT,
            "Receipt cannot be generated from model prose",
        )
