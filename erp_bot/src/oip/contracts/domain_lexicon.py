"""MAI-10 domain lexicon / concept ontology contracts — never mutate raw; never auto-route."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class DomainLexiconStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class DomainConceptCandidateV1(ContractBase):
    candidate_id: str
    surface: str
    concept_id: str
    language_form: str = "UNKNOWN"
    raw_start: int = Field(ge=0)
    raw_end: int = Field(ge=0)
    reason_codes: tuple[str, ...] = ()
    ambiguous: bool = False
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("DOMAIN_LEXICON_CANDIDATES_MUST_NOT_BE_APPLIED")
        return v


class DomainLexiconBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: DomainLexiconStatus = DomainLexiconStatus.NOT_RUN
    runtime_version: str = "mai-10.0.2-slice2"
    ontology_version: str = "mai-10.seed.v1"
    offset_unit: str = "UNICODE_CODE_POINT"
    source_authority: str = "RAW"
    candidates: tuple[DomainConceptCandidateV1, ...] = ()
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
