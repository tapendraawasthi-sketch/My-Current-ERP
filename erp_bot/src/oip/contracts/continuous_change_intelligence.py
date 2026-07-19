"""MAI-43 continuous change intelligence — policy (never production truth)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ContinuousChangeIntelligenceStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class ContinuousChangeReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    SCOPE_PARTIAL = "SCOPE_PARTIAL"


class ContinuousChangeTopic(str, Enum):
    AMENDMENT = "AMENDMENT"
    GAZETTE = "GAZETTE"
    CIRCULAR = "CIRCULAR"
    EFFECTIVE_DATE_CHANGE = "EFFECTIVE_DATE_CHANGE"
    NOTIFICATION = "NOTIFICATION"
    ORDINANCE = "ORDINANCE"
    RATE_CHANGE = "RATE_CHANGE"
    UNSUPPORTED = "UNSUPPORTED"


class ContinuousChangeIntelligenceBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ContinuousChangeIntelligenceStatus = (
        ContinuousChangeIntelligenceStatus.NOT_RUN
    )
    runtime_version: str = "mai-43.0.2-slice2"
    source_authority: str = "REQUEST"
    continuous_change_readiness: ContinuousChangeReadiness = (
        ContinuousChangeReadiness.NOT_APPLICABLE
    )
    pilot_scope: str = "CONTINUOUS_CHANGE_CANDIDATE_ONLY"
    in_scope_topics: tuple[str, ...] = ()
    unsupported_topics: tuple[str, ...] = ()
    release_status: str = "NOT_RELEASED"
    gold_questions_status: str = "NOT_RELEASED"
    specialist_signoff_status: str = "NOT_SIGNED"
    research_mode_bound: bool = False
    mutation_tools_allowed: bool = False
    continuous_change_authority_claimed: bool = False
    unreviewed_as_production_truth: bool = False
    cache_invalidated: bool = False
    rates_changed_as_truth: bool = False
    change_applied: bool = False
    amendment_applied: bool = False
    rollback_executed: bool = False
    current_law_definitive: bool = False
    legal_effective_dates_proven: bool = False
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
        if v != "CONTINUOUS_CHANGE_CANDIDATE_ONLY":
            raise ValueError("PILOT_SCOPE_MUST_STAY_NARROW")
        return v

    @field_validator("release_status")
    @classmethod
    def _rel(cls, v: str) -> str:
        if v != "NOT_RELEASED":
            raise ValueError("RELEASE_STATUS_MUST_REMAIN_NOT_RELEASED")
        return v

    @field_validator("gold_questions_status")
    @classmethod
    def _gold(cls, v: str) -> str:
        if v != "NOT_RELEASED":
            raise ValueError("GOLD_QUESTIONS_MUST_REMAIN_NOT_RELEASED")
        return v

    @field_validator("mutation_tools_allowed")
    @classmethod
    def _mut(cls, v: bool) -> bool:
        if v:
            raise ValueError("CONTINUOUS_CHANGE_MUST_NOT_ALLOW_MUTATION")
        return v

    @field_validator(
        "continuous_change_authority_claimed",
        "unreviewed_as_production_truth",
        "cache_invalidated",
        "rates_changed_as_truth",
        "change_applied",
        "amendment_applied",
        "rollback_executed",
        "current_law_definitive",
        "legal_effective_dates_proven",
        "claims_verified",
        "citations_verified",
        "legal_proof_claimed",
        "kb_retrieval_invoked",
    )
    @classmethod
    def _never_claim(cls, v: bool) -> bool:
        if v:
            raise ValueError("CONTINUOUS_CHANGE_MUST_NOT_CLAIM_OR_APPLY")
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
            raise ValueError("CONTINUOUS_CHANGE_MUST_NOT_MUTATE_OR_RETRIEVE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
