"""Turn relation and intent candidate contracts — classifiers deferred to later MAI."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ConfidenceV1, ContractBase, EvidenceReferenceV1, SourceSpanV1, default_schema_version
from .registry import get_contract_registry


class TurnRelationKind(str, Enum):
    NEW_TOPIC = "NEW_TOPIC"
    CONTINUE_EXPLICIT_DRAFT = "CONTINUE_EXPLICIT_DRAFT"
    CONTINUE_ACTIVE_DRAFT = "CONTINUE_ACTIVE_DRAFT"
    ANSWER_CLARIFICATION = "ANSWER_CLARIFICATION"
    CORRECT_ACTIVE_DRAFT = "CORRECT_ACTIVE_DRAFT"
    CANCEL_ACTIVE_DRAFT = "CANCEL_ACTIVE_DRAFT"
    CONFIRMATION_INTENT = "CONFIRMATION_INTENT"
    REFER_TO_PRIOR_ANSWER = "REFER_TO_PRIOR_ANSWER"
    COMPARE_PRIOR_RESULTS = "COMPARE_PRIOR_RESULTS"
    UNKNOWN = "UNKNOWN"


class ContractStatus(str, Enum):
    READY = "READY"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    NOT_RUN = "NOT_RUN"


class TurnRelationV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    relation: TurnRelationKind = TurnRelationKind.UNKNOWN
    referenced_object_ids: tuple[str, ...] = ()
    evidence_spans: tuple[SourceSpanV1, ...] = ()
    alternatives: tuple[TurnRelationKind, ...] = ()
    confidence: ConfidenceV1 | None = None
    classifier_version: str = "none"
    status: ContractStatus = ContractStatus.NOT_RUN

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @property
    def is_execution_authority(self) -> bool:
        """CONFIRMATION_INTENT is never execution authority."""
        return False


class IntentCandidateV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    intent_id: str = Field(min_length=1, max_length=128)
    domain: str = "unknown"
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    required_capability: str | None = None
    evidence_spans: tuple[SourceSpanV1, ...] = ()
    missing_context: tuple[str, ...] = ()
    out_of_distribution_score: float = Field(default=0.0, ge=0.0, le=1.0)
    classifier_version: str = "none"
    status: ContractStatus = ContractStatus.NOT_RUN
    evidence_refs: tuple[EvidenceReferenceV1, ...] = ()

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("intent_id")
    @classmethod
    def _intent(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("intent_id cannot be empty")
        return v

    @property
    def grants_capability(self) -> bool:
        """Score/capability fields never authorize — MAI-01 policy decides."""
        return False
