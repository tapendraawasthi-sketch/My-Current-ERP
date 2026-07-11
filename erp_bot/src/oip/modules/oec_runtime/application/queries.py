"""OEC Runtime queries."""

from __future__ import annotations

from ....application.queries import Query


class GetConnectorQuery(Query):
    query_type: str = "oip.query.oec.get_connector.v1"
    connector_id: str


class SearchConnectorsQuery(Query):
    query_type: str = "oip.query.oec.search_connectors.v1"
    connector_type: str | None = None
    status: str | None = None
    limit: int = 50


class ConnectorHealthQuery(Query):
    query_type: str = "oip.query.oec.health.v1"
    connector_id: str | None = None


class ConnectorMetricsQuery(Query):
    query_type: str = "oip.query.oec.metrics.v1"
    connector_id: str | None = None
    metric_date: str | None = None


class ConnectorCapabilitiesQuery(Query):
    query_type: str = "oip.query.oec.capabilities.v1"
    connector_id: str


class ExecutionHistoryQuery(Query):
    query_type: str = "oip.query.oec.execution_history.v1"
    connector_id: str | None = None
    limit: int = 50
