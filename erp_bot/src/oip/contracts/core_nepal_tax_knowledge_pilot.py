"""MAI-37 core Nepal tax knowledge pilot — policy annotation (never calculates)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class CoreNepalTaxKnowledgePilotStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class TaxPilotReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    SCOPE_PARTIAL = "SCOPE_PARTIAL"


class TaxPilotTopic(str, Enum):
    INCOME_TAX = "INCOME_TAX"
    VAT = "VAT"
    TDS = "TDS"
    UNSUPPORTED = "UNSUPPORTED"


class CoreNepalTaxKnowledgePilotBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: CoreNepalTaxKnowledgePilotStatus = (
        CoreNepalTaxKnowledgePilotStatus.NOT_RUN
    )
    runtime_version: str = "mai-37.0.1-slice1"
    source_authority: str = "REQUEST"
    tax_pilot_readiness: TaxPilotReadiness = TaxPilotReadiness.NOT_APPLICABLE
    pilot_scope: str = "INCOME_TAX_VAT_TDS_ONLY"
    in_scope_topics: tuple[str, ...] = ()
    unsupported_topics: tuple[str, ...] = ()
    approved_source_policy: str = "REVIEWED_PRIMARY_REQUIRED"
    rate_table_status: str = "CANDIDATE_REFS_ONLY"
    gold_questions_status: str = "NOT_RELEASED"
    specialist_signoff_status: str = "NOT_SIGNED"
    research_mode_bound: bool = False
    mutation_tools_allowed: bool = False
    tax_calculator_invoked: bool = False
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
    rate_lookup_executed: bool = False
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
        if v != "INCOME_TAX_VAT_TDS_ONLY":
            raise ValueError("PILOT_SCOPE_MUST_STAY_NARROW")
        return v

    @field_validator("mutation_tools_allowed")
    @classmethod
    def _mut(cls, v: bool) -> bool:
        if v:
            raise ValueError("TAX_PILOT_MUST_NOT_ALLOW_MUTATION")
        return v

    @field_validator(
        "tax_calculator_invoked",
        "current_law_definitive",
        "legal_effective_dates_proven",
        "amendment_applied",
        "claims_verified",
        "citations_verified",
        "legal_proof_claimed",
        "kb_retrieval_invoked",
        "rate_lookup_executed",
    )
    @classmethod
    def _never_claim(cls, v: bool) -> bool:
        if v:
            raise ValueError("TAX_PILOT_MUST_NOT_CLAIM_OR_EXECUTE")
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

    @field_validator("gold_questions_status")
    @classmethod
    def _gold(cls, v: str) -> str:
        if v != "NOT_RELEASED":
            raise ValueError("GOLD_QUESTIONS_MUST_REMAIN_NOT_RELEASED")
        return v

    @field_validator("documents_retrieved", "draft_mutations", "posting_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("TAX_PILOT_MUST_NOT_MUTATE_OR_RETRIEVE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
