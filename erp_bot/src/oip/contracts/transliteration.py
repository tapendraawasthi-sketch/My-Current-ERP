"""MAI-07 Romanized Nepali candidate transliteration contracts — candidates only, never truth."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, SourceSpanV1, default_schema_version
from .registry import get_contract_registry


class TransliterationStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class EligibilityDecision(str, Enum):
    GENERATE = "GENERATE"
    IDENTITY_ONLY = "IDENTITY_ONLY"
    ABSTAIN = "ABSTAIN"
    SKIPPED_PROTECTED = "SKIPPED_PROTECTED"
    SKIPPED_UNSUPPORTED = "SKIPPED_UNSUPPORTED"
    SKIPPED_SECURITY = "SKIPPED_SECURITY"
    SKIPPED_TOO_LONG = "SKIPPED_TOO_LONG"


class CandidateKind(str, Enum):
    IDENTITY = "IDENTITY"
    LEXICAL = "LEXICAL"
    GRAPHEME = "GRAPHEME"
    MORPHOLOGICAL = "MORPHOLOGICAL"
    PHRASE = "PHRASE"
    DOMAIN = "DOMAIN"
    CONTEXTUAL = "CONTEXTUAL"
    ABSTENTION = "ABSTENTION"


class CandidateScript(str, Enum):
    LATIN = "LATIN"
    DEVANAGARI = "DEVANAGARI"
    MIXED = "MIXED"
    OTHER = "OTHER"


class CalibrationStatus(str, Enum):
    UNCALIBRATED = "UNCALIBRATED"
    ENGINEERING_CALIBRATED = "ENGINEERING_CALIBRATED"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"


class UncertaintyClass(str, Enum):
    HIGH_EVIDENCE = "HIGH_EVIDENCE"
    MODERATE = "MODERATE"
    LOW_EVIDENCE = "LOW_EVIDENCE"
    AMBIGUOUS = "AMBIGUOUS"
    ABSTAIN = "ABSTAIN"


class AlignmentKind(str, Enum):
    ONE_TO_ONE = "ONE_TO_ONE"
    ONE_TO_MANY = "ONE_TO_MANY"
    MANY_TO_ONE = "MANY_TO_ONE"
    MANY_TO_MANY = "MANY_TO_MANY"
    IDENTITY = "IDENTITY"
    IDENTITY_GAP = "IDENTITY_GAP"


class AlignmentSegmentV1(ContractBase):
    raw_start: int = Field(ge=0)
    raw_end: int = Field(ge=0)
    candidate_start: int = Field(ge=0)
    candidate_end: int = Field(ge=0)
    alignment_kind: AlignmentKind = AlignmentKind.IDENTITY

    @model_validator(mode="after")
    def _bounds(self) -> AlignmentSegmentV1:
        if self.raw_end < self.raw_start or self.candidate_end < self.candidate_start:
            raise ValueError("INVALID_ALIGNMENT_SEGMENT")
        return self


class AlignmentMapV1(ContractBase):
    offset_unit: str = "UNICODE_CODE_POINT"
    segments: tuple[AlignmentSegmentV1, ...] = ()
    raw_length: int = Field(ge=0)
    candidate_length: int = Field(ge=0)
    mapping_version: str = "mai-07.1.0"


class TransliterationCandidateV1(ContractBase):
    candidate_id: str
    surface: str
    script: CandidateScript
    kind: CandidateKind
    rank: int = Field(ge=1)
    ranking_score: float
    uncertainty_class: UncertaintyClass = UncertaintyClass.MODERATE
    calibration_status: CalibrationStatus = CalibrationStatus.UNCALIBRATED
    provenance: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = ()
    alignment: AlignmentMapV1
    is_identity: bool = False
    requires_review: bool = False


class TransliterationSpanV1(ContractBase):
    span_id: str
    raw_span: SourceSpanV1
    source_language_form: str
    eligibility: EligibilityDecision
    decision_reason_codes: tuple[str, ...] = ()
    candidates: tuple[TransliterationCandidateV1, ...] = ()
    identity_candidate_id: str | None = None
    is_protected: bool = False
    is_ambiguous: bool = False
    is_name_like: bool = False
    truncated: bool = False
    # MAI-07R3H2: span-level review/disposition authority (interpretation decision).
    review_required: bool = False
    review_reason_codes: tuple[str, ...] = ()
    disposition: str | None = None
    policy_version: str | None = None


class TransliterationHypothesisV1(ContractBase):
    hypothesis_id: str
    candidate_refs: tuple[str, ...] = ()
    preview_surface: str = ""
    aggregate_ranking_score: float = 0.0
    alignment: AlignmentMapV1 | None = None
    status: str = "CANDIDATE_ONLY"
    authoritative: bool = False


class TransliterationBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: TransliterationStatus = TransliterationStatus.NOT_RUN
    runtime_version: str = "mai-07.1.0"
    resource_version: str = "mai-07.1.0"
    resource_hash: str = ""
    offset_unit: str = "UNICODE_CODE_POINT"
    source_authority: str = "RAW"
    matching_view: str = "RAW"
    span_results: tuple[TransliterationSpanV1, ...] = ()
    hypotheses: tuple[TransliterationHypothesisV1, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    eligible_span_count: int = Field(ge=0, default=0)
    candidate_count: int = Field(ge=0, default=0)
    abstention_count: int = Field(ge=0, default=0)
    truncated_count: int = Field(ge=0, default=0)
    identity_only_count: int = Field(ge=0, default=0)
    max_candidates_per_span: int = 5
    max_hypotheses: int = 5

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("source_authority")
    @classmethod
    def _src(cls, v: str) -> str:
        if v != "RAW":
            raise ValueError("SOURCE_AUTHORITY_MUST_BE_RAW")
        return v
