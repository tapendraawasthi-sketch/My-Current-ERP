"""MAI-08 typo / abbreviation / code-mix candidate contracts — never applied as truth."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class TypoCodeMixStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


class TypoCodeMixCandidateKind(str, Enum):
    TYPO_VARIANT = "TYPO_VARIANT"
    ABBREVIATION_EXPAND = "ABBREVIATION_EXPAND"
    CODE_MIX_FEATURE = "CODE_MIX_FEATURE"


class TypoCodeMixCandidateV1(ContractBase):
    candidate_id: str
    kind: TypoCodeMixCandidateKind
    original_surface: str
    candidate_surface: str
    raw_start: int = Field(ge=0)
    raw_end: int = Field(ge=0)
    reason_codes: tuple[str, ...] = ()
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("TYPO_CODE_MIX_CANDIDATES_MUST_NOT_BE_APPLIED")
        return v


class TypoCodeMixBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: TypoCodeMixStatus = TypoCodeMixStatus.NOT_RUN
    runtime_version: str = "mai-08.0.2-slice2"
    resource_version: str = "mai-08.0.1-slice1"
    offset_unit: str = "UNICODE_CODE_POINT"
    source_authority: str = "RAW"
    candidates: tuple[TypoCodeMixCandidateV1, ...] = ()
    code_mix_features: dict[str, Any] = Field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    candidate_count: int = Field(ge=0, default=0)

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

    @field_validator("silent_applications")
    @classmethod
    def _no_silent(cls, v: int) -> int:
        if v != 0:
            raise ValueError("SILENT_APPLICATIONS_MUST_BE_ZERO")
        return v
