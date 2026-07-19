"""MAI-29 hybrid fusion / evidence — policy annotation (no RRF / rerank execute)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class HybridFusionStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class HybridFusionMode(str, Enum):
    LEXICAL_ONLY = "LEXICAL_ONLY"
    RRF_CANDIDATE = "RRF_CANDIDATE"
    SKIP = "SKIP"
    UNKNOWN = "UNKNOWN"


class HybridFusionBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: HybridFusionStatus = HybridFusionStatus.NOT_RUN
    runtime_version: str = "mai-29.0.1-slice1"
    source_authority: str = "REQUEST"
    fusion_mode: HybridFusionMode = HybridFusionMode.UNKNOWN
    rrf_k: int = Field(ge=1, default=60)
    lexical_authoritative: bool = True
    rerank_authorized: bool = False
    fusion_executed: bool = False
    evidence_assembled: bool = False
    evidence_item_count: int = Field(ge=0, default=0)
    claims_verified: bool = False
    citations_verified: bool = False
    ollama_required_for_hybrid: bool = True
    hybrid_production_eligible: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    documents_retrieved: int = Field(ge=0, default=0)
    index_mutations: int = Field(ge=0, default=0)

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

    @field_validator("rerank_authorized", "fusion_executed", "evidence_assembled")
    @classmethod
    def _no_execute(cls, v: bool) -> bool:
        if v:
            raise ValueError("HYBRID_FUSION_MUST_NOT_EXECUTE_OR_ASSEMBLE")
        return v

    @field_validator(
        "claims_verified",
        "citations_verified",
        "hybrid_production_eligible",
    )
    @classmethod
    def _no_claims(cls, v: bool) -> bool:
        if v:
            raise ValueError("HYBRID_FUSION_MUST_NOT_CLAIM_VERIFIED_OR_PROD")
        return v

    @field_validator(
        "evidence_item_count",
        "documents_retrieved",
        "index_mutations",
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("HYBRID_FUSION_MUST_NOT_RETRIEVE_OR_ASSEMBLE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
