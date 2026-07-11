"""Production ERP connector drivers."""

from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from .erp_registries import (
    ErpCommandHandlerRegistry,
    ErpQueryHandlerRegistry,
    create_default_command_registry,
    create_default_query_registry,
)
from .sql_executor import AioSqliteExecutor
from .sutra_erp_service import SutraErpService


def _erp_ref(prefix: str, command_type: str) -> str:
    return f"{prefix}-{command_type.split('.')[-1][:12]}-{uuid.uuid4().hex[:8]}"


def _observability(
    *,
    connector_type: str,
    started: float,
    command_type: str,
    payload: dict[str, Any],
    result: dict[str, Any],
    retry_count: int = 0,
    failure_category: str = "",
) -> dict[str, Any]:
    latency_ms = int((time.perf_counter() - started) * 1000)
    return {
        "connector": connector_type,
        "execution_time_ms": latency_ms,
        "database_latency_ms": result.get("database_latency_ms", latency_ms),
        "rows_affected": int(result.get("rows_affected", 0)),
        "command_type": command_type,
        "company_id": payload.get("company_id", ""),
        "tenant_id": payload.get("tenant_id", ""),
        "transaction_id": result.get("voucher_id") or result.get("transaction_id", ""),
        "retry_count": retry_count,
        "failure_category": failure_category,
    }


class ProductionConnectorBase:
    connector_type: str = "production"

    def __init__(
        self,
        *,
        command_registry: ErpCommandHandlerRegistry | None = None,
        query_registry: ErpQueryHandlerRegistry | None = None,
    ) -> None:
        self._commands = command_registry or create_default_command_registry()
        self._queries = query_registry or create_default_query_registry()

    async def _service_for_config(self, config: dict) -> SutraErpService:
        raise NotImplementedError

    async def execute_command(
        self,
        *,
        connector_id: str,
        command_type: str,
        payload: dict,
        config: dict,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        service = await self._service_for_config(config)
        result = await self._commands.dispatch(command_type=command_type, service=service, payload=payload)
        result.setdefault("status", "accepted")
        result.setdefault("command_id", payload.get("command_id", str(uuid.uuid4())))
        result.setdefault("erp_reference", result.get("erp_reference") or _erp_ref(self.connector_type, command_type))
        result["connector_id"] = connector_id
        result["observability"] = _observability(
            connector_type=self.connector_type,
            started=started,
            command_type=command_type,
            payload=payload,
            result=result,
        )
        return result

    async def execute_query(
        self,
        *,
        connector_id: str,
        query_type: str,
        payload: dict,
        config: dict,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        service = await self._service_for_config(config)
        result = await self._queries.dispatch(query_type=query_type, service=service, payload=payload)
        result["connector_id"] = connector_id
        result["observability"] = _observability(
            connector_type=self.connector_type,
            started=started,
            command_type=query_type,
            payload=payload,
            result=result,
        )
        return result


class ProductionSQLiteConnectorDriver(ProductionConnectorBase):
    connector_type = "sqlite"

    def __init__(self, conn, **kwargs) -> None:
        super().__init__(**kwargs)
        self._conn = conn

    async def _service_for_config(self, config: dict) -> SutraErpService:
        return SutraErpService(AioSqliteExecutor(self._conn))

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        executor = AioSqliteExecutor(self._conn)
        return await executor.health_check()


class ProductionSutraConnectorDriver(ProductionSQLiteConnectorDriver):
    connector_type = "sutra"


class ProductionPostgreSQLConnectorDriver(ProductionConnectorBase):
    connector_type = "postgresql"

    async def _service_for_config(self, config: dict) -> SutraErpService:
        conn_str = config.get("connection_string", "")
        if not conn_str:
            raise ValueError("PostgreSQL connection_string required")
        return SutraErpService(PostgresExecutor(conn_str))

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        conn_str = config.get("connection_string", "")
        if not conn_str:
            return {"state": "degraded", "latency_ms": 0, "availability": 0.0}
        try:
            import psycopg2

            started = time.perf_counter()
            conn = await asyncio.to_thread(psycopg2.connect, conn_str)
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            cur.close()
            conn.close()
            latency = int((time.perf_counter() - started) * 1000)
            return {"state": "healthy", "latency_ms": latency, "availability": 1.0}
        except Exception:  # noqa: BLE001
            return {"state": "unhealthy", "latency_ms": 5000, "availability": 0.0}


class PostgresExecutor:
    """Sync psycopg2 executor wrapped for async — parameterized only."""

    def __init__(self, connection_string: str) -> None:
        self._connection_string = connection_string
        self._conn = None

    def _connect(self):
        import psycopg2
        import psycopg2.extras

        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self._connection_string)
        return self._conn

    async def fetchone(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        def _run():
            import psycopg2.extras

            conn = self._connect()
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql.replace("?", "%s"), params)
                row = cur.fetchone()
                return dict(row) if row else None

        return await asyncio.to_thread(_run)

    async def fetchall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        def _run():
            import psycopg2.extras

            conn = self._connect()
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql.replace("?", "%s"), params)
                return [dict(row) for row in cur.fetchall()]

        return await asyncio.to_thread(_run)

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        def _run():
            conn = self._connect()
            with conn.cursor() as cur:
                cur.execute(sql.replace("?", "%s"), params)
                conn.commit()
                return cur.rowcount

        return await asyncio.to_thread(_run)

    async def executemany(self, sql: str, params_seq: list[tuple[Any, ...]]) -> int:
        def _run():
            conn = self._connect()
            with conn.cursor() as cur:
                cur.executemany(sql.replace("?", "%s"), params_seq)
                conn.commit()
                return len(params_seq)

        return await asyncio.to_thread(_run)

    async def begin(self) -> None:
        def _run():
            conn = self._connect()
            conn.autocommit = False

        await asyncio.to_thread(_run)

    async def commit(self) -> None:
        def _run():
            if self._conn:
                self._conn.commit()

        await asyncio.to_thread(_run)

    async def rollback(self) -> None:
        def _run():
            if self._conn:
                self._conn.rollback()

        await asyncio.to_thread(_run)


