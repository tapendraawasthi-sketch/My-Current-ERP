"""Language frame contracts — structure only; MAI-05 owns analysis."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from .common import ConfidenceV1, ContractBase, SourceSpanV1, default_schema_version
from .normalization import NormalizationBundleV1
from .registry import get_contract_registry
from .transliteration import TransliterationBundleV1
from .typo_code_mix import TypoCodeMixBundleV1
from .number_roles import NumberRoleBundleV1


class AnalysisStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    PARTIAL = "PARTIAL"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class SpanAnnotationV1(ContractBase):
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=0)
    original_text: str
    script: str = "UNKNOWN"
    language_form: str = "UNKNOWN"
    normalized_candidates: tuple[str, ...] = ()
    confidence: ConfidenceV1 | None = None
    protected_reason: str | None = None
    offset_unit: str = "UNICODE_CODE_POINT"

    @field_validator("end_offset")
    @classmethod
    def _end(cls, v: int, info: Any) -> int:
        start = info.data.get("start_offset", 0)
        if v < start:
            raise ValueError("end_offset must be >= start_offset")
        return v


class LanguageFrameV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: AnalysisStatus = AnalysisStatus.NOT_RUN
    raw_text: str = Field(min_length=1)
    unicode_normalized_view: str | None = None
    span_annotations: tuple[SpanAnnotationV1, ...] = ()
    language_distribution: dict[str, float] = Field(default_factory=dict)
    dominant_response_language: str | None = None
    linguistic_register: str | None = None
    code_mix_pattern: str | None = None
    transliteration_candidates: tuple[str, ...] = ()
    # MAI-07: typed candidate-only transliteration bundle (never replaces raw_text)
    transliteration_bundle: TransliterationBundleV1 | None = None
    normalization_edits: tuple[dict[str, Any], ...] = ()
    protected_spans: tuple[SourceSpanV1, ...] = ()
    number_candidates: tuple[dict[str, Any], ...] = ()
    date_candidates: tuple[dict[str, Any], ...] = ()
    entity_surface_candidates: tuple[dict[str, Any], ...] = ()
    ambiguity_flags: tuple[str, ...] = ()
    analyzer_versions: dict[str, str] = Field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    # MAI-05 extensions (optional / defaulted — schema 1.0.0 compatible)
    offset_unit: str = "UNICODE_CODE_POINT"
    input_quality_flags: tuple[str, ...] = ()
    protected_span_kinds: tuple[str, ...] = ()
    # MAI-06: typed lossless normalization bundle (never replaces raw_text)
    normalization_bundle: NormalizationBundleV1 | None = None
    # MAI-08: candidate-only typo / abbreviation / code-mix features
    typo_code_mix_bundle: TypoCodeMixBundleV1 | None = None
    # MAI-09: number / duration / ID role candidates
    number_role_bundle: NumberRoleBundleV1 | None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @classmethod
    def not_run(cls, raw_text: str) -> LanguageFrameV1:
        """Explicit empty analysis — never fabricate."""
        return cls(analysis_status=AnalysisStatus.NOT_RUN, raw_text=raw_text)
