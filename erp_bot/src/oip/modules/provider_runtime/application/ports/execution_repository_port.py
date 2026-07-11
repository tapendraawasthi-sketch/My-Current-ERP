"""Execution repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.entities import ExecutionAggregate
from ...domain.value_objects import CapabilityToken, ExecutionArtifact, ProviderUsage, StreamingState
from ..read_models.execution_read_models import ExecutionMetricsReadModel


class ExecutionRepositoryPort(ABC):
    @abstractmethod
    async def save(self, execution: ExecutionAggregate) -> None:
        """Persist execution aggregate and children."""

    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, execution_id: str) -> ExecutionAggregate | None:
        """Load execution by id."""

    @abstractmethod
    async def search(
        self,
        *,
        tenant_id: str,
        route_id: str | None = None,
        plan_id: str | None = None,
        request_id: str | None = None,
        conversation_id: str | None = None,
        company_id: str | None = None,
        provider_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> tuple[ExecutionAggregate, ...]:
        """Search executions."""

    @abstractmethod
    async def save_capability_token(self, token: CapabilityToken) -> None:
        """Persist capability token."""

    @abstractmethod
    async def get_capability_token(self, *, tenant_id: str, token_id: str) -> CapabilityToken | None:
        """Load capability token."""

    @abstractmethod
    async def save_stream_chunk(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        sequence_no: int,
        chunk_text: str,
        provisional: bool = True,
    ) -> None:
        """Persist provisional stream chunk."""

    @abstractmethod
    async def list_stream_chunks(
        self,
        *,
        tenant_id: str,
        execution_id: str,
    ) -> tuple[dict[str, object], ...]:
        """List stream chunks for replay."""

    @abstractmethod
    async def get_usage(self, *, tenant_id: str, execution_id: str) -> ProviderUsage | None:
        """Get usage record."""

    @abstractmethod
    async def list_artifacts(self, *, tenant_id: str, execution_id: str) -> tuple[ExecutionArtifact, ...]:
        """List artifact metadata (no raw blob)."""

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> ExecutionMetricsReadModel:
        """Get daily execution metrics."""

    @abstractmethod
    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        provider_id: str | None = None,
        latency_ms: int = 0,
        cost_micros: int = 0,
        tokens: int = 0,
    ) -> None:
        """Increment metrics rollup."""
