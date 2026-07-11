"""SQLite OEC repository adapter."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from ...application.ports.oec_ports import OecRepositoryPort
from ...application.read_models.oec_read_models import ConnectorMetricsReadModel
from ...domain.entities import (
    CompensationRecord,
    ConnectorHealth,
    ConnectorTransaction,
    ERPCommandExecution,
    ERPConnector,
    ERPQueryExecution,
)
from ...domain.value_objects import (
    ConnectorConfig,
    ConnectorStatus,
    ConnectorType,
    ExecutionStatus,
    HealthState,
    TransactionStatus,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_today() -> str:
    return _utc_now().date().isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


TENANT_A = "tenant-a"
DEFAULT_CONNECTOR_ID = "conn-mock-default"


class SqliteOecRepositoryAdapter(OecRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn
        self._seeded = False

    async def ensure_seeded(self) -> None:
        if self._seeded:
            return
        existing = await self.get_connector(tenant_id=TENANT_A, connector_id=DEFAULT_CONNECTOR_ID)
        if existing:
            self._seeded = True
            return
        now = _utc_now()
        connector = ERPConnector(
            connector_id=DEFAULT_CONNECTOR_ID,
            tenant_id=TENANT_A,
            name="Default Mock ERP Connector",
            connector_type=ConnectorType.MOCK,
            status=ConnectorStatus.ACTIVE,
            config=ConnectorConfig(metadata={"legacy_mode": True}),
            capabilities=("Accounting", "Inventory"),
            is_default=True,
            created_at=now,
            updated_at=now,
        )
        await self.save_connector(connector)
        self._seeded = True

    async def save_connector(self, connector: ERPConnector) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_connectors (
                connector_id, tenant_id, company_id, name, connector_type, status,
                config_json, capabilities_json, is_default, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                connector.connector_id,
                connector.tenant_id,
                connector.company_id,
                connector.name,
                connector.connector_type.value,
                connector.status.value,
                json.dumps(connector.config.model_dump()),
                json.dumps(list(connector.capabilities)),
                1 if connector.is_default else 0,
                json.dumps(connector.metadata),
                connector.created_at.isoformat(),
                connector.updated_at.isoformat(),
            ),
        )
        await self._conn.commit()

    def _row_to_connector(self, row: aiosqlite.Row) -> ERPConnector:
        config_raw = json.loads(row["config_json"])
        return ERPConnector(
            connector_id=row["connector_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            name=row["name"],
            connector_type=ConnectorType(row["connector_type"]),
            status=ConnectorStatus(row["status"]),
            config=ConnectorConfig(**config_raw),
            capabilities=tuple(json.loads(row["capabilities_json"])),
            is_default=bool(row["is_default"]),
            metadata=json.loads(row["metadata_json"]),
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
            updated_at=_parse_dt(row["updated_at"]) or _utc_now(),
        )

    async def get_connector(self, *, tenant_id: str, connector_id: str) -> ERPConnector | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_connectors WHERE tenant_id = ? AND connector_id = ?",
            (tenant_id, connector_id),
        )
        row = await cursor.fetchone()
        return self._row_to_connector(row) if row else None

    async def get_default_connector(self, *, tenant_id: str, company_id: str | None) -> ERPConnector | None:
        if company_id:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_connectors
                WHERE tenant_id = ? AND company_id = ? AND is_default = 1 AND status = 'active'
                LIMIT 1
                """,
                (tenant_id, company_id),
            )
            row = await cursor.fetchone()
            if row:
                return self._row_to_connector(row)
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_connectors
            WHERE tenant_id = ? AND is_default = 1 AND status = 'active'
            LIMIT 1
            """,
            (tenant_id,),
        )
        row = await cursor.fetchone()
        return self._row_to_connector(row) if row else None

    async def search_connectors(
        self, *, tenant_id: str, connector_type: str | None, status: str | None, limit: int
    ) -> tuple[ERPConnector, ...]:
        clauses = ["tenant_id = ?"]
        params: list[Any] = [tenant_id]
        if connector_type:
            clauses.append("connector_type = ?")
            params.append(connector_type)
        if status:
            clauses.append("status = ?")
            params.append(status)
        sql = f"SELECT * FROM oip_connectors WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await self._conn.execute(sql, params)
        rows = await cursor.fetchall()
        return tuple(self._row_to_connector(row) for row in rows)

    def _row_to_execution(self, row: aiosqlite.Row) -> ERPCommandExecution:
        return ERPCommandExecution(
            execution_id=row["execution_id"],
            connector_id=row["connector_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            branch_id=row["branch_id"],
            command_id=row["command_id"],
            command_type=row["command_type"],
            idempotency_key=row["idempotency_key"],
            status=ExecutionStatus(row["status"]),
            erp_reference=row["erp_reference"],
            payload=json.loads(row["payload_json"]),
            response=json.loads(row["response_json"]),
            retry_count=row["retry_count"],
            error_message=row["error_message"],
            transaction_id=row["transaction_id"],
            snapshot_id=row["snapshot_id"],
            request_id=row["request_id"],
            correlation_id=row["correlation_id"],
            created_at=_parse_dt(row["created_at"]) or _utc_now(),
            completed_at=_parse_dt(row["completed_at"]),
        )

    async def save_execution(self, execution: ERPCommandExecution) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_erp_commands (
                execution_id, connector_id, tenant_id, company_id, branch_id,
                command_id, command_type, idempotency_key, status, erp_reference,
                payload_json, response_json, retry_count, error_message, transaction_id,
                snapshot_id, request_id, correlation_id, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                execution.execution_id,
                execution.connector_id,
                execution.tenant_id,
                execution.company_id,
                execution.branch_id,
                execution.command_id,
                execution.command_type,
                execution.idempotency_key,
                execution.status.value,
                execution.erp_reference,
                json.dumps(execution.payload),
                json.dumps(execution.response),
                execution.retry_count,
                execution.error_message,
                execution.transaction_id,
                execution.snapshot_id,
                execution.request_id,
                execution.correlation_id,
                execution.created_at.isoformat(),
                execution.completed_at.isoformat() if execution.completed_at else None,
            ),
        )
        await self._conn.commit()

    async def get_execution(self, *, tenant_id: str, execution_id: str) -> ERPCommandExecution | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_erp_commands WHERE tenant_id = ? AND execution_id = ?",
            (tenant_id, execution_id),
        )
        row = await cursor.fetchone()
        return self._row_to_execution(row) if row else None

    async def get_execution_by_idempotency(
        self, *, tenant_id: str, idempotency_key: str
    ) -> ERPCommandExecution | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_erp_commands
            WHERE tenant_id = ? AND idempotency_key = ? AND status IN ('confirmed', 'duplicate')
            ORDER BY created_at DESC LIMIT 1
            """,
            (tenant_id, idempotency_key),
        )
        row = await cursor.fetchone()
        return self._row_to_execution(row) if row else None

    async def save_query(self, query: ERPQueryExecution) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_erp_queries (
                query_id, connector_id, tenant_id, company_id, query_type, status,
                payload_json, response_json, latency_ms, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                query.query_id,
                query.connector_id,
                query.tenant_id,
                query.company_id,
                query.query_type,
                query.status.value,
                json.dumps(query.payload),
                json.dumps(query.response),
                query.latency_ms,
                query.created_at.isoformat(),
                query.completed_at.isoformat() if query.completed_at else None,
            ),
        )
        await self._conn.commit()

    async def save_transaction(self, transaction: ConnectorTransaction) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_connector_transactions (
                transaction_id, connector_id, tenant_id, execution_id, status,
                opened_at, committed_at, timeout_at, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction.transaction_id,
                transaction.connector_id,
                transaction.tenant_id,
                transaction.execution_id,
                transaction.status.value,
                transaction.opened_at.isoformat(),
                transaction.committed_at.isoformat() if transaction.committed_at else None,
                transaction.timeout_at.isoformat() if transaction.timeout_at else None,
                json.dumps(transaction.metadata),
            ),
        )
        await self._conn.commit()

    async def save_compensation(self, record: CompensationRecord) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_connector_compensations (
                compensation_id, execution_id, connector_id, tenant_id, reason,
                reversal_command_id, erp_reference, status, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.compensation_id,
                record.execution_id,
                record.connector_id,
                record.tenant_id,
                record.reason,
                record.reversal_command_id,
                record.erp_reference,
                record.status.value,
                record.created_at.isoformat(),
                record.completed_at.isoformat() if record.completed_at else None,
            ),
        )
        await self._conn.commit()

    async def save_health(self, health: ConnectorHealth) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_connector_health (
                health_id, connector_id, tenant_id, state, latency_ms, availability, last_check_at, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                health.health_id,
                health.connector_id,
                health.tenant_id,
                health.state.value,
                health.latency_ms,
                health.availability,
                health.last_check_at.isoformat(),
                json.dumps(health.details),
            ),
        )
        await self._conn.commit()

    async def get_health(self, *, tenant_id: str, connector_id: str) -> ConnectorHealth | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_connector_health
            WHERE tenant_id = ? AND connector_id = ?
            ORDER BY last_check_at DESC LIMIT 1
            """,
            (tenant_id, connector_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return ConnectorHealth(
            health_id=row["health_id"],
            connector_id=row["connector_id"],
            tenant_id=row["tenant_id"],
            state=HealthState(row["state"]),
            latency_ms=row["latency_ms"],
            availability=row["availability"],
            last_check_at=_parse_dt(row["last_check_at"]) or _utc_now(),
            details=json.loads(row["details_json"]),
        )

    async def list_executions(
        self, *, tenant_id: str, connector_id: str | None, limit: int
    ) -> tuple[ERPCommandExecution, ...]:
        if connector_id:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_erp_commands
                WHERE tenant_id = ? AND connector_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (tenant_id, connector_id, limit),
            )
        else:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_erp_commands WHERE tenant_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (tenant_id, limit),
            )
        rows = await cursor.fetchall()
        return tuple(self._row_to_execution(row) for row in rows)

    async def increment_metrics(self, *, tenant_id: str, connector_id: str, metric: str, value: float = 1.0) -> None:
        metric_date = _utc_today()
        await self._conn.execute(
            """
            INSERT INTO oip_connector_metrics (tenant_id, connector_id, metric_date, metadata_json)
            VALUES (?, ?, ?, json_object(?, ?))
            ON CONFLICT(tenant_id, connector_id, metric_date) DO UPDATE SET
                metadata_json = json_set(
                    metadata_json,
                    '$.' || ?,
                    COALESCE(json_extract(metadata_json, '$.' || ?), 0) + ?
                )
            """,
            (tenant_id, connector_id, metric_date, metric, value, metric, metric, value),
        )
        await self._conn.commit()

    async def get_metrics(
        self, *, tenant_id: str, connector_id: str, metric_date: str | None
    ) -> ConnectorMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_connector_metrics
            WHERE tenant_id = ? AND connector_id = ? AND metric_date = ?
            """,
            (tenant_id, connector_id, date),
        )
        row = await cursor.fetchone()
        meta = json.loads(row["metadata_json"]) if row else {}
        commands = meta.get("commands", 0)
        queries = meta.get("queries", 0)
        failures = meta.get("failures", 0)
        total = commands + failures
        return ConnectorMetricsReadModel(
            tenant_id=tenant_id,
            connector_id=connector_id,
            metric_date=date,
            command_throughput=int(commands),
            query_throughput=int(queries),
            failure_count=int(failures),
            success_rate=(commands / total) if total else 1.0,
            metadata=meta,
        )

    async def enqueue_dead_letter(self, *, tenant_id: str, execution_id: str, payload: dict) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_connector_dead_letter (dead_letter_id, tenant_id, execution_id, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), tenant_id, execution_id, json.dumps(payload), _utc_now().isoformat()),
        )
        await self._conn.commit()

    async def record_circuit_state(self, *, tenant_id: str, connector_id: str, state: str) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_connector_circuit (tenant_id, connector_id, state, failure_count, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tenant_id, connector_id, state, 1 if state == "open" else 0, _utc_now().isoformat()),
        )
        await self._conn.commit()

    async def get_circuit_state(self, *, tenant_id: str, connector_id: str) -> str:
        cursor = await self._conn.execute(
            "SELECT state FROM oip_connector_circuit WHERE tenant_id = ? AND connector_id = ?",
            (tenant_id, connector_id),
        )
        row = await cursor.fetchone()
        return row[0] if row else "closed"

    async def increment_circuit_failures(self, *, tenant_id: str, connector_id: str) -> int:
        cursor = await self._conn.execute(
            "SELECT failure_count FROM oip_connector_circuit WHERE tenant_id = ? AND connector_id = ?",
            (tenant_id, connector_id),
        )
        row = await cursor.fetchone()
        count = (row[0] if row else 0) + 1
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO oip_connector_circuit (tenant_id, connector_id, state, failure_count, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tenant_id, connector_id, "closed", count, _utc_now().isoformat()),
        )
        await self._conn.commit()
        return count
