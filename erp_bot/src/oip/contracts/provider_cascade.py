"""MAI-22 provider cascade — annotation only (no model invocation)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ProviderCascadeAnalysisStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class ProviderCascadeBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ProviderCascadeAnalysisStatus = (
        ProviderCascadeAnalysisStatus.NOT_RUN
    )
    runtime_version: str = "mai-22.0.2-slice2"
    source_authority: str = "REQUEST"
    selected_provider_id: str | None = None
    selected_model_id: str | None = None
    cascade_order: tuple[str, ...] = ()
    fallback_chain: tuple[str, ...] = ()
    policy_name: str = "deterministic_default_v1"
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    silent_applications: int = Field(ge=0, default=0)
    draft_mutations: int = Field(ge=0, default=0)
    model_invocations: int = Field(ge=0, default=0)

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

    @field_validator("silent_applications", "draft_mutations", "model_invocations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("PROVIDER_CASCADE_MUST_NOT_INVOKE_OR_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
