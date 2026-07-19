"""MAI-13 object-reference candidates + store resolutions — never merge; never post."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ObjectReferenceStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class ObjectReferenceKind(str, Enum):
    CONVERSATION = "CONVERSATION"
    ACTIVE_DRAFT = "ACTIVE_DRAFT"
    UI_CONTEXT_OBJECT = "UI_CONTEXT_OBJECT"
    UNKNOWN = "UNKNOWN"


class ObjectReferenceResolutionStatus(str, Enum):
    FOUND = "FOUND"
    MISSING = "MISSING"
    NOT_PENDING = "NOT_PENDING"
    CONVERSATION_FOUND = "CONVERSATION_FOUND"
    CONVERSATION_MISSING = "CONVERSATION_MISSING"
    SKIPPED = "SKIPPED"
    UNKNOWN = "UNKNOWN"


class ObjectReferenceCandidateV1(ContractBase):
    candidate_id: str
    kind: ObjectReferenceKind
    object_id: str
    source: str = "REQUEST"
    reason_codes: tuple[str, ...] = ()
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("OBJECT_REFERENCE_CANDIDATES_MUST_NOT_BE_APPLIED")
        return v


class ObjectReferenceResolutionV1(ContractBase):
    """Read-only store projection for one candidate. Never merge authority."""

    candidate_id: str
    kind: ObjectReferenceKind
    object_id: str
    resolution_status: ObjectReferenceResolutionStatus
    store_name: str | None = None
    draft_kind: str | None = None
    draft_status: str | None = None
    conversation_status: str | None = None
    reason_codes: tuple[str, ...] = ()
    applied: bool = False

    @field_validator("applied")
    @classmethod
    def _never_applied(cls, v: bool) -> bool:
        if v:
            raise ValueError("OBJECT_REFERENCE_RESOLUTIONS_MUST_NOT_BE_APPLIED")
        return v


class ObjectReferenceBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ObjectReferenceStatus = ObjectReferenceStatus.NOT_RUN
    runtime_version: str = "mai-13.0.2-slice2"
    source_authority: str = "REQUEST"
    candidates: tuple[ObjectReferenceCandidateV1, ...] = ()
    resolutions: tuple[ObjectReferenceResolutionV1, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    candidate_count: int = Field(ge=0, default=0)
    resolution_count: int = Field(ge=0, default=0)
    found_count: int = Field(ge=0, default=0)
    missing_count: int = Field(ge=0, default=0)
    not_pending_count: int = Field(ge=0, default=0)
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
            raise ValueError("OBJECT_REFERENCE_MUST_NOT_MUTATE")
        return v
