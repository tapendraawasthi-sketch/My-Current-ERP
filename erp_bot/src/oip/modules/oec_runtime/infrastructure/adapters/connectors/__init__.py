"""Connector driver implementations — mock/replay for testing; production drivers for ERP."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .production_drivers import (
    ProductionGraphQLConnectorDriver,
    ProductionMySQLConnectorDriver,
    ProductionPostgreSQLConnectorDriver,
    ProductionRestConnectorDriver,
    ProductionSQLServerConnectorDriver,
    ProductionSQLiteConnectorDriver,
    ProductionSutraConnectorDriver,
)

__all__ = (
    "MockConnectorDriver",
    "ReplayConnectorDriver",
    "OfflineConnectorDriver",
    "SQLiteConnectorDriver",
    "PostgreSQLConnectorDriver",
    "MySQLConnectorDriver",
    "SQLServerConnectorDriver",
    "RestConnectorDriver",
    "GraphQLConnectorDriver",
    "SutraConnectorDriver",
)


def _erp_ref(prefix: str, command_type: str) -> str:
    return f"{prefix}-{command_type.split('.')[-1][:12]}-{uuid.uuid4().hex[:8]}"


class MockConnectorDriver:
    """Test-only synthetic connector."""

    connector_type = "mock"

    async def execute_command(self, *, connector_id: str, command_type: str, payload: dict, config: dict) -> dict:
        return {
            "status": "accepted",
            "command_id": payload.get("command_id", str(uuid.uuid4())),
            "erp_reference": _erp_ref("mock", command_type),
            "connector_id": connector_id,
            "legacy_mode": config.get("legacy_mode", False),
        }

    async def execute_query(self, *, connector_id: str, query_type: str, payload: dict, config: dict) -> dict:
        if "period" in query_type.lower():
            return {"is_open": True, "fiscal_period_id": payload.get("fiscal_period_id")}
        return {
            "snapshot_id": str(uuid.uuid4()),
            "tenant_id": payload.get("tenant_id", "tenant-a"),
            "company_id": payload.get("company_id", ""),
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"connector_id": connector_id, "user_id": payload.get("user_id", "")},
        }

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        return {"state": "healthy", "latency_ms": 1, "availability": 1.0}


class ReplayConnectorDriver:
    """Test-only replay connector."""

    connector_type = "replay"

    def __init__(self, repository) -> None:
        self._repository = repository

    async def execute_command(self, *, connector_id: str, command_type: str, payload: dict, config: dict) -> dict:
        key = payload.get("idempotency_key", "")
        if key:
            existing = await self._repository.get_execution_by_idempotency(
                tenant_id=payload.get("tenant_id", "tenant-a"), idempotency_key=key
            )
            if existing:
                return dict(existing.response)
        return {
            "status": "accepted",
            "erp_reference": _erp_ref("replay", command_type),
            "replayed": False,
        }

    async def execute_query(self, *, connector_id: str, query_type: str, payload: dict, config: dict) -> dict:
        return {"replayed": True, "query_type": query_type}

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        return {"state": "healthy", "latency_ms": 2, "availability": 1.0}


class OfflineConnectorDriver:
    """Test-only offline queue connector."""

    connector_type = "offline"

    def __init__(self, repository) -> None:
        self._repository = repository

    async def execute_command(self, *, connector_id: str, command_type: str, payload: dict, config: dict) -> dict:
        execution_id = str(uuid.uuid4())
        await self._repository.enqueue_dead_letter(
            tenant_id=payload.get("tenant_id", "tenant-a"),
            execution_id=execution_id,
            payload={"command_type": command_type, "payload": payload, "connector_id": connector_id},
        )
        return {
            "status": "queued",
            "erp_reference": _erp_ref("offline", command_type),
            "execution_id": execution_id,
        }

    async def execute_query(self, *, connector_id: str, query_type: str, payload: dict, config: dict) -> dict:
        return {"status": "offline", "cached": True}

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        return {"state": "degraded", "latency_ms": 0, "availability": 0.5}


SQLiteConnectorDriver = ProductionSQLiteConnectorDriver
PostgreSQLConnectorDriver = ProductionPostgreSQLConnectorDriver
MySQLConnectorDriver = ProductionMySQLConnectorDriver
SQLServerConnectorDriver = ProductionSQLServerConnectorDriver
RestConnectorDriver = ProductionRestConnectorDriver
GraphQLConnectorDriver = ProductionGraphQLConnectorDriver
SutraConnectorDriver = ProductionSutraConnectorDriver
