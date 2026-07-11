"""Workflow stage port — each stage implements independently."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..dto.stage_result import StageResult
from ..dto.workflow_context import WorkflowContext


class WorkflowStagePort(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def validate(self, context: WorkflowContext) -> StageResult: ...

    @abstractmethod
    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]: ...

    @abstractmethod
    async def rollback(self, context: WorkflowContext) -> StageResult: ...

    @abstractmethod
    def metrics(self) -> dict[str, Any]: ...

    @abstractmethod
    def supports_retry(self) -> bool: ...
