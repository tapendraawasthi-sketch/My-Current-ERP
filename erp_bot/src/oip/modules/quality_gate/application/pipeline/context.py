"""Quality Gate pipeline context."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from ....provider_runtime.domain.entities import ExecutionAggregate
from ....provider_runtime.domain.value_objects import ExecutionResult
from ...domain.value_objects import (
    QualityBudget,
    QualityDecision,
    QualityDecisionOutcome,
    QualityEvidence,
    QualityFinding,
    QualityGateRun,
    QualityLevel,
    QualityRecommendation,
    QualityRisk,
    QualityRule,
    QualityScore,
    QualityViolation,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class QualityPipelineContext:
    evaluation_id: str
    execution: ExecutionAggregate
    execution_result: ExecutionResult
    minimum_gate: QualityLevel
    l3_enabled: bool
    validation_context: dict[str, Any] = field(default_factory=dict)
    rules: tuple[QualityRule, ...] = field(default_factory=tuple)
    gate_runs: list[QualityGateRun] = field(default_factory=list)
    findings: list[QualityFinding] = field(default_factory=list)
    violations: list[QualityViolation] = field(default_factory=list)
    evidence: list[QualityEvidence] = field(default_factory=list)
    budget: QualityBudget | None = None
    risk: QualityRisk | None = None
    score: QualityScore | None = None
    recommendations: list[QualityRecommendation] = field(default_factory=list)
    decision: QualityDecision | None = None
    highest_gate_reached: QualityLevel = QualityLevel.L0
    blocked: bool = False
    failed: bool = False
    review_required: bool = False
    warning_count: int = 0
    audit_events: list[dict[str, Any]] = field(default_factory=list)
    outbox_events: list[str] = field(default_factory=list)
    started_at: str = field(default_factory=_utc_now_iso)

    def add_finding(self, finding: QualityFinding) -> None:
        self.findings.append(finding)
        if finding.severity.value == "warning":
            self.warning_count += 1
        elif finding.severity.value in ("error", "critical"):
            self.violations.append(
                QualityViolation(
                    violation_id=str(uuid.uuid4()),
                    evaluation_id=self.evaluation_id,
                    level=finding.level,
                    kind=finding.violation_kind,
                    code=finding.code,
                    message=finding.message,
                    blocking=finding.severity.value == "critical",
                    metadata=finding.metadata,
                )
            )

    def record_gate_run(
        self,
        *,
        level: QualityLevel,
        status: str,
        rule_count: int,
        finding_count: int,
        duration_ms: int,
    ) -> None:
        self.gate_runs.append(
            QualityGateRun(
                run_id=str(uuid.uuid4()),
                evaluation_id=self.evaluation_id,
                level=level,
                status=status,  # type: ignore[arg-type]
                rule_count=rule_count,
                finding_count=finding_count,
                started_at=self.started_at,
                completed_at=_utc_now_iso(),
                duration_ms=duration_ms,
            )
        )
        gate_order = (QualityLevel.L0, QualityLevel.L1, QualityLevel.L2, QualityLevel.L3)
        if gate_order.index(level) >= gate_order.index(self.highest_gate_reached):
            self.highest_gate_reached = level
