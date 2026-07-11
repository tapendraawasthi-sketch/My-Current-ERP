"""OEC Runtime application service."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from .....integration.contracts.erp_commands import ErpCommandEnvelope, ErpCommandType
from .....integration.contracts.snapshots import ErpContextSnapshot, FiscalPeriodStatus
from ...domain.connector_registry import ConnectorRegistry
from ...domain.entities import ConnectorHealth, ERPCommandExecution, ERPConnector, ERPQueryExecution
from ...domain.events import (
    ConnectorArchivedEvent,
    ConnectorRegisteredEvent,
    ERPCommandConfirmedEvent,
    ERPCommandFailedEvent,
    ERPQueryCompletedEvent,
    build_oec_event,
)
from ...domain.health_registry import HealthRegistry, create_default_health_registry
from ...domain.retry_registry import RetryRegistry, create_default_retry_registry
from ...domain.value_objects import (
    ConnectorConfig,
    ConnectorStatus,
    ConnectorType,
    ExecutionStatus,
    HealthState,
    RetryPolicyName,
)
from ..pipeline.context import ExecutionPipelineContext
from ..pipeline.pipeline import OecExecutionPipeline
from ..ports.oec_ports import OecRepositoryPort, OecRuntimePort
from ..projectors.oec_projectors import ConnectorProjector, ExecutionProjector


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OecRuntimeService(OecRuntimePort):
    def __init__(
        self,
        *,
        pipeline: OecExecutionPipeline,
        repository: OecRepositoryPort,
        connector_registry: ConnectorRegistry,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._connector_registry = connector_registry
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._connector_projector = ConnectorProjector()
        self._execution_projector = ExecutionProjector()
        self._health_registry = create_default_health_registry()
        self._retry_registry = create_default_retry_registry()

    async def dispatch_envelope(self, command: ErpCommandEnvelope) -> dict[str, Any]:
        if not self._settings.oec_enabled:
            raise ValueError("OEC runtime module is disabled")
        return await self.execute_command(
            tenant_id=command.tenant_id,
            request_id=command.command_id,
            correlation_id=command.command_id,
            command_id=command.command_id,
            command_type=command.command_type.value,
            company_id=command.company_id,
            branch_id=command.branch_id,
            idempotency_key=command.idempotency_key,
            payload=dict(command.payload),
        )

    async def execute_command(
        self,
        *,
        tenant_id: str,
        request_id: str,
        correlation_id: str,
        command_id: str,
        command_type: str,
        company_id: str,
        branch_id: str | None = None,
        idempotency_key: str,
        payload: dict[str, Any] | None = None,
        connector_id: str | None = None,
        snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        merged_payload = {
            **(payload or {}),
            "tenant_id": tenant_id,
            "company_id": company_id,
            "command_id": command_id,
            "idempotency_key": idempotency_key,
        }
        context = ExecutionPipelineContext(
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            request_id=request_id,
            correlation_id=correlation_id,
            command_id=command_id,
            command_type=command_type,
            idempotency_key=idempotency_key,
            payload=merged_payload,
            connector_id=connector_id,
            snapshot=snapshot,
            started_at=_utc_now(),
        )
        result = await self._pipeline.execute(context)
        if result.blocked and not result.duplicate:
            await self._publish_event(
                ERPCommandFailedEvent,
                tenant_id=tenant_id,
                correlation_id=correlation_id,
                company_id=company_id,
                connector_id=result.connector_id or "unknown",
                request_id=request_id,
                payload={"error": result.error, "execution_id": result.execution.execution_id if result.execution else None},
            )
            raise RuntimeError(result.error or "erp_command_failed")
        response = dict(result.response)
        if result.execution:
            await self._publish_event(
                ERPCommandConfirmedEvent,
                tenant_id=tenant_id,
                correlation_id=correlation_id,
                company_id=company_id,
                connector_id=result.execution.connector_id,
                request_id=request_id,
                payload={"execution_id": result.execution.execution_id, "erp_reference": result.execution.erp_reference},
            )
        return response

    async def register_connector(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        name: str,
        connector_type: str,
        company_id: str | None = None,
        config: dict[str, Any] | None = None,
        capabilities: tuple[str, ...] = (),
        is_default: bool = False,
    ) -> ERPConnector:
        now = _utc_now()
        connector = ERPConnector(
            connector_id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            name=name,
            connector_type=ConnectorType(connector_type),
            status=ConnectorStatus.ACTIVE,
            config=ConnectorConfig(**(config or {})),
            capabilities=capabilities,
            is_default=is_default,
            created_at=now,
            updated_at=now,
        )
        if self._connector_registry.get_driver(connector.connector_type) is None:
            raise ValueError("unsupported_connector_type")
        await self._repository.save_connector(connector)
        await self._publish_event(
            ConnectorRegisteredEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=company_id,
            connector_id=connector.connector_id,
            request_id=correlation_id,
            payload={"name": name, "connector_type": connector_type},
        )
        return connector

    async def execute_query(
        self,
        *,
        tenant_id: str,
        correlation_id: str,
        query_type: str,
        company_id: str,
        branch_id: str | None = None,
        payload: dict[str, Any] | None = None,
        connector_id: str | None = None,
    ) -> dict[str, Any]:
        connector = None
        if connector_id:
            connector = await self._repository.get_connector(tenant_id=tenant_id, connector_id=connector_id)
        if connector is None:
            connector = await self._repository.get_default_connector(tenant_id=tenant_id, company_id=company_id)
        if connector is None:
            raise ValueError("connector_not_found")
        driver = self._connector_registry.get_driver(connector.connector_type)
        if driver is None:
            raise ValueError("driver_not_found")
        started = time.monotonic()
        merged = {**(payload or {}), "tenant_id": tenant_id, "company_id": company_id, "branch_id": branch_id}
        response = await driver.execute_query(
            connector_id=connector.connector_id,
            query_type=query_type,
            payload=merged,
            config=connector.config.model_dump(),
        )
        latency = int((time.monotonic() - started) * 1000)
        now = _utc_now()
        query = ERPQueryExecution(
            query_id=str(uuid.uuid4()),
            connector_id=connector.connector_id,
            tenant_id=tenant_id,
            company_id=company_id,
            query_type=query_type,
            status=ExecutionStatus.CONFIRMED,
            payload=merged,
            response=response,
            latency_ms=latency,
            created_at=now,
            completed_at=now,
        )
        await self._repository.save_query(query)
        await self._repository.increment_metrics(
            tenant_id=tenant_id, connector_id=connector.connector_id, metric="queries"
        )
        await self._publish_event(
            ERPQueryCompletedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=company_id,
            connector_id=connector.connector_id,
            request_id=correlation_id,
            payload={"query_id": query.query_id, "query_type": query_type},
        )
        return response

    async def retry_execution(self, *, tenant_id: str, correlation_id: str, execution_id: str) -> ERPCommandExecution:
        execution = await self._repository.get_execution(tenant_id=tenant_id, execution_id=execution_id)
        if execution is None:
            raise ValueError("execution_not_found")
        policy = self._retry_registry.get(RetryPolicyName.EXPONENTIAL)
        assert policy is not None
        if execution.retry_count >= policy.max_attempts:
            raise ValueError("max_retries_exceeded")
        response = await self.execute_command(
            tenant_id=tenant_id,
            request_id=execution.request_id,
            correlation_id=correlation_id,
            command_id=execution.command_id,
            command_type=execution.command_type,
            company_id=execution.company_id,
            branch_id=execution.branch_id,
            idempotency_key=f"{execution.idempotency_key}-retry-{execution.retry_count + 1}",
            payload=execution.payload,
            connector_id=execution.connector_id,
        )
        updated = execution.model_copy(update={"retry_count": execution.retry_count + 1, "response": response})
        await self._repository.save_execution(updated)
        await self._repository.increment_metrics(
            tenant_id=tenant_id, connector_id=execution.connector_id, metric="retries"
        )
        return updated

    async def cancel_execution(self, *, tenant_id: str, execution_id: str) -> ERPCommandExecution:
        execution = await self._repository.get_execution(tenant_id=tenant_id, execution_id=execution_id)
        if execution is None:
            raise ValueError("execution_not_found")
        cancelled = execution.model_copy(update={"status": ExecutionStatus.CANCELLED, "completed_at": _utc_now()})
        await self._repository.save_execution(cancelled)
        return cancelled

    async def archive_connector(self, *, tenant_id: str, correlation_id: str, connector_id: str) -> ERPConnector:
        connector = await self._repository.get_connector(tenant_id=tenant_id, connector_id=connector_id)
        if connector is None:
            raise ValueError("connector_not_found")
        archived = connector.model_copy(
            update={"status": ConnectorStatus.ARCHIVED, "updated_at": _utc_now(), "is_default": False}
        )
        await self._repository.save_connector(archived)
        await self._publish_event(
            ConnectorArchivedEvent,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=connector.company_id,
            connector_id=connector_id,
            request_id=correlation_id,
            payload={},
        )
        return archived

    async def unregister_connector(self, *, tenant_id: str, correlation_id: str, connector_id: str) -> ERPConnector:
        connector = await self._repository.get_connector(tenant_id=tenant_id, connector_id=connector_id)
        if connector is None:
            raise ValueError("connector_not_found")
        unregistered = connector.model_copy(
            update={"status": ConnectorStatus.UNREGISTERED, "updated_at": _utc_now(), "is_default": False}
        )
        await self._repository.save_connector(unregistered)
        return unregistered

    async def get_connector(self, *, tenant_id: str, connector_id: str) -> ERPConnector | None:
        return await self._repository.get_connector(tenant_id=tenant_id, connector_id=connector_id)

    async def search_connectors(
        self, *, tenant_id: str, connector_type: str | None, status: str | None, limit: int
    ) -> tuple[ERPConnector, ...]:
        return await self._repository.search_connectors(
            tenant_id=tenant_id, connector_type=connector_type, status=status, limit=limit
        )

    async def check_health(self, *, tenant_id: str, connector_id: str) -> ConnectorHealth:
        connector = await self._repository.get_connector(tenant_id=tenant_id, connector_id=connector_id)
        if connector is None:
            raise ValueError("connector_not_found")
        driver = self._connector_registry.get_driver(connector.connector_type)
        if driver is None:
            raise ValueError("driver_not_found")
        started = time.monotonic()
        raw = await driver.health_check(connector_id=connector_id, config=connector.config.model_dump())
        latency = int((time.monotonic() - started) * 1000)
        state = self._health_registry.evaluate(
            latency_ms=latency,
            availability=float(raw.get("availability", 1.0)),
        )
        health = ConnectorHealth(
            health_id=str(uuid.uuid4()),
            connector_id=connector_id,
            tenant_id=tenant_id,
            state=state,
            latency_ms=latency,
            availability=float(raw.get("availability", 1.0)),
            last_check_at=_utc_now(),
            details=raw,
        )
        await self._repository.save_health(health)
        return health

    async def get_metrics(self, *, tenant_id: str, connector_id: str, metric_date: str | None = None):
        return await self._repository.get_metrics(
            tenant_id=tenant_id, connector_id=connector_id, metric_date=metric_date
        )

    async def list_executions(
        self, *, tenant_id: str, connector_id: str | None, limit: int
    ) -> tuple[ERPCommandExecution, ...]:
        return await self._repository.list_executions(
            tenant_id=tenant_id, connector_id=connector_id, limit=limit
        )

    async def get_context_snapshot(
        self, *, tenant_id: str, company_id: str, branch_id: str | None, user_id: str
    ) -> ErpContextSnapshot:
        raw = await self.execute_query(
            tenant_id=tenant_id,
            correlation_id=str(uuid.uuid4()),
            query_type=ErpCommandType.GET_COA_SNAPSHOT.value,
            company_id=company_id,
            branch_id=branch_id,
            payload={"user_id": user_id, "branch_id": branch_id},
        )
        return ErpContextSnapshot(
            snapshot_id=raw.get("snapshot_id", str(uuid.uuid4())),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            captured_at=_utc_now(),
            metadata=raw.get("metadata", {"user_id": user_id}),
        )

    async def is_period_open(
        self, *, tenant_id: str, company_id: str, branch_id: str | None, fiscal_period_id: str | None
    ) -> FiscalPeriodStatus:
        raw = await self.execute_query(
            tenant_id=tenant_id,
            correlation_id=str(uuid.uuid4()),
            query_type=ErpCommandType.IS_PERIOD_OPEN.value,
            company_id=company_id,
            branch_id=branch_id,
            payload={"fiscal_period_id": fiscal_period_id},
        )
        return FiscalPeriodStatus(
            is_open=bool(raw.get("is_open", True)),
            fiscal_period_id=fiscal_period_id,
            reason=raw.get("reason", ""),
        )

    async def _publish_event(
        self,
        event_cls,
        *,
        tenant_id: str,
        correlation_id: str,
        company_id: str | None,
        connector_id: str,
        request_id: str,
        payload: dict,
    ) -> None:
        event = build_oec_event(
            event_cls,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            company_id=company_id,
            connector_id=connector_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event, request_id=request_id))
