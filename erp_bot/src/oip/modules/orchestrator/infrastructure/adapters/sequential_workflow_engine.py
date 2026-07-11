"""Sequential workflow engine — replaceable by Temporal/Cadence later."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

from ...application.dto.stage_result import StageResult
from ...application.dto.workflow_context import WorkflowContext
from ...application.ports.workflow_engine_port import WorkflowEnginePort
from ...application.ports.workflow_repository_port import WorkflowRepositoryPort
from ...domain.entities import WorkflowExecution
from ...domain.stage_registry import WorkflowStageRegistry, create_default_stage_registry
from ...domain.value_objects import (
    RetryClassification,
    RetryState,
    RollbackPolicy,
    StageMetrics,
    StageRunStatus,
    WorkflowMetrics,
    WorkflowStageName,
    WorkflowState,
)
from .stage_port_registry import StagePortRegistry


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SequentialWorkflowEngine(WorkflowEnginePort):
    def __init__(
        self,
        *,
        stage_ports: StagePortRegistry,
        stage_registry: WorkflowStageRegistry | None = None,
        repository: WorkflowRepositoryPort | None = None,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
        stage_timeout: float = 120.0,
    ) -> None:
        self._stage_ports = stage_ports
        self._stage_registry = stage_registry or create_default_stage_registry()
        self._repository = repository
        self._max_retries = max_retries
        self._retry_backoff = retry_backoff
        self._stage_timeout = stage_timeout

    async def run(
        self,
        *,
        workflow: WorkflowExecution,
        context: WorkflowContext,
    ) -> tuple[WorkflowExecution, WorkflowContext]:
        current_workflow = workflow.model_copy(
            update={"workflow_state": WorkflowState.RUNNING, "updated_at": _utc_now()}
        )
        current_context = context
        stage_metrics: list[StageMetrics] = []
        completed: list[str] = []

        for definition in self._stage_registry.ordered_stages():
            stage_name = definition.name.value
            port = self._stage_ports.get(stage_name)
            if port is None:
                continue

            current_workflow = current_workflow.model_copy(
                update={
                    "current_stage": definition.name,
                    "updated_at": _utc_now(),
                }
            )

            started = time.perf_counter()
            started_iso = _utc_now().isoformat()
            attempt = 0
            stage_done = False
            last_error = ""

            while not stage_done:
                try:
                    updated_ctx, result = await asyncio.wait_for(
                        port.execute(current_context),
                        timeout=self._stage_timeout,
                    )
                except asyncio.TimeoutError:
                    result = StageResult(
                        stage=stage_name,
                        status=StageRunStatus.FAILED,
                        error="stage_timeout",
                        retry_classification=RetryClassification.RETRYABLE,
                    )
                    updated_ctx = current_context
                except Exception as exc:  # noqa: BLE001
                    result = StageResult(
                        stage=stage_name,
                        status=StageRunStatus.FAILED,
                        error=str(exc),
                        retry_classification=RetryClassification.RETRYABLE,
                    )
                    updated_ctx = current_context

                duration_ms = int((time.perf_counter() - started) * 1000)
                metric = StageMetrics(
                    stage=stage_name,
                    started_at=started_iso,
                    completed_at=_utc_now().isoformat(),
                    duration_ms=duration_ms,
                    status=result.status,
                    retry_count=attempt,
                    metadata=result.metadata,
                )
                stage_metrics.append(metric)
                if self._repository:
                    await self._repository.save_stage_run(
                        tenant_id=current_workflow.tenant_id,
                        workflow_id=current_workflow.workflow_id,
                        stage=metric,
                    )

                if result.status == StageRunStatus.SKIPPED:
                    stage_done = True
                    current_context = updated_ctx
                    continue

                if result.status == StageRunStatus.FAILED:
                    last_error = result.error
                    if (
                        port.supports_retry()
                        and definition.supports_retry
                        and result.retry_classification == RetryClassification.RETRYABLE
                        and attempt < self._max_retries
                    ):
                        attempt += 1
                        if self._repository:
                            await self._repository.save_retry(
                                tenant_id=current_workflow.tenant_id,
                                workflow_id=current_workflow.workflow_id,
                                attempt=attempt,
                                stage=stage_name,
                            )
                        await asyncio.sleep(self._retry_backoff * attempt)
                        continue

                    if self._repository:
                        await self._repository.save_failure(
                            tenant_id=current_workflow.tenant_id,
                            workflow_id=current_workflow.workflow_id,
                            stage=stage_name,
                            reason=last_error,
                        )
                    rolled = await self._rollback_stages(
                        current_context, completed, definition.rollback_policy
                    )
                    failed_workflow = current_workflow.model_copy(
                        update={
                            "workflow_state": WorkflowState.FAILED if not rolled else WorkflowState.ROLLED_BACK,
                            "failed_stage": stage_name,
                            "completed_stages": tuple(completed),
                            "updated_at": _utc_now(),
                            "completed_at": _utc_now(),
                            "metrics": WorkflowMetrics(
                                total_duration_ms=sum(m.duration_ms for m in stage_metrics),
                                stage_count=len(stage_metrics),
                                retry_count=sum(m.retry_count for m in stage_metrics),
                                rollback_count=1 if rolled else 0,
                                stages=tuple(stage_metrics),
                            ),
                            "rollback_state": current_workflow.rollback_state.model_copy(
                                update={
                                    "required": True,
                                    "completed": rolled,
                                    "failure_reason": last_error,
                                }
                            ),
                        }
                    )
                    return failed_workflow, current_context

                stage_done = True
                current_context = updated_ctx
                completed.append(stage_name)

        total_ms = sum(m.duration_ms for m in stage_metrics)
        completed_workflow = current_workflow.model_copy(
            update={
                "workflow_state": WorkflowState.COMPLETED,
                "current_stage": None,
                "completed_stages": tuple(completed),
                "updated_at": _utc_now(),
                "completed_at": _utc_now(),
                "snapshots": {
                    "conversation": current_context.conversation_ref,
                    "session": current_context.session_ref,
                    "plan": current_context.plan_ref,
                    "route": current_context.route_ref,
                    "execution": current_context.execution_ref,
                    "quality": current_context.quality_ref,
                    "action": current_context.action_ref,
                    "stream": current_context.stream_ref,
                    "response": current_context.response_ref,
                },
                "metrics": WorkflowMetrics(
                    total_duration_ms=total_ms,
                    stage_count=len(stage_metrics),
                    retry_count=sum(m.retry_count for m in stage_metrics),
                    stages=tuple(stage_metrics),
                ),
            }
        )
        return completed_workflow, current_context

    async def recover(
        self,
        *,
        workflow: WorkflowExecution,
        context: WorkflowContext,
    ) -> tuple[WorkflowExecution, WorkflowContext]:
        resume_context = context.model_copy(
            update={
                "plan_ref": workflow.snapshots.get("plan"),
                "route_ref": workflow.snapshots.get("route"),
                "execution_ref": workflow.snapshots.get("execution"),
                "quality_ref": workflow.snapshots.get("quality"),
                "action_ref": workflow.snapshots.get("action"),
                "stream_ref": workflow.snapshots.get("stream"),
            }
        )
        resumed = workflow.model_copy(
            update={
                "workflow_state": WorkflowState.RUNNING,
                "failed_stage": None,
                "updated_at": _utc_now(),
            }
        )
        return await self.run(workflow=resumed, context=resume_context)

    async def _rollback_stages(
        self,
        context: WorkflowContext,
        completed: list[str],
        failed_policy: RollbackPolicy,
    ) -> bool:
        rolled: list[str] = []
        for stage_name in reversed(completed):
            port = self._stage_ports.get(stage_name)
            if port is None:
                continue
            try:
                await port.rollback(context)
                rolled.append(stage_name)
                if self._repository:
                    await self._repository.save_rollback(
                        tenant_id=context.tenant_id,
                        workflow_id=context.workflow_id,
                        stage=stage_name,
                        reason="stage_failure",
                    )
            except Exception:  # noqa: BLE001
                continue
        return len(rolled) > 0
