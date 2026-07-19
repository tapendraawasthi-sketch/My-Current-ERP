"""MAI-18 event specification registry — annotation only."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class EventSpecAnalysisStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"


class EventSpecCandidateV1(ContractBase):
    spec_id: str = Field(min_length=1, max_length=128)
    event_type: str = "unknown"
    intent_family: str = "UNKNOWN"
    operation_class: str | None = None
    intent_hint: str | None = None
    required_fields: tuple[str, ...] = ()
    optional_fields: tuple[str, ...] = ()
    prohibited_assumptions: tuple[str, ...] = ()
    match_rank: int = Field(default=0, ge=0)
    match_reason_codes: tuple[str, ...] = ()
    selected: bool = False

    @field_validator("selected")
    @classmethod
    def _never_selected_apply(cls, v: bool) -> bool:
        # Slice 1: selected is annotation of best match only; never "applied".
        return v


class EventSpecRegistryBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: EventSpecAnalysisStatus = EventSpecAnalysisStatus.NOT_RUN
    runtime_version: str = "mai-18.0.2-slice2"
    source_authority: str = "REQUEST"
    candidates: tuple[EventSpecCandidateV1, ...] = ()
    selected_spec_id: str | None = None
    lookup_keys: dict[str, str | None] = Field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)

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

    @field_validator("silent_applications", "draft_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("EVENT_SPEC_REGISTRY_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
