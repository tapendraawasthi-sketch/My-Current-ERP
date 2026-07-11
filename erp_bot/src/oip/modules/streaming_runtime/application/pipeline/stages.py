"""Streaming Runtime pipeline stages — independently testable."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Protocol

from ...domain.event_order_registry import EventOrderRegistry
from ...domain.events import (
    build_streaming_event,
)
from ...domain.value_objects import StreamEventRecord, WorkflowEventType
from ..ports.replay_buffer_port import ReplayBufferPort
from ..ports.stream_repository_port import StreamRepositoryPort
from ..ports.streaming_runtime_ports import StreamingTransportPort
from .context import StreamPipelineContext


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _checksum(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


class StreamStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext: ...


class ReceiveStage:
    name = "receive"

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        context.audit_events.append({"stage": self.name, "event_type": context.event_type.value})
        return context


class ValidateStage:
    name = "validate"

    def __init__(self, order_registry: EventOrderRegistry, repository: StreamRepositoryPort) -> None:
        self._order = order_registry
        self._repository = repository

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        if context.blocked:
            return context
        seen = await self._repository.get_seen_event_types(
            tenant_id=context.session.tenant_id,
            workflow_id=context.session.workflow_id,
        )
        ok, missing = self._order.prerequisites_met(context.event_type, seen)
        if not ok:
            context.blocked = True
            context.block_reason = f"ordering_violation:{','.join(missing)}"
            context.audit_events.append(
                {"stage": self.name, "valid": False, "missing": list(missing)}
            )
            return context
        context.audit_events.append({"stage": self.name, "valid": True})
        return context


class SequenceStage:
    name = "sequence"

    def __init__(self, repository: StreamRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        if context.blocked:
            return context
        seq = await self._repository.next_sequence(
            tenant_id=context.session.tenant_id,
            workflow_id=context.session.workflow_id,
        )
        context.sequence = seq
        return context


class PersistStage:
    name = "persist"

    def __init__(
        self,
        repository: StreamRepositoryPort,
        replay_buffer: ReplayBufferPort,
    ) -> None:
        self._repository = repository
        self._replay = replay_buffer

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        if context.blocked or context.sequence is None:
            return context
        payload = dict(context.raw_payload)
        record = StreamEventRecord(
            event_id=str(uuid.uuid4()),
            stream_id=context.session.stream_id,
            workflow_id=context.session.workflow_id,
            conversation_id=context.session.conversation_id,
            request_id=context.request_id,
            tenant_id=context.session.tenant_id,
            company_id=context.session.company_id,
            sequence=context.sequence,
            event_type=context.event_type,
            timestamp=_utc_now_iso(),
            payload=payload,
            checksum=_checksum(payload),
        )
        await self._repository.save_event(record)
        await self._replay.append(workflow_id=context.session.workflow_id, event=record)
        context.record = record
        context.audit_events.append({"stage": self.name, "sequence": context.sequence})
        return context


class PublishStage:
    name = "publish"

    def __init__(
        self,
        transport: StreamingTransportPort,
        *,
        shadow_mode: bool = False,
    ) -> None:
        self._transport = transport
        self._shadow = shadow_mode

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        if context.blocked or context.record is None:
            return context
        if self._shadow:
            context.audit_events.append({"stage": self.name, "shadow": True})
            return context
        connection_id = context.session.connection_id
        if not connection_id:
            context.transport_ok = False
            context.transport_error = "no_active_connection"
            context.domain_events.append(
                {"event": "oip.streaming_runtime.transport.failed.v1", "reason": context.transport_error}
            )
            return context
        try:
            ok = await self._transport.publish(connection_id=connection_id, event=context.record)
            context.transport_ok = ok
            if ok:
                context.domain_events.append(
                    {"event": "oip.streaming_runtime.chunk.published.v1", "sequence": context.record.sequence}
                )
            else:
                context.transport_error = "publish_returned_false"
                context.domain_events.append(
                    {"event": "oip.streaming_runtime.transport.failed.v1", "reason": context.transport_error}
                )
        except Exception as exc:  # noqa: BLE001 — transport must never fail workflow
            context.transport_ok = False
            context.transport_error = str(exc)
            context.domain_events.append(
                {"event": "oip.streaming_runtime.transport.failed.v1", "reason": context.transport_error}
            )
        context.audit_events.append(
            {"stage": self.name, "ok": context.transport_ok, "error": context.transport_error}
        )
        return context


class AckStage:
    name = "ack"

    def __init__(self, repository: StreamRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        if context.blocked or context.record is None:
            return context
        acked = context.record.model_copy(update={"acked": True, "delivered": context.transport_ok})
        await self._repository.save_event(acked)
        context.record = acked
        context.acked = True
        updated_session = context.session.model_copy(
            update={"last_sequence": acked.sequence, "updated_at": datetime.now(timezone.utc)}
        )
        await self._repository.save_session(updated_session)
        context.session = updated_session
        context.audit_events.append({"stage": self.name, "acked": True})
        return context


class CleanupStage:
    name = "cleanup"

    def __init__(
        self,
        replay_buffer: ReplayBufferPort,
        *,
        buffer_size: int = 1000,
    ) -> None:
        self._replay = replay_buffer
        self._buffer_size = buffer_size

    async def run(self, context: StreamPipelineContext) -> StreamPipelineContext:
        if context.record is None:
            return context
        trimmed = await self._replay.trim(
            workflow_id=context.session.workflow_id,
            keep=self._buffer_size,
        )
        context.audit_events.append({"stage": self.name, "trimmed": trimmed})
        return context
