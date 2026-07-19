"""MAI-20 clarification plan — information-gain ranking (annotation only)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ClarificationPlanStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    NOT_NEEDED = "NOT_NEEDED"
    ASK = "ASK"
    SKIP = "SKIP"
    FAILED = "FAILED"


class ClarificationTargetKind(str, Enum):
    MISSING_REQUIRED = "missing_required"
    AMBIGUOUS = "ambiguous"


class ClarificationTargetV1(ContractBase):
    field_name: str = Field(min_length=1, max_length=128)
    kind: ClarificationTargetKind = ClarificationTargetKind.MISSING_REQUIRED
    information_gain_rank: int = Field(ge=1, default=1)
    reason_codes: tuple[str, ...] = ()


class ClarificationPlanBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ClarificationPlanStatus = ClarificationPlanStatus.NOT_RUN
    runtime_version: str = "mai-20.0.2-slice2"
    source_authority: str = "REQUEST"
    event_type: str | None = None
    frame_status: str | None = None
    targets: tuple[ClarificationTargetV1, ...] = ()
    primary_field: str | None = None
    question_text: str | None = None
    remaining_missing_required: tuple[str, ...] = ()
    remaining_ambiguous: tuple[str, ...] = ()
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
            raise ValueError("CLARIFICATION_PLAN_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
