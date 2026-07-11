"""Execution plan repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from ...application.read_models.execution_plan_read_model import PlannerMetricsReadModel
from ...domain.entities import ExecutionPlan
from ...domain.value_objects import PlanStatus


class ExecutionPlanRepositoryPort(ABC):
    @abstractmethod
    async def save(self, plan: ExecutionPlan) -> None:
        """Persist immutable execution plan aggregate."""

    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, plan_id: str) -> ExecutionPlan | None:
        """Load plan by id."""

    @abstractmethod
    async def search(
        self,
        *,
        tenant_id: str,
        company_id: str | None = None,
        conversation_id: str | None = None,
        request_id: str | None = None,
        status: PlanStatus | None = None,
        limit: int = 50,
    ) -> Sequence[ExecutionPlan]:
        """Search execution plans."""

    @abstractmethod
    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        estimated_latency_ms: int = 0,
        estimated_tokens: int = 0,
    ) -> None:
        """Update planner metrics read model."""

    @abstractmethod
    async def get_metrics(
        self,
        *,
        tenant_id: str,
        metric_date: str | None = None,
    ) -> PlannerMetricsReadModel:
        """Load planner metrics read model."""
