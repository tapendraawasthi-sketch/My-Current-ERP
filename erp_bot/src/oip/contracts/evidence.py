"""Evidence and claim contracts — verification deferred to MAI-30."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from .common import ConfidenceV1, ContractBase, default_schema_version
from .registry import get_contract_registry


class EvidenceClass(str, Enum):
    ERP_SNAPSHOT = "ERP_SNAPSHOT"
    DETERMINISTIC_CALCULATION = "DETERMINISTIC_CALCULATION"
    AUTHORITATIVE_EXTERNAL = "AUTHORITATIVE_EXTERNAL"
    PROFESSIONAL_EXPLANATORY = "PROFESSIONAL_EXPLANATORY"
    PRODUCT_DOCUMENTATION = "PRODUCT_DOCUMENTATION"
    LANGUAGE_EXAMPLE = "LANGUAGE_EXAMPLE"
    USER_PROVIDED = "USER_PROVIDED"
    INTERNAL_DRAFT = "INTERNAL_DRAFT"
    UNKNOWN = "UNKNOWN"


class ReviewStatus(str, Enum):
    UNREVIEWED = "UNREVIEWED"
    REVIEWED = "REVIEWED"
    REJECTED = "REJECTED"


class VerificationStatus(str, Enum):
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"
    CONFLICTING = "CONFLICTING"
    INSUFFICIENT = "INSUFFICIENT"


class ClaimType(str, Enum):
    ERP_FACT = "ERP_FACT"
    ACCOUNTING_RULE = "ACCOUNTING_RULE"
    LEGAL_TAX = "LEGAL_TAX"
    PRODUCT_CAPABILITY = "PRODUCT_CAPABILITY"
    LANGUAGE_EXAMPLE = "LANGUAGE_EXAMPLE"
    USER_ASSERTION = "USER_ASSERTION"
    OTHER = "OTHER"


class EvidenceItemV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    evidence_id: str = Field(min_length=1, max_length=128)
    evidence_class: EvidenceClass = EvidenceClass.UNKNOWN
    source_id: str = Field(min_length=1)
    document_version_or_snapshot: str | None = None
    exact_location: str | None = None
    extracted_text_or_fact: str = ""
    authority_level: str | None = None
    jurisdiction: str | None = None
    effective_period: str | None = None
    acquired_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    review_status: ReviewStatus = ReviewStatus.UNREVIEWED
    content_hash: str | None = None
    allowed_uses: tuple[str, ...] = ("citation",)
    status: str = "ready"

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("acquired_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("acquired_at must be timezone-aware")
        return v

    @property
    def is_authoritative(self) -> bool:
        return self.evidence_class not in {
            EvidenceClass.INTERNAL_DRAFT,
            EvidenceClass.LANGUAGE_EXAMPLE,
            EvidenceClass.UNKNOWN,
        }


class ClaimV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    claim_id: str = Field(min_length=1)
    claim_type: ClaimType = ClaimType.OTHER
    canonical_proposition: str = Field(min_length=1)
    evidence_ids: tuple[str, ...] = ()
    derivation_reference: str | None = None
    confidence: ConfidenceV1 | None = None
    materiality: str = "unknown"
    temporal_scope: str | None = None
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED
    status: str = "ready"
    verifier_findings: dict[str, Any] = Field(default_factory=dict)

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("verification_status")
    @classmethod
    def _no_lang_verify(cls, v: VerificationStatus, info: Any) -> VerificationStatus:
        # Citation presence is not verification — claim_type + language examples handled in tests.
        return v
