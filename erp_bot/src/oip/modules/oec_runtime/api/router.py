"""OEC Runtime HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id
from ..application.commands import ArchiveConnectorCommand, RegisterConnectorCommand, RetryExecutionCommand
from ..application.queries import ConnectorHealthQuery, ConnectorMetricsQuery, GetConnectorQuery, SearchConnectorsQuery

router = APIRouter(prefix="/connectors", tags=["oec-runtime"])


class RegisterConnectorRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    name: str = Field(..., min_length=1)
    connector_type: str = Field(default="Mock")
    company_id: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    capabilities: tuple[str, ...] = ()
    is_default: bool = False


class RetryExecutionRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")
    execution_id: str


class ArchiveConnectorRequest(BaseModel):
    tenant_id: str = Field(default="tenant-a")


@router.post("")
async def register_connector(req: RegisterConnectorRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.oec_enabled:
        raise HTTPException(status_code=503, detail="OEC runtime is disabled")
    correlation_id = str(new_correlation_id())
    encrypted_config = container.credential_vault.encrypt_config(req.config)
    return await container.command_bus.dispatch(
        RegisterConnectorCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            name=req.name,
            connector_type=req.connector_type,
            company_id=req.company_id,
            config=encrypted_config,
            capabilities=req.capabilities,
            is_default=req.is_default,
        )
    )


@router.get("")
async def list_connectors(
    tenant_id: str = "tenant-a",
    connector_type: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        SearchConnectorsQuery(
            tenant_id=TenantId(tenant_id),
            connector_type=connector_type,
            status=status,
            limit=limit,
        )
    )


@router.get("/health")
async def connectors_health(tenant_id: str = "tenant-a", connector_id: str | None = None) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        ConnectorHealthQuery(tenant_id=TenantId(tenant_id), connector_id=connector_id)
    )


@router.get("/metrics")
async def connectors_metrics(tenant_id: str = "tenant-a", connector_id: str | None = None) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        ConnectorMetricsQuery(tenant_id=TenantId(tenant_id), connector_id=connector_id)
    )


@router.get("/{connector_id}")
async def get_connector(connector_id: str, tenant_id: str = "tenant-a") -> dict[str, Any]:
    container = await get_container()
    result = await container.query_bus.dispatch(
        GetConnectorQuery(tenant_id=TenantId(tenant_id), connector_id=connector_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    return {"connector": result}


@router.post("/{connector_id}/retry")
async def retry_execution(connector_id: str, req: RetryExecutionRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.oec_enabled:
        raise HTTPException(status_code=503, detail="OEC runtime is disabled")
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        RetryExecutionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            execution_id=req.execution_id,
        )
    )


@router.post("/{connector_id}/archive")
async def archive_connector(connector_id: str, req: ArchiveConnectorRequest) -> dict[str, Any]:
    container = await get_container()
    if not container.settings.oec_enabled:
        raise HTTPException(status_code=503, detail="OEC runtime is disabled")
    correlation_id = str(new_correlation_id())
    return await container.command_bus.dispatch(
        ArchiveConnectorCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            connector_id=connector_id,
        )
    )
