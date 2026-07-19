"""MAI-30 grounded answer / claim-citation — policy annotation (never verified)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ClaimCitationStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class GroundedAnswerPolicy(str, Enum):
    ABSTAIN_WHEN_UNGROUNDED = "ABSTAIN_WHEN_UNGROUNDED"
    UNKNOWN = "UNKNOWN"


class ClaimCitationVerificationStatus(str, Enum):
    UNVERIFIED = "UNVERIFIED"
    INSUFFICIENT = "INSUFFICIENT"
    # VERIFIED intentionally omitted from annotation defaults — slice 1 never claims it.


class ClaimCueKind(str, Enum):
    LEGAL_TAX = "LEGAL_TAX"
    ACCOUNTING_RULE = "ACCOUNTING_RULE"
    ERP_FACT = "ERP_FACT"
    PRODUCT_CAPABILITY = "PRODUCT_CAPABILITY"
    UNKNOWN = "UNKNOWN"


class ClaimCueV1(ContractBase):
    cue_id: str = Field(min_length=1, max_length=64)
    kind: ClaimCueKind = ClaimCueKind.UNKNOWN
    surface: str = ""
    reason_codes: tuple[str, ...] = ()


class ClaimCitationBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ClaimCitationStatus = ClaimCitationStatus.NOT_RUN
    runtime_version: str = "mai-30.0.2-slice2"
    source_authority: str = "REQUEST"
    grounded_answer_policy: GroundedAnswerPolicy = (
        GroundedAnswerPolicy.ABSTAIN_WHEN_UNGROUNDED
    )
    verification_status: ClaimCitationVerificationStatus = (
        ClaimCitationVerificationStatus.UNVERIFIED
    )
    citation_required: bool = True
    claim_cues: tuple[ClaimCueV1, ...] = ()
    claims_verified: bool = False
    citations_verified: bool = False
    verifier_executed: bool = False
    legal_proof_claimed: bool = False
    fake_citation_allowed: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    documents_retrieved: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    model_invocations: int = Field(ge=0, default=0)

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

    @field_validator(
        "claims_verified",
        "citations_verified",
        "verifier_executed",
        "legal_proof_claimed",
        "fake_citation_allowed",
    )
    @classmethod
    def _never_verified_or_fake(cls, v: bool) -> bool:
        if v:
            raise ValueError("CLAIM_CITATION_MUST_NOT_VERIFY_OR_ALLOW_FAKE")
        return v

    @field_validator("grounded_answer_policy")
    @classmethod
    def _abstain(cls, v: GroundedAnswerPolicy) -> GroundedAnswerPolicy:
        if v != GroundedAnswerPolicy.ABSTAIN_WHEN_UNGROUNDED:
            raise ValueError("GROUNDED_ANSWER_MUST_ABSTAIN_WHEN_UNGROUNDED")
        return v

    @field_validator(
        "documents_retrieved",
        "draft_mutations",
        "model_invocations",
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("CLAIM_CITATION_MUST_NOT_RETRIEVE_OR_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
