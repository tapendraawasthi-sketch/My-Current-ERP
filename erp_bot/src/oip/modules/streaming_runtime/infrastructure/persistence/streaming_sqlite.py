"""SQLite streaming runtime repository."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.stream_repository_port import StreamRepositoryPort
from ...application.read_models.streaming_read_models import StreamingMetricsReadModel
from ...domain.entities import StreamingSession
from ...domain.value_objects import (
    StreamEventRecord,
    StreamOffset,
    StreamProtocol,
    StreamReplayState,
    StreamSessionStatus,
    WorkflowEventType,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _parse_dt(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value)


class SqliteStreamRepositoryAdapter(StreamRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save_session(self, session: StreamingSession) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_stream_sessions (
                stream_id, workflow_id, conversation_id, execution_id, request_id,
                tenant_id, company_id, client_id, status, protocol, last_sequence,
                replay_position, connection_id, metadata_json, created_at, updated_at,
                connected_at, disconnected_at, closed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(stream_id) DO UPDATE SET
                status = excluded.status,
                last_sequence = excluded.last_sequence,
                replay_position = excluded.replay_position,
                connection_id = excluded.connection_id,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at,
                connected_at = excluded.connected_at,
                disconnected_at = excluded.disconnected_at,
                closed_at = excluded.closed_at
            """,
            (
                session.stream_id,
                session.workflow_id,
                session.conversation_id,
                session.execution_id,
                session.request_id,
                session.tenant_id,
                session.company_id,
                session.client_id,
                session.status.value,
                session.protocol.value,
                session.last_sequence,
                session.replay_position,
                session.connection_id,
                json.dumps(session.metadata),
                session.created_at.isoformat(),
                session.updated_at.isoformat(),
                session.connected_at.isoformat() if session.connected_at else None,
                session.disconnected_at.isoformat() if session.disconnected_at else None,
                session.closed_at.isoformat() if session.closed_at else None,
            ),
        )
        await self._conn.commit()

    async def get_session(self, *, tenant_id: str, stream_id: str) -> StreamingSession | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_stream_sessions WHERE tenant_id = ? AND stream_id = ?",
            (tenant_id, stream_id),
        )
        row = await cursor.fetchone()
        return self._row_to_session(row) if row else None

    async def get_session_by_workflow(
        self, *, tenant_id: str, workflow_id: str
    ) -> StreamingSession | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_stream_sessions
            WHERE tenant_id = ? AND workflow_id = ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (tenant_id, workflow_id),
        )
        row = await cursor.fetchone()
        return self._row_to_session(row) if row else None

    async def save_event(self, event: StreamEventRecord) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_stream_events (
                event_id, stream_id, workflow_id, conversation_id, request_id,
                tenant_id, company_id, sequence, event_type, timestamp,
                payload_json, checksum, delivered, acked, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(event_id) DO UPDATE SET
                delivered = excluded.delivered,
                acked = excluded.acked
            """,
            (
                event.event_id,
                event.stream_id,
                event.workflow_id,
                event.conversation_id,
                event.request_id,
                event.tenant_id,
                event.company_id,
                event.sequence,
                event.event_type.value,
                event.timestamp,
                json.dumps(event.payload),
                event.checksum,
                int(event.delivered),
                int(event.acked),
                now,
            ),
        )
        await self._conn.commit()

    async def get_events_after(
        self, *, tenant_id: str, workflow_id: str, after_sequence: int, limit: int = 1000
    ) -> tuple[StreamEventRecord, ...]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_stream_events
            WHERE tenant_id = ? AND workflow_id = ? AND sequence > ?
            ORDER BY sequence ASC LIMIT ?
            """,
            (tenant_id, workflow_id, after_sequence, limit),
        )
        rows = await cursor.fetchall()
        return tuple(self._row_to_event(row) for row in rows)

    async def next_sequence(self, *, tenant_id: str, workflow_id: str) -> int:
        cursor = await self._conn.execute(
            """
            SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq
            FROM oip_stream_events WHERE tenant_id = ? AND workflow_id = ?
            """,
            (tenant_id, workflow_id),
        )
        row = await cursor.fetchone()
        return int(row["next_seq"]) if row else 1

    async def save_offset(self, offset: StreamOffset) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_stream_offsets (offset_id, stream_id, client_id, last_sequence, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(offset_id) DO UPDATE SET
                last_sequence = excluded.last_sequence,
                updated_at = excluded.updated_at
            """,
            (
                offset.offset_id,
                offset.stream_id,
                offset.client_id,
                offset.last_sequence,
                offset.updated_at,
            ),
        )
        await self._conn.commit()

    async def get_offset(
        self, *, tenant_id: str, stream_id: str, client_id: str
    ) -> StreamOffset | None:
        cursor = await self._conn.execute(
            """
            SELECT o.* FROM oip_stream_offsets o
            JOIN oip_stream_sessions s ON s.stream_id = o.stream_id
            WHERE s.tenant_id = ? AND o.stream_id = ? AND o.client_id = ?
            """,
            (tenant_id, stream_id, client_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return StreamOffset(
            offset_id=row["offset_id"],
            stream_id=row["stream_id"],
            client_id=row["client_id"],
            last_sequence=row["last_sequence"],
            updated_at=row["updated_at"],
        )

    async def save_replay(self, replay: StreamReplayState) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_stream_replays (
                replay_id, stream_id, workflow_id, from_sequence, to_sequence,
                event_count, started_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(replay_id) DO UPDATE SET
                to_sequence = excluded.to_sequence,
                event_count = excluded.event_count,
                completed_at = excluded.completed_at
            """,
            (
                replay.replay_id,
                replay.stream_id,
                replay.workflow_id,
                replay.from_sequence,
                replay.to_sequence,
                replay.event_count,
                replay.started_at,
                replay.completed_at,
            ),
        )
        await self._conn.commit()

    async def list_sessions(
        self, *, tenant_id: str, workflow_id: str | None = None, limit: int = 50
    ) -> tuple[StreamingSession, ...]:
        if workflow_id:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_stream_sessions
                WHERE tenant_id = ? AND workflow_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (tenant_id, workflow_id, limit),
            )
        else:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_stream_sessions
                WHERE tenant_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (tenant_id, limit),
            )
        rows = await cursor.fetchall()
        return tuple(self._row_to_session(row) for row in rows)

    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None:
        allowed = {
            "streams_opened",
            "streams_closed",
            "events_published",
            "replays_started",
            "replays_completed",
            "heartbeats_sent",
            "transport_failures",
            "reconnects",
        }
        if metric not in allowed:
            return
        today = _utc_today()
        await self._conn.execute(
            f"""
            INSERT INTO oip_stream_metrics (tenant_id, metric_date, {metric})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                {metric} = oip_stream_metrics.{metric} + 1
            """,
            (tenant_id, today),
        )
        await self._conn.commit()

    async def get_metrics(
        self, *, tenant_id: str, metric_date: str | None = None
    ) -> StreamingMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_stream_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if not row:
            return StreamingMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return StreamingMetricsReadModel(
            tenant_id=tenant_id,
            metric_date=date,
            streams_opened=row["streams_opened"],
            streams_closed=row["streams_closed"],
            events_published=row["events_published"],
            replays_started=row["replays_started"],
            replays_completed=row["replays_completed"],
            heartbeats_sent=row["heartbeats_sent"],
            transport_failures=row["transport_failures"],
            reconnects=row["reconnects"],
        )

    async def get_seen_event_types(self, *, tenant_id: str, workflow_id: str) -> set[str]:
        cursor = await self._conn.execute(
            """
            SELECT DISTINCT event_type FROM oip_stream_events
            WHERE tenant_id = ? AND workflow_id = ?
            """,
            (tenant_id, workflow_id),
        )
        rows = await cursor.fetchall()
        return {row["event_type"] for row in rows}

    async def count_active_sessions(self, *, tenant_id: str) -> int:
        cursor = await self._conn.execute(
            """
            SELECT COUNT(*) AS cnt FROM oip_stream_sessions
            WHERE tenant_id = ? AND status IN ('open', 'connected', 'replaying')
            """,
            (tenant_id,),
        )
        row = await cursor.fetchone()
        return int(row["cnt"]) if row else 0

    def _row_to_session(self, row) -> StreamingSession:
        return StreamingSession(
            stream_id=row["stream_id"],
            workflow_id=row["workflow_id"],
            conversation_id=row["conversation_id"],
            execution_id=row["execution_id"],
            request_id=row["request_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            client_id=row["client_id"],
            status=StreamSessionStatus(row["status"]),
            protocol=StreamProtocol(row["protocol"]),
            last_sequence=row["last_sequence"],
            replay_position=row["replay_position"],
            connection_id=row["connection_id"],
            metadata=json.loads(row["metadata_json"] or "{}"),
            created_at=_parse_dt(row["created_at"]),
            updated_at=_parse_dt(row["updated_at"]),
            connected_at=_parse_dt(row["connected_at"]),
            disconnected_at=_parse_dt(row["disconnected_at"]),
            closed_at=_parse_dt(row["closed_at"]),
        )

    def _row_to_event(self, row) -> StreamEventRecord:
        return StreamEventRecord(
            event_id=row["event_id"],
            stream_id=row["stream_id"],
            workflow_id=row["workflow_id"],
            conversation_id=row["conversation_id"],
            request_id=row["request_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            sequence=row["sequence"],
            event_type=WorkflowEventType(row["event_type"]),
            timestamp=row["timestamp"],
            payload=json.loads(row["payload_json"] or "{}"),
            checksum=row["checksum"],
            delivered=bool(row["delivered"]),
            acked=bool(row["acked"]),
        )
