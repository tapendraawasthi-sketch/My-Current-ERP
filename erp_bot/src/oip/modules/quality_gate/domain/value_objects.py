"""Quality Gate domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class QualityLevel(str, Enum):
    L0 = "L0"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"


class QualityDecisionOutcome(str, Enum):
    PASS = "pass"
    PASS_WITH_WARNING = "pass_with_warning"
    REVIEW_REQUIRED = "review_required"
    FAIL = "fail"
    BLOCK = "block"


class EvaluationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class GateRunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class FindingSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ViolationKind(str, Enum):
    SCHEMA = "schema"
    ACCOUNTING = "accounting"
    BUSINESS_RULE = "business_rule"
    EVIDENCE = "evidence"
    AUTHORITY = "authority"
    FRESHNESS = "freshness"
    HASH = "hash"
    AI_QUALITY = "ai_quality"
    RISK = "risk"
    POLICY = "policy"


class QualityRule(BaseModel):
    model_config = ConfigDict(frozen=True)

    rule_id: str
    rule_code: str
    level: QualityLevel
    name: str
    description: str = ""
    mandatory: bool = True
    enabled: bool = True
    jurisdiction: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class QualityFinding(BaseModel):
    model_config = ConfigDict(frozen=True)

    finding_id: str
    evaluation_id: str
    rule_id: str
    level: QualityLevel
    severity: FindingSeverity
    code: str
    message: str
    field_path: str | None = None
    violation_kind: ViolationKind
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class QualityViolation(BaseModel):
    model_config = ConfigDict(frozen=True)

    violation_id: str
    evaluation_id: str
    level: QualityLevel
    kind: ViolationKind
    code: str
    message: str
    blocking: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class QualityEvidence(BaseModel):
    model_config = ConfigDict(frozen=True)

    evidence_id: str
    evaluation_id: str
    source: str
    authority: str
    content_hash: str
    snapshot_version: str = ""
    effective_date: str | None = None
    ttl_seconds: int = 300
    age_seconds: float = 0.0
    complete: bool = True
    verified: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class QualityBudget(BaseModel):
    model_config = ConfigDict(frozen=True)

    budget_id: str
    evaluation_id: str
    tenant_id: str
    max_findings: int = 100
    max_warnings: int = 50
    max_latency_ms: int = 5_000
    consumed_latency_ms: int = 0
    exceeded: bool = False


class QualityRisk(BaseModel):
    model_config = ConfigDict(frozen=True)

    risk_id: str
    evaluation_id: str
    score: float
    level: str
    factors: tuple[str, ...] = Field(default_factory=tuple)
    escalated: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class QualityScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    score_id: str
    evaluation_id: str
    overall: float
    l0_score: float = 1.0
    l1_score: float = 1.0
    l2_score: float = 1.0
    l3_score: float | None = None
    confidence: float = 1.0


class QualityRecommendation(BaseModel):
    model_config = ConfigDict(frozen=True)

    recommendation_id: str
    evaluation_id: str
    action: str
    reason: str
    priority: str = "normal"
    metadata: dict[str, Any] = Field(default_factory=dict)


class QualityDecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    decision_id: str
    evaluation_id: str
    outcome: QualityDecisionOutcome
    minimum_gate: QualityLevel
    highest_gate_reached: QualityLevel
    l3_enabled: bool
    warning_count: int = 0
    violation_count: int = 0
    blocking: bool = False
    requires_review: bool = False
    score: QualityScore | None = None
    risk: QualityRisk | None = None
    summary: str = ""
    decided_at: str


class QualityGateRun(BaseModel):
    model_config = ConfigDict(frozen=True)

    run_id: str
    evaluation_id: str
    level: QualityLevel
    status: GateRunStatus
    rule_count: int = 0
    finding_count: int = 0
    started_at: str
    completed_at: str | None = None
    duration_ms: int = 0


class ExecutionResultSnapshot(BaseModel):
    """Read-only snapshot of provider execution result — never mutated."""

    model_config = ConfigDict(frozen=True)

    result_id: str
    execution_id: str
    success: bool
    output_text: str = ""
    output_json: dict[str, Any] = Field(default_factory=dict)
    artifact_id: str | None = None
