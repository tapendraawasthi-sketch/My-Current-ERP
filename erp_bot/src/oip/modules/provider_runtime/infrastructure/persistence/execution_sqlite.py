"""SQLite execution repository."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Sequence

import aiosqlite

from ...application.ports.execution_repository_port import ExecutionRepositoryPort
from ...application.read_models.execution_read_models import ExecutionMetricsReadModel
from ...domain.entities import ExecutionAggregate
from ...domain.value_objects import (
    CapabilityToken,
    ExecutionArtifact,
    ExecutionBudget,
    ExecutionCancellation,
    ExecutionCheckpoint,
    ExecutionContext,
    ExecutionFailure,
    ExecutionLimits,
    ExecutionPolicyName,
    ExecutionResult,
    ExecutionStatus,
    ProviderInvocation,
    ProviderUsage,
    RetryClass,
    StreamingState,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


class SqliteExecutionRepositoryAdapter(ExecutionRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save(self, execution: ExecutionAggregate) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_executions (
                execution_id, route_id, plan_id, request_id, tenant_id, company_id,
                conversation_id, correlation_id, status, policy_name, edition,
                deployment_mode, provider_id, fallback_providers_json, selected_tools_json,
                context_json, capability_token_json, limits_json, budget_json,
                usage_json, result_json, failure_json, streaming_json, cancellation_json,
                health_snapshot_json, metadata_json, created_at, updated_at,
                started_at, completed_at, cancelled_at, timed_out_at, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(execution_id) DO UPDATE SET
                status = excluded.status,
                context_json = excluded.context_json,
                capability_token_json = excluded.capability_token_json,
                budget_json = excluded.budget_json,
                usage_json = excluded.usage_json,
                result_json = excluded.result_json,
                failure_json = excluded.failure_json,
                streaming_json = excluded.streaming_json,
                cancellation_json = excluded.cancellation_json,
                updated_at = excluded.updated_at,
                completed_at = excluded.completed_at,
                cancelled_at = excluded.cancelled_at,
                timed_out_at = excluded.timed_out_at,
                archived_at = excluded.archived_at
            """,
            (
                execution.execution_id,
                execution.route_id,
                execution.plan_id,
                execution.request_id,
                execution.tenant_id,
                execution.company_id,
                execution.conversation_id,
                execution.correlation_id,
                execution.status.value,
                execution.policy_name.value,
                execution.edition,
                execution.deployment_mode,
                execution.provider_id,
                json.dumps(list(execution.fallback_providers)),
                json.dumps(list(execution.selected_tools)),
                json.dumps(execution.context.model_dump(mode="json")) if execution.context else None,
                json.dumps(execution.capability_token.model_dump(mode="json")) if execution.capability_token else None,
                json.dumps(execution.limits.model_dump(mode="json")),
                json.dumps(execution.budget.model_dump(mode="json")) if execution.budget else None,
                json.dumps(execution.usage.model_dump(mode="json")) if execution.usage else None,
                json.dumps(execution.result.model_dump(mode="json")) if execution.result else None,
                json.dumps(execution.failure.model_dump(mode="json")) if execution.failure else None,
                json.dumps(execution.streaming.model_dump(mode="json")) if execution.streaming else None,
                json.dumps(execution.cancellation.model_dump(mode="json")) if execution.cancellation else None,
                json.dumps({}),
                json.dumps(execution.metadata),
                execution.created_at.isoformat(),
                execution.updated_at.isoformat(),
                execution.started_at.isoformat() if execution.started_at else None,
                execution.completed_at.isoformat() if execution.completed_at else None,
                execution.cancelled_at.isoformat() if execution.cancelled_at else None,
                execution.timed_out_at.isoformat() if execution.timed_out_at else None,
                execution.archived_at.isoformat() if execution.archived_at else None,
            ),
        )
        await self._conn.execute("DELETE FROM oip_provider_invocations WHERE execution_id = ?", (execution.execution_id,))
        for inv in execution.invocations:
            await self._conn.execute(
                """
                INSERT INTO oip_provider_invocations (
                    invocation_id, execution_id, tenant_id, provider_id, model,
                    attempt, success, latency_ms, error_code, retry_class, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    inv.invocation_id,
                    inv.execution_id,
                    inv.tenant_id,
                    inv.provider_id,
                    inv.model,
                    inv.attempt,
                    int(inv.success),
                    inv.latency_ms,
                    inv.error_code,
                    inv.retry_class.value if inv.retry_class else None,
                    inv.created_at,
                ),
            )
        if execution.usage:
            await self._conn.execute(
                """
                INSERT INTO oip_execution_usage (
                    usage_id, execution_id, tenant_id, provider_id, model, region,
                    input_tokens, output_tokens, reasoning_tokens, cache_hits,
                    latency_ms, cost_micros, retries, streaming_duration_ms, tool_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(execution_id) DO UPDATE SET
                    input_tokens = excluded.input_tokens,
                    output_tokens = excluded.output_tokens,
                    latency_ms = excluded.latency_ms,
                    cost_micros = excluded.cost_micros
                """,
                (
                    execution.usage.usage_id,
                    execution.usage.execution_id,
                    execution.usage.tenant_id,
                    execution.usage.provider_id,
                    execution.usage.model,
                    execution.usage.region,
                    execution.usage.input_tokens,
                    execution.usage.output_tokens,
                    execution.usage.reasoning_tokens,
                    execution.usage.cache_hits,
                    execution.usage.latency_ms,
                    execution.usage.cost_micros,
                    execution.usage.retries,
                    execution.usage.streaming_duration_ms,
                    execution.usage.tool_count,
                    execution.updated_at.isoformat(),
                ),
            )
        await self._conn.execute("DELETE FROM oip_execution_artifacts WHERE execution_id = ?", (execution.execution_id,))
        for artifact in execution.artifacts:
            await self._conn.execute(
                """
                INSERT INTO oip_execution_artifacts (
                    artifact_id, execution_id, tenant_id, blob_pointer, content_hash,
                    encrypted, ttl_seconds, provider_id, model, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    artifact.artifact_id,
                    artifact.execution_id,
                    artifact.tenant_id,
                    artifact.blob_pointer,
                    artifact.content_hash,
                    int(artifact.encrypted),
                    artifact.ttl_seconds,
                    artifact.provider_id,
                    artifact.model,
                    json.dumps(artifact.metadata),
                    artifact.created_at,
                ),
            )
        await self._conn.execute("DELETE FROM oip_execution_checkpoints WHERE execution_id = ?", (execution.execution_id,))
        for cp in execution.checkpoints:
            await self._conn.execute(
                """
                INSERT INTO oip_execution_checkpoints (
                    checkpoint_id, execution_id, tenant_id, sequence_no, state_snapshot_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    cp.checkpoint_id,
                    cp.execution_id,
                    execution.tenant_id,
                    cp.sequence_no,
                    json.dumps(cp.state_snapshot),
                    cp.created_at,
                ),
            )
        await self._conn.commit()

    async def get_by_id(self, *, tenant_id: str, execution_id: str) -> ExecutionAggregate | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_executions WHERE tenant_id = ? AND execution_id = ?",
            (tenant_id, execution_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        invocations = await self._load_invocations(execution_id)
        checkpoints = await self._load_checkpoints(execution_id)
        artifacts = await self._load_artifacts(execution_id)
        return self._row_to_execution(row, invocations, checkpoints, artifacts)

    async def search(
        self,
        *,
        tenant_id: str,
        route_id: str | None = None,
        plan_id: str | None = None,
        request_id: str | None = None,
        conversation_id: str | None = None,
        company_id: str | None = None,
        provider_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> tuple[ExecutionAggregate, ...]:
        clauses = ["tenant_id = ?"]
        params: list = [tenant_id]
        for field, value in (
            ("route_id", route_id),
            ("plan_id", plan_id),
            ("request_id", request_id),
            ("conversation_id", conversation_id),
            ("company_id", company_id),
            ("provider_id", provider_id),
        ):
            if value:
                clauses.append(f"{field} = ?")
                params.append(value)
        if status:
            clauses.append("status = ?")
            params.append(status)
        params.append(limit)
        cursor = await self._conn.execute(
            f"SELECT * FROM oip_executions WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?",
            tuple(params),
        )
        rows = await cursor.fetchall()
        results: list[ExecutionAggregate] = []
        for row in rows:
            eid = row["execution_id"]
            invocations = await self._load_invocations(eid)
            checkpoints = await self._load_checkpoints(eid)
            artifacts = await self._load_artifacts(eid)
            results.append(self._row_to_execution(row, invocations, checkpoints, artifacts))
        return tuple(results)

    async def save_capability_token(self, token: CapabilityToken) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_capability_tokens (
                token_id, tenant_id, request_id, conversation_id, company_id,
                expires_at, allowed_tools_json, allowed_erp_actions_json,
                maximum_calls, read_scope_json, write_scope_json, revoked, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(token_id) DO UPDATE SET revoked = excluded.revoked
            """,
            (
                token.token_id,
                token.tenant_id,
                token.request_id,
                token.conversation_id,
                token.company_id,
                token.expires_at,
                json.dumps(list(token.allowed_tools)),
                json.dumps(list(token.allowed_erp_actions)),
                token.maximum_calls,
                json.dumps(list(token.read_scope)),
                json.dumps(list(token.write_scope)),
                int(token.revoked),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await self._conn.commit()

    async def get_capability_token(self, *, tenant_id: str, token_id: str) -> CapabilityToken | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_capability_tokens WHERE tenant_id = ? AND token_id = ?",
            (tenant_id, token_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return CapabilityToken(
            token_id=row["token_id"],
            request_id=row["request_id"],
            conversation_id=row["conversation_id"],
            company_id=row["company_id"],
            tenant_id=row["tenant_id"],
            expires_at=row["expires_at"],
            allowed_tools=tuple(json.loads(row["allowed_tools_json"])),
            allowed_erp_actions=tuple(json.loads(row["allowed_erp_actions_json"])),
            maximum_calls=int(row["maximum_calls"]),
            read_scope=tuple(json.loads(row["read_scope_json"])),
            write_scope=tuple(json.loads(row["write_scope_json"])),
            revoked=bool(row["revoked"]),
        )

    async def save_stream_chunk(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        sequence_no: int,
        chunk_text: str,
        provisional: bool = True,
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_stream_chunks (
                chunk_id, execution_id, tenant_id, sequence_no, chunk_text, provisional, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(execution_id, sequence_no) DO UPDATE SET chunk_text = excluded.chunk_text
            """,
            (
                str(uuid.uuid4()),
                execution_id,
                tenant_id,
                sequence_no,
                chunk_text,
                int(provisional),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await self._conn.commit()

    async def list_stream_chunks(self, *, tenant_id: str, execution_id: str) -> tuple[dict[str, object], ...]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_stream_chunks WHERE tenant_id = ? AND execution_id = ? ORDER BY sequence_no ASC",
            (tenant_id, execution_id),
        )
        rows = await cursor.fetchall()
        return tuple(
            {
                "sequence_no": int(row["sequence_no"]),
                "chunk_text": row["chunk_text"],
                "provisional": bool(row["provisional"]),
            }
            for row in rows
        )

    async def get_usage(self, *, tenant_id: str, execution_id: str) -> ProviderUsage | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_usage WHERE tenant_id = ? AND execution_id = ?",
            (tenant_id, execution_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return ProviderUsage(
            usage_id=row["usage_id"],
            execution_id=row["execution_id"],
            tenant_id=row["tenant_id"],
            provider_id=row["provider_id"],
            model=row["model"],
            region=row["region"],
            input_tokens=int(row["input_tokens"]),
            output_tokens=int(row["output_tokens"]),
            reasoning_tokens=int(row["reasoning_tokens"]),
            cache_hits=int(row["cache_hits"]),
            latency_ms=int(row["latency_ms"]),
            cost_micros=int(row["cost_micros"]),
            retries=int(row["retries"]),
            streaming_duration_ms=int(row["streaming_duration_ms"]),
            tool_count=int(row["tool_count"]),
        )

    async def list_artifacts(self, *, tenant_id: str, execution_id: str) -> tuple[ExecutionArtifact, ...]:
        return await self._load_artifacts(execution_id)

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> ExecutionMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if not row:
            return ExecutionMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return ExecutionMetricsReadModel(
            tenant_id=row["tenant_id"],
            metric_date=row["metric_date"],
            executions_started=int(row["executions_started"]),
            executions_completed=int(row["executions_completed"]),
            executions_failed=int(row["executions_failed"]),
            executions_cancelled=int(row["executions_cancelled"]),
            executions_timed_out=int(row["executions_timed_out"]),
            total_tokens=int(row["total_tokens"]),
            total_cost_micros=int(row["total_cost_micros"]),
            avg_latency_ms=float(row["avg_latency_ms"]),
        )

    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        provider_id: str | None = None,
        latency_ms: int = 0,
        cost_micros: int = 0,
        tokens: int = 0,
    ) -> None:
        column_map = {
            "executions_started": "executions_started",
            "executions_completed": "executions_completed",
            "executions_failed": "executions_failed",
            "executions_cancelled": "executions_cancelled",
            "executions_timed_out": "executions_timed_out",
        }
        column = column_map.get(metric)
        if not column:
            return
        metric_date = _utc_today()
        await self._conn.execute(
            f"""
            INSERT INTO oip_execution_metrics (tenant_id, metric_date, {column})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET {column} = {column} + 1
            """,
            (tenant_id, metric_date),
        )
        if metric == "executions_completed":
            await self._conn.execute(
                """
                UPDATE oip_execution_metrics
                SET total_tokens = total_tokens + ?,
                    total_cost_micros = total_cost_micros + ?,
                    avg_latency_ms = (
                        (avg_latency_ms * MAX(executions_completed - 1, 0) + ?) /
                        MAX(executions_completed, 1)
                    )
                WHERE tenant_id = ? AND metric_date = ?
                """,
                (tokens, cost_micros, float(latency_ms), tenant_id, metric_date),
            )
        await self._conn.commit()

    async def _load_invocations(self, execution_id: str) -> tuple[ProviderInvocation, ...]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_provider_invocations WHERE execution_id = ? ORDER BY attempt ASC",
            (execution_id,),
        )
        rows = await cursor.fetchall()
        return tuple(
            ProviderInvocation(
                invocation_id=row["invocation_id"],
                execution_id=row["execution_id"],
                tenant_id=row["tenant_id"],
                provider_id=row["provider_id"],
                model=row["model"],
                attempt=int(row["attempt"]),
                success=bool(row["success"]),
                latency_ms=int(row["latency_ms"]),
                error_code=row["error_code"],
                retry_class=RetryClass(row["retry_class"]) if row["retry_class"] else None,
                created_at=row["created_at"],
            )
            for row in rows
        )

    async def _load_checkpoints(self, execution_id: str) -> tuple[ExecutionCheckpoint, ...]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_checkpoints WHERE execution_id = ? ORDER BY sequence_no ASC",
            (execution_id,),
        )
        rows = await cursor.fetchall()
        return tuple(
            ExecutionCheckpoint(
                checkpoint_id=row["checkpoint_id"],
                execution_id=row["execution_id"],
                sequence_no=int(row["sequence_no"]),
                state_snapshot=json.loads(row["state_snapshot_json"]),
                created_at=row["created_at"],
            )
            for row in rows
        )

    async def _load_artifacts(self, execution_id: str) -> tuple[ExecutionArtifact, ...]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_execution_artifacts WHERE execution_id = ?",
            (execution_id,),
        )
        rows = await cursor.fetchall()
        return tuple(
            ExecutionArtifact(
                artifact_id=row["artifact_id"],
                execution_id=row["execution_id"],
                tenant_id=row["tenant_id"],
                blob_pointer=row["blob_pointer"],
                content_hash=row["content_hash"],
                encrypted=bool(row["encrypted"]),
                ttl_seconds=int(row["ttl_seconds"]),
                provider_id=row["provider_id"],
                model=row["model"],
                metadata=json.loads(row["metadata_json"]),
                created_at=row["created_at"],
            )
            for row in rows
        )

    @staticmethod
    def _row_to_execution(
        row: aiosqlite.Row,
        invocations: tuple[ProviderInvocation, ...],
        checkpoints: tuple[ExecutionCheckpoint, ...],
        artifacts: tuple[ExecutionArtifact, ...],
    ) -> ExecutionAggregate:
        context = ExecutionContext(**json.loads(row["context_json"])) if row["context_json"] else None
        token = CapabilityToken(**json.loads(row["capability_token_json"])) if row["capability_token_json"] else None
        budget = ExecutionBudget(**json.loads(row["budget_json"])) if row["budget_json"] else None
        usage = ProviderUsage(**json.loads(row["usage_json"])) if row["usage_json"] else None
        result = ExecutionResult(**json.loads(row["result_json"])) if row["result_json"] else None
        failure = ExecutionFailure(**json.loads(row["failure_json"])) if row["failure_json"] else None
        streaming = StreamingState(**json.loads(row["streaming_json"])) if row["streaming_json"] else None
        cancellation = ExecutionCancellation(**json.loads(row["cancellation_json"])) if row["cancellation_json"] else None
        return ExecutionAggregate(
            execution_id=row["execution_id"],
            route_id=row["route_id"],
            plan_id=row["plan_id"],
            request_id=row["request_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            conversation_id=row["conversation_id"],
            correlation_id=row["correlation_id"],
            status=ExecutionStatus(row["status"]),
            policy_name=ExecutionPolicyName(row["policy_name"]),
            edition=row["edition"],
            deployment_mode=row["deployment_mode"],
            provider_id=row["provider_id"],
            fallback_providers=tuple(json.loads(row["fallback_providers_json"])),
            selected_tools=tuple(json.loads(row["selected_tools_json"])),
            context=context,
            capability_token=token,
            limits=ExecutionLimits(**json.loads(row["limits_json"])),
            budget=budget,
            invocations=invocations,
            usage=usage,
            artifacts=artifacts,
            streaming=streaming,
            result=result,
            failure=failure,
            checkpoints=checkpoints,
            cancellation=cancellation,
            metadata=json.loads(row["metadata_json"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
            cancelled_at=datetime.fromisoformat(row["cancelled_at"]) if row["cancelled_at"] else None,
            timed_out_at=datetime.fromisoformat(row["timed_out_at"]) if row["timed_out_at"] else None,
            archived_at=datetime.fromisoformat(row["archived_at"]) if row["archived_at"] else None,
        )
