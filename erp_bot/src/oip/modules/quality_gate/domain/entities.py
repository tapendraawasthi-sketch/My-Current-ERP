"""Quality Gate domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    EvaluationStatus,
    ExecutionResultSnapshot,
    QualityBudget,
    QualityDecision,
    QualityEvidence,
    QualityFinding,
    QualityGateRun,
    QualityRecommendation,
    QualityRisk,
    QualityRule,
    QualityScore,
    QualityViolation,
)


class QualityEvaluation(BaseModel):
    """Root quality evaluation aggregate — immutable via model_copy."""

    model_config = ConfigDict(frozen=True)

    evaluation_id: str
    execution_id: str
    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str | None = None
    branch_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    status: EvaluationStatus
    minimum_gate: str
    l3_enabled: bool
    execution_result: ExecutionResultSnapshot
    gate_runs: tuple[QualityGateRun, ...] = Field(default_factory=tuple)
    rules_evaluated: tuple[QualityRule, ...] = Field(default_factory=tuple)
    findings: tuple[QualityFinding, ...] = Field(default_factory=tuple)
    violations: tuple[QualityViolation, ...] = Field(default_factory=tuple)
    evidence: tuple[QualityEvidence, ...] = Field(default_factory=tuple)
    budget: QualityBudget | None = None
    risk: QualityRisk | None = None
    score: QualityScore | None = None
    recommendations: tuple[QualityRecommendation, ...] = Field(default_factory=tuple)
    decision: QualityDecision | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    archived_at: datetime | None = None
