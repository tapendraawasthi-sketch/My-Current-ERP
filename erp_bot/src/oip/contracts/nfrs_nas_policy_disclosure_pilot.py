"""MAI-39 NFRS/NAS policy, mapping, disclosure pilot — annotation (never files)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class NfrsNasPolicyDisclosurePilotStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class NfrsNasPilotReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    SCOPE_PARTIAL = "SCOPE_PARTIAL"


class NfrsNasTopic(str, Enum):
    NFRS = "NFRS"
    NAS = "NAS"
    DISCLOSURE = "DISCLOSURE"
    MAPPING = "MAPPING"
    UNSUPPORTED = "UNSUPPORTED"


class NfrsNasPolicyDisclosurePilotBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: NfrsNasPolicyDisclosurePilotStatus = (
        NfrsNasPolicyDisclosurePilotStatus.NOT_RUN
    )
    runtime_version: str = "mai-39.0.1-slice1"
    source_authority: str = "REQUEST"
    nfrs_nas_readiness: NfrsNasPilotReadiness = NfrsNasPilotReadiness.NOT_APPLICABLE
    pilot_scope: str = "NFRS_NAS_DISCLOSURE_ONLY"
    in_scope_topics: tuple[str, ...] = ()
    unsupported_topics: tuple[str, ...] = ()
    mapping_status: str = "CANDIDATE_MAPPINGS_ONLY"
    disclosure_status: str = "NOT_FILED"
    specialist_signoff_status: str = "NOT_SIGNED"
    research_mode_bound: bool = False
    mutation_tools_allowed: bool = False
    standards_authority_claimed: bool = False
    mapping_executed: bool = False
    disclosure_filed: bool = False
    filing_ready: bool = False
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
        if v != "NFRS_NAS_DISCLOSURE_ONLY":
            raise ValueError("PILOT_SCOPE_MUST_STAY_NARROW")
        return v

    @field_validator("mapping_status")
    @classmethod
    def _map(cls, v: str) -> str:
        if v != "CANDIDATE_MAPPINGS_ONLY":
            raise ValueError("MAPPING_MUST_STAY_CANDIDATE_ONLY")
        return v

    @field_validator("disclosure_status")
    @classmethod
    def _disc(cls, v: str) -> str:
        if v != "NOT_FILED":
            raise ValueError("DISCLOSURE_MUST_REMAIN_NOT_FILED")
        return v

    @field_validator("mutation_tools_allowed")
    @classmethod
    def _mut(cls, v: bool) -> bool:
        if v:
            raise ValueError("NFRS_NAS_PILOT_MUST_NOT_ALLOW_MUTATION")
        return v

    @field_validator(
        "standards_authority_claimed",
        "mapping_executed",
        "disclosure_filed",
        "filing_ready",
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
            raise ValueError("NFRS_NAS_PILOT_MUST_NOT_CLAIM_OR_EXECUTE")
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
            raise ValueError("NFRS_NAS_PILOT_MUST_NOT_MUTATE_OR_RETRIEVE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
