"""Streaming Runtime application service — delivery only, never generates intelligence."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from .....shared.ids import new_event_id
from ...domain.entities import StreamingSession
from ...domain.event_order_registry import create_default_event_order_registry
from ...domain.events import (
    HeartbeatSentEvent,
    ReplayCompletedEvent,
    ReplayStartedEvent,
    StreamClosedEvent,
    StreamOpenedEvent,
    TransportFailedEvent,
    build_streaming_event,
)
from ...domain.value_objects import (
    StreamEventRecord,
    StreamFeatureMode,
    StreamOffset,
    StreamProtocol,
    StreamReplayState,
    StreamSessionStatus,
    WorkflowEventType,
)
from ..pipeline.pipeline import StreamingRuntimePipeline
from ..ports.replay_buffer_port import ReplayBufferPort
from ..ports.stream_repository_port import StreamRepositoryPort
from ..ports.streaming_runtime_port import StreamingRuntimePort
from ..ports.streaming_runtime_ports import StreamingTransportPort
from ..projectors.streaming_runtime_projectors import StreamingSessionProjector


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StreamingRuntimeService(StreamingRuntimePort):
    def __init__(
        self,
        *,
        pipeline: StreamingRuntimePipeline,
        repository: StreamRepositoryPort,
        replay_buffer: ReplayBufferPort,
        transport: StreamingTransportPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._replay = replay_buffer
        self._transport = transport
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._projector = StreamingSessionProjector()
        self._order = create_default_event_order_registry()
        self._live_subscribers: dict[str, asyncio.Queue[StreamEventRecord | None]] = {}
        self._heartbeat_tasks: dict[str, asyncio.Task] = {}

    def _mode(self) -> StreamFeatureMode:
        return StreamFeatureMode(self._settings.stream_runtime_mode)

    def _enabled(self) -> bool:
        return self._mode() != StreamFeatureMode.DISABLED

    def _shadow(self) -> bool:
        return self._mode() == StreamFeatureMode.SHADOW

    def _resolve_protocol(self, protocol: StreamProtocol | None) -> StreamProtocol:
        if protocol is not None:
            return protocol
        pref = self._settings.stream_protocol.lower()
        if pref == "websocket":
            return StreamProtocol.WEBSOCKET
        return StreamProtocol.SSE

    async def open_stream(
        self,
        *,
        workflow_id: str,
        tenant_id: str,
        request_id: str,
        client_id: str,
        protocol: StreamProtocol | None = None,
        conversation_id: str | None = None,
        company_id: str | None = None,
        execution_id: str | None = None,
    ) -> StreamingSession:
        if not self._enabled():
            raise ValueError("Streaming runtime module is disabled")

        existing = await self._repository.get_session_by_workflow(
            tenant_id=tenant_id, workflow_id=workflow_id
        )
        if existing and existing.status not in (StreamSessionStatus.CLOSED,):
            return existing

        now = _utc_now()
        stream_id = str(uuid.uuid4())
        resolved = self._resolve_protocol(protocol)
        connection_id = await self._transport.connect(
            stream_id=stream_id, client_id=client_id, protocol=resolved
        )
        session = StreamingSession(
            stream_id=stream_id,
            workflow_id=workflow_id,
            conversation_id=conversation_id,
            execution_id=execution_id,
            request_id=request_id,
            tenant_id=tenant_id,
            company_id=company_id,
            client_id=client_id,
            status=StreamSessionStatus.CONNECTED,
            protocol=resolved,
            connection_id=connection_id,
            created_at=now,
            updated_at=now,
            connected_at=now,
        )
        await self._repository.save_session(session)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="streams_opened")
        await self._emit(StreamOpenedEvent, session, {"client_id": client_id, "protocol": resolved.value})
        await self._audit_mutation(session, "streaming_runtime.stream.opened", {"client_id": client_id})
        await self._lineage_append(session, "StreamingSession", {"stream_id": stream_id})
        self._ensure_heartbeat(session)
        return session

    async def close_stream(self, *, tenant_id: str, stream_id: str) -> StreamingSession:
        session = await self._require_session(tenant_id, stream_id)
        if session.status == StreamSessionStatus.CLOSED:
            return session
        now = _utc_now()
        if session.connection_id:
            await self._transport.disconnect(connection_id=session.connection_id)
        closed = session.model_copy(
            update={
                "status": StreamSessionStatus.CLOSED,
                "updated_at": now,
                "closed_at": now,
                "connection_id": None,
            }
        )
        await self._repository.save_session(closed)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="streams_closed")
        await self._emit(StreamClosedEvent, closed, {})
        await self._audit_mutation(closed, "streaming_runtime.stream.closed", {})
        self._stop_heartbeat(stream_id)
        self._notify_live(stream_id, None)
        return closed

    async def ingest_workflow_event(
        self,
        *,
        workflow_id: str,
        tenant_id: str,
        request_id: str,
        event_type: WorkflowEventType,
        payload: dict[str, Any],
        conversation_id: str | None = None,
        company_id: str | None = None,
        execution_id: str | None = None,
    ) -> StreamEventRecord | None:
        if not self._enabled():
            return None

        session = await self._repository.get_session_by_workflow(
            tenant_id=tenant_id, workflow_id=workflow_id
        )
        if session is None:
            now = _utc_now()
            session = StreamingSession(
                stream_id=str(uuid.uuid4()),
                workflow_id=workflow_id,
                conversation_id=conversation_id,
                execution_id=execution_id,
                request_id=request_id,
                tenant_id=tenant_id,
                company_id=company_id,
                client_id="system",
                status=StreamSessionStatus.OPEN,
                protocol=self._resolve_protocol(None),
                created_at=now,
                updated_at=now,
            )
            await self._repository.save_session(session)

        ctx = await self._pipeline.execute(
            session=session,
            event_type=event_type,
            payload=payload,
            request_id=request_id,
        )
        if ctx.blocked or ctx.record is None:
            return None

        await self._repository.increment_metrics(tenant_id=tenant_id, metric="events_published")
        await self._emit_domain_events(session, ctx)
        await self._audit_mutation(
            session,
            f"streaming_runtime.event.{event_type.value}",
            {"sequence": ctx.record.sequence},
        )
        await self._lineage_append(
            session,
            self._lineage_node_type(event_type),
            {"sequence": ctx.record.sequence, "event_type": event_type.value},
        )
        self._notify_live(session.stream_id, ctx.record)
        return ctx.record

    async def replay(
        self, *, tenant_id: str, workflow_id: str, last_sequence: int, client_id: str
    ) -> tuple[StreamEventRecord, ...]:
        session = await self._repository.get_session_by_workflow(
            tenant_id=tenant_id, workflow_id=workflow_id
        )
        if session is None:
            return ()

        replay_id = str(uuid.uuid4())
        started = _utc_now().isoformat()
        replay_state = StreamReplayState(
            replay_id=replay_id,
            stream_id=session.stream_id,
            workflow_id=workflow_id,
            from_sequence=last_sequence,
            to_sequence=session.last_sequence,
            event_count=0,
            started_at=started,
        )
        await self._repository.save_replay(replay_state)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="replays_started")
        await self._emit(ReplayStartedEvent, session, {"from_sequence": last_sequence, "client_id": client_id})
        await self._audit_mutation(session, "streaming_runtime.replay.started", {"from_sequence": last_sequence})

        events = await self._repository.get_events_after(
            tenant_id=tenant_id,
            workflow_id=workflow_id,
            after_sequence=last_sequence,
        )
        if not events:
            events = await self._replay.get_after_sequence(
                workflow_id=workflow_id, after_sequence=last_sequence
            )

        completed = replay_state.model_copy(
            update={
                "event_count": len(events),
                "to_sequence": events[-1].sequence if events else last_sequence,
                "completed_at": _utc_now().isoformat(),
            }
        )
        await self._repository.save_replay(completed)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="replays_completed")
        await self._emit(
            ReplayCompletedEvent,
            session,
            {"event_count": len(events), "to_sequence": completed.to_sequence},
        )
        await self._audit_mutation(session, "streaming_runtime.replay.completed", {"event_count": len(events)})

        offset = StreamOffset(
            offset_id=str(uuid.uuid4()),
            stream_id=session.stream_id,
            client_id=client_id,
            last_sequence=completed.to_sequence,
            updated_at=_utc_now().isoformat(),
        )
        await self._repository.save_offset(offset)
        return events

    async def reconnect(
        self, *, tenant_id: str, stream_id: str, client_id: str, last_sequence: int
    ) -> StreamingSession:
        session = await self._require_session(tenant_id, stream_id)
        now = _utc_now()
        connection_id = await self._transport.connect(
            stream_id=stream_id, client_id=client_id, protocol=session.protocol
        )
        reconnected = session.model_copy(
            update={
                "status": StreamSessionStatus.REPLAYING,
                "client_id": client_id,
                "connection_id": connection_id,
                "updated_at": now,
                "connected_at": now,
                "disconnected_at": None,
                "replay_position": last_sequence,
            }
        )
        await self._repository.save_session(reconnected)
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="reconnects")
        await self._audit_mutation(reconnected, "streaming_runtime.reconnect", {"last_sequence": last_sequence})

        events = await self.replay(
            tenant_id=tenant_id,
            workflow_id=session.workflow_id,
            last_sequence=last_sequence,
            client_id=client_id,
        )
        for event in events:
            if reconnected.connection_id and not self._shadow():
                await self._transport.publish(connection_id=reconnected.connection_id, event=event)

        live = reconnected.model_copy(
            update={"status": StreamSessionStatus.CONNECTED, "updated_at": _utc_now()}
        )
        await self._repository.save_session(live)
        self._ensure_heartbeat(live)
        return live

    async def stream_live(
        self, *, tenant_id: str, workflow_id: str, client_id: str, last_sequence: int = 0
    ) -> AsyncIterator[StreamEventRecord]:
        session = await self._repository.get_session_by_workflow(
            tenant_id=tenant_id, workflow_id=workflow_id
        )
        if session is None:
            request_id = str(new_event_id())
            session = await self.open_stream(
                workflow_id=workflow_id,
                tenant_id=tenant_id,
                request_id=request_id,
                client_id=client_id,
            )

        if last_sequence > 0:
            missed = await self.replay(
                tenant_id=tenant_id,
                workflow_id=workflow_id,
                last_sequence=last_sequence,
                client_id=client_id,
            )
            for event in missed:
                yield event

        queue: asyncio.Queue[StreamEventRecord | None] = asyncio.Queue(maxsize=100)
        self._live_subscribers[session.stream_id] = queue
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            self._live_subscribers.pop(session.stream_id, None)

    async def get_read_model(
        self, *, tenant_id: str, stream_id: str
    ):
        session = await self._repository.get_session(tenant_id=tenant_id, stream_id=stream_id)
        return self._projector.project(session) if session else None

    async def get_metrics(self, *, tenant_id: str):
        active = await self._repository.count_active_sessions(tenant_id=tenant_id)
        metrics = await self._repository.get_metrics(tenant_id=tenant_id)
        return metrics.model_copy(update={"active_sessions": active})

    async def handle_disconnect(self, *, tenant_id: str, stream_id: str) -> StreamingSession:
        session = await self._require_session(tenant_id, stream_id)
        now = _utc_now()
        if session.connection_id:
            await self._transport.disconnect(connection_id=session.connection_id)
        disconnected = session.model_copy(
            update={
                "status": StreamSessionStatus.DISCONNECTED,
                "updated_at": now,
                "disconnected_at": now,
                "connection_id": None,
            }
        )
        await self._repository.save_session(disconnected)
        await self._audit_mutation(disconnected, "streaming_runtime.disconnect", {})
        self._stop_heartbeat(stream_id)
        return disconnected

    async def send_heartbeat(self, *, tenant_id: str, stream_id: str) -> StreamEventRecord | None:
        session = await self._require_session(tenant_id, stream_id)
        if session.status != StreamSessionStatus.CONNECTED:
            return None
        return await self.ingest_workflow_event(
            workflow_id=session.workflow_id,
            tenant_id=tenant_id,
            request_id=session.request_id,
            event_type=WorkflowEventType.HEARTBEAT,
            payload={"stream_id": stream_id},
            conversation_id=session.conversation_id,
            company_id=session.company_id,
            execution_id=session.execution_id,
        )

    def _notify_live(self, stream_id: str, event: StreamEventRecord | None) -> None:
        queue = self._live_subscribers.get(stream_id)
        if queue is None:
            return
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            pass

    def _ensure_heartbeat(self, session: StreamingSession) -> None:
        if self._shadow() or session.status != StreamSessionStatus.CONNECTED:
            return
        self._stop_heartbeat(session.stream_id)

        async def _loop() -> None:
            interval = max(5, self._settings.stream_heartbeat)
            while True:
                await asyncio.sleep(interval)
                try:
                    record = await self.send_heartbeat(
                        tenant_id=session.tenant_id, stream_id=session.stream_id
                    )
                    if record:
                        await self._repository.increment_metrics(
                            tenant_id=session.tenant_id, metric="heartbeats_sent"
                        )
                        await self._emit(HeartbeatSentEvent, session, {"sequence": record.sequence})
                except Exception:  # noqa: BLE001
                    break

        self._heartbeat_tasks[session.stream_id] = asyncio.create_task(_loop())

    def _stop_heartbeat(self, stream_id: str) -> None:
        task = self._heartbeat_tasks.pop(stream_id, None)
        if task and not task.done():
            task.cancel()

    async def _require_session(self, tenant_id: str, stream_id: str) -> StreamingSession:
        session = await self._repository.get_session(tenant_id=tenant_id, stream_id=stream_id)
        if session is None:
            raise ValueError(f"Streaming session not found: {stream_id}")
        return session

    async def _emit(self, event_cls, session: StreamingSession, payload: dict) -> None:
        event = build_streaming_event(
            event_cls,
            tenant_id=session.tenant_id,
            correlation_id=session.request_id,
            company_id=session.company_id,
            stream_id=session.stream_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _emit_domain_events(self, session: StreamingSession, ctx) -> None:
        for item in ctx.domain_events:
            event_name = item.get("event")
            if event_name == "oip.streaming_runtime.transport.failed.v1":
                await self._repository.increment_metrics(
                    tenant_id=session.tenant_id, metric="transport_failures"
                )
                await self._emit(TransportFailedEvent, session, item)

    async def _audit_mutation(self, session: StreamingSession, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=session.tenant_id,
            request_id=session.request_id,
            correlation_id=session.request_id,
            event_name=event_name,
            payload_redacted={"stream_id": session.stream_id, "workflow_id": session.workflow_id, **(extra or {})},
        )

    async def _lineage_append(self, session: StreamingSession, node_type: str, payload: dict) -> None:
        await self._lineage.append_node(
            tenant_id=session.tenant_id,
            request_id=session.request_id,
            node_type=node_type,
            payload={"stream_id": session.stream_id, "workflow_id": session.workflow_id, **payload},
        )

    @staticmethod
    def _lineage_node_type(event_type: WorkflowEventType) -> str:
        mapping = {
            WorkflowEventType.PROVIDER_CHUNK: "ProviderChunk",
            WorkflowEventType.QUALITY_STARTED: "QualityUpdate",
            WorkflowEventType.QUALITY_COMPLETED: "QualityUpdate",
            WorkflowEventType.ACTION_PROPOSED: "ActionUpdate",
            WorkflowEventType.ACTION_APPROVED: "ActionUpdate",
            WorkflowEventType.ACTION_EXECUTED: "ActionUpdate",
            WorkflowEventType.ACTION_REJECTED: "ActionUpdate",
            WorkflowEventType.WORKFLOW_COMPLETED: "FinalResponse",
            WorkflowEventType.WORKFLOW_STARTED: "Workflow",
        }
        return mapping.get(event_type, "StreamEvent")
