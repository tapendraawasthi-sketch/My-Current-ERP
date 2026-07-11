"""Workflow event subscriber — maps domain events to streaming events without modifying source modules."""

from __future__ import annotations

from typing import Any

from .....domain.events import DomainEventEnvelope
from ...domain.value_objects import WorkflowEventType
from ..services.streaming_runtime_service import StreamingRuntimeService

_EVENT_MAP: dict[str, WorkflowEventType] = {
    "oip.provider_runtime.execution.started.v1": WorkflowEventType.WORKFLOW_STARTED,
    "oip.provider_runtime.execution.chunk_produced.v1": WorkflowEventType.PROVIDER_CHUNK,
    "oip.provider_runtime.execution.completed.v1": WorkflowEventType.PROVIDER_COMPLETED,
    "oip.provider_runtime.execution.failed.v1": WorkflowEventType.WORKFLOW_FAILED,
    "oip.quality_gate.quality_evaluation.started.v1": WorkflowEventType.QUALITY_STARTED,
    "oip.quality_gate.quality_gate.passed.v1": WorkflowEventType.QUALITY_COMPLETED,
    "oip.quality_gate.quality_gate.failed.v1": WorkflowEventType.QUALITY_COMPLETED,
    "oip.action_runtime.action.proposed.v1": WorkflowEventType.ACTION_PROPOSED,
    "oip.action_runtime.action.approved.v1": WorkflowEventType.ACTION_APPROVED,
    "oip.action_runtime.action.executed.v1": WorkflowEventType.ACTION_EXECUTED,
    "oip.action_runtime.action.rejected.v1": WorkflowEventType.ACTION_REJECTED,
}


class WorkflowEventSubscriber:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service

    async def __call__(self, envelope: DomainEventEnvelope) -> None:
        event_type = envelope.event.event_type
        mapped = _EVENT_MAP.get(event_type)
        if mapped is None:
            return
        payload: dict[str, Any] = dict(envelope.event.payload or {})
        workflow_id = (
            payload.get("execution_id")
            or payload.get("workflow_id")
            or payload.get("plan_id")
            or envelope.event.partition_key
        )
        tenant_id = str(envelope.event.tenant_id)
        request_id = payload.get("request_id") or str(envelope.event.correlation_id)
        try:
            await self._service.ingest_workflow_event(
                workflow_id=str(workflow_id),
                tenant_id=tenant_id,
                request_id=str(request_id),
                event_type=mapped,
                payload={"source_event": event_type, **payload},
                conversation_id=payload.get("conversation_id"),
                company_id=payload.get("company_id"),
                execution_id=payload.get("execution_id"),
            )
        except Exception:  # noqa: BLE001 — streaming must never fail workflow
            return
