"""Streaming Runtime CQRS handlers."""

from __future__ import annotations

from typing import Any

from ..commands import CloseStreamCommand, IngestWorkflowEventCommand, OpenStreamCommand, ReconnectStreamCommand
from ..projectors.streaming_runtime_projectors import ReplayProjector, StreamingMetricsProjector, StreamingSessionProjector
from ..queries import GetStreamQuery, ListStreamsQuery, ReplayStreamQuery, StreamingMetricsQuery
from ..services.streaming_runtime_service import StreamingRuntimeService
from ...domain.value_objects import StreamProtocol, WorkflowEventType
from ...infrastructure.persistence.streaming_sqlite import SqliteStreamRepositoryAdapter


class OpenStreamHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service
        self._projector = StreamingSessionProjector()

    async def __call__(self, command: OpenStreamCommand) -> dict[str, Any]:
        protocol = StreamProtocol(command.protocol) if command.protocol else None
        session = await self._service.open_stream(
            workflow_id=command.workflow_id,
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            client_id=command.client_id,
            protocol=protocol,
            conversation_id=command.conversation_id,
            company_id=command.company_id,
            execution_id=command.execution_id,
        )
        return self._projector.project(session).model_dump(mode="json")


class CloseStreamHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service
        self._projector = StreamingSessionProjector()

    async def __call__(self, command: CloseStreamCommand) -> dict[str, Any]:
        session = await self._service.close_stream(
            tenant_id=str(command.tenant_id),
            stream_id=command.stream_id,
        )
        return self._projector.project(session).model_dump(mode="json")


class IngestWorkflowEventHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service

    async def __call__(self, command: IngestWorkflowEventCommand) -> dict[str, Any] | None:
        record = await self._service.ingest_workflow_event(
            workflow_id=command.workflow_id,
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            event_type=WorkflowEventType(command.event_type),
            payload=command.payload,
            conversation_id=command.conversation_id,
            company_id=command.company_id,
            execution_id=command.execution_id,
        )
        return record.model_dump(mode="json") if record else None


class ReconnectStreamHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service
        self._projector = StreamingSessionProjector()

    async def __call__(self, command: ReconnectStreamCommand) -> dict[str, Any]:
        session = await self._service.reconnect(
            tenant_id=str(command.tenant_id),
            stream_id=command.stream_id,
            client_id=command.client_id,
            last_sequence=command.last_sequence,
        )
        return self._projector.project(session).model_dump(mode="json")


class GetStreamHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: GetStreamQuery) -> dict[str, Any] | None:
        read_model = await self._service.get_read_model(
            tenant_id=str(query.tenant_id),
            stream_id=query.stream_id,
        )
        return read_model.model_dump(mode="json") if read_model else None


class ReplayStreamHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service
        self._projector = ReplayProjector()

    async def __call__(self, query: ReplayStreamQuery) -> dict[str, Any]:
        events = await self._service.replay(
            tenant_id=str(query.tenant_id),
            workflow_id=query.workflow_id,
            last_sequence=query.last_sequence,
            client_id=query.client_id,
        )
        from datetime import datetime, timezone

        replay_state = {
            "replay_id": "query-replay",
            "stream_id": "",
            "workflow_id": query.workflow_id,
            "from_sequence": query.last_sequence,
            "to_sequence": events[-1].sequence if events else query.last_sequence,
            "event_count": len(events),
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        from ...domain.value_objects import StreamReplayState

        model = self._projector.project(StreamReplayState(**replay_state), events)
        return model.model_dump(mode="json")


class StreamingMetricsHandler:
    def __init__(self, service: StreamingRuntimeService) -> None:
        self._service = service
        self._projector = StreamingMetricsProjector()

    async def __call__(self, query: StreamingMetricsQuery) -> dict[str, Any]:
        metrics = await self._service.get_metrics(tenant_id=str(query.tenant_id))
        return self._projector.project(metrics).model_dump(mode="json")


class ListStreamsHandler:
    def __init__(self, repository: SqliteStreamRepositoryAdapter) -> None:
        self._repository = repository
        self._projector = StreamingSessionProjector()

    async def __call__(self, query: ListStreamsQuery) -> list[dict[str, Any]]:
        sessions = await self._repository.list_sessions(
            tenant_id=str(query.tenant_id),
            workflow_id=query.workflow_id,
            limit=query.limit,
        )
        return [self._projector.project(s).model_dump(mode="json") for s in sessions]
