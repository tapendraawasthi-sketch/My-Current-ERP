"""Quality Gate inbound port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.entities import QualityEvaluation
from ..read_models.quality_gate_read_models import (
    QualityDecisionReadModel,
    QualityFindingReadModel,
)


class QualityGatePort(ABC):
    @abstractmethod
    async def start_evaluation(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        validation_context: dict | None = None,
    ) -> QualityEvaluation: ...

    @abstractmethod
    async def approve_evaluation(self, *, tenant_id: str, evaluation_id: str) -> QualityEvaluation: ...

    @abstractmethod
    async def reject_evaluation(
        self, *, tenant_id: str, evaluation_id: str, reason: str = ""
    ) -> QualityEvaluation: ...

    @abstractmethod
    async def archive_evaluation(self, *, tenant_id: str, evaluation_id: str) -> QualityEvaluation: ...

    @abstractmethod
    async def get_read_model(
        self, *, tenant_id: str, evaluation_id: str
    ) -> QualityDecisionReadModel | None: ...

    @abstractmethod
    async def get_findings(
        self, *, tenant_id: str, evaluation_id: str
    ) -> tuple[QualityFindingReadModel, ...]: ...
