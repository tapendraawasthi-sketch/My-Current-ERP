"""SQLite orchestrator repository."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.workflow_repository_port import WorkflowRepositoryPort
from ...application.read_models.orchestrator_read_models import WorkflowMetricsReadModel
from ...domain.entities import WorkflowExecution
from ...domain.value_objects import (
    ExecutionMode,
    RetryState,
    RollbackState,
    StageMetrics,
    StageRunStatus,
    WorkflowMetrics,
    WorkflowStageName,
    WorkflowState,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _parse_dt(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value)


class SqliteWorkflowRepositoryAdapter(WorkflowRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save(self, workflow: WorkflowExecution) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_workflows (
                workflow_id, request_id, conversation_id, session_id, tenant_id,
                company_id, branch_id, user_id, correlation_id, idempotency_key,
                execution_mode, workflow_state, current_stage, completed_stages_json,
                failed_stage, rollback_state_json, retry_state_json, module, message,
                snapshots_json, metadata_json, metrics_json, started_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workflow_id) DO UPDATE SET
                conversation_id = excluded.conversation_id,
                workflow_state = excluded.workflow_state,
                current_stage = excluded.current_stage,
                completed_stages_json = excluded.completed_stages_json,
                failed_stage = excluded.failed_stage,
                rollback_state_json = excluded.rollback_state_json,
                retry_state_json = excluded.retry_state_json,
                snapshots_json = excluded.snapshots_json,
                metadata_json = excluded.metadata_json,
                metrics_json = excluded.metrics_json,
                updated_at = excluded.updated_at,
                completed_at = excluded.completed_at
            """,
            (
                workflow.workflow_id,
                workflow.request_id,
                workflow.conversation_id,
                workflow.session_id,
                workflow.tenant_id,
                workflow.company_id,
                workflow.branch_id,
                workflow.user_id,
                workflow.correlation_id,
                workflow.idempotency_key,
                workflow.execution_mode.value,
                workflow.workflow_state.value,
                workflow.current_stage.value if workflow.current_stage else None,
                json.dumps(list(workflow.completed_stages)),
                workflow.failed_stage,
                workflow.rollback_state.model_dump_json(),
                workflow.retry_state.model_dump_json(),
                workflow.module,
                workflow.message,
                json.dumps(workflow.snapshots),
                json.dumps(workflow.metadata),
                workflow.metrics.model_dump_json(),
                workflow.started_at.isoformat(),
                workflow.updated_at.isoformat(),
                workflow.completed_at.isoformat() if workflow.completed_at else None,
            ),
        )
        await self._conn.commit()

    async def get_by_id(self, *, tenant_id: str, workflow_id: str) -> WorkflowExecution | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_workflows WHERE tenant_id = ? AND workflow_id = ?",
            (tenant_id, workflow_id),
        )
        row = await cursor.fetchone()
        return self._row_to_workflow(row) if row else None

    async def get_by_idempotency(
        self, *, tenant_id: str, idempotency_key: str
    ) -> WorkflowExecution | None:
        if not idempotency_key:
            return None
        cursor = await self._conn.execute(
            "SELECT * FROM oip_workflows WHERE tenant_id = ? AND idempotency_key = ?",
            (tenant_id, idempotency_key),
        )
        row = await cursor.fetchone()
        return self._row_to_workflow(row) if row else None

    async def list_workflows(
        self, *, tenant_id: str, state: str | None = None, limit: int = 50
    ) -> tuple[WorkflowExecution, ...]:
        if state:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_workflows
                WHERE tenant_id = ? AND workflow_state = ?
                ORDER BY started_at DESC LIMIT ?
                """,
                (tenant_id, state, limit),
            )
        else:
            cursor = await self._conn.execute(
                """
                SELECT * FROM oip_workflows WHERE tenant_id = ?
                ORDER BY started_at DESC LIMIT ?
                """,
                (tenant_id, limit),
            )
        rows = await cursor.fetchall()
        return tuple(self._row_to_workflow(row) for row in rows)

    async def save_stage_run(
        self, *, tenant_id: str, workflow_id: str, stage: StageMetrics
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_workflow_stages (
                stage_run_id, workflow_id, tenant_id, stage, status,
                started_at, completed_at, duration_ms, retry_count, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                workflow_id,
                tenant_id,
                stage.stage,
                stage.status.value,
                stage.started_at,
                stage.completed_at,
                stage.duration_ms,
                stage.retry_count,
                json.dumps(stage.metadata),
            ),
        )
        await self._conn.commit()

    async def get_stage_runs(
        self, *, tenant_id: str, workflow_id: str
    ) -> tuple[StageMetrics, ...]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_workflow_stages
            WHERE tenant_id = ? AND workflow_id = ?
            ORDER BY started_at ASC
            """,
            (tenant_id, workflow_id),
        )
        rows = await cursor.fetchall()
        return tuple(
            StageMetrics(
                stage=row["stage"],
                started_at=row["started_at"],
                completed_at=row["completed_at"],
                duration_ms=row["duration_ms"],
                status=StageRunStatus(row["status"]),
                retry_count=row["retry_count"],
                metadata=json.loads(row["metadata_json"] or "{}"),
            )
            for row in rows
        )

    async def save_failure(
        self, *, tenant_id: str, workflow_id: str, stage: str, reason: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_workflow_failures (failure_id, workflow_id, tenant_id, stage, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), workflow_id, tenant_id, stage, reason, now),
        )
        await self._conn.commit()

    async def save_retry(
        self, *, tenant_id: str, workflow_id: str, attempt: int, stage: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_workflow_retries (retry_id, workflow_id, tenant_id, stage, attempt, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), workflow_id, tenant_id, stage, attempt, now),
        )
        await self._increment(tenant_id, "retries_scheduled")
        await self._conn.commit()

    async def save_rollback(
        self, *, tenant_id: str, workflow_id: str, stage: str, reason: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_workflow_rollbacks (rollback_id, workflow_id, tenant_id, stage, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), workflow_id, tenant_id, stage, reason, now),
        )
        await self._increment(tenant_id, "rollbacks_performed")
        await self._conn.commit()

    async def increment_metrics(self, *, tenant_id: str, metric: str) -> None:
        await self._increment(tenant_id, metric)

    async def _increment(self, tenant_id: str, metric: str) -> None:
        allowed = {
            "workflows_started",
            "workflows_completed",
            "workflows_failed",
            "workflows_cancelled",
            "retries_scheduled",
            "rollbacks_performed",
        }
        if metric not in allowed:
            return
        today = _utc_today()
        await self._conn.execute(
            f"""
            INSERT INTO oip_workflow_metrics (tenant_id, metric_date, {metric})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                {metric} = oip_workflow_metrics.{metric} + 1
            """,
            (tenant_id, today),
        )

    async def get_metrics(
        self, *, tenant_id: str, metric_date: str | None = None
    ) -> WorkflowMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_workflow_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        active = await self._count_active(tenant_id)
        if not row:
            return WorkflowMetricsReadModel(
                tenant_id=tenant_id, metric_date=date, active_workflows=active
            )
        return WorkflowMetricsReadModel(
            tenant_id=tenant_id,
            metric_date=date,
            workflows_started=row["workflows_started"],
            workflows_completed=row["workflows_completed"],
            workflows_failed=row["workflows_failed"],
            workflows_cancelled=row["workflows_cancelled"],
            retries_scheduled=row["retries_scheduled"],
            rollbacks_performed=row["rollbacks_performed"],
            active_workflows=active,
        )

    async def list_recoverable(
        self, *, tenant_id: str, limit: int = 100
    ) -> tuple[WorkflowExecution, ...]:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_workflows
            WHERE tenant_id = ? AND workflow_state IN ('running', 'failed')
            ORDER BY updated_at ASC LIMIT ?
            """,
            (tenant_id, limit),
        )
        rows = await cursor.fetchall()
        return tuple(self._row_to_workflow(row) for row in rows)

    async def _count_active(self, tenant_id: str) -> int:
        cursor = await self._conn.execute(
            """
            SELECT COUNT(*) AS cnt FROM oip_workflows
            WHERE tenant_id = ? AND workflow_state IN ('pending', 'running')
            """,
            (tenant_id,),
        )
        row = await cursor.fetchone()
        return int(row["cnt"]) if row else 0

    def _row_to_workflow(self, row) -> WorkflowExecution:
        current = row["current_stage"]
        return WorkflowExecution(
            workflow_id=row["workflow_id"],
            request_id=row["request_id"],
            conversation_id=row["conversation_id"],
            session_id=row["session_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            branch_id=row["branch_id"],
            user_id=row["user_id"],
            correlation_id=row["correlation_id"],
            idempotency_key=row["idempotency_key"] or "",
            execution_mode=ExecutionMode(row["execution_mode"]),
            workflow_state=WorkflowState(row["workflow_state"]),
            current_stage=WorkflowStageName(current) if current else None,
            completed_stages=tuple(json.loads(row["completed_stages_json"] or "[]")),
            failed_stage=row["failed_stage"],
            rollback_state=RollbackState.model_validate_json(row["rollback_state_json"] or "{}"),
            retry_state=RetryState.model_validate_json(row["retry_state_json"] or "{}"),
            module=row["module"],
            message=row["message"],
            snapshots=json.loads(row["snapshots_json"] or "{}"),
            metadata=json.loads(row["metadata_json"] or "{}"),
            metrics=WorkflowMetrics.model_validate_json(row["metrics_json"] or "{}"),
            started_at=_parse_dt(row["started_at"]),
            updated_at=_parse_dt(row["updated_at"]),
            completed_at=_parse_dt(row["completed_at"]),
        )
