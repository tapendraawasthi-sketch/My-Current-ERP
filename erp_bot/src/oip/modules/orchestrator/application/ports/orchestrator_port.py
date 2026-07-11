"""Orchestrator inbound port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .....application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from ...domain.entities import WorkflowExecution
from ..read_models.orchestrator_read_models import (
    WorkflowMetricsReadModel,
    WorkflowReadModel,
    WorkflowTimelineReadModel,
)


class OrchestratorPort(ABC):
    @abstractmethod
    async def start_workflow(
        self,
        *,
        request: IntelligenceRequestDto,
        execution_mode: str | None = None,
    ) -> WorkflowExecution: ...

    @abstractmethod
    async def execute_workflow(
        self,
        *,
        request: IntelligenceRequestDto,
        legacy_response: IntelligenceResponseDto | None = None,
    ) -> tuple[WorkflowExecution, IntelligenceResponseDto | None]: ...

    @abstractmethod
    async def cancel_workflow(self, *, tenant_id: str, workflow_id: str, reason: str = "") -> WorkflowExecution: ...

    @abstractmethod
    async def archive_workflow(self, *, tenant_id: str, workflow_id: str) -> WorkflowExecution: ...

    @abstractmethod
    async def recover_workflows(self, *, tenant_id: str) -> tuple[WorkflowExecution, ...]: ...

    @abstractmethod
    async def get_workflow(self, *, tenant_id: str, workflow_id: str) -> WorkflowReadModel | None: ...

    @abstractmethod
    async def get_timeline(
        self, *, tenant_id: str, workflow_id: str
    ) -> WorkflowTimelineReadModel | None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str) -> WorkflowMetricsReadModel: ...
