"""OEC Runtime domain aggregates — immutable."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    CapabilityDomain,
    CapabilityMode,
    ConnectorConfig,
    ConnectorStatus,
    ConnectorType,
    ExecutionStatus,
    HealthState,
    TransactionStatus,
)


class ERPConnector(BaseModel):
    model_config = ConfigDict(frozen=True)

    connector_id: str
    tenant_id: str
    company_id: str | None = None
    name: str
    connector_type: ConnectorType
    status: ConnectorStatus = ConnectorStatus.ACTIVE
    config: ConnectorConfig = Field(default_factory=ConnectorConfig)
    capabilities: tuple[str, ...] = Field(default_factory=tuple)
    is_default: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ConnectorHealth(BaseModel):
    model_config = ConfigDict(frozen=True)

    health_id: str
    connector_id: str
    tenant_id: str
    state: HealthState
    latency_ms: int = 0
    availability: float = 1.0
    last_check_at: datetime
    details: dict[str, Any] = Field(default_factory=dict)


class ConnectorCapability(BaseModel):
    model_config = ConfigDict(frozen=True)

    capability_id: str
    connector_id: str
    tenant_id: str
    domain: CapabilityDomain
    mode: CapabilityMode
    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class ERPCommandExecution(BaseModel):
    model_config = ConfigDict(frozen=True)

    execution_id: str
    connector_id: str
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    command_id: str
    command_type: str
    idempotency_key: str
    status: ExecutionStatus
    erp_reference: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    response: dict[str, Any] = Field(default_factory=dict)
    retry_count: int = 0
    error_message: str = ""
    transaction_id: str | None = None
    snapshot_id: str | None = None
    request_id: str = ""
    correlation_id: str = ""
    created_at: datetime
    completed_at: datetime | None = None


class ERPQueryExecution(BaseModel):
    model_config = ConfigDict(frozen=True)

    query_id: str
    connector_id: str
    tenant_id: str
    company_id: str
    query_type: str
    status: ExecutionStatus
    payload: dict[str, Any] = Field(default_factory=dict)
    response: dict[str, Any] = Field(default_factory=dict)
    latency_ms: int = 0
    created_at: datetime
    completed_at: datetime | None = None


class ConnectorTransaction(BaseModel):
    model_config = ConfigDict(frozen=True)

    transaction_id: str
    connector_id: str
    tenant_id: str
    execution_id: str
    status: TransactionStatus
    opened_at: datetime
    committed_at: datetime | None = None
    timeout_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CompensationRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    compensation_id: str
    execution_id: str
    connector_id: str
    tenant_id: str
    reason: str
    reversal_command_id: str
    erp_reference: str = ""
    status: ExecutionStatus
    created_at: datetime
    completed_at: datetime | None = None


class ConnectorMetrics(BaseModel):
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
