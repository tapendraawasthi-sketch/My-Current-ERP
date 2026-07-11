"""Memory Runtime queries."""

from __future__ import annotations

from ....application.queries import Query


class GetMemoryQuery(Query):
    query_type: str = "oip.query.memory.get.v1"
    memory_id: str


class TimelineQuery(Query):
    query_type: str = "oip.query.memory.timeline.v1"
    conversation_id: str | None = None
    workflow_id: str | None = None
    company_id: str | None = None
    limit: int = 50


class SearchMemoryQuery(Query):
    query_type: str = "oip.query.memory.search.v1"
    query: str
    mode: str = "Hybrid"
    company_id: str | None = None
    conversation_id: str | None = None
    limit: int = 20


class PatternSearchQuery(Query):
    query_type: str = "oip.query.memory.pattern_search.v1"
    pattern_type: str = "success"
    limit: int = 20


class RelatedMemoryQuery(Query):
    query_type: str = "oip.query.memory.related.v1"
    memory_id: str
    limit: int = 10


class MemoryMetricsQuery(Query):
    query_type: str = "oip.query.memory.metrics.v1"
    metric_date: str | None = None


class CollectionsQuery(Query):
    query_type: str = "oip.query.memory.collections.v1"
    scope: str | None = None


class StatisticsQuery(Query):
    query_type: str = "oip.query.memory.statistics.v1"
