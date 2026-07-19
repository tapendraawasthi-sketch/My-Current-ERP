"""MAI-25 extraction / OCR plan — annotation only (never invokes OCR)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ExtractionOcrPlanStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class ExtractionPlanStepKind(str, Enum):
    PARSE_TEXT_SEGMENT = "PARSE_TEXT_SEGMENT"
    PARSE_RECORD_BLOCK = "PARSE_RECORD_BLOCK"
    PARSE_TABLE_CUE = "PARSE_TABLE_CUE"
    PARSE_LIST_ITEM = "PARSE_LIST_ITEM"
    SKIP_OCR = "SKIP_OCR"
    OCR_CANDIDATE = "OCR_CANDIDATE"


class ExtractionPlanStepV1(ContractBase):
    step_id: str = Field(min_length=1, max_length=64)
    kind: ExtractionPlanStepKind
    segment_id: str | None = None
    reason_codes: tuple[str, ...] = ()


class ExtractionOcrPlanBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ExtractionOcrPlanStatus = ExtractionOcrPlanStatus.NOT_RUN
    runtime_version: str = "mai-25.0.2-slice2"
    source_authority: str = "REQUEST"
    steps: tuple[ExtractionPlanStepV1, ...] = ()
    step_count: int = Field(ge=0, default=0)
    ocr_candidate: bool = False
    ocr_execution_authorized: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    ocr_invocations: int = Field(ge=0, default=0)
    extraction_mutations: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    tool_executions: int = Field(ge=0, default=0)

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

    @field_validator("ocr_execution_authorized")
    @classmethod
    def _never_auth(cls, v: bool) -> bool:
        if v:
            raise ValueError("OCR_EXECUTION_MUST_NOT_BE_AUTHORIZED")
        return v

    @field_validator(
        "ocr_invocations",
        "extraction_mutations",
        "draft_mutations",
        "tool_executions",
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("EXTRACTION_OCR_PLAN_MUST_NOT_INVOKE_OR_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
