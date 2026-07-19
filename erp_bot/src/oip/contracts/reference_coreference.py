"""MAI-15 reference / coreference / correction candidates — never apply."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .dialogue import TurnRelationKind
from .registry import get_contract_registry


class ReferenceCoreferenceStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class MentionKind(str, Enum):
    PARTY = "PARTY"
    AMOUNT = "AMOUNT"
    DRAFT = "DRAFT"
    PRIOR_ANSWER = "PRIOR_ANSWER"
    PRIOR_RESULT = "PRIOR_RESULT"
    UNKNOWN = "UNKNOWN"


class MentionResolutionStatus(str, Enum):
    RESOLVED = "RESOLVED"
    AMBIGUOUS = "AMBIGUOUS"
    UNRESOLVED = "UNRESOLVED"
    SKIPPED = "SKIPPED"


class CorrectionTargetKind(str, Enum):
    AMOUNT = "AMOUNT"
    PARTY = "PARTY"
    FIELD = "FIELD"
    DRAFT = "DRAFT"
    UNKNOWN = "UNKNOWN"


class CorrectionCueKind(str, Enum):
    REPLACE_AMOUNT = "REPLACE_AMOUNT"
    NEGATE_REPLACE = "NEGATE_REPLACE"
    GENERIC_CORRECT = "GENERIC_CORRECT"
    UNKNOWN = "UNKNOWN"


class DiscourseMentionV1(ContractBase):
    mention_id: str
    kind: MentionKind
    surface_cue: str = ""
    reason_codes: tuple[str, ...] = ()
    referent_object_id: str | None = None
    resolution_status: MentionResolutionStatus = MentionResolutionStatus.UNRESOLVED
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("DISCOURSE_MENTIONS_MUST_NOT_BE_APPLIED")
        return v


class CorrectionCandidateV1(ContractBase):
    correction_id: str
    target_kind: CorrectionTargetKind
    cue_kind: CorrectionCueKind
    proposed_value_surface: str | None = None
    linked_mention_ids: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = ()
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("CORRECTION_CANDIDATES_MUST_NOT_BE_APPLIED")
        return v


class AppliedCorrectionReceiptV1(ContractBase):
    """Proof of a draft field write driven by MAI-15 (not candidate.applied)."""

    correction_id: str
    draft_id: str
    field_name: str
    value_surface: str
    cue_kind: str
    pending_kind: str
    runtime_version: str = "mai-15.0.2-slice2"
    applied: bool = True

    @field_validator("applied")
    @classmethod
    def _must_be_applied(cls, v: bool) -> bool:
        if not v:
            raise ValueError("APPLIED_CORRECTION_RECEIPT_MUST_BE_APPLIED")
        return v


class ReferenceCoreferenceBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ReferenceCoreferenceStatus = ReferenceCoreferenceStatus.NOT_RUN
    runtime_version: str = "mai-15.0.2-slice2"
    source_authority: str = "REQUEST"
    turn_relation_echo: TurnRelationKind | None = None
    mentions: tuple[DiscourseMentionV1, ...] = ()
    corrections: tuple[CorrectionCandidateV1, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    mention_count: int = Field(ge=0, default=0)
    correction_count: int = Field(ge=0, default=0)
    resolved_count: int = Field(ge=0, default=0)
    ambiguous_count: int = Field(ge=0, default=0)
    silent_applications: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)

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

    @field_validator("silent_applications", "draft_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("REFERENCE_COREFERENCE_MUST_NOT_MUTATE")
        return v
