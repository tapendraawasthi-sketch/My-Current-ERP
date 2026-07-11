"""OEC Runtime CQRS handlers."""

from __future__ import annotations

from typing import Any

from ..commands import (
    ArchiveConnectorCommand,
    CancelExecutionCommand,
    ExecuteERPCommandCommand,
    ExecuteERPQueryCommand,
    RegisterConnectorCommand,
    RetryExecutionCommand,
    UnregisterConnectorCommand,
)
from ..projectors.oec_projectors import ConnectorProjector, ExecutionProjector
from ..queries import (
    ConnectorCapabilitiesQuery,
    ConnectorHealthQuery,
    ConnectorMetricsQuery,
    ExecutionHistoryQuery,
    GetConnectorQuery,
    SearchConnectorsQuery,
)
from ..services.oec_runtime_service import OecRuntimeService


class RegisterConnectorHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ConnectorProjector()

    async def __call__(self, command: RegisterConnectorCommand) -> dict[str, Any]:
        connector = await self._service.register_connector(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            name=command.name,
            connector_type=command.connector_type,
            company_id=command.company_id,
            config=command.config,
            capabilities=command.capabilities,
            is_default=command.is_default,
        )
        return self._projector.project(connector).model_dump(mode="json")


class ExecuteERPCommandHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service

    async def __call__(self, command: ExecuteERPCommandCommand) -> dict[str, Any]:
        return await self._service.execute_command(
            tenant_id=str(command.tenant_id),
            request_id=str(command.request_id),
            correlation_id=str(command.correlation_id),
            command_id=command.command_id,
            command_type=command.command_type_name,
            company_id=command.company_id,
            branch_id=command.branch_id,
            idempotency_key=command.idempotency_key,
            payload=command.payload,
            connector_id=command.connector_id,
        )


class ExecuteERPQueryHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service

    async def __call__(self, command: ExecuteERPQueryCommand) -> dict[str, Any]:
        return await self._service.execute_query(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            query_type=command.query_type,
            company_id=command.company_id,
            branch_id=command.branch_id,
            payload=command.payload,
            connector_id=command.connector_id,
        )


class RetryExecutionHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: RetryExecutionCommand) -> dict[str, Any]:
        execution = await self._service.retry_execution(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            execution_id=command.execution_id,
        )
        return self._projector.project(execution).model_dump(mode="json")


class CancelExecutionHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, command: CancelExecutionCommand) -> dict[str, Any]:
        execution = await self._service.cancel_execution(
            tenant_id=str(command.tenant_id),
            execution_id=command.execution_id,
        )
        return self._projector.project(execution).model_dump(mode="json")


class ArchiveConnectorHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ConnectorProjector()

    async def __call__(self, command: ArchiveConnectorCommand) -> dict[str, Any]:
        connector = await self._service.archive_connector(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            connector_id=command.connector_id,
        )
        return self._projector.project(connector).model_dump(mode="json")


class UnregisterConnectorHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ConnectorProjector()

    async def __call__(self, command: UnregisterConnectorCommand) -> dict[str, Any]:
        connector = await self._service.unregister_connector(
            tenant_id=str(command.tenant_id),
            correlation_id=str(command.correlation_id),
            connector_id=command.connector_id,
        )
        return self._projector.project(connector).model_dump(mode="json")


class GetConnectorHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ConnectorProjector()

    async def __call__(self, query: GetConnectorQuery) -> dict[str, Any] | None:
        connector = await self._service.get_connector(
            tenant_id=str(query.tenant_id), connector_id=query.connector_id
        )
        return self._projector.project(connector).model_dump(mode="json") if connector else None


class SearchConnectorsHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ConnectorProjector()

    async def __call__(self, query: SearchConnectorsQuery) -> dict[str, Any]:
        connectors = await self._service.search_connectors(
            tenant_id=str(query.tenant_id),
            connector_type=query.connector_type,
            status=query.status,
            limit=query.limit,
        )
        return {
            "connectors": [self._projector.project(c).model_dump(mode="json") for c in connectors]
        }


class ConnectorHealthHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: ConnectorHealthQuery) -> dict[str, Any]:
        from ...infrastructure.persistence.oec_sqlite import DEFAULT_CONNECTOR_ID, TENANT_A

        connector_id = query.connector_id or DEFAULT_CONNECTOR_ID
        health = await self._service.check_health(
            tenant_id=str(query.tenant_id), connector_id=connector_id
        )
        return health.model_dump(mode="json")


class ConnectorMetricsHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: ConnectorMetricsQuery) -> dict[str, Any]:
        from ...infrastructure.persistence.oec_sqlite import DEFAULT_CONNECTOR_ID

        connector_id = query.connector_id or DEFAULT_CONNECTOR_ID
        metrics = await self._service.get_metrics(
            tenant_id=str(query.tenant_id),
            connector_id=connector_id,
            metric_date=query.metric_date,
        )
        return metrics.model_dump(mode="json")


class ConnectorCapabilitiesHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service

    async def __call__(self, query: ConnectorCapabilitiesQuery) -> dict[str, Any]:
        connector = await self._service.get_connector(
            tenant_id=str(query.tenant_id), connector_id=query.connector_id
        )
        if connector is None:
            return {"capabilities": []}
        return {"capabilities": list(connector.capabilities)}


class ExecutionHistoryHandler:
    def __init__(self, service: OecRuntimeService) -> None:
        self._service = service
        self._projector = ExecutionProjector()

    async def __call__(self, query: ExecutionHistoryQuery) -> dict[str, Any]:
        executions = await self._service.list_executions(
            tenant_id=str(query.tenant_id),
            connector_id=query.connector_id,
            limit=query.limit,
        )
        return {
            "executions": [self._projector.project(e).model_dump(mode="json") for e in executions]
        }
