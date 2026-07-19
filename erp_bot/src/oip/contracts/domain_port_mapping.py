"""MAI-31 EventFrame → domain port mapping — annotation only (never executes)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class DomainPortMappingStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class DomainPortSupportStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    UNSUPPORTED = "UNSUPPORTED"
    INCOMPLETE = "INCOMPLETE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class DomainPortFieldBindingV1(ContractBase):
    event_field: str = Field(min_length=1, max_length=64)
    draft_field: str = Field(min_length=1, max_length=64)
    required: bool = False
    reason_codes: tuple[str, ...] = ()


class DomainPortMappingCandidateV1(ContractBase):
    candidate_id: str = Field(min_length=1, max_length=64)
    port_id: str = Field(min_length=1, max_length=64)
    draft_entrypoint: str = Field(min_length=1, max_length=96)
    event_type: str = ""
    support_status: DomainPortSupportStatus = DomainPortSupportStatus.UNSUPPORTED
    field_bindings: tuple[DomainPortFieldBindingV1, ...] = ()
    reason_codes: tuple[str, ...] = ()


class DomainPortMappingBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: DomainPortMappingStatus = DomainPortMappingStatus.NOT_RUN
    runtime_version: str = "mai-31.0.1-slice1"
    source_authority: str = "REQUEST"
    support_status: DomainPortSupportStatus = DomainPortSupportStatus.NOT_APPLICABLE
    selected_port_id: str | None = None
    selected_draft_entrypoint: str | None = None
    event_type: str = "unknown"
    candidates: tuple[DomainPortMappingCandidateV1, ...] = ()
    field_bindings: tuple[DomainPortFieldBindingV1, ...] = ()
    master_lookup_mode: str = "ANNOTATION_ONLY"
    lookup_executed: bool = False
    port_executed: bool = False
    draft_mutations: int = Field(ge=0, default=0)
    dexie_invoked: bool = False
    journal_calculated: bool = False
    mode_aware_invoked: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()

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

    @field_validator("master_lookup_mode")
    @classmethod
    def _lookup_mode(cls, v: str) -> str:
        if v != "ANNOTATION_ONLY":
            raise ValueError("MASTER_LOOKUP_MUST_BE_ANNOTATION_ONLY")
        return v

    @field_validator(
        "lookup_executed",
        "port_executed",
        "dexie_invoked",
        "journal_calculated",
        "mode_aware_invoked",
    )
    @classmethod
    def _never_execute(cls, v: bool) -> bool:
        if v:
            raise ValueError("DOMAIN_PORT_MAPPING_MUST_NOT_EXECUTE")
        return v

    @field_validator("draft_mutations")
    @classmethod
    def _zero_mutations(cls, v: int) -> int:
        if v != 0:
            raise ValueError("DOMAIN_PORT_MAPPING_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
