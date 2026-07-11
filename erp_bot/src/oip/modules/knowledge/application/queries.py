"""Knowledge Runtime queries."""

from __future__ import annotations

from ....application.queries import Query


class GetKnowledgeDocumentQuery(Query):
    query_type: str = "oip.query.knowledge.get_document.v1"
    document_id: str


class GetEvidenceBundleQuery(Query):
    query_type: str = "oip.query.knowledge.get_bundle.v1"
    bundle_id: str


class GetRetrievalQuery(Query):
    query_type: str = "oip.query.knowledge.get_retrieval.v1"
    retrieval_id: str


class KnowledgeMetricsQuery(Query):
    query_type: str = "oip.query.knowledge.get_metrics.v1"
    metric_date: str | None = None
