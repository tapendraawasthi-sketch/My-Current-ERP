"""MAI-26 temporal / amendment / cross-reference — annotation only."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class TemporalCrossRefStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class TemporalCueKind(str, Enum):
    AS_OF_DATE = "AS_OF_DATE"
    FISCAL_YEAR = "FISCAL_YEAR"
    AMENDMENT_LANGUAGE = "AMENDMENT_LANGUAGE"
    EFFECTIVE_FROM_CUE = "EFFECTIVE_FROM_CUE"
    UNKNOWN = "UNKNOWN"


class CrossRefCueKind(str, Enum):
    DOCUMENT_REF = "DOCUMENT_REF"
    SECTION_REF = "SECTION_REF"
    ACT_RULE_REF = "ACT_RULE_REF"
    SUPERSEDES_CUE = "SUPERSEDES_CUE"
    UNKNOWN = "UNKNOWN"


class TemporalCueV1(ContractBase):
    cue_id: str = Field(min_length=1, max_length=64)
    kind: TemporalCueKind = TemporalCueKind.UNKNOWN
    surface: str = ""
    start_offset: int = Field(ge=0, default=0)
    end_offset: int = Field(ge=0, default=0)
    reason_codes: tuple[str, ...] = ()


class CrossRefCueV1(ContractBase):
    cue_id: str = Field(min_length=1, max_length=64)
    kind: CrossRefCueKind = CrossRefCueKind.UNKNOWN
    surface: str = ""
    start_offset: int = Field(ge=0, default=0)
    end_offset: int = Field(ge=0, default=0)
    reason_codes: tuple[str, ...] = ()


class TemporalCrossRefBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: TemporalCrossRefStatus = TemporalCrossRefStatus.NOT_RUN
    runtime_version: str = "mai-26.0.1-slice1"
    source_authority: str = "REQUEST"
    temporal_cues: tuple[TemporalCueV1, ...] = ()
    cross_ref_cues: tuple[CrossRefCueV1, ...] = ()
    as_of_candidate: str | None = None
    legal_effective_dates_proven: bool = False
    amendment_applied: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    documents_mutated: int = Field(ge=0, default=0)

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

    @field_validator("legal_effective_dates_proven", "amendment_applied")
    @classmethod
    def _never_proven(cls, v: bool) -> bool:
        if v:
            raise ValueError("TEMPORAL_CROSS_REF_MUST_NOT_CLAIM_PROVEN_OR_APPLY")
        return v

    @field_validator("silent_applications", "draft_mutations", "documents_mutated")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("TEMPORAL_CROSS_REF_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
