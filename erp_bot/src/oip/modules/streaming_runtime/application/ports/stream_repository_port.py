"""Streaming Runtime repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..read_models.streaming_read_models import StreamingMetricsReadModel
from ...domain.entities import StreamingSession
from ...domain.value_objects import StreamEventRecord, StreamOffset, StreamReplayState


class StreamRepositoryPort(ABC):
    @abstractmethod
    async def save_session(self, session: StreamingSession) -> None: ...

    @abstractmethod
    async def get_session(self, *, tenant_id: str, stream_id: str) -> StreamingSession | None: ...

    @abstractmethod
    async def get_session_by_workflow(
        self, *, tenant_id: str, workflow_id: str
    ) -> StreamingSession | None: ...

    @abstractmethod
    async def save_event(self, event: StreamEventRecord) -> None: ...

    @abstractmethod
    async def get_events_after(
        self, *, tenant_id: str, workflow_id: str, after_sequence: int, limit: int = 1000
    ) -> tuple[StreamEventRecord, ...]: ...

    @abstractmethod
    async def next_sequence(self, *, tenant_id: str, workflow_id: str) -> int: ...

    @abstractmethod
    async def save_offset(self, offset: StreamOffset) -> None: ...

    @abstractmethod
    async def get_offset(
        self, *, tenant_id: str, stream_id: str, client_id: str
    ) -> StreamOffset | None: ...

    @abstractmethod
    async def save_replay(self, replay: StreamReplayState) -> None: ...

    @abstractmethod
    async def list_sessions(
        self, *, tenant_id: str, workflow_id: str | None = None, limit: int = 50
    ) -> tuple[StreamingSession, ...]: ...

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> StreamingMetricsReadModel: ...

    @abstractmethod
    async def get_seen_event_types(self, *, tenant_id: str, workflow_id: str) -> set[str]: ...

    @abstractmethod
    async def count_active_sessions(self, *, tenant_id: str) -> int: ...
