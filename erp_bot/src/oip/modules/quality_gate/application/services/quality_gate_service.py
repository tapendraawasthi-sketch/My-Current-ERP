"""Quality Gate application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from ....provider_runtime.domain.entities import ExecutionAggregate
from ....provider_runtime.domain.value_objects import ExecutionResult
from ...domain.entities import QualityEvaluation
from ...domain.events import (
    QualityApprovedEvent,
    QualityArchivedEvent,
    QualityEscalatedEvent,
    QualityEvaluationStartedEvent,
    QualityGateFailedEvent,
    QualityGatePassedEvent,
    QualityRejectedEvent,
    QualityRuleTriggeredEvent,
    QualityWarningRaisedEvent,
    build_quality_event,
)
from ...domain.value_objects import (
    EvaluationStatus,
    ExecutionResultSnapshot,
    QualityBudget,
    QualityDecisionOutcome,
    QualityLevel,
)
from ..pipeline.pipeline import QualityGatePipeline
from ..ports.quality_gate_port import QualityGatePort
from ..ports.quality_repository_port import QualityRepositoryPort
from ..projectors.quality_gate_projectors import DecisionProjector, FindingProjector
from ..read_models.quality_gate_read_models import QualityDecisionReadModel, QualityFindingReadModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class QualityGateService(QualityGatePort):
    def __init__(
        self,
        *,
        pipeline: QualityGatePipeline,
        repository: QualityRepositoryPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
        execution_loader,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._execution_loader = execution_loader
        self._decision_projector = DecisionProjector()
        self._finding_projector = FindingProjector()

    async def start_evaluation(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        validation_context: dict | None = None,
    ) -> QualityEvaluation:
        if not self._settings.quality_enabled:
            raise ValueError("Quality gate module is disabled")

        execution = await self._execution_loader.get_by_id(tenant_id=tenant_id, execution_id=execution_id)
        if execution is None:
            raise ValueError(f"Execution not found: {execution_id}")
        if execution.result is None:
            raise ValueError(f"Execution has no result: {execution_id}")

        evaluation_id = str(uuid.uuid4())
        now = _utc_now()
        minimum_gate = self._resolve_minimum_gate()
        l3_enabled = self._settings.l3_enabled

        result_snapshot = ExecutionResultSnapshot(
            result_id=execution.result.result_id,
            execution_id=execution.result.execution_id,
            success=execution.result.success,
            output_text=execution.result.output_text,
            output_json=dict(execution.result.output_json),
            artifact_id=execution.result.artifact_id,
        )

        ctx = dict(validation_context or {})
        ctx["evaluation_id"] = evaluation_id
        ctx.setdefault("branch_id", execution.metadata.get("branch_id"))

        evaluation = QualityEvaluation(
            evaluation_id=evaluation_id,
            execution_id=execution.execution_id,
            route_id=execution.route_id,
            plan_id=execution.plan_id,
            request_id=execution.request_id,
            tenant_id=execution.tenant_id,
            company_id=execution.company_id,
            branch_id=ctx.get("branch_id"),
            conversation_id=execution.conversation_id,
            correlation_id=execution.correlation_id,
            status=EvaluationStatus.RUNNING,
            minimum_gate=minimum_gate.value,
            l3_enabled=l3_enabled,
            execution_result=result_snapshot,
            budget=QualityBudget(
                budget_id=str(uuid.uuid4()),
                evaluation_id=evaluation_id,
                tenant_id=tenant_id,
            ),
            metadata={"shadow": self._settings.shadow_quality},
            created_at=now,
            updated_at=now,
        )
        await self._repository.save(evaluation)
        await self._emit(QualityEvaluationStartedEvent, evaluation, {"execution_id": execution_id})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="evaluations_started")

        pipeline_ctx = await self._pipeline.execute(
            evaluation_id=evaluation_id,
            execution=execution,
            execution_result=execution.result,
            minimum_gate=minimum_gate,
            l3_enabled=l3_enabled,
            validation_context=ctx,
        )

        completed_at = _utc_now()
        decision = pipeline_ctx.decision
        completed = evaluation.model_copy(
            update={
                "status": EvaluationStatus.COMPLETED,
                "gate_runs": tuple(pipeline_ctx.gate_runs),
                "rules_evaluated": pipeline_ctx.rules,
                "findings": tuple(pipeline_ctx.findings),
                "violations": tuple(pipeline_ctx.violations),
                "evidence": tuple(pipeline_ctx.evidence),
                "budget": pipeline_ctx.budget or evaluation.budget,
                "risk": pipeline_ctx.risk,
                "score": pipeline_ctx.score,
                "recommendations": tuple(pipeline_ctx.recommendations),
                "decision": decision,
                "updated_at": completed_at,
            }
        )
        await self._repository.save(completed)

        outcome = decision.outcome.value if decision else "fail"
        await self._repository.increment_metrics(tenant_id=tenant_id, metric=outcome, decision=outcome)
        if pipeline_ctx.warning_count:
            await self._conn_increment_warnings(tenant_id, pipeline_ctx.warning_count)
        if pipeline_ctx.findings:
            await self._conn_increment_findings(tenant_id, len(pipeline_ctx.findings))

        await self._emit_domain_events(completed, pipeline_ctx)
        await self._record_lineage(completed, execution, pipeline_ctx)
        await self._audit_pipeline(completed, pipeline_ctx)
        return completed

    async def approve_evaluation(self, *, tenant_id: str, evaluation_id: str) -> QualityEvaluation:
        evaluation = await self._require_evaluation(tenant_id, evaluation_id)
        if evaluation.status == EvaluationStatus.APPROVED:
            return evaluation
        now = _utc_now()
        approved = evaluation.model_copy(
            update={"status": EvaluationStatus.APPROVED, "updated_at": now, "approved_at": now}
        )
        await self._repository.save(approved)
        await self._emit(QualityApprovedEvent, approved, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="approved")
        await self._audit_mutation(approved, "quality_gate.evaluation.approved")
        return approved

    async def reject_evaluation(
        self, *, tenant_id: str, evaluation_id: str, reason: str = ""
    ) -> QualityEvaluation:
        evaluation = await self._require_evaluation(tenant_id, evaluation_id)
        if evaluation.status == EvaluationStatus.REJECTED:
            return evaluation
        now = _utc_now()
        rejected = evaluation.model_copy(
            update={"status": EvaluationStatus.REJECTED, "updated_at": now, "rejected_at": now}
        )
        await self._repository.save(rejected)
        await self._emit(QualityRejectedEvent, rejected, {"reason": reason})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="rejected")
        await self._audit_mutation(rejected, "quality_gate.evaluation.rejected", {"reason": reason})
        return rejected

    async def archive_evaluation(self, *, tenant_id: str, evaluation_id: str) -> QualityEvaluation:
        evaluation = await self._require_evaluation(tenant_id, evaluation_id)
        if evaluation.status == EvaluationStatus.ARCHIVED:
            return evaluation
        now = _utc_now()
        archived = evaluation.model_copy(
            update={"status": EvaluationStatus.ARCHIVED, "updated_at": now, "archived_at": now}
        )
        await self._repository.save(archived)
        await self._emit(QualityArchivedEvent, archived, {})
        await self._audit_mutation(archived, "quality_gate.evaluation.archived")
        return archived

    async def get_read_model(
        self, *, tenant_id: str, evaluation_id: str
    ) -> QualityDecisionReadModel | None:
        evaluation = await self._repository.get_by_id(tenant_id=tenant_id, evaluation_id=evaluation_id)
        return self._decision_projector.project(evaluation)

    async def get_findings(
        self, *, tenant_id: str, evaluation_id: str
    ) -> tuple[QualityFindingReadModel, ...]:
        evaluation = await self._repository.get_by_id(tenant_id=tenant_id, evaluation_id=evaluation_id)
        return self._finding_projector.project(evaluation)

    async def _require_evaluation(self, tenant_id: str, evaluation_id: str) -> QualityEvaluation:
        evaluation = await self._repository.get_by_id(tenant_id=tenant_id, evaluation_id=evaluation_id)
        if evaluation is None:
            raise ValueError(f"Quality evaluation not found: {evaluation_id}")
        return evaluation

    async def _emit(self, event_cls, evaluation: QualityEvaluation, payload: dict) -> None:
        event = build_quality_event(
            event_cls,
            tenant_id=evaluation.tenant_id,
            correlation_id=evaluation.correlation_id,
            company_id=evaluation.company_id,
            evaluation_id=evaluation.evaluation_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _emit_domain_events(self, evaluation: QualityEvaluation, pipeline_ctx) -> None:
        decision = evaluation.decision
        if decision is None:
            await self._emit(QualityGateFailedEvent, evaluation, {"reason": "no_decision"})
            return
        if decision.outcome in (QualityDecisionOutcome.PASS, QualityDecisionOutcome.PASS_WITH_WARNING):
            await self._emit(
                QualityGatePassedEvent,
                evaluation,
                {"outcome": decision.outcome.value, "warnings": decision.warning_count},
            )
        else:
            await self._emit(
                QualityGateFailedEvent,
                evaluation,
                {"outcome": decision.outcome.value, "violations": decision.violation_count},
            )
        if decision.warning_count:
            await self._emit(QualityWarningRaisedEvent, evaluation, {"count": decision.warning_count})
        for _ in evaluation.findings:
            await self._emit(QualityRuleTriggeredEvent, evaluation, {"finding_count": len(evaluation.findings)})
            break
        if evaluation.risk and evaluation.risk.escalated:
            await self._emit(QualityEscalatedEvent, evaluation, {"risk_score": evaluation.risk.score})

    async def _audit_mutation(self, evaluation: QualityEvaluation, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=evaluation.tenant_id,
            request_id=evaluation.request_id,
            correlation_id=evaluation.correlation_id,
            event_name=event_name,
            payload_redacted={
                "evaluation_id": evaluation.evaluation_id,
                "execution_id": evaluation.execution_id,
                "decision": evaluation.decision.outcome.value if evaluation.decision else None,
                **(extra or {}),
            },
        )

    async def _audit_pipeline(self, evaluation: QualityEvaluation, pipeline_ctx) -> None:
        for audit_event in pipeline_ctx.audit_events:
            await self._audit.record(
                tenant_id=evaluation.tenant_id,
                request_id=evaluation.request_id,
                correlation_id=evaluation.correlation_id,
                event_name=f"quality_gate.pipeline.{audit_event.get('stage', 'unknown')}",
                payload_redacted=audit_event,
            )
        await self._audit_mutation(
            evaluation,
            "quality_gate.evaluation.completed",
            {
                "decision": evaluation.decision.outcome.value if evaluation.decision else None,
                "findings": len(evaluation.findings),
            },
        )

    async def _record_lineage(self, evaluation: QualityEvaluation, execution: ExecutionAggregate, pipeline_ctx) -> None:
        exec_node = await self._lineage.append_node(
            tenant_id=evaluation.tenant_id,
            request_id=evaluation.request_id,
            node_type="ExecutionResult",
            payload={"execution_id": execution.execution_id, "success": execution.result.success if execution.result else False},
        )
        eval_node = await self._lineage.append_node(
            tenant_id=evaluation.tenant_id,
            request_id=evaluation.request_id,
            node_type="QualityEvaluation",
            parent_node_id=exec_node.node_id,
            payload={"evaluation_id": evaluation.evaluation_id},
        )
        for finding in evaluation.findings[:5]:
            await self._lineage.append_node(
                tenant_id=evaluation.tenant_id,
                request_id=evaluation.request_id,
                node_type="QualityFinding",
                parent_node_id=eval_node.node_id,
                payload={"finding_id": finding.finding_id, "code": finding.code, "severity": finding.severity.value},
            )
        if evaluation.decision:
            await self._lineage.append_node(
                tenant_id=evaluation.tenant_id,
                request_id=evaluation.request_id,
                node_type="QualityDecision",
                parent_node_id=eval_node.node_id,
                payload={"decision_id": evaluation.decision.decision_id, "outcome": evaluation.decision.outcome.value},
            )

    async def _conn_increment_warnings(self, tenant_id: str, count: int) -> None:
        if hasattr(self._repository, "_conn"):
            await self._repository._conn.execute(
                """
                INSERT INTO oip_quality_metrics (tenant_id, metric_date, total_warnings)
                VALUES (?, date('now'), ?)
                ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                    total_warnings = total_warnings + excluded.total_warnings
                """,
                (tenant_id, count),
            )
            await self._repository._conn.commit()

    async def _conn_increment_findings(self, tenant_id: str, count: int) -> None:
        if hasattr(self._repository, "_conn"):
            await self._repository._conn.execute(
                """
                INSERT INTO oip_quality_metrics (tenant_id, metric_date, total_findings)
                VALUES (?, date('now'), ?)
                ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                    total_findings = total_findings + excluded.total_findings
                """,
                (tenant_id, count),
            )
            await self._repository._conn.commit()

    def _resolve_minimum_gate(self) -> QualityLevel:
        raw = self._settings.minimum_gate.upper()
        try:
            return QualityLevel(raw)
        except ValueError:
            return QualityLevel.L2
