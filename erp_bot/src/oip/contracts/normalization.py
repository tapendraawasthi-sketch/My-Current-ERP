"""MAI-06 lossless normalization contracts — derived views never replace raw text."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, SourceSpanV1, default_schema_version
from .registry import get_contract_registry


class NormalizationStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class ViewType(str, Enum):
    RAW = "RAW"
    UNICODE_CANONICAL = "UNICODE_CANONICAL"
    SAFE_SEMANTIC = "SAFE_SEMANTIC"
    RETRIEVAL = "RETRIEVAL"
    DISPLAY_CANDIDATE = "DISPLAY_CANDIDATE"


class NormalizationOperation(str, Enum):
    UNICODE_NFC = "UNICODE_NFC"
    WHITESPACE_CODEPOINT_STANDARDIZATION = "WHITESPACE_CODEPOINT_STANDARDIZATION"
    WHITESPACE_COLLAPSE = "WHITESPACE_COLLAPSE"
    LINE_ENDING_STANDARDIZATION = "LINE_ENDING_STANDARDIZATION"
    LATIN_CASEFOLD = "LATIN_CASEFOLD"
    ASCII_DEVANAGARI_DIGIT_EQUIVALENCE = "ASCII_DEVANAGARI_DIGIT_EQUIVALENCE"
    PUNCTUATION_EQUIVALENCE_CANDIDATE = "PUNCTUATION_EQUIVALENCE_CANDIDATE"
    QUOTE_EQUIVALENCE_CANDIDATE = "QUOTE_EQUIVALENCE_CANDIDATE"
    DASH_EQUIVALENCE_CANDIDATE = "DASH_EQUIVALENCE_CANDIDATE"
    ABBREVIATION_EXPANSION_CANDIDATE = "ABBREVIATION_EXPANSION_CANDIDATE"
    REPETITION_REDUCTION_CANDIDATE = "REPETITION_REDUCTION_CANDIDATE"
    CONTROL_CHARACTER_REVIEW = "CONTROL_CHARACTER_REVIEW"
    ZERO_WIDTH_REVIEW = "ZERO_WIDTH_REVIEW"
    BIDI_CONTROL_REVIEW = "BIDI_CONTROL_REVIEW"
    UNKNOWN_EDIT = "UNKNOWN_EDIT"


class SafetyClass(str, Enum):
    SAFE_AUTOMATIC = "SAFE_AUTOMATIC"
    RETRIEVAL_ONLY = "RETRIEVAL_ONLY"
    CANDIDATE_ONLY = "CANDIDATE_ONLY"
    SECURITY_REVIEW_REQUIRED = "SECURITY_REVIEW_REQUIRED"
    PROHIBITED = "PROHIBITED"


class ProtectedSpanInteraction(str, Enum):
    OUTSIDE_PROTECTED = "OUTSIDE_PROTECTED"
    COPIED_UNCHANGED = "COPIED_UNCHANGED"
    OVERLAP_REJECTED = "OVERLAP_REJECTED"
    CALLER_DECLARED_PROTECTED = "CALLER_DECLARED_PROTECTED"


class MappingKind(str, Enum):
    IDENTITY = "IDENTITY"
    ONE_TO_ONE = "ONE_TO_ONE"
    MANY_TO_ONE = "MANY_TO_ONE"
    ONE_TO_MANY = "ONE_TO_MANY"
    INSERTION = "INSERTION"
    DELETION_CANDIDATE_NOT_APPLIED = "DELETION_CANDIDATE_NOT_APPLIED"


class OffsetMapSegmentV1(ContractBase):
    raw_start: int = Field(ge=0)
    raw_end: int = Field(ge=0)
    normalized_start: int = Field(ge=0)
    normalized_end: int = Field(ge=0)
    edit_id: str | None = None
    mapping_kind: MappingKind = MappingKind.IDENTITY

    @model_validator(mode="after")
    def _bounds(self) -> OffsetMapSegmentV1:
        if self.raw_end < self.raw_start or self.normalized_end < self.normalized_start:
            raise ValueError("INVALID_OFFSET_SEGMENT")
        return self


class OffsetMapV1(ContractBase):
    offset_unit: str = "UNICODE_CODE_POINT"
    segments: tuple[OffsetMapSegmentV1, ...] = ()
    raw_length: int = Field(ge=0)
    normalized_length: int = Field(ge=0)
    mapping_version: str = "mai-06.1.0"


class NormalizationEditV1(ContractBase):
    edit_id: str
    raw_span: SourceSpanV1
    normalized_span: SourceSpanV1 | None = None
    operation: NormalizationOperation
    original_surface: str
    candidate_surface: str
    safety_class: SafetyClass
    applied_views: tuple[ViewType, ...] = ()
    rule_id: str
    rule_version: str = "mai-06.1.0"
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    reversible: bool = True
    protected_span_interaction: ProtectedSpanInteraction = ProtectedSpanInteraction.OUTSIDE_PROTECTED
    reason_code: str = ""
    alternatives: tuple[str, ...] = ()


class ReconstructionIntegrityV1(ContractBase):
    """Trusted artifact binding for structural reconstruction (not a digital signature)."""

    schema_version: str = "1.0.0"
    integrity_algorithm: str = "SHA-256"
    integrity_domain: str = "MOKXYA_NORMALIZATION_RECONSTRUCTION_V1"
    normalizer_version: str
    view_name: str
    offset_unit: str = "UNICODE_CODE_POINT"
    source_codepoint_length: int = Field(ge=0)
    view_codepoint_length: int = Field(ge=0)
    source_digest: str = Field(min_length=64, max_length=64)
    view_digest: str = Field(min_length=64, max_length=64)
    edits_digest: str = Field(min_length=64, max_length=64)
    offset_map_digest: str = Field(min_length=64, max_length=64)
    artifact_digest: str = Field(min_length=64, max_length=64)


class NormalizationViewV1(ContractBase):
    view_id: str
    view_type: ViewType
    text: str
    offset_map: OffsetMapV1
    applied_edit_ids: tuple[str, ...] = ()
    allowed_uses: tuple[str, ...] = ()
    status: NormalizationStatus = NormalizationStatus.COMPLETE
    # MAI-06C2: optional integrity descriptor for edit-based reconstruction (schema 1.0.0 compatible)
    integrity: ReconstructionIntegrityV1 | None = None


class NormalizationBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    raw_text: str
    offset_unit: str = "UNICODE_CODE_POINT"
    views: tuple[NormalizationViewV1, ...] = ()
    edits: tuple[NormalizationEditV1, ...] = ()
    protected_span_references: tuple[SourceSpanV1, ...] = ()
    input_quality_flags: tuple[str, ...] = ()
    normalizer_version: str = "mai-06.1.1"
    resource_pack_version: str = "mai-06.1.0"
    status: NormalizationStatus = NormalizationStatus.NOT_RUN
    warnings: tuple[str, ...] = ()

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    def view(self, view_type: ViewType | str) -> NormalizationViewV1 | None:
        vt = ViewType(view_type) if isinstance(view_type, str) else view_type
        for v in self.views:
            if v.view_type is vt:
                return v
        return None
