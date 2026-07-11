"""Workflow engine port — replaceable execution backend."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.entities import WorkflowExecution
from ..dto.workflow_context import WorkflowContext


class WorkflowEnginePort(ABC):
    @abstractmethod
    async def run(
        self,
        *,
        workflow: WorkflowExecution,
        context: WorkflowContext,
    ) -> tuple[WorkflowExecution, WorkflowContext]: ...

    @abstractmethod
    async def recover(
        self,
        *,
        workflow: WorkflowExecution,
        context: WorkflowContext,
    ) -> tuple[WorkflowExecution, WorkflowContext]: ...
