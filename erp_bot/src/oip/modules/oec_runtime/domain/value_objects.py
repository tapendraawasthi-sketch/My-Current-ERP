"""OEC Runtime domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ConnectorType(str, Enum):
    SQLITE = "SQLite"
    POSTGRESQL = "PostgreSQL"
    MYSQL = "MySQL"
    SQL_SERVER = "SQL Server"
    REST = "REST"
    GRAPHQL = "GraphQL"
    SUTRA = "Sutra"
    OFFLINE = "Offline"
    REPLAY = "Replay"
    MOCK = "Mock"


class ConnectorStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    UNREGISTERED = "unregistered"


class HealthState(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    COMPENSATED = "compensated"
    DUPLICATE = "duplicate"


class TransactionStatus(str, Enum):
    OPEN = "open"
    COMMITTED = "committed"
    ROLLED_BACK = "rolled_back"
    TIMED_OUT = "timed_out"


class CapabilityDomain(str, Enum):
    ACCOUNTING = "Accounting"
    INVENTORY = "Inventory"
    PAYROLL = "Payroll"
    CRM = "CRM"
    HR = "HR"
    MANUFACTURING = "Manufacturing"
    GOVERNMENT = "Government"


class CapabilityMode(str, Enum):
    READ_ONLY = "ReadOnly"
    READ_WRITE = "ReadWrite"
    STREAMING = "Streaming"
    OFFLINE = "Offline"


class RetryPolicyName(str, Enum):
    NONE = "none"
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    CIRCUIT_BREAKER = "circuit_breaker"


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class IdempotencyRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    idempotency_key: str
    execution_id: str
    erp_reference: str
    created_at: str


class ConnectorConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    connection_string: str = ""
    base_url: str = ""
    api_key: str = ""
    timeout_seconds: float = 30.0
    max_retries: int = 3
    metadata: dict[str, Any] = Field(default_factory=dict)
