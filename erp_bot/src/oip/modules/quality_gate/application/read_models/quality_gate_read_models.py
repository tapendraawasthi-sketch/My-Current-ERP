"""Quality Gate read models — replay-safe."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class QualityDecisionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    evaluation_id: str
    execution_id: str
    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    status: str
    decision: str | None = None
    minimum_gate: str
    l3_enabled: bool
    warning_count: int = 0
    violation_count: int = 0
    risk_score: float | None = None
    overall_score: float | None = None
    blocking: bool = False
    requires_review: bool = False
    summary: str = ""
    created_at: str
    updated_at: str
    decided_at: str | None = None


class QualityFindingReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    finding_id: str
    evaluation_id: str
    rule_id: str
    level: str
    severity: str
    code: str
    message: str
    field_path: str | None = None
    violation_kind: str
    created_at: str


class QualityMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    metric_date: str
    evaluations_started: int = 0
    evaluations_passed: int = 0
    evaluations_pass_with_warning: int = 0
    evaluations_review_required: int = 0
    evaluations_failed: int = 0
    evaluations_blocked: int = 0
    evaluations_approved: int = 0
    evaluations_rejected: int = 0
    total_findings: int = 0
    total_warnings: int = 0
    avg_risk_score: float = 0.0
