"""Streaming Runtime inbound port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from ...domain.entities import StreamingSession
from ...domain.value_objects import StreamEventRecord, StreamProtocol, WorkflowEventType
from ..read_models.streaming_read_models import (
    ReplayReadModel,
    StreamingMetricsReadModel,
    StreamingSessionReadModel,
)


class StreamingRuntimePort(ABC):
    @abstractmethod
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
    ) -> StreamingSession: ...

    @abstractmethod
    async def close_stream(self, *, tenant_id: str, stream_id: str) -> StreamingSession: ...

    @abstractmethod
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
    ) -> StreamEventRecord | None: ...

    @abstractmethod
    async def replay(
        self, *, tenant_id: str, workflow_id: str, last_sequence: int, client_id: str
    ) -> tuple[StreamEventRecord, ...]: ...

    @abstractmethod
    async def reconnect(
        self, *, tenant_id: str, stream_id: str, client_id: str, last_sequence: int
    ) -> StreamingSession: ...

    @abstractmethod
    async def stream_live(
        self, *, tenant_id: str, workflow_id: str, client_id: str, last_sequence: int = 0
    ) -> AsyncIterator[StreamEventRecord]: ...

    @abstractmethod
    async def get_read_model(
        self, *, tenant_id: str, stream_id: str
    ) -> StreamingSessionReadModel | None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str) -> StreamingMetricsReadModel: ...
