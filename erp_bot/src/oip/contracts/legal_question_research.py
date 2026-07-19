"""MAI-36 legal question framer / research mode — policy annotation (never mutates)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class LegalQuestionResearchStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class ResearchModeReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    CLARIFY_REQUIRED = "CLARIFY_REQUIRED"


class SlotStatus(str, Enum):
    PRESENT = "PRESENT"
    MISSING = "MISSING"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class LegalRiskClass(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class EscalationPolicy(str, Enum):
    PROFESSIONAL_REVIEW_RECOMMENDED = "PROFESSIONAL_REVIEW_RECOMMENDED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class LegalQuestionResearchBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: LegalQuestionResearchStatus = (
        LegalQuestionResearchStatus.NOT_RUN
    )
    runtime_version: str = "mai-36.0.2-slice2"
    source_authority: str = "REQUEST"
    research_mode_readiness: ResearchModeReadiness = (
        ResearchModeReadiness.NOT_APPLICABLE
    )
    research_mode_active: bool = False
    claim_kinds: tuple[str, ...] = ()
    jurisdiction_status: SlotStatus = SlotStatus.NOT_APPLICABLE
    jurisdiction_candidate: str | None = None
    as_of_status: SlotStatus = SlotStatus.NOT_APPLICABLE
    as_of_candidate: str | None = None
    risk_class: LegalRiskClass = LegalRiskClass.NOT_APPLICABLE
    source_authority_policy: str = "APPROVED_EVIDENCE_REQUIRED"
    clarification_policy: str = "CLARIFY_MISSING_JURISDICTION_OR_TIME"
    escalation_policy: EscalationPolicy = EscalationPolicy.NOT_APPLICABLE
    mutation_tools_allowed: bool = False
    accounting_action_separated: bool = True
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
    research_planner_executed: bool = False
    kb_retrieval_invoked: bool = False
    draft_mutations: int = Field(ge=0, default=0)
    research_mode_mutations: int = Field(ge=0, default=0)
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

    @field_validator("mutation_tools_allowed")
    @classmethod
    def _mut(cls, v: bool) -> bool:
        if v:
            raise ValueError("RESEARCH_MODE_MUST_NOT_ALLOW_MUTATION")
        return v

    @field_validator(
        "current_law_definitive",
        "legal_effective_dates_proven",
        "amendment_applied",
        "claims_verified",
        "citations_verified",
        "legal_proof_claimed",
        "research_planner_executed",
        "kb_retrieval_invoked",
    )
    @classmethod
    def _never_claim(cls, v: bool) -> bool:
        if v:
            raise ValueError("LEGAL_RESEARCH_MUST_NOT_CLAIM_OR_EXECUTE")
        return v

    @field_validator("gap_p2_008_status")
    @classmethod
    def _gap(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P2_008_MUST_REMAIN_OPEN")
        return v

    @field_validator(
        "draft_mutations", "research_mode_mutations", "posting_mutations"
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("LEGAL_RESEARCH_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
