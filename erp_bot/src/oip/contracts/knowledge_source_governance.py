"""MAI-24 knowledge source / document governance — annotation only."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class KnowledgeSourceGovernanceStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class KnowledgeSourceGovernanceBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: KnowledgeSourceGovernanceStatus = (
        KnowledgeSourceGovernanceStatus.NOT_RUN
    )
    runtime_version: str = "mai-24.0.1-slice1"
    source_authority: str = "REQUEST"
    domain_key: str | None = None
    intent_family: str | None = None
    allowed_retrieval_collections: tuple[str, ...] = ()
    blocked_retrieval_collections: tuple[str, ...] = ()
    eligibility_policy: str = "production_eligible"
    allow_evaluation_corpus: bool = False
    citation_required: bool = True
    max_authority_level: str = "GOVERNMENT"
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    documents_retrieved: int = Field(ge=0, default=0)
    index_mutations: int = Field(ge=0, default=0)
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

    @field_validator(
        "documents_retrieved",
        "index_mutations",
        "draft_mutations",
        "model_invocations",
    )
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("KNOWLEDGE_SOURCE_GOVERNANCE_MUST_NOT_RETRIEVE_OR_MUTATE")
        return v

    @field_validator("allow_evaluation_corpus")
    @classmethod
    def _no_eval(cls, v: bool) -> bool:
        if v:
            raise ValueError("EVALUATION_CORPUS_MUST_NOT_BE_ALLOWED")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
