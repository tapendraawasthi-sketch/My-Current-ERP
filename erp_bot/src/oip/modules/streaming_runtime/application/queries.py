"""Streaming Runtime queries."""

from __future__ import annotations

from ....application.queries import Query


class GetStreamQuery(Query):
    query_type: str = "oip.query.streaming_runtime.get_stream.v1"
    stream_id: str


class ReplayStreamQuery(Query):
    query_type: str = "oip.query.streaming_runtime.replay_stream.v1"
    workflow_id: str
    last_sequence: int = 0
    client_id: str = "replay-client"


class StreamingMetricsQuery(Query):
    query_type: str = "oip.query.streaming_runtime.get_metrics.v1"
    metric_date: str | None = None


class ListStreamsQuery(Query):
    query_type: str = "oip.query.streaming_runtime.list_streams.v1"
    workflow_id: str | None = None
    limit: int = 50
