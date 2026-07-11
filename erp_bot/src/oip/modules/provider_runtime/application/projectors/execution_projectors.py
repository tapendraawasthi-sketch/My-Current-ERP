"""Execution projectors — replay-safe and idempotent."""

from __future__ import annotations

from ...domain.entities import ExecutionAggregate
from ...domain.value_objects import ExecutionStatus
from ..read_models.execution_read_models import (
    ExecutionArtifactReadModel,
    ExecutionReadModel,
    ExecutionUsageReadModel,
)


class ExecutionProjector:
    def project(self, execution: ExecutionAggregate | None) -> ExecutionReadModel | None:
        if execution is None:
            return None
        return ExecutionReadModel(
            execution_id=execution.execution_id,
            route_id=execution.route_id,
            plan_id=execution.plan_id,
            request_id=execution.request_id,
            tenant_id=execution.tenant_id,
            company_id=execution.company_id,
            conversation_id=execution.conversation_id,
            correlation_id=execution.correlation_id,
            status=execution.status.value,
            policy_name=execution.policy_name.value,
            provider_id=execution.provider_id,
            fallback_providers=execution.fallback_providers,
            selected_tools=execution.selected_tools,
            output_text=execution.result.output_text if execution.result else "",
            artifact_count=len(execution.artifacts),
            chunk_count=execution.streaming.chunk_count if execution.streaming else 0,
            success=execution.result.success if execution.result else None,
            failure_kind=execution.failure.kind.value if execution.failure else None,
            created_at=execution.created_at.isoformat(),
            updated_at=execution.updated_at.isoformat(),
            started_at=execution.started_at.isoformat() if execution.started_at else None,
            completed_at=execution.completed_at.isoformat() if execution.completed_at else None,
        )

    def project_usage(self, execution: ExecutionAggregate | None) -> ExecutionUsageReadModel | None:
        if execution is None or execution.usage is None:
            return None
        u = execution.usage
        return ExecutionUsageReadModel(
            execution_id=u.execution_id,
            provider_id=u.provider_id,
            model=u.model,
            region=u.region,
            input_tokens=u.input_tokens,
            output_tokens=u.output_tokens,
            reasoning_tokens=u.reasoning_tokens,
            cache_hits=u.cache_hits,
            latency_ms=u.latency_ms,
            cost_micros=u.cost_micros,
            retries=u.retries,
            streaming_duration_ms=u.streaming_duration_ms,
            tool_count=u.tool_count,
        )

    def project_artifacts(self, execution: ExecutionAggregate | None) -> tuple[ExecutionArtifactReadModel, ...]:
        if execution is None:
            return ()
        return tuple(
            ExecutionArtifactReadModel(
                artifact_id=a.artifact_id,
                execution_id=a.execution_id,
                blob_pointer=a.blob_pointer,
                content_hash=a.content_hash,
                encrypted=a.encrypted,
                ttl_seconds=a.ttl_seconds,
                provider_id=a.provider_id,
                model=a.model,
                created_at=a.created_at,
            )
            for a in execution.artifacts
        )
