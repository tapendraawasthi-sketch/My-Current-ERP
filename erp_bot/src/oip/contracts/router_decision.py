"""MAI-17 hierarchical router decision + OOD signal — annotation only."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .dialogue import IntentCandidateV1
from .registry import get_contract_registry


class RouterAnalysisStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class RouterDomain(str, Enum):
    ACCOUNTING = "ACCOUNTING"
    ERP_OPS = "ERP_OPS"
    REPORTING = "REPORTING"
    MASTER_DATA = "MASTER_DATA"
    DIALOGUE = "DIALOGUE"
    UNKNOWN = "UNKNOWN"


class IntentFamily(str, Enum):
    TRANSACTION = "TRANSACTION"
    QUERY = "QUERY"
    REPORT = "REPORT"
    MASTER = "MASTER"
    CLARIFY = "CLARIFY"
    CONFIRM = "CONFIRM"
    CANCEL = "CANCEL"
    QA = "QA"
    UNKNOWN = "UNKNOWN"


class OodSignalV1(ContractBase):
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    is_ood: bool = False
    abstain_recommended: bool = False
    reason_codes: tuple[str, ...] = ()


class RouterDecisionBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: RouterAnalysisStatus = RouterAnalysisStatus.NOT_RUN
    runtime_version: str = "mai-17.0.2-slice2"
    source_authority: str = "REQUEST"
    domain: RouterDomain = RouterDomain.UNKNOWN
    intent_family: IntentFamily = IntentFamily.UNKNOWN
    intent_hint: str | None = None
    operation_class: str | None = None
    operation_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    candidates: tuple[IntentCandidateV1, ...] = ()
    ood: OodSignalV1 = Field(default_factory=OodSignalV1)
    classifier_version: str = "mai-17.0.2-slice2"
    concept_ids: tuple[str, ...] = ()
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
            raise ValueError("ROUTER_DECISION_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
