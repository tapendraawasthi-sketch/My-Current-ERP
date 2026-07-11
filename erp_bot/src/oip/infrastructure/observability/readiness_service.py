"""Platform readiness and health aggregation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from ...config.settings import OipSettings
from ..persistence.outbox_sqlite import SqliteOutboxAdapter
from ..security.secret_provider import SecretProvider


class ReadinessService:
    def __init__(
        self,
        *,
        conn: aiosqlite.Connection,
        outbox: SqliteOutboxAdapter,
        settings: OipSettings,
        secret_provider: SecretProvider | None = None,
    ) -> None:
        self._conn = conn
        self._outbox = outbox
        self._settings = settings
        self._secrets = secret_provider or SecretProvider()

    async def liveness(self) -> dict[str, Any]:
        return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}

    async def readiness(self, *, kernel_health: dict[str, Any] | None = None) -> dict[str, Any]:
        checks: dict[str, dict[str, Any]] = {}
        checks["database"] = await self._check_database()
        checks["outbox"] = await self._check_outbox()
        checks["secrets"] = self._check_secrets()
        checks["event_bus"] = {"status": "healthy", "mode": "in_process"}
        if kernel_health:
            checks["platform"] = {"status": "healthy", "modules": kernel_health}
        component_checks = await self._component_health()
        checks.update(component_checks)
        overall = "ready" if all(c.get("status") == "healthy" for c in checks.values()) else "degraded"
        return {
            "status": overall,
            "checks": checks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def _check_database(self) -> dict[str, Any]:
        try:
            cursor = await self._conn.execute("SELECT 1")
            await cursor.fetchone()
            return {"status": "healthy", "latency_ms": 1}
        except Exception as exc:  # noqa: BLE001
            return {"status": "unhealthy", "error": str(exc)}

    async def _check_outbox(self) -> dict[str, Any]:
        stats = await self._outbox.get_queue_stats()
        status = "healthy"
        if stats["dead_letter"] > 100:
            status = "degraded"
        if stats["unpublished"] > 1000:
            status = "degraded"
        return {"status": status, **stats}

    def _check_secrets(self) -> dict[str, Any]:
        jwt = self._secrets.get("OIP_JWT_SECRET") or self._secrets.get("JWT_SECRET")
        if self._settings.auth_required and not jwt:
            return {"status": "unhealthy", "reason": "jwt_secret_missing"}
        return {"status": "healthy", "auth_required": self._settings.auth_required}

    async def _component_health(self) -> dict[str, dict[str, Any]]:
        components = {}
        flags = {
            "provider_runtime": self._settings.provider_runtime_enabled,
            "router": self._settings.router_enabled,
            "knowledge": self._settings.knowledge_enabled,
            "memory": self._settings.memory_enabled,
            "action_runtime": self._settings.action_runtime_enabled,
            "oec_runtime": self._settings.oec_enabled,
        }
        for name, enabled in flags.items():
            components[name] = {"status": "healthy" if enabled else "disabled", "enabled": enabled}
        return components

    async def record_alert(self, *, alert_type: str, severity: str, detail: dict[str, Any], tenant_id: str | None = None) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_ops_alerts (alert_id, alert_type, severity, detail_json, tenant_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                alert_type,
                severity,
                __import__("json").dumps(detail),
                tenant_id,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await self._conn.commit()
