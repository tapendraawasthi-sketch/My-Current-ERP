"""MAI-16 context assembly candidates + memory policy — annotation only."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ContextAssemblyStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class MemoryExpiryClass(str, Enum):
    SESSION = "SESSION"
    CONVERSATION = "CONVERSATION"
    TEMPORARY = "TEMPORARY"
    NONE = "NONE"


class ContextSliceKind(str, Enum):
    TRUSTED_SCOPE = "TRUSTED_SCOPE"
    ACTIVE_DRAFT = "ACTIVE_DRAFT"
    TURN_RELATION = "TURN_RELATION"
    REFERENCE_COREFERENCE = "REFERENCE_COREFERENCE"
    UNRESOLVED_CLARIFICATION = "UNRESOLVED_CLARIFICATION"
    ACTIVE_UI_CONTEXT = "ACTIVE_UI_CONTEXT"
    CONVERSATION_ID = "CONVERSATION_ID"
    UNKNOWN = "UNKNOWN"


class ContextFreshness(str, Enum):
    HOT = "HOT"
    WARM = "WARM"
    COLD = "COLD"
    UNKNOWN = "UNKNOWN"


class MemoryPolicyV1(ContractBase):
    read_allowed: bool = True
    write_allowed: bool = False
    expiry_class: MemoryExpiryClass = MemoryExpiryClass.CONVERSATION
    cross_company_allowed: bool = False
    erp_facts_source: str = "ERP_PREFERRED"
    max_tokens: int = Field(default=1200, ge=0)
    max_slices: int = Field(default=8, ge=0)

    @field_validator("write_allowed")
    @classmethod
    def _no_write(cls, v: bool) -> bool:
        if v:
            raise ValueError("MEMORY_POLICY_WRITE_MUST_BE_FALSE_SLICE1")
        return v

    @field_validator("cross_company_allowed")
    @classmethod
    def _no_cross(cls, v: bool) -> bool:
        if v:
            raise ValueError("MEMORY_POLICY_CROSS_COMPANY_FORBIDDEN")
        return v

    @field_validator("erp_facts_source")
    @classmethod
    def _erp_src(cls, v: str) -> str:
        if v not in {"ERP_PREFERRED", "MEMORY_OK", "FORBIDDEN"}:
            raise ValueError("INVALID_ERP_FACTS_SOURCE")
        return v


class ContextSliceCandidateV1(ContractBase):
    slice_id: str
    kind: ContextSliceKind
    priority: int = 0
    tokens_est: int = Field(ge=0, default=0)
    source_label: str = "REQUEST"
    freshness: ContextFreshness = ContextFreshness.UNKNOWN
    include_reason_codes: tuple[str, ...] = ()
    exclude_reason_codes: tuple[str, ...] = ()
    surface_summary: str = ""
    included: bool = False
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("CONTEXT_SLICES_MUST_NOT_BE_APPLIED")
        return v


class ContextAssemblyBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ContextAssemblyStatus = ContextAssemblyStatus.NOT_RUN
    runtime_version: str = "mai-16.0.2-slice2"
    source_authority: str = "REQUEST"
    memory_policy: MemoryPolicyV1 = Field(default_factory=MemoryPolicyV1)
    slices: tuple[ContextSliceCandidateV1, ...] = ()
    token_budget: int = Field(ge=0, default=1200)
    tokens_estimated: int = Field(ge=0, default=0)
    included_count: int = Field(ge=0, default=0)
    excluded_count: int = Field(ge=0, default=0)
    active_task_present: bool = False
    unresolved_clarification_present: bool = False
    company_id_echo: str | None = None
    tenant_id_echo: str | None = None
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    memory_writes: int = Field(ge=0, default=0)

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

    @field_validator("silent_applications", "draft_mutations", "memory_writes")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("CONTEXT_ASSEMBLY_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
