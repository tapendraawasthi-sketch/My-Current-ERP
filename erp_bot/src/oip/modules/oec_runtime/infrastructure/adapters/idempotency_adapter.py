"""Idempotency adapter backed by repository."""

from __future__ import annotations

from ...application.ports.oec_ports import IdempotencyPort, OecRepositoryPort
from ...domain.entities import ERPCommandExecution
from ...domain.value_objects import ExecutionStatus


class IdempotencyAdapter(IdempotencyPort):
    def __init__(self, repository: OecRepositoryPort) -> None:
        self._repository = repository

    async def check(self, *, tenant_id: str, idempotency_key: str) -> ERPCommandExecution | None:
        return await self._repository.get_execution_by_idempotency(
            tenant_id=tenant_id, idempotency_key=idempotency_key
        )

    async def record(self, *, tenant_id: str, execution: ERPCommandExecution) -> None:
        if execution.status == ExecutionStatus.CONFIRMED:
            await self._repository.save_execution(execution)
