"""Application queries — read-side (CQRS)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ...shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id


class Query(BaseModel):
    model_config = ConfigDict(frozen=True)

    query_type: str = ""
    tenant_id: TenantId
    correlation_id: CorrelationId = Field(default_factory=new_correlation_id)


class GetLineageTraceQuery(Query):
    query_type: str = "oip.query.lineage.get_trace.v1"
    request_id: RequestId


class GetAuditChainQuery(Query):
    query_type: str = "oip.query.audit.get_chain.v1"
    request_id: RequestId | None = None
    limit: int = 100
