"""MAI-21 typed plan bundle — annotation only (no tool execution)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .plan_tools import PlanV1, ToolCallV1
from .registry import get_contract_registry


class TypedPlanAnalysisStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class TypedPlanBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: TypedPlanAnalysisStatus = TypedPlanAnalysisStatus.NOT_RUN
    runtime_version: str = "mai-21.0.1-slice1"
    source_authority: str = "REQUEST"
    event_type: str | None = None
    clarification_status: str | None = None
    plan: PlanV1 | None = None
    proposed_tool_calls: tuple[ToolCallV1, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    tool_executions: int = Field(ge=0, default=0)

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

    @field_validator("silent_applications", "draft_mutations", "tool_executions")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("TYPED_PLAN_MUST_NOT_MUTATE_OR_EXECUTE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
