"""Provider Runtime application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from ....router.domain.entities import RouteDecision
from ...domain.entities import ExecutionAggregate
from ...domain.events import (
    ExecutionArtifactStoredEvent,
    ExecutionCancelledEvent,
    ExecutionCheckpointCreatedEvent,
    ExecutionChunkProducedEvent,
    ExecutionCompletedEvent,
    ExecutionFailedEvent,
    ExecutionProviderInvokedEvent,
    ExecutionStartedEvent,
    ExecutionStreamingStartedEvent,
    ExecutionTimedOutEvent,
    build_execution_event,
)
from ...domain.value_objects import (
    ExecutionBudget,
    ExecutionCancellation,
    ExecutionCheckpoint,
    ExecutionFailure,
    ExecutionLimits,
    ExecutionPolicyName,
    ExecutionStatus,
    FailureKind,
    ProviderInvocation,
    RetryClass,
)
from ..pipeline.pipeline import ExecutionPipeline
from ..ports.execution_ports import ProviderRuntimePort
from ..ports.execution_repository_port import ExecutionRepositoryPort
from ..projectors.execution_projectors import ExecutionProjector
from ..read_models.execution_read_models import ExecutionReadModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProviderRuntimeService(ProviderRuntimePort):
    def __init__(
        self,
        *,
        pipeline: ExecutionPipeline,
        repository: ExecutionRepositoryPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
        route_loader,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._route_loader = route_loader
        self._projector = ExecutionProjector()

    async def start_execution(
        self,
        *,
        route: RouteDecision | None = None,
        route_id: str | None = None,
        tenant_id: str | None = None,
        execution_policy: ExecutionPolicyName | None = None,
    ) -> ExecutionAggregate:
        if route is None:
            if route_id is None or tenant_id is None:
                raise ValueError("route or (route_id, tenant_id) required")
            route = await self._route_loader.get_by_id(tenant_id=tenant_id, route_id=route_id)
            if route is None:
                raise ValueError(f"Route decision not found: {route_id}")

        policy_name = execution_policy or self._resolve_policy_name()
        execution_id = str(uuid.uuid4())
        now = _utc_now()
        tool_ids = tuple(t.tool_id for t in route.selected_tools)

        execution = ExecutionAggregate(
            execution_id=execution_id,
            route_id=route.route_id,
            plan_id=route.plan_id,
            request_id=route.request_id,
            tenant_id=route.tenant_id,
            company_id=route.company_id,
            conversation_id=route.conversation_id,
            correlation_id=route.correlation_id,
            status=ExecutionStatus.RUNNING,
            policy_name=policy_name,
            edition=route.edition,
            deployment_mode=route.deployment_mode,
            provider_id=route.primary_provider.provider_id,
            fallback_providers=route.fallback_chain.providers,
            selected_tools=tool_ids,
            limits=ExecutionLimits(
                max_tokens=route.estimated_tokens or 16_000,
                max_cost_micros=route.estimated_cost_micros or 500_000,
                max_latency_ms=route.estimated_latency_ms or 30_000,
            ),
            created_at=now,
            updated_at=now,
            started_at=now,
        )

        await self._repository.save(execution)
        await self._emit(ExecutionStartedEvent, execution, {"route_id": route.route_id, "provider": route.primary_provider.provider_id})
        await self._repository.increment_metrics(tenant_id=execution.tenant_id, metric="executions_started", provider_id=execution.provider_id)

        pipeline_ctx = await self._pipeline.execute(
            route=route,
            policy_name=policy_name,
            execution=execution,
            streaming_enabled=self._settings.streaming_enabled,
        )

        if pipeline_ctx.capability_token:
            await self._repository.save_capability_token(pipeline_ctx.capability_token)

        for idx, chunk in enumerate(pipeline_ctx.stream_chunks):
            await self._repository.save_stream_chunk(
                execution_id=execution_id,
                tenant_id=route.tenant_id,
                sequence_no=idx,
                chunk_text=chunk,
                provisional=True,
            )
            await self._emit(
                ExecutionChunkProducedEvent,
                execution,
                {"sequence_no": idx, "chunk_preview": chunk[:120]},
            )

        if pipeline_ctx.streaming and pipeline_ctx.streaming.chunk_count > 0:
            await self._emit(ExecutionStreamingStartedEvent, execution, {"chunk_count": pipeline_ctx.streaming.chunk_count})

        resolved_provider = pipeline_ctx.resolved_provider_id or route.primary_provider.provider_id
        invocation = ProviderInvocation(
            invocation_id=str(uuid.uuid4()),
            execution_id=execution_id,
            tenant_id=route.tenant_id,
            provider_id=resolved_provider,
            model=pipeline_ctx.provider_response.get("model", ""),
            attempt=pipeline_ctx.retry_count + 1,
            success=not bool(pipeline_ctx.failure_message),
            latency_ms=int(pipeline_ctx.provider_response.get("_latency_ms", 0)),
            error_code=pipeline_ctx.failure_message or None,
            retry_class=RetryClass.RETRYABLE if pipeline_ctx.retry_count else RetryClass.NON_RETRYABLE,
            created_at=now.isoformat(),
        )
        await self._emit(
            ExecutionProviderInvokedEvent,
            execution,
            {
                "provider": resolved_provider,
                "success": invocation.success,
                "retry_count": pipeline_ctx.retry_count,
                "latency_ms": invocation.latency_ms,
            },
        )

        completed_at = _utc_now()
        if pipeline_ctx.failure_message or (pipeline_ctx.result and not pipeline_ctx.result.success):
            failure = pipeline_ctx.result.failure if pipeline_ctx.result and pipeline_ctx.result.failure else ExecutionFailure(
                failure_id=str(uuid.uuid4()),
                execution_id=execution_id,
                kind=FailureKind.PROVIDER_UNAVAILABLE,
                retry_class=RetryClass.NON_RETRYABLE,
                message=pipeline_ctx.failure_message or "execution_failed",
                provider_id=route.primary_provider.provider_id,
                occurred_at=completed_at.isoformat(),
            )
            failed = execution.model_copy(
                update={
                    "status": ExecutionStatus.FAILED,
                    "context": pipeline_ctx.context,
                    "capability_token": pipeline_ctx.capability_token,
                    "budget": pipeline_ctx.budget,
                    "invocations": (invocation,),
                    "usage": pipeline_ctx.usage,
                    "artifacts": (pipeline_ctx.artifact,) if pipeline_ctx.artifact else (),
                    "streaming": pipeline_ctx.streaming,
                    "result": pipeline_ctx.result,
                    "failure": failure,
                    "updated_at": completed_at,
                    "completed_at": completed_at,
                }
            )
            await self._repository.save(failed)
            await self._emit(ExecutionFailedEvent, failed, {"failure_kind": failure.kind.value})
            await self._repository.increment_metrics(tenant_id=failed.tenant_id, metric="executions_failed", provider_id=failed.provider_id)
            await self._record_lineage(failed, route, pipeline_ctx)
            await self._audit_mutation(failed, "provider_runtime.execution.failed")
            return failed

        budget = pipeline_ctx.budget
        if budget is None:
            budget = ExecutionBudget(
                budget_id=str(uuid.uuid4()),
                execution_id=execution_id,
                tenant_id=route.tenant_id,
                allocated_tokens=route.estimated_tokens,
                allocated_cost_micros=route.estimated_cost_micros,
                allocated_latency_ms=route.estimated_latency_ms,
            )

        completed = execution.model_copy(
            update={
                "status": ExecutionStatus.COMPLETED,
                "provider_id": resolved_provider,
                "context": pipeline_ctx.context,
                "capability_token": pipeline_ctx.capability_token,
                "budget": budget,
                "invocations": (invocation,),
                "usage": pipeline_ctx.usage,
                "artifacts": (pipeline_ctx.artifact,) if pipeline_ctx.artifact else (),
                "streaming": pipeline_ctx.streaming,
                "result": pipeline_ctx.result,
                "updated_at": completed_at,
                "completed_at": completed_at,
            }
        )
        await self._repository.save(completed)
        if pipeline_ctx.artifact:
            await self._emit(
                ExecutionArtifactStoredEvent,
                completed,
                {"artifact_id": pipeline_ctx.artifact.artifact_id, "content_hash": pipeline_ctx.artifact.content_hash},
            )
        await self._emit(ExecutionCompletedEvent, completed, {"provider": route.primary_provider.provider_id})
        await self._repository.increment_metrics(
            tenant_id=completed.tenant_id,
            metric="executions_completed",
            provider_id=completed.provider_id,
            latency_ms=completed.usage.latency_ms if completed.usage else 0,
            cost_micros=completed.usage.cost_micros if completed.usage else 0,
            tokens=(completed.usage.input_tokens + completed.usage.output_tokens) if completed.usage else 0,
        )
        await self._record_lineage(completed, route, pipeline_ctx)
        await self._audit_mutation(
            completed,
            "provider_runtime.execution.completed",
            {
                "provider": resolved_provider,
                "model": completed.usage.model if completed.usage else None,
                "latency_ms": completed.usage.latency_ms if completed.usage else 0,
                "tokens": (completed.usage.input_tokens + completed.usage.output_tokens) if completed.usage else 0,
                "cost_micros": completed.usage.cost_micros if completed.usage else 0,
                "retry_count": pipeline_ctx.retry_count,
            },
        )
        return completed

    async def cancel_execution(self, *, tenant_id: str, execution_id: str, reason: str = "") -> ExecutionAggregate:
        execution = await self._require_execution(tenant_id, execution_id)
        if execution.status == ExecutionStatus.CANCELLED:
            return execution
        now = _utc_now()
        cancelled = execution.model_copy(
            update={
                "status": ExecutionStatus.CANCELLED,
                "cancellation": ExecutionCancellation(
                    cancellation_id=str(uuid.uuid4()),
                    execution_id=execution_id,
                    reason=reason,
                    cancelled_by="user",
                ),
                "updated_at": now,
                "cancelled_at": now,
            }
        )
        await self._repository.save(cancelled)
        await self._emit(ExecutionCancelledEvent, cancelled, {"reason": reason})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="executions_cancelled")
        await self._audit_mutation(cancelled, "provider_runtime.execution.cancelled", {"reason": reason})
        return cancelled

    async def retry_execution(self, *, tenant_id: str, execution_id: str) -> ExecutionAggregate:
        execution = await self._require_execution(tenant_id, execution_id)
        route = await self._route_loader.get_by_id(tenant_id=tenant_id, route_id=execution.route_id)
        if route is None:
            raise ValueError(f"Route not found for retry: {execution.route_id}")
        return await self.start_execution(route=route, execution_policy=execution.policy_name)

    async def timeout_execution(self, *, tenant_id: str, execution_id: str) -> ExecutionAggregate:
        execution = await self._require_execution(tenant_id, execution_id)
        if execution.status == ExecutionStatus.TIMED_OUT:
            return execution
        now = _utc_now()
        timed_out = execution.model_copy(
            update={
                "status": ExecutionStatus.TIMED_OUT,
                "failure": ExecutionFailure(
                    failure_id=str(uuid.uuid4()),
                    execution_id=execution_id,
                    kind=FailureKind.TIMEOUT,
                    retry_class=RetryClass.RETRYABLE,
                    message="execution_timed_out",
                    provider_id=execution.provider_id,
                    occurred_at=now.isoformat(),
                ),
                "updated_at": now,
                "timed_out_at": now,
            }
        )
        await self._repository.save(timed_out)
        await self._emit(ExecutionTimedOutEvent, timed_out, {})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="executions_timed_out")
        await self._audit_mutation(timed_out, "provider_runtime.execution.timed_out")
        return timed_out

    async def checkpoint_execution(
        self,
        *,
        tenant_id: str,
        execution_id: str,
        state_snapshot: dict | None = None,
    ) -> ExecutionAggregate:
        execution = await self._require_execution(tenant_id, execution_id)
        now = _utc_now()
        checkpoint = ExecutionCheckpoint(
            checkpoint_id=str(uuid.uuid4()),
            execution_id=execution_id,
            sequence_no=len(execution.checkpoints) + 1,
            state_snapshot=state_snapshot or {"status": execution.status.value},
            created_at=now.isoformat(),
        )
        updated = execution.model_copy(
            update={
                "checkpoints": execution.checkpoints + (checkpoint,),
                "updated_at": now,
            }
        )
        await self._repository.save(updated)
        await self._emit(ExecutionCheckpointCreatedEvent, updated, {"checkpoint_id": checkpoint.checkpoint_id})
        await self._audit_mutation(updated, "provider_runtime.execution.checkpoint")
        return updated

    async def archive_execution(self, *, tenant_id: str, execution_id: str) -> ExecutionAggregate:
        execution = await self._require_execution(tenant_id, execution_id)
        if execution.status == ExecutionStatus.ARCHIVED:
            return execution
        now = _utc_now()
        archived = execution.model_copy(update={"status": ExecutionStatus.ARCHIVED, "updated_at": now, "archived_at": now})
        await self._repository.save(archived)
        await self._audit_mutation(archived, "provider_runtime.execution.archived")
        return archived

    async def get_read_model(self, *, tenant_id: str, execution_id: str) -> ExecutionReadModel | None:
        execution = await self._repository.get_by_id(tenant_id=tenant_id, execution_id=execution_id)
        return self._projector.project(execution)

    async def _require_execution(self, tenant_id: str, execution_id: str) -> ExecutionAggregate:
        execution = await self._repository.get_by_id(tenant_id=tenant_id, execution_id=execution_id)
        if execution is None:
            raise ValueError(f"Execution not found: {execution_id}")
        return execution

    async def _emit(self, event_cls, execution: ExecutionAggregate, payload: dict) -> None:
        event = build_execution_event(
            event_cls,
            tenant_id=execution.tenant_id,
            correlation_id=execution.correlation_id,
            company_id=execution.company_id,
            execution_id=execution.execution_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _audit_mutation(self, execution: ExecutionAggregate, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=execution.tenant_id,
            request_id=execution.request_id,
            correlation_id=execution.correlation_id,
            event_name=event_name,
            payload_redacted={"execution_id": execution.execution_id, "provider": execution.provider_id, **(extra or {})},
        )

    async def _record_lineage(self, execution: ExecutionAggregate, route: RouteDecision, pipeline_ctx) -> None:
        exec_node = await self._lineage.append_node(
            tenant_id=execution.tenant_id,
            request_id=execution.request_id,
            node_type="Execution",
            payload={"execution_id": execution.execution_id, "route_id": route.route_id},
        )
        await self._lineage.append_node(
            tenant_id=execution.tenant_id,
            request_id=execution.request_id,
            node_type="ProviderInvocation",
            parent_node_id=exec_node.node_id,
            payload={"provider_id": execution.provider_id, "success": execution.status == ExecutionStatus.COMPLETED},
        )
        if pipeline_ctx.artifact:
            await self._lineage.append_node(
                tenant_id=execution.tenant_id,
                request_id=execution.request_id,
                node_type="ArtifactPointer",
                parent_node_id=exec_node.node_id,
                payload={
                    "artifact_id": pipeline_ctx.artifact.artifact_id,
                    "content_hash": pipeline_ctx.artifact.content_hash,
                    "blob_pointer": pipeline_ctx.artifact.blob_pointer,
                },
            )
        await self._lineage.append_node(
            tenant_id=execution.tenant_id,
            request_id=execution.request_id,
            node_type="ExecutionResult",
            parent_node_id=exec_node.node_id,
            payload={
                "success": execution.status == ExecutionStatus.COMPLETED,
                "artifact_hash": pipeline_ctx.artifact.content_hash if pipeline_ctx.artifact else None,
            },
        )

    def _resolve_policy_name(self) -> ExecutionPolicyName:
        try:
            return ExecutionPolicyName(self._settings.provider_policy)
        except ValueError:
            return ExecutionPolicyName.BALANCED
