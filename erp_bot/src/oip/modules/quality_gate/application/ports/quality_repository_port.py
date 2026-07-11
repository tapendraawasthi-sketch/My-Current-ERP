"""Quality Gate repository ports."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..read_models.quality_gate_read_models import QualityMetricsReadModel
from ...domain.entities import QualityEvaluation
from ...domain.value_objects import QualityRule


class QualityRepositoryPort(ABC):
    @abstractmethod
    async def save(self, evaluation: QualityEvaluation) -> None: ...

    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, evaluation_id: str) -> QualityEvaluation | None: ...

    @abstractmethod
    async def get_by_execution_id(
        self, *, tenant_id: str, execution_id: str
    ) -> QualityEvaluation | None: ...

    @abstractmethod
    async def search(
        self,
        *,
        tenant_id: str,
        request_id: str | None = None,
        conversation_id: str | None = None,
        company_id: str | None = None,
        decision: str | None = None,
        limit: int = 50,
    ) -> tuple[QualityEvaluation, ...]: ...

    @abstractmethod
    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        decision: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> QualityMetricsReadModel: ...


class QualityRuleRepositoryPort(ABC):
    @abstractmethod
    async def list_rules(self, *, level: str | None = None, enabled_only: bool = True) -> tuple[QualityRule, ...]: ...

    @abstractmethod
    async def get_rule(self, *, rule_code: str) -> QualityRule | None: ...

    @abstractmethod
    async def save_rule(self, rule: QualityRule) -> None: ...
