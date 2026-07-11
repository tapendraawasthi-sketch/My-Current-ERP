"""OEC Runtime read models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ConnectorReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    connector_id: str
    tenant_id: str
    name: str
    connector_type: str
    status: str
    company_id: str | None = None
    is_default: bool = False
    capabilities: tuple[str, ...] = Field(default_factory=tuple)
    created_at: str
    updated_at: str


class ExecutionReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    execution_id: str
    connector_id: str
    command_id: str
    command_type: str
    status: str
    erp_reference: str = ""
    retry_count: int = 0
    created_at: str
    completed_at: str | None = None


class ConnectorMetricsReadModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: str
    connector_id: str
    metric_date: str
    latency_ms_avg: float = 0.0
    retry_count: int = 0
    failure_count: int = 0
    rollback_rate: float = 0.0
    availability: float = 1.0
    command_throughput: int = 0
    query_throughput: int = 0
    success_rate: float = 1.0
    metadata: dict[str, Any] = Field(default_factory=dict)