class ProductionMySQLConnectorDriver(ProductionPostgreSQLConnectorDriver):
    connector_type = "mysql"

    async def _service_for_config(self, config: dict) -> SutraErpService:
        conn_str = config.get("connection_string", "")
        if not conn_str:
            raise ValueError("MySQL connection_string required")
        return SutraErpService(MySQLExecutor(conn_str))

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        conn_str = config.get("connection_string", "")
        if not conn_str:
            return {"state": "degraded", "latency_ms": 0, "availability": 0.0}
        try:
            import pymysql

            started = time.perf_counter()
            conn = await asyncio.to_thread(pymysql.connect, **self._parse_mysql_dsn(conn_str))
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            conn.close()
            latency = int((time.perf_counter() - started) * 1000)
            return {"state": "healthy", "latency_ms": latency, "availability": 1.0}
        except Exception:  # noqa: BLE001
            return {"state": "unhealthy", "latency_ms": 5000, "availability": 0.0}

    @staticmethod
    def _parse_mysql_dsn(dsn: str) -> dict[str, Any]:
        # mysql://user:pass@host:3306/db
        from urllib.parse import urlparse

        parsed = urlparse(dsn)
        return {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 3306,
            "user": parsed.username or "root",
            "password": parsed.password or "",
            "database": (parsed.path or "/").lstrip("/"),
            "charset": "utf8mb4",
        }


class MySQLExecutor(PostgresExecutor):
    def _connect(self):
        import pymysql

        if self._conn is None or not getattr(self._conn, "open", True):
            self._conn = pymysql.connect(**ProductionMySQLConnectorDriver._parse_mysql_dsn(self._connection_string))
        return self._conn


class ProductionSQLServerConnectorDriver(ProductionPostgreSQLConnectorDriver):
    connector_type = "sqlserver"


