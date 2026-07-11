"""Streaming Runtime projectors."""

from __future__ import annotations

from ...domain.entities import StreamingSession
from ...domain.value_objects import StreamEventRecord, StreamReplayState
from ..read_models.streaming_read_models import (
    ReplayReadModel,
    StreamingMetricsReadModel,
    StreamingSessionReadModel,
)


class StreamingSessionProjector:
    def project(self, session: StreamingSession) -> StreamingSessionReadModel:
        return StreamingSessionReadModel(
            stream_id=session.stream_id,
            workflow_id=session.workflow_id,
            conversation_id=session.conversation_id,
            execution_id=session.execution_id,
            request_id=session.request_id,
            tenant_id=session.tenant_id,
            company_id=session.company_id,
            client_id=session.client_id,
            status=session.status.value,
            protocol=session.protocol.value,
            last_sequence=session.last_sequence,
            replay_position=session.replay_position,
            connection_id=session.connection_id,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
            connected_at=session.connected_at.isoformat() if session.connected_at else None,
            disconnected_at=session.disconnected_at.isoformat() if session.disconnected_at else None,
            closed_at=session.closed_at.isoformat() if session.closed_at else None,
        )


class ReplayProjector:
    def project(
        self,
        replay: StreamReplayState,
        events: tuple[StreamEventRecord, ...],
    ) -> ReplayReadModel:
        return ReplayReadModel(
            replay_id=replay.replay_id,
            stream_id=replay.stream_id,
            workflow_id=replay.workflow_id,
            from_sequence=replay.from_sequence,
            to_sequence=replay.to_sequence,
            event_count=replay.event_count,
            events=tuple(e.model_dump(mode="json") for e in events),
            started_at=replay.started_at,
            completed_at=replay.completed_at,
        )


class StreamingMetricsProjector:
    def project(self, metrics: StreamingMetricsReadModel) -> StreamingMetricsReadModel:
        return metrics
