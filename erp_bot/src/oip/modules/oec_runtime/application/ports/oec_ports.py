"""OEC Runtime ports."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from .....integration.contracts.erp_commands import ErpCommandEnvelope
from .....integration.contracts.snapshots import ErpContextSnapshot, FiscalPeriodStatus
from ..read_models.oec_read_models import ConnectorMetricsReadModel
from ...domain.entities import (
    CompensationRecord,
    ConnectorHealth,
    ConnectorTransaction,
    ERPCommandExecution,
    ERPConnector,
    ERPQueryExecution,
)
from ...domain.connector_registry import ConnectorRegistry


class OecRepositoryPort(ABC):
    @abstractmethod
    async def save_connector(self, connector: ERPConnector) -> None: ...

    @abstractmethod
    async def get_connector(self, *, tenant_id: str, connector_id: str) -> ERPConnector | None: ...

    @abstractmethod
    async def get_default_connector(self, *, tenant_id: str, company_id: str | None) -> ERPConnector | None: ...

    @abstractmethod
    async def search_connectors(
        self, *, tenant_id: str, connector_type: str | None, status: str | None, limit: int
    ) -> tuple[ERPConnector, ...]: ...

    @abstractmethod
    async def save_execution(self, execution: ERPCommandExecution) -> None: ...

    @abstractmethod
    async def get_execution(self, *, tenant_id: str, execution_id: str) -> ERPCommandExecution | None: ...

    @abstractmethod
    async def get_execution_by_idempotency(
        self, *, tenant_id: str, idempotency_key: str
    ) -> ERPCommandExecution | None: ...

    @abstractmethod
    async def save_query(self, query: ERPQueryExecution) -> None: ...

    @abstractmethod
    async def save_transaction(self, transaction: ConnectorTransaction) -> None: ...

    @abstractmethod
    async def save_compensation(self, record: CompensationRecord) -> None: ...

    @abstractmethod
    async def save_health(self, health: ConnectorHealth) -> None: ...

    @abstractmethod
    async def get_health(self, *, tenant_id: str, connector_id: str) -> ConnectorHealth | None: ...

    @abstractmethod
    async def list_executions(
        self, *, tenant_id: str, connector_id: str | None, limit: int
    ) -> tuple[ERPCommandExecution, ...]: ...

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, connector_id: str, metric: str, value: float = 1.0) -> None: ...

    @abstractmethod
    async def get_metrics(
        self, *, tenant_id: str, connector_id: str, metric_date: str | None
    ) -> ConnectorMetricsReadModel: ...

    @abstractmethod
    async def enqueue_dead_letter(self, *, tenant_id: str, execution_id: str, payload: dict) -> None: ...

    @abstractmethod
    async def record_circuit_state(self, *, tenant_id: str, connector_id: str, state: str) -> None: ...

    @abstractmethod
    async def get_circuit_state(self, *, tenant_id: str, connector_id: str) -> str: ...

    @abstractmethod
    async def increment_circuit_failures(self, *, tenant_id: str, connector_id: str) -> int: ...


class CircuitBreakerPort(ABC):
    @abstractmethod
    async def allow_request(self, *, tenant_id: str, connector_id: str) -> bool: ...

    @abstractmethod
    async def record_success(self, *, tenant_id: str, connector_id: str) -> None: ...

    @abstractmethod
    async def record_failure(self, *, tenant_id: str, connector_id: str) -> None: ...


class IdempotencyPort(ABC):
    @abstractmethod
    async def check(self, *, tenant_id: str, idempotency_key: str) -> ERPCommandExecution | None: ...

    @abstractmethod
    async def record(self, *, tenant_id: str, execution: ERPCommandExecution) -> None: ...


class OecRuntimePort(ABC):
    @abstractmethod
    async def dispatch_envelope(self, command: ErpCommandEnvelope) -> dict[str, Any]: ...

    @abstractmethod
    async def get_context_snapshot(
        self, *, tenant_id: str, company_id: str, branch_id: str | None, user_id: str
    ) -> ErpContextSnapshot: ...

    @abstractmethod
    async def is_period_open(
        self, *, tenant_id: str, company_id: str, branch_id: str | None, fiscal_period_id: str | None
    ) -> FiscalPeriodStatus: ...
