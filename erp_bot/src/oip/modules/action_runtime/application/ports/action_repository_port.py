"""Action Runtime repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..read_models.action_runtime_read_models import ActionMetricsReadModel
from ...domain.entities import ActionExecution


class ActionRepositoryPort(ABC):
    @abstractmethod
    async def save(self, action: ActionExecution) -> None: ...

    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, action_id: str) -> ActionExecution | None: ...

    @abstractmethod
    async def get_by_idempotency_key(
        self, *, tenant_id: str, idempotency_key: str
    ) -> ActionExecution | None: ...

    @abstractmethod
    async def search(
        self,
        *,
        tenant_id: str,
        execution_id: str | None = None,
        evaluation_id: str | None = None,
        request_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> tuple[ActionExecution, ...]: ...

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> ActionMetricsReadModel: ...
