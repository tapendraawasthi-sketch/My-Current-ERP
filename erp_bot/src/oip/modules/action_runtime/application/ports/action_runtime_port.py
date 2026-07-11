"""Action Runtime inbound port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .....integration.contracts.execution_intent import ExecutionIntent
from ...domain.entities import ActionExecution
from ..read_models.action_runtime_read_models import ActionExecutionReadModel


class ActionRuntimePort(ABC):
    @abstractmethod
    async def propose_action(
        self,
        *,
        evaluation_id: str,
        tenant_id: str,
        execution_intent: ExecutionIntent | None = None,
        action_type: str | None = None,
        payload: dict[str, Any] | None = None,
        user_id: str = "system",
        idempotency_key: str | None = None,
        auto_execute: bool = True,
        runtime_context: dict[str, Any] | None = None,
    ) -> ActionExecution: ...

    @abstractmethod
    async def approve_action(
        self, *, tenant_id: str, action_id: str, approver_id: str = "manager"
    ) -> ActionExecution: ...

    @abstractmethod
    async def reject_action(
        self, *, tenant_id: str, action_id: str, approver_id: str = "manager", reason: str = ""
    ) -> ActionExecution: ...

    @abstractmethod
    async def cancel_action(self, *, tenant_id: str, action_id: str, reason: str = "") -> ActionExecution: ...

    @abstractmethod
    async def get_read_model(
        self, *, tenant_id: str, action_id: str
    ) -> ActionExecutionReadModel | None: ...
