"""MAI-25 structural segmentation — annotation only (no OCR / extraction mutate)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class StructuralSegmentationStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class StructuralSegmentKind(str, Enum):
    HEADING = "HEADING"
    RECORD_BLOCK = "RECORD_BLOCK"
    TABLE_CUE = "TABLE_CUE"
    LIST_ITEM = "LIST_ITEM"
    FREE_TEXT = "FREE_TEXT"
    UNKNOWN = "UNKNOWN"


class StructuralSegmentV1(ContractBase):
    segment_id: str = Field(min_length=1, max_length=64)
    kind: StructuralSegmentKind = StructuralSegmentKind.UNKNOWN
    start_offset: int = Field(ge=0, default=0)
    end_offset: int = Field(ge=0, default=0)
    preview: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason_codes: tuple[str, ...] = ()


class StructuralSegmentationBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: StructuralSegmentationStatus = (
        StructuralSegmentationStatus.NOT_RUN
    )
    runtime_version: str = "mai-25.0.1-slice1"
    source_authority: str = "REQUEST"
    segments: tuple[StructuralSegmentV1, ...] = ()
    segment_count: int = Field(ge=0, default=0)
    ocr_recommended: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    ocr_invocations: int = Field(ge=0, default=0)
    extraction_mutations: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    index_mutations: int = Field(ge=0, default=0)

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
        "ocr_invocations",
        "extraction_mutations",
        "draft_mutations",
        "index_mutations",
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("STRUCTURAL_SEGMENTATION_MUST_NOT_OCR_OR_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
