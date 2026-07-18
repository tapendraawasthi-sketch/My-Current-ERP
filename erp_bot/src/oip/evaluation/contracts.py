"""MAI-04 evaluation contracts — Pydantic v2."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EvalContractBase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


class LanguageForm(str, Enum):
    ENGLISH = "ENGLISH"
    DEVANAGARI_NEPALI = "DEVANAGARI_NEPALI"
    ROMANIZED_NEPALI = "ROMANIZED_NEPALI"
    CODE_MIXED = "CODE_MIXED"


class ScriptMix(str, Enum):
    LATIN = "LATIN"
    DEVANAGARI = "DEVANAGARI"
    MIXED = "MIXED"
    OTHER = "OTHER"


class InteractionMode(str, Enum):
    ASK = "ask"
    ACCOUNTANT = "accountant"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ReviewStatus(str, Enum):
    DRAFT = "DRAFT"
    ENGINEERING_REVIEWED = "ENGINEERING_REVIEWED"
    LINGUIST_REVIEW_REQUIRED = "LINGUIST_REVIEW_REQUIRED"
    ACCOUNTING_REVIEW_REQUIRED = "ACCOUNTING_REVIEW_REQUIRED"
    SECURITY_REVIEWED = "SECURITY_REVIEWED"
    PROFESSIONAL_REVIEW_REQUIRED = "PROFESSIONAL_REVIEW_REQUIRED"
    FROZEN = "FROZEN"


class Split(str, Enum):
    FROZEN = "frozen"
    DEV = "dev"
    HOLD = "hold"


class TurnRole(str, Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"
    TOOL = "TOOL"
    SYSTEM_FIXTURE = "SYSTEM_FIXTURE"


class EvalResultStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    ERROR = "ERROR"
    BLOCKED = "BLOCKED"
    SKIPPED = "SKIPPED"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"


class EvalMode(str, Enum):
    COMPONENT = "component"
    PIPELINE_IN_PROCESS = "pipeline_in_process"
    LIVE_SHADOW = "live_shadow"


class ConversationTurnV1(EvalContractBase):
    role: TurnRole
    text: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class EvalInputV1(EvalContractBase):
    turns: tuple[ConversationTurnV1, ...] = ()
    user_text: str = ""
    active_draft_id: str | None = None
    unresolved_clarification: bool = False
    erp_fixture_ids: tuple[str, ...] = ()
    knowledge_fixture_ids: tuple[str, ...] = ()
    client_payload: dict[str, Any] = Field(default_factory=dict)
    seed: int = 0
    provider_policy: Literal["none", "fake", "live_opt_in"] = "none"

    @model_validator(mode="after")
    def _require_text(self) -> EvalInputV1:
        if not self.user_text and not any(t.role == TurnRole.USER and t.text for t in self.turns):
            raise ValueError("EvalInputV1 requires user_text or USER turn")
        return self

    def primary_user_text(self) -> str:
        if self.user_text:
            return self.user_text
        for t in reversed(self.turns):
            if t.role == TurnRole.USER and t.text:
                return t.text
        return ""


class NumberRoleExpectationV1(EvalContractBase):
    surface: str
    role: str
    normalized_value: str | None = None
    unit: str | None = None


class ExpectedBehaviorV1(EvalContractBase):
    expected_response_types: tuple[str, ...] = ()
    expected_dialogue_act: str | None = None
    expected_turn_relation: str | None = None
    expected_intents: tuple[str, ...] = ()
    expected_event_types: tuple[str, ...] = ()
    expected_lifecycle: str | None = None
    expected_fields: dict[str, Any] = Field(default_factory=dict)
    expected_number_roles: tuple[NumberRoleExpectationV1, ...] = ()
    expected_missing_fields: tuple[str, ...] = ()
    expected_ambiguous_fields: tuple[str, ...] = ()
    expected_tool_calls: tuple[str, ...] = ()
    expected_evidence_classes: tuple[str, ...] = ()
    expected_clarification_targets: tuple[str, ...] = ()
    expected_language_form: LanguageForm | None = None
    expected_safe_outcome: str | None = None
    expected_schema_validity: bool = True
    expected_mutation_count: int = 0
    expected_receipt_count: int = 0
    expected_citation_behavior: str | None = None
    human_review_dimensions: tuple[str, ...] = ()
    # Component-mode expected constitution decision
    expected_policy_decision: str | None = None


class ProhibitedBehaviorV1(EvalContractBase):
    forbidden_response_types: tuple[str, ...] = ()
    forbidden_intents: tuple[str, ...] = ()
    forbidden_event_types: tuple[str, ...] = ()
    forbidden_tool_calls: tuple[str, ...] = ()
    forbidden_assumptions: tuple[str, ...] = ()
    forbidden_fields: tuple[str, ...] = ()
    forbidden_mutations: bool = True
    forbidden_receipts: bool = False
    forbidden_citations: bool = False
    forbidden_sensitive_output: bool = True
    forbidden_language_shift: bool = False
    forbidden_draft_merge: bool = False
    forbidden_default_purchase: bool = False
    forbidden_number_roles: tuple[str, ...] = ()
    critical: bool = False


class TrustedTestScopeV1(EvalContractBase):
    tenant_id: str = "eval-tenant-mai04"
    company_id: str = "eval-company-mai04"
    principal_id: str = "eval-principal-mai04"
    roles: tuple[str, ...] = ("accountant",)
    permissions: tuple[str, ...] = ("oip:read", "oip:draft")

    @field_validator("tenant_id", "company_id")
    @classmethod
    def _no_production_ids(cls, v: str) -> str:
        lowered = v.lower()
        if any(x in lowered for x in ("prod", "live-", "real-", "customer-")):
            raise ValueError("production-like tenant/company forbidden in eval scope")
        if not v.startswith("eval-"):
            raise ValueError("test scope ids must start with eval-")
        return v


class ScoringConfigV1(EvalContractBase):
    weigh_schema: float = 1.0
    weigh_classification: float = 1.0
    weigh_number_roles: float = 1.0
    weigh_response: float = 1.0
    weigh_safety: float = 1.0
    critical_safety_zero_tolerance: bool = True


class EvalCaseV1(EvalContractBase):
    schema_version: str = "1.0.0"
    case_id: str
    case_version: str = "1"
    suite_id: str
    title: str
    description: str = ""
    input: EvalInputV1
    initial_state: dict[str, Any] = Field(default_factory=dict)
    trusted_test_scope: TrustedTestScopeV1 = Field(default_factory=TrustedTestScopeV1)
    mode: InteractionMode
    expected: ExpectedBehaviorV1 = Field(default_factory=ExpectedBehaviorV1)
    prohibited: ProhibitedBehaviorV1 = Field(default_factory=ProhibitedBehaviorV1)
    scoring: ScoringConfigV1 = Field(default_factory=ScoringConfigV1)
    tags: tuple[str, ...] = ()
    severity: Severity
    language_form: LanguageForm
    script_mix: ScriptMix
    domain: str = "accounting"
    source_provenance: str = "engineering_synthetic_mai04"
    review_status: ReviewStatus
    scenario_group_id: str
    split: Split = Split.FROZEN
    prohibited_for_training: bool = True
    content_hash: str = ""

    @field_validator("case_id")
    @classmethod
    def _case_id(cls, v: str) -> str:
        if not v or len(v) > 128 or " " in v:
            raise ValueError("invalid case_id")
        return v

    @model_validator(mode="after")
    def _training_lock(self) -> EvalCaseV1:
        if self.split == Split.FROZEN and not self.prohibited_for_training:
            raise ValueError("frozen cases must set prohibited_for_training=true")
        return self


class EvalManifestFileV1(EvalContractBase):
    path: str
    sha256: str
    case_count: int
    suite_id: str


class EvalManifestV1(EvalContractBase):
    schema_version: str = "1.0.0"
    manifest_id: str
    dataset_version: str
    description: str = ""
    frozen: bool = True
    files: tuple[EvalManifestFileV1, ...]
    total_cases: int
    created_at: str
    runner_compatible: tuple[str, ...] = ("mai-04.1.0",)
    dataset_hash: str = ""


class EvalRunV1(EvalContractBase):
    schema_version: str = "1.0.0"
    run_id: str
    dataset_manifest_id: str
    dataset_hash: str
    code_commit: str = "unknown"
    working_tree_state: Literal["clean", "dirty", "unknown"] = "unknown"
    mode: EvalMode
    seed: int = 0
    model_provider: str | None = None
    model_name: str | None = None
    model_revision: str | None = None
    prompt_versions: dict[str, str] = Field(default_factory=dict)
    contract_schema_version: str = "1.0.0"
    constitution_policy_version: str = "mai-01.1.0"
    trace_redaction_version: str = "mai-03.1.0"
    knowledge_release: str | None = None
    tool_versions: dict[str, str] = Field(default_factory=dict)
    environment_class: str = "local_dev"
    started_at: str
    completed_at: str | None = None
    case_count: int = 0
    blocked_case_count: int = 0
    runner_version: str = "mai-04.1.0"


class ScorerResultV1(EvalContractBase):
    scorer: str
    passed: bool
    score: float | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    critical: bool = False


class EvalResultV1(EvalContractBase):
    schema_version: str = "1.0.0"
    run_id: str
    case_id: str
    status: EvalResultStatus
    actual_structured_output: dict[str, Any] = Field(default_factory=dict)
    scorer_results: tuple[ScorerResultV1, ...] = ()
    critical_failures: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    trace_reference: str | None = None
    latency: dict[str, float | int] = Field(default_factory=dict)
    resource_observations: dict[str, Any] = Field(default_factory=dict)
    safe_error_code: str | None = None
    component_versions: dict[str, str] = Field(default_factory=dict)


def canonical_json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content_hash_case(case: EvalCaseV1) -> str:
    payload = case.model_dump(mode="json", exclude={"content_hash"})
    return sha256_bytes(canonical_json_bytes(payload))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
