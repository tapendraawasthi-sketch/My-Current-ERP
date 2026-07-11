"""Orchestrator application service — constitutional execution engine."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

from .....application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from .....domain.value_objects import ActionPayload, ActionType
from ...domain.entities import WorkflowExecution
from ...domain.events import (
    WorkflowArchivedEvent,
    WorkflowCancelledEvent,
    WorkflowCompletedEvent,
    WorkflowFailedEvent,
    WorkflowRolledBackEvent,
    WorkflowStartedEvent,
    build_orchestrator_event,
)
from ...domain.value_objects import ExecutionMode, RetryState, WorkflowState
from ..dto.workflow_context import WorkflowContext
from ..ports.orchestrator_port import OrchestratorPort
from ..ports.workflow_engine_port import WorkflowEnginePort
from ..ports.workflow_repository_port import WorkflowRepositoryPort
from ..projectors.orchestrator_projectors import (
    WorkflowMetricsProjector,
    WorkflowProjector,
    WorkflowTimelineProjector,
)
from .....infrastructure.observability.logging import log_event

_OIP_CHAT_DEBUG = os.getenv("OIP_CHAT_DEBUG", "false").lower() in {"1", "true", "yes"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OrchestratorService(OrchestratorPort):
    def __init__(
        self,
        *,
        engine: WorkflowEnginePort,
        repository: WorkflowRepositoryPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
    ) -> None:
        self._engine = engine
        self._repository = repository
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._workflow_projector = WorkflowProjector()
        self._timeline_projector = WorkflowTimelineProjector()
        self._metrics_projector = WorkflowMetricsProjector()

    def _resolve_mode(self, override: str | None = None) -> ExecutionMode:
        raw = (override or self._settings.execution_mode).lower()
        try:
            mode = ExecutionMode(raw)
        except ValueError:
            return ExecutionMode.NATIVE
        if mode == ExecutionMode.LEGACY:
            return ExecutionMode.NATIVE
        return mode

    async def start_workflow(
        self,
        *,
        request: IntelligenceRequestDto,
        execution_mode: str | None = None,
    ) -> WorkflowExecution:
        if not self._settings.orchestrator_enabled:
            raise ValueError("Orchestrator module is disabled")

        mode = self._resolve_mode(execution_mode)
        idem = request.idempotency_key or request.request_id
        existing = await self._repository.get_by_idempotency(
            tenant_id=request.tenant_id, idempotency_key=idem
        )
        if existing:
            return existing

        now = _utc_now()
        workflow_id = str(uuid.uuid4())
        workflow = WorkflowExecution(
            workflow_id=workflow_id,
            request_id=request.request_id,
            session_id=request.session_id,
            tenant_id=request.tenant_id,
            company_id=request.company_id,
            branch_id=request.branch_id,
            user_id=request.user_id,
            correlation_id=request.correlation_id,
            idempotency_key=idem,
            execution_mode=mode,
            workflow_state=WorkflowState.PENDING,
            module=request.module,
            message=request.question,
            retry_state=RetryState(
                max_retries=self._settings.max_retries,
                backoff_seconds=self._settings.retry_backoff,
            ),
            started_at=now,
            updated_at=now,
        )
        await self._repository.save(workflow)
        await self._repository.increment_metrics(tenant_id=request.tenant_id, metric="workflows_started")
        await self._emit(WorkflowStartedEvent, workflow, {"execution_mode": mode.value})
        await self._audit_mutation(workflow, "orchestrator.workflow.started")
        await self._lineage_chain_start(workflow)
        return workflow

    async def execute_workflow(
        self,
        *,
        request: IntelligenceRequestDto,
        legacy_response: IntelligenceResponseDto | None = None,
    ) -> tuple[WorkflowExecution, IntelligenceResponseDto | None]:
        _ = legacy_response  # retained for API compatibility; native pipeline is authoritative
        configured = (self._settings.execution_mode or "native").lower()
        diagnostic_shadow = configured == ExecutionMode.SHADOW.value
        mode = self._resolve_mode()

        workflow = await self.start_workflow(
            request=request,
            execution_mode=ExecutionMode.SHADOW.value if diagnostic_shadow else mode.value,
        )
        context = WorkflowContext(
            workflow_id=workflow.workflow_id,
            request_id=request.request_id,
            correlation_id=request.correlation_id,
            idempotency_key=workflow.idempotency_key,
            tenant_id=request.tenant_id,
            company_id=request.company_id,
            branch_id=request.branch_id,
            user_id=request.user_id,
            session_id=request.session_id,
            conversation_id=request.conversation_id or None,
            module=request.module,
            language=request.language,
            message=request.question,
            execution_mode=workflow.execution_mode.value,
        )
        if _OIP_CHAT_DEBUG:
            log_event(
                "oip.orchestrator.input",
                workflow_id=workflow.workflow_id,
                message=context.message,
                module=context.module,
            )

        completed, final_context = await self._engine.run(workflow=workflow, context=context)
        await self._repository.save(completed)

        if completed.workflow_state == WorkflowState.COMPLETED:
            await self._repository.increment_metrics(
                tenant_id=request.tenant_id, metric="workflows_completed"
            )
            await self._emit(WorkflowCompletedEvent, completed, {"stage_count": len(completed.completed_stages)})
            await self._audit_mutation(completed, "orchestrator.workflow.completed")
            await self._lineage_chain_complete(completed, final_context)
        elif completed.workflow_state == WorkflowState.ROLLED_BACK:
            await self._emit(WorkflowRolledBackEvent, completed, {"failed_stage": completed.failed_stage})
            await self._audit_mutation(completed, "orchestrator.workflow.rolled_back")
        else:
            await self._repository.increment_metrics(
                tenant_id=request.tenant_id, metric="workflows_failed"
            )
            await self._emit(
                WorkflowFailedEvent,
                completed,
                {"failed_stage": completed.failed_stage},
            )
            await self._audit_mutation(completed, "orchestrator.workflow.failed")

        response = self._build_native_response(
            request=request,
            completed=completed,
            final_context=final_context,
            diagnostic_shadow=diagnostic_shadow,
        )
        return completed, response

    async def cancel_workflow(
        self, *, tenant_id: str, workflow_id: str, reason: str = ""
    ) -> WorkflowExecution:
        workflow = await self._require(tenant_id, workflow_id)
        if workflow.workflow_state in (WorkflowState.CANCELLED, WorkflowState.ARCHIVED):
            return workflow
        now = _utc_now()
        cancelled = workflow.model_copy(
            update={
                "workflow_state": WorkflowState.CANCELLED,
                "updated_at": now,
                "completed_at": now,
                "metadata": {**workflow.metadata, "cancel_reason": reason},
            }
        )
        await self._repository.save(cancelled)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="workflows_cancelled")
        await self._emit(WorkflowCancelledEvent, cancelled, {"reason": reason})
        await self._audit_mutation(cancelled, "orchestrator.workflow.cancelled")
        return cancelled

    async def archive_workflow(self, *, tenant_id: str, workflow_id: str) -> WorkflowExecution:
        workflow = await self._require(tenant_id, workflow_id)
        archived = workflow.model_copy(
            update={"workflow_state": WorkflowState.ARCHIVED, "updated_at": _utc_now()}
        )
        await self._repository.save(archived)
        await self._emit(WorkflowArchivedEvent, archived, {})
        await self._audit_mutation(archived, "orchestrator.workflow.archived")
        return archived

    async def recover_workflows(self, *, tenant_id: str) -> tuple[WorkflowExecution, ...]:
        recoverable = await self._repository.list_recoverable(tenant_id=tenant_id)
        recovered: list[WorkflowExecution] = []
        for workflow in recoverable:
            context = WorkflowContext(
                workflow_id=workflow.workflow_id,
                request_id=workflow.request_id,
                correlation_id=workflow.correlation_id,
                tenant_id=workflow.tenant_id,
                company_id=workflow.company_id,
                branch_id=workflow.branch_id,
                user_id=workflow.user_id,
                session_id=workflow.session_id,
                conversation_id=workflow.conversation_id,
                module=workflow.module,
                message=workflow.message,
                execution_mode=workflow.execution_mode.value,
            )
            completed, _ = await self._engine.recover(workflow=workflow, context=context)
            await self._repository.save(completed)
            recovered.append(completed)
        return tuple(recovered)

    async def get_workflow(self, *, tenant_id: str, workflow_id: str):
        workflow = await self._repository.get_by_id(tenant_id=tenant_id, workflow_id=workflow_id)
        return self._workflow_projector.project(workflow) if workflow else None

    async def get_timeline(self, *, tenant_id: str, workflow_id: str):
        workflow = await self._repository.get_by_id(tenant_id=tenant_id, workflow_id=workflow_id)
        if workflow is None:
            return None
        stages = await self._repository.get_stage_runs(tenant_id=tenant_id, workflow_id=workflow_id)
        return self._timeline_projector.project(workflow, stages)

    async def get_metrics(self, *, tenant_id: str):
        metrics = await self._repository.get_metrics(tenant_id=tenant_id)
        return self._metrics_projector.project(metrics)

    def _build_native_response(
        self,
        *,
        request: IntelligenceRequestDto,
        completed: WorkflowExecution,
        final_context: WorkflowContext,
        diagnostic_shadow: bool,
    ) -> IntelligenceResponseDto:
        response_snapshot = completed.snapshots.get("response") or final_context.response_ref or {}
        text = self._extract_response_text(response_snapshot)
        actions: tuple[ActionPayload, ...] = ()
        if text:
            actions = (
                ActionPayload(
                    action_type=ActionType.ANSWER,
                    body={"text": text},
                    confidence=1.0,
                    requires_confirmation=False,
                ),
            )
        metadata: dict[str, Any] = {
            "status": completed.workflow_state.value,
            "workflow_id": completed.workflow_id,
            "native_pipeline": True,
            **(response_snapshot if isinstance(response_snapshot, dict) else {}),
        }
        if diagnostic_shadow:
            metadata["diagnostic_mode"] = "shadow"
        return IntelligenceResponseDto(
            request_id=request.request_id,
            correlation_id=request.correlation_id,
            actions=actions,
            metadata=metadata,
            provider="oip",
            model="native-pipeline",
        )

    async def _require(self, tenant_id: str, workflow_id: str) -> WorkflowExecution:
        workflow = await self._repository.get_by_id(tenant_id=tenant_id, workflow_id=workflow_id)
        if workflow is None:
            raise ValueError(f"Workflow not found: {workflow_id}")
        return workflow

    async def _emit(self, event_cls, workflow: WorkflowExecution, payload: dict) -> None:
        event = build_orchestrator_event(
            event_cls,
            tenant_id=workflow.tenant_id,
            correlation_id=workflow.correlation_id,
            company_id=workflow.company_id,
            workflow_id=workflow.workflow_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _audit_mutation(self, workflow: WorkflowExecution, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=workflow.tenant_id,
            request_id=workflow.request_id,
            correlation_id=workflow.correlation_id,
            event_name=event_name,
            payload_redacted={
                "workflow_id": workflow.workflow_id,
                "state": workflow.workflow_state.value,
                **(extra or {}),
            },
        )

    async def _lineage_chain_start(self, workflow: WorkflowExecution) -> None:
        await self._lineage.append_node(
            tenant_id=workflow.tenant_id,
            request_id=workflow.request_id,
            node_type="Workflow",
            payload={"workflow_id": workflow.workflow_id, "module": workflow.module},
        )

    async def _lineage_chain_complete(self, workflow: WorkflowExecution, context: WorkflowContext) -> None:
        chain = (
            ("Conversation", context.conversation_ref),
            ("Session", context.session_ref),
            ("Plan", context.plan_ref),
            ("Route", context.route_ref),
            ("Execution", context.execution_ref),
            ("Quality", context.quality_ref),
            ("Action", context.action_ref),
            ("Stream", context.stream_ref),
            ("Response", context.response_ref),
        )
        parent = None
        for node_type, ref in chain:
            if ref:
                node = await self._lineage.append_node(
                    tenant_id=workflow.tenant_id,
                    request_id=workflow.request_id,
                    node_type=node_type,
                    parent_node_id=parent,
                    payload=ref,
                )
                parent = node.node_id

    @staticmethod
    def _extract_response_text(response_ref: dict[str, Any] | None) -> str:
        if not response_ref:
            return ""
        text = response_ref.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
        return ""
