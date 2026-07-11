"""Quality Gate projectors — replay-safe and idempotent."""

from __future__ import annotations

from ...domain.entities import QualityEvaluation
from ..read_models.quality_gate_read_models import (
    QualityDecisionReadModel,
    QualityFindingReadModel,
    QualityMetricsReadModel,
)


class DecisionProjector:
    def project(self, evaluation: QualityEvaluation | None) -> QualityDecisionReadModel | None:
        if evaluation is None:
            return None
        decision = evaluation.decision
        return QualityDecisionReadModel(
            evaluation_id=evaluation.evaluation_id,
            execution_id=evaluation.execution_id,
            route_id=evaluation.route_id,
            plan_id=evaluation.plan_id,
            request_id=evaluation.request_id,
            tenant_id=evaluation.tenant_id,
            company_id=evaluation.company_id,
            conversation_id=evaluation.conversation_id,
            correlation_id=evaluation.correlation_id,
            status=evaluation.status.value,
            decision=decision.outcome.value if decision else None,
            minimum_gate=evaluation.minimum_gate,
            l3_enabled=evaluation.l3_enabled,
            warning_count=decision.warning_count if decision else 0,
            violation_count=decision.violation_count if decision else 0,
            risk_score=evaluation.risk.score if evaluation.risk else None,
            overall_score=evaluation.score.overall if evaluation.score else None,
            blocking=decision.blocking if decision else False,
            requires_review=decision.requires_review if decision else False,
            summary=decision.summary if decision else "",
            created_at=evaluation.created_at.isoformat(),
            updated_at=evaluation.updated_at.isoformat(),
            decided_at=decision.decided_at if decision else None,
        )


class FindingProjector:
    def project(self, evaluation: QualityEvaluation | None) -> tuple[QualityFindingReadModel, ...]:
        if evaluation is None:
            return ()
        return tuple(
            QualityFindingReadModel(
                finding_id=f.finding_id,
                evaluation_id=f.evaluation_id,
                rule_id=f.rule_id,
                level=f.level.value,
                severity=f.severity.value,
                code=f.code,
                message=f.message,
                field_path=f.field_path,
                violation_kind=f.violation_kind.value,
                created_at=f.created_at,
            )
            for f in evaluation.findings
        )


class MetricsProjector:
    def project(self, metrics) -> QualityMetricsReadModel:
        if metrics is None:
            return QualityMetricsReadModel(tenant_id="", metric_date="")
        return metrics
