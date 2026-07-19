"""MAI-11 response language / register policy contracts — never mute raw; never rewrite replies in slice 1."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ResponseRegisterStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class ResponseLanguageKind(str, Enum):
    NEPALI_DEVANAGARI = "NEPALI_DEVANAGARI"
    ROMANIZED_NEPALI = "ROMANIZED_NEPALI"
    ENGLISH = "ENGLISH"
    MIXED = "MIXED"
    UNKNOWN = "UNKNOWN"


class LinguisticRegisterKind(str, Enum):
    SHOP_INFORMAL = "SHOP_INFORMAL"
    ACCOUNTING_FORMAL = "ACCOUNTING_FORMAL"
    NEUTRAL = "NEUTRAL"
    UNKNOWN = "UNKNOWN"


class ResponseRegisterBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ResponseRegisterStatus = ResponseRegisterStatus.NOT_RUN
    runtime_version: str = "mai-11.0.1-slice1"
    offset_unit: str = "UNICODE_CODE_POINT"
    source_authority: str = "RAW"
    response_language: ResponseLanguageKind = ResponseLanguageKind.UNKNOWN
    linguistic_register: LinguisticRegisterKind = LinguisticRegisterKind.UNKNOWN
    mirror_user_language: bool = False
    honorific_cue: str | None = None
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    applied_response_rewrite: bool = False

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

    @field_validator("applied_response_rewrite")
    @classmethod
    def _no_rewrite(cls, v: bool) -> bool:
        if v:
            raise ValueError("RESPONSE_REWRITE_MUST_NOT_BE_APPLIED_IN_SLICE1")
        return v
