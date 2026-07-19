"""MAI-28 multilingual vector index — readiness annotation (no embed/query)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class VectorIndexStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class VectorIndexBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: VectorIndexStatus = VectorIndexStatus.NOT_RUN
    runtime_version: str = "mai-28.0.1-slice1"
    source_authority: str = "REQUEST"
    index_present: bool = False
    chroma_present: bool = False
    vector_backend: str = "CHROMA_OLLAMA"
    ollama_required: bool = True
    production_eligible: bool = False
    multilingual_capable: bool = False
    citations_verified: bool = False
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    documents_retrieved: int = Field(ge=0, default=0)
    index_mutations: int = Field(ge=0, default=0)
    query_executions: int = Field(ge=0, default=0)
    embed_invocations: int = Field(ge=0, default=0)

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

    @field_validator("production_eligible")
    @classmethod
    def _not_prod(cls, v: bool) -> bool:
        if v:
            raise ValueError("VECTOR_INDEX_MUST_NOT_CLAIM_PRODUCTION_ELIGIBLE")
        return v

    @field_validator("citations_verified")
    @classmethod
    def _no_cite(cls, v: bool) -> bool:
        if v:
            raise ValueError("VECTOR_INDEX_MUST_NOT_CLAIM_CITATIONS_VERIFIED")
        return v

    @field_validator(
        "documents_retrieved",
        "index_mutations",
        "query_executions",
        "embed_invocations",
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("VECTOR_INDEX_MUST_NOT_RETRIEVE_EMBED_OR_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
