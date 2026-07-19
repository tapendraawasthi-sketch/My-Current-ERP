"""MAI-09 number-role candidate contracts — never mutate raw; never auto-post money."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class NumberRoleStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class NumberRoleKind(str, Enum):
    AMOUNT = "amount"
    QUANTITY = "quantity"
    DURATION = "duration"
    PERCENTAGE = "percentage"
    INVOICE_NUMBER = "invoice_number"
    IDENTIFIER = "identifier"
    DATE = "date"
    UNKNOWN = "unknown"


class NumberRoleCandidateV1(ContractBase):
    candidate_id: str
    surface: str
    role: NumberRoleKind
    normalized_value: str | None = None
    unit: str | None = None
    raw_start: int = Field(ge=0)
    raw_end: int = Field(ge=0)
    reason_codes: tuple[str, ...] = ()
    ambiguous: bool = False
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("NUMBER_ROLE_CANDIDATES_MUST_NOT_BE_APPLIED")
        return v


class NumberRoleBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: NumberRoleStatus = NumberRoleStatus.NOT_RUN
    runtime_version: str = "mai-09.0.1-slice1"
    offset_unit: str = "UNICODE_CODE_POINT"
    source_authority: str = "RAW"
    candidates: tuple[NumberRoleCandidateV1, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    candidate_count: int = Field(ge=0, default=0)
    silent_applications: int = Field(ge=0, default=0)

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
