"""Streaming Runtime outbound ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from ...domain.value_objects import StreamEventRecord, StreamProtocol, WorkflowEventType


class StreamingTransportPort(ABC):
    @abstractmethod
    async def connect(
        self, *, stream_id: str, client_id: str, protocol: StreamProtocol
    ) -> str: ...

    @abstractmethod
    async def publish(self, *, connection_id: str, event: StreamEventRecord) -> bool: ...

    @abstractmethod
    async def disconnect(self, *, connection_id: str) -> None: ...

    @abstractmethod
    async def stream_events(
        self, *, connection_id: str
    ) -> AsyncIterator[dict[str, Any]]: ...


class ReplayBufferPort(ABC):
    @abstractmethod
    async def append(self, *, workflow_id: str, event: StreamEventRecord) -> None: ...

    @abstractmethod
    async def get_after_sequence(
        self, *, workflow_id: str, after_sequence: int, limit: int = 1000
    ) -> tuple[StreamEventRecord, ...]: ...

    @abstractmethod
    async def trim(self, *, workflow_id: str, keep: int) -> int: ...


class WorkflowEventPort(ABC):
    """Ingress for workflow events — delivery only, never generates intelligence."""

    @abstractmethod
    async def ingest(
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
