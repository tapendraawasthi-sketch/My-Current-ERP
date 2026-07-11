"""Workflow repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..read_models.orchestrator_read_models import WorkflowMetricsReadModel
from ...domain.entities import WorkflowExecution
from ...domain.value_objects import StageMetrics


class WorkflowRepositoryPort(ABC):
    @abstractmethod
    async def save(self, workflow: WorkflowExecution) -> None: ...

    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, workflow_id: str) -> WorkflowExecution | None: ...

    @abstractmethod
    async def get_by_idempotency(
        self, *, tenant_id: str, idempotency_key: str
    ) -> WorkflowExecution | None: ...

    @abstractmethod
    async def list_workflows(
        self, *, tenant_id: str, state: str | None = None, limit: int = 50
    ) -> tuple[WorkflowExecution, ...]: ...

    @abstractmethod
    async def save_stage_run(
        self, *, tenant_id: str, workflow_id: str, stage: StageMetrics
    ) -> None: ...

    @abstractmethod
    async def get_stage_runs(
        self, *, tenant_id: str, workflow_id: str
    ) -> tuple[StageMetrics, ...]: ...

    @abstractmethod
    async def save_failure(
        self, *, tenant_id: str, workflow_id: str, stage: str, reason: str
    ) -> None: ...

    @abstractmethod
    async def save_retry(
        self, *, tenant_id: str, workflow_id: str, attempt: int, stage: str
    ) -> None: ...

    @abstractmethod
    async def save_rollback(
        self, *, tenant_id: str, workflow_id: str, stage: str, reason: str
    ) -> None: ...

    @abstractmethod
    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None: ...

    @abstractmethod
    async def get_metrics(
        self, *, tenant_id: str, metric_date: str | None = None
    ) -> WorkflowMetricsReadModel: ...

    @abstractmethod
    async def list_recoverable(
        self, *, tenant_id: str, limit: int = 100
    ) -> tuple[WorkflowExecution, ...]: ...
