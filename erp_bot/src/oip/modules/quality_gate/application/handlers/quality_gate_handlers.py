"""Quality Gate command and query handlers."""

from __future__ import annotations

from typing import Any

from ..commands import ApproveEvaluationCommand, ArchiveEvaluationCommand, RejectEvaluationCommand, StartEvaluationCommand
from ..projectors.quality_gate_projectors import DecisionProjector, FindingProjector, MetricsProjector
from ..queries import GetDecisionQuery, GetEvaluationQuery, GetFindingsQuery, QualityMetricsQuery, SearchEvaluationsQuery
from ..services.quality_gate_service import QualityGateService
from ...infrastructure.persistence.quality_gate_sqlite import SqliteQualityRepositoryAdapter


class StartEvaluationHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service
        self._projector = DecisionProjector()

    async def __call__(self, command: StartEvaluationCommand) -> dict[str, Any]:
        evaluation = await self._service.start_evaluation(
            execution_id=str(command.execution_id),
            tenant_id=str(command.tenant_id),
            validation_context=command.metadata.get("validation_context"),
        )
        read_model = self._projector.project(evaluation)
        return read_model.model_dump(mode="json") if read_model else {}


class ApproveEvaluationHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service
        self._projector = DecisionProjector()

    async def __call__(self, command: ApproveEvaluationCommand) -> dict[str, Any]:
        evaluation = await self._service.approve_evaluation(
            tenant_id=str(command.tenant_id),
            evaluation_id=str(command.evaluation_id),
        )
        read_model = self._projector.project(evaluation)
        return read_model.model_dump(mode="json") if read_model else {}


class RejectEvaluationHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service
        self._projector = DecisionProjector()

    async def __call__(self, command: RejectEvaluationCommand) -> dict[str, Any]:
        evaluation = await self._service.reject_evaluation(
            tenant_id=str(command.tenant_id),
            evaluation_id=str(command.evaluation_id),
            reason=command.reason,
        )
        read_model = self._projector.project(evaluation)
        return read_model.model_dump(mode="json") if read_model else {}


class ArchiveEvaluationHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service
        self._projector = DecisionProjector()

    async def __call__(self, command: ArchiveEvaluationCommand) -> dict[str, Any]:
        evaluation = await self._service.archive_evaluation(
            tenant_id=str(command.tenant_id),
            evaluation_id=str(command.evaluation_id),
        )
        read_model = self._projector.project(evaluation)
        return read_model.model_dump(mode="json") if read_model else {}


class GetEvaluationHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service

    async def __call__(self, query: GetEvaluationQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_read_model(
            tenant_id=str(query.tenant_id),
            evaluation_id=str(query.evaluation_id),
        )
        return read_model.model_dump(mode="json") if read_model else None


class GetDecisionHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service

    async def __call__(self, query: GetDecisionQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_read_model(
            tenant_id=str(query.tenant_id),
            evaluation_id=str(query.evaluation_id),
        )
        if read_model is None:
            return None
        return {
            "evaluation_id": read_model.evaluation_id,
            "decision": read_model.decision,
            "blocking": read_model.blocking,
            "requires_review": read_model.requires_review,
            "summary": read_model.summary,
            "warning_count": read_model.warning_count,
            "violation_count": read_model.violation_count,
            "risk_score": read_model.risk_score,
            "overall_score": read_model.overall_score,
            "decided_at": read_model.decided_at,
        }


class GetFindingsHandler:
    def __init__(self, service: QualityGateService) -> None:
        self._service = service
        self._projector = FindingProjector()

    async def __call__(self, query: GetFindingsQuery) -> list[dict[str, Any]]:
        findings = await self._service.get_findings(
            tenant_id=str(query.tenant_id),
            evaluation_id=str(query.evaluation_id),
        )
        return [f.model_dump(mode="json") for f in findings]


class QualityMetricsHandler:
    def __init__(self, repository: SqliteQualityRepositoryAdapter) -> None:
        self._repository = repository
        self._projector = MetricsProjector()

    async def __call__(self, query: QualityMetricsQuery) -> dict[str, Any]:
        metrics = await self._repository.get_metrics(
            tenant_id=str(query.tenant_id),
            metric_date=query.metric_date,
        )
        return self._projector.project(metrics).model_dump(mode="json")


class SearchEvaluationsHandler:
    def __init__(self, repository: SqliteQualityRepositoryAdapter) -> None:
        self._repository = repository
        self._projector = DecisionProjector()

    async def __call__(self, query: SearchEvaluationsQuery) -> list[dict[str, Any]]:
        if query.execution_id:
            evaluation = await self._repository.get_by_execution_id(
                tenant_id=str(query.tenant_id),
                execution_id=str(query.execution_id),
            )
            if evaluation is None:
                return []
            read_model = self._projector.project(evaluation)
            return [read_model.model_dump(mode="json")] if read_model else []
        evaluations = await self._repository.search(
            tenant_id=str(query.tenant_id),
            request_id=str(query.request_id) if query.request_id else None,
            conversation_id=query.conversation_id,
            company_id=query.company_id,
            decision=query.decision,
            limit=query.limit,
        )
        return [
            rm.model_dump(mode="json")
            for e in evaluations
            if (rm := self._projector.project(e)) is not None
        ]
