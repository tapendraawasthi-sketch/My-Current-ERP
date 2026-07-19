"""MAI-40 financial close / adjustment assistance — policy annotation (never posts)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class FinancialCloseAdjustmentAssistanceStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class CloseAssistReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    SCOPE_PARTIAL = "SCOPE_PARTIAL"


class CloseAssistTopic(str, Enum):
    FINANCIAL_CLOSE = "FINANCIAL_CLOSE"
    ADJUSTMENT = "ADJUSTMENT"
    CHECKLIST = "CHECKLIST"
    CLOSING_ENTRY = "CLOSING_ENTRY"
    UNSUPPORTED = "UNSUPPORTED"


class FinancialCloseAdjustmentAssistanceBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: FinancialCloseAdjustmentAssistanceStatus = (
        FinancialCloseAdjustmentAssistanceStatus.NOT_RUN
    )
    runtime_version: str = "mai-40.0.2-slice2"
    source_authority: str = "REQUEST"
    close_assist_readiness: CloseAssistReadiness = (
        CloseAssistReadiness.NOT_APPLICABLE
    )
    pilot_scope: str = "FINANCIAL_CLOSE_ADJUSTMENT_ONLY"
    in_scope_topics: tuple[str, ...] = ()
    unsupported_topics: tuple[str, ...] = ()
    adjustment_status: str = "CANDIDATE_ASSISTANCE_ONLY"
    specialist_signoff_status: str = "NOT_SIGNED"
    nfrs_nas_bound: bool = False
    mutation_tools_allowed: bool = False
    close_posted: bool = False
    adjustments_posted: bool = False
    books_locked: bool = False
    period_closed: bool = False
    current_law_definitive: bool = False
    legal_effective_dates_proven: bool = False
    amendment_applied: bool = False
    claims_verified: bool = False
    citations_verified: bool = False
    legal_proof_claimed: bool = False
    gap_p2_008_status: str = "OPEN"
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    kb_retrieval_invoked: bool = False
    documents_retrieved: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    posting_mutations: int = Field(ge=0, default=0)

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("source_authority")
    @classmethod
    def _src(cls, v: str) -> str:
        if v != "REQUEST":
            raise ValueError("SOURCE_AUTHORITY_MUST_BE_REQUEST")
        return v

    @field_validator("pilot_scope")
    @classmethod
    def _scope(cls, v: str) -> str:
        if v != "FINANCIAL_CLOSE_ADJUSTMENT_ONLY":
            raise ValueError("PILOT_SCOPE_MUST_STAY_NARROW")
        return v

    @field_validator("adjustment_status")
    @classmethod
    def _adj(cls, v: str) -> str:
        if v != "CANDIDATE_ASSISTANCE_ONLY":
            raise ValueError("ADJUSTMENT_MUST_STAY_CANDIDATE_ONLY")
        return v

    @field_validator("mutation_tools_allowed")
    @classmethod
    def _mut(cls, v: bool) -> bool:
        if v:
            raise ValueError("CLOSE_ASSIST_MUST_NOT_ALLOW_MUTATION")
        return v

    @field_validator(
        "close_posted",
        "adjustments_posted",
        "books_locked",
        "period_closed",
        "current_law_definitive",
        "legal_effective_dates_proven",
        "amendment_applied",
        "claims_verified",
        "citations_verified",
        "legal_proof_claimed",
        "kb_retrieval_invoked",
    )
    @classmethod
    def _never_claim(cls, v: bool) -> bool:
        if v:
            raise ValueError("CLOSE_ASSIST_MUST_NOT_CLAIM_OR_POST")
        return v

    @field_validator("gap_p2_008_status")
    @classmethod
    def _gap(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P2_008_MUST_REMAIN_OPEN")
        return v

    @field_validator("specialist_signoff_status")
    @classmethod
    def _sign(cls, v: str) -> str:
        if v != "NOT_SIGNED":
            raise ValueError("SPECIALIST_SIGNOFF_MUST_REMAIN_NOT_SIGNED")
        return v

    @field_validator("documents_retrieved", "draft_mutations", "posting_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("CLOSE_ASSIST_MUST_NOT_MUTATE_OR_RETRIEVE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