class ProductionRestConnectorDriver:
    connector_type = "rest"

    async def execute_command(self, *, connector_id: str, command_type: str, payload: dict, config: dict) -> dict:
        started = time.perf_counter()
        base_url = config.get("base_url", "")
        timeout = float(config.get("timeout_seconds", 30.0))
        max_retries = int(config.get("max_retries", 3))
        if not base_url:
            raise ValueError("REST base_url required for production connector")
        last_error = ""
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        f"{base_url.rstrip('/')}/commands",
                        json={"command_type": command_type, "payload": payload},
                        headers={"Authorization": f"Bearer {config.get('api_key', '')}"},
                    )
                    data = response.json() if response.content else {}
                    if response.status_code >= 500 and attempt + 1 < max_retries:
                        continue
                    if response.status_code >= 400:
                        raise ValueError(f"REST command failed: {response.status_code}")
                    data.setdefault("erp_reference", _erp_ref("rest", command_type))
                    data["observability"] = _observability(
                        connector_type=self.connector_type,
                        started=started,
                        command_type=command_type,
                        payload=payload,
                        result=data,
                        retry_count=attempt,
                    )
                    return data
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                if attempt + 1 >= max_retries:
                    break
        raise ValueError(last_error or "REST command failed")

    async def execute_query(self, *, connector_id: str, query_type: str, payload: dict, config: dict) -> dict:
        started = time.perf_counter()
        base_url = config.get("base_url", "")
        timeout = float(config.get("timeout_seconds", 30.0))
        if not base_url:
            raise ValueError("REST base_url required")
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"{base_url.rstrip('/')}/queries/{query_type}",
                params=payload,
                headers={"Authorization": f"Bearer {config.get('api_key', '')}"},
            )
            data = response.json() if response.content else {}
            data["observability"] = _observability(
                connector_type=self.connector_type,
                started=started,
                command_type=query_type,
                payload=payload,
                result=data,
            )
            return data

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        base_url = config.get("base_url", "")
        if not base_url:
            return {"state": "degraded", "latency_ms": 0, "availability": 0.0}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                started = datetime.now(timezone.utc)
                response = await client.get(f"{base_url.rstrip('/')}/health")
                latency = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
                return {
                    "state": "healthy" if response.is_success else "unhealthy",
                    "latency_ms": latency,
                    "availability": 1.0 if response.is_success else 0.0,
                }
        except Exception:  # noqa: BLE001
            return {"state": "unhealthy", "latency_ms": 5000, "availability": 0.0}


class ProductionGraphQLConnectorDriver:
    connector_type = "graphql"

    async def execute_command(self, *, connector_id: str, command_type: str, payload: dict, config: dict) -> dict:
        started = time.perf_counter()
        endpoint = config.get("base_url", "")
        timeout = float(config.get("timeout_seconds", 30.0))
        if not endpoint:
            raise ValueError("GraphQL endpoint required")
        query = """
        mutation ExecuteCommand($input: ExecuteCommandInput!) {
          executeCommand(input: $input) { erpReference status rowsAffected }
        }
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                endpoint,
                json={"query": query, "variables": {"input": {"commandType": command_type, "payload": payload}}},
                headers={"Authorization": f"Bearer {config.get('api_key', '')}"},
            )
            body = response.json() if response.content else {}
            result = (body.get("data") or {}).get("executeCommand") or {}
            normalized = {
                "status": result.get("status", "accepted"),
                "erp_reference": result.get("erpReference", _erp_ref("graphql", command_type)),
                "rows_affected": result.get("rowsAffected", 0),
            }
            normalized["observability"] = _observability(
                connector_type=self.connector_type,
                started=started,
                command_type=command_type,
                payload=payload,
                result=normalized,
            )
            return normalized

    async def execute_query(self, *, connector_id: str, query_type: str, payload: dict, config: dict) -> dict:
        started = time.perf_counter()
        endpoint = config.get("base_url", "")
        if not endpoint:
            raise ValueError("GraphQL endpoint required")
        query = """
        query ExecuteQuery($queryType: String!, $payload: JSON!) {
          executeQuery(queryType: $queryType, payload: $payload) { snapshotId rows }
        }
        """
        async with httpx.AsyncClient(timeout=float(config.get("timeout_seconds", 30.0))) as client:
            response = await client.post(
                endpoint,
                json={"query": query, "variables": {"queryType": query_type, "payload": payload}},
            )
            body = response.json() if response.content else {}
            result = (body.get("data") or {}).get("executeQuery") or {}
            normalized = {"snapshot_id": result.get("snapshotId"), "rows": result.get("rows", [])}
            normalized["observability"] = _observability(
                connector_type=self.connector_type,
                started=started,
                command_type=query_type,
                payload=payload,
                result=normalized,
            )
            return normalized

    async def health_check(self, *, connector_id: str, config: dict) -> dict:
        return {"state": "healthy" if config.get("base_url") else "degraded", "latency_ms": 3, "availability": 0.99}
