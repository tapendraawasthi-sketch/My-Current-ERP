"""Action Runtime application service — sole ERP mutation authority."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .....application.ports.outbound.outbox_port import OutboxPort
from .....application.services.audit_service import AuditService
from .....application.services.lineage_service import LineageService
from .....config.settings import OipSettings
from .....domain.events import DomainEventEnvelope
from .....integration.contracts.execution_intent import ExecutionIntent
from .....shared.ids import new_action_id
from ....quality_gate.domain.value_objects import QualityDecisionOutcome
from ...domain.action_registry import ActionTypeRegistry
from ...domain.entities import ActionExecution
from ...domain.events import (
    ActionApprovedEvent,
    ActionCancelledEvent,
    ActionCompensatedEvent,
    ActionExecutedEvent,
    ActionExecutionStartedEvent,
    ActionFailedEvent,
    ActionProposedEvent,
    ActionRejectedEvent,
    ActionValidatedEvent,
    build_action_event,
)
from ...domain.value_objects import ActionExecutionStatus, ActionRuntimeType
from ..pipeline.pipeline import ActionRuntimePipeline
from ..ports.action_repository_port import ActionRepositoryPort
from ..ports.action_runtime_port import ActionRuntimePort
from ..ports.action_runtime_ports import ApprovalPort
from ..projectors.action_runtime_projectors import ActionExecutionProjector
from ..read_models.action_runtime_read_models import ActionExecutionReadModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ActionRuntimeService(ActionRuntimePort):
    def __init__(
        self,
        *,
        pipeline: ActionRuntimePipeline,
        repository: ActionRepositoryPort,
        registry: ActionTypeRegistry,
        approval_port: ApprovalPort,
        outbox: OutboxPort,
        audit_service: AuditService,
        lineage_service: LineageService,
        settings: OipSettings,
        execution_loader,
        evaluation_loader,
    ) -> None:
        self._pipeline = pipeline
        self._repository = repository
        self._registry = registry
        self._approval = approval_port
        self._outbox = outbox
        self._audit = audit_service
        self._lineage = lineage_service
        self._settings = settings
        self._execution_loader = execution_loader
        self._evaluation_loader = evaluation_loader
        self._projector = ActionExecutionProjector()

    async def propose_action(
        self,
        *,
        evaluation_id: str,
        tenant_id: str,
        execution_intent: ExecutionIntent | None = None,
        action_type: str | None = None,
        payload: dict[str, Any] | None = None,
        user_id: str = "system",
        idempotency_key: str | None = None,
        auto_execute: bool = True,
        runtime_context: dict[str, Any] | None = None,
    ) -> ActionExecution:
        if not self._settings.action_runtime_enabled:
            raise ValueError("Action runtime module is disabled")

        evaluation = await self._evaluation_loader.get_by_id(tenant_id=tenant_id, evaluation_id=evaluation_id)
        if evaluation is None:
            raise ValueError(f"Quality evaluation not found: {evaluation_id}")
        if evaluation.decision is None:
            raise ValueError(f"Quality evaluation has no decision: {evaluation_id}")

        execution = await self._execution_loader.get_by_id(tenant_id=tenant_id, execution_id=evaluation.execution_id)
        if execution is None:
            raise ValueError(f"Execution not found: {evaluation.execution_id}")

        resolved_type = self._resolve_action_type(execution_intent=execution_intent, action_type=action_type)
        runtime_type = ActionRuntimeType(resolved_type)
        self._registry.require(runtime_type)

        idem_key = idempotency_key or str(new_action_id())
        existing = await self._repository.get_by_idempotency_key(tenant_id=tenant_id, idempotency_key=idem_key)
        if existing and existing.status == ActionExecutionStatus.EXECUTED:
            return existing

        action_id = str(new_action_id())
        now = _utc_now()
        ctx = dict(runtime_context or {})
        ctx["action_id"] = action_id
        ctx["compensation_enabled"] = self._settings.compensation_enabled
        if execution_intent:
            ctx["execution_intent"] = execution_intent.model_dump(mode="json")
        if self._settings.require_approval or (execution_intent and execution_intent.approval_required):
            ctx["require_approval"] = True

        action = ActionExecution(
            action_id=action_id,
            execution_id=execution.execution_id,
            evaluation_id=evaluation.evaluation_id,
            route_id=execution.route_id,
            plan_id=execution.plan_id,
            request_id=execution.request_id,
            tenant_id=execution.tenant_id,
            company_id=execution.company_id or ctx.get("company_id", "default-company"),
            branch_id=execution.metadata.get("branch_id") or ctx.get("branch_id"),
            conversation_id=execution.conversation_id,
            correlation_id=execution.correlation_id,
            user_id=user_id,
            status=ActionExecutionStatus.PROPOSED,
            action_type=runtime_type,
            quality_decision=evaluation.decision.outcome.value,
            idempotency_key=idem_key,
            payload=dict(payload or execution.result.output_json if execution.result else {}),
            metadata={
                "shadow": self._settings.shadow_action_runtime,
                **({"execution_intent": execution_intent.model_dump(mode="json")} if execution_intent else {}),
            },
            created_at=now,
            updated_at=now,
        )

        should_execute = auto_execute and evaluation.decision.outcome.value in (
            QualityDecisionOutcome.PASS.value,
            QualityDecisionOutcome.PASS_WITH_WARNING.value,
        )

        pipeline_ctx = await self._pipeline.execute(
            action=action,
            execution=execution,
            evaluation=evaluation,
            action_type=runtime_type,
            execution_intent=execution_intent,
            runtime_context=ctx,
            execute=should_execute,
        )

        completed = self._apply_pipeline(action, pipeline_ctx, now)
        await self._repository.save(completed)
        await self._emit_events(completed, pipeline_ctx)
        await self._record_metrics(completed, pipeline_ctx)
        await self._record_lineage(completed, evaluation, pipeline_ctx)
        await self._audit_pipeline(completed, pipeline_ctx)
        return completed

    async def approve_action(
        self, *, tenant_id: str, action_id: str, approver_id: str = "manager"
    ) -> ActionExecution:
        action = await self._require_action(tenant_id, action_id)
        if action.status not in (ActionExecutionStatus.PENDING_APPROVAL, ActionExecutionStatus.PROPOSED):
            if action.status == ActionExecutionStatus.EXECUTED:
                return action
            raise ValueError(f"Action not pending approval: {action.status.value}")

        evaluation = await self._evaluation_loader.get_by_id(tenant_id=tenant_id, evaluation_id=action.evaluation_id)
        execution = await self._execution_loader.get_by_id(tenant_id=tenant_id, execution_id=action.execution_id)
        if evaluation is None or execution is None:
            raise ValueError("Missing evaluation or execution for approval")

        approvals = action.approvals
        for pending in approvals:
            if pending.status.value == "pending":
                approvals = await self._approval.approve(
                    action=action.model_copy(update={"approvals": approvals}),
                    approver_id=approver_id,
                    role=pending.role.value,
                )
        now = _utc_now()
        updated = action.model_copy(update={"approvals": approvals, "updated_at": now})

        if not await self._approval.all_approved(approvals):
            pending = updated.model_copy(update={"status": ActionExecutionStatus.PENDING_APPROVAL})
            await self._repository.save(pending)
            return pending

        ctx = dict(action.metadata.get("runtime_context", {}))
        ctx["pre_approved"] = True
        ctx["action_id"] = action_id
        ctx["compensation_enabled"] = self._settings.compensation_enabled

        pipeline_ctx = await self._pipeline.execute(
            action=updated.model_copy(update={"status": ActionExecutionStatus.APPROVED, "approved_at": now}),
            execution=execution,
            evaluation=evaluation,
            action_type=action.action_type,
            execution_intent=ExecutionIntent.from_dict(action.metadata.get("execution_intent")),
            runtime_context=ctx,
            execute=True,
        )
        completed = self._apply_pipeline(updated, pipeline_ctx, now)
        completed = completed.model_copy(update={"status": ActionExecutionStatus.APPROVED, "approved_at": now})
        await self._repository.save(completed)
        await self._emit(ActionApprovedEvent, completed, {"approver_id": approver_id})
        await self._emit_events(completed, pipeline_ctx)
        await self._record_metrics(completed, pipeline_ctx)
        await self._audit_mutation(completed, "action_runtime.action.approved", {"approver_id": approver_id})
        return completed

    async def reject_action(
        self, *, tenant_id: str, action_id: str, approver_id: str = "manager", reason: str = ""
    ) -> ActionExecution:
        action = await self._require_action(tenant_id, action_id)
        now = _utc_now()
        approvals = await self._approval.reject(action=action, approver_id=approver_id, reason=reason)
        rejected = action.model_copy(
            update={"status": ActionExecutionStatus.REJECTED, "approvals": approvals, "updated_at": now}
        )
        await self._repository.save(rejected)
        await self._emit(ActionRejectedEvent, rejected, {"reason": reason})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="rejected")
        await self._audit_mutation(rejected, "action_runtime.action.rejected", {"reason": reason})
        return rejected

    async def cancel_action(self, *, tenant_id: str, action_id: str, reason: str = "") -> ActionExecution:
        action = await self._require_action(tenant_id, action_id)
        if action.status in (ActionExecutionStatus.EXECUTED, ActionExecutionStatus.CANCELLED):
            return action
        now = _utc_now()
        cancelled = action.model_copy(
            update={"status": ActionExecutionStatus.CANCELLED, "updated_at": now, "cancelled_at": now}
        )
        await self._repository.save(cancelled)
        await self._emit(ActionCancelledEvent, cancelled, {"reason": reason})
        await self._repository.increment_metrics(tenant_id=tenant_id, metric="cancelled")
        await self._audit_mutation(cancelled, "action_runtime.action.cancelled", {"reason": reason})
        return cancelled

    async def get_read_model(self, *, tenant_id: str, action_id: str) -> ActionExecutionReadModel | None:
        action = await self._repository.get_by_id(tenant_id=tenant_id, action_id=action_id)
        return self._projector.project(action)

    def _apply_pipeline(self, action: ActionExecution, pipeline_ctx, now: datetime) -> ActionExecution:
        status = action.status
        if pipeline_ctx.blocked and pipeline_ctx.failure:
            status = ActionExecutionStatus.BLOCKED if pipeline_ctx.failure.kind.value == "quality_blocked" else ActionExecutionStatus.FAILED
        elif pipeline_ctx.idempotent_hit and pipeline_ctx.result:
            status = ActionExecutionStatus.EXECUTED
        elif pipeline_ctx.result and pipeline_ctx.result.success:
            status = ActionExecutionStatus.EXECUTED
        elif not pipeline_ctx.execute and pipeline_ctx.approvals:
            if any(a.status.value == "pending" for a in pipeline_ctx.approvals):
                status = ActionExecutionStatus.PENDING_APPROVAL
            else:
                status = ActionExecutionStatus.PROPOSED
        elif pipeline_ctx.proposal and not pipeline_ctx.execute:
            status = ActionExecutionStatus.PENDING_APPROVAL

        return action.model_copy(
            update={
                "status": status,
                "proposal": pipeline_ctx.proposal,
                "materialization": pipeline_ctx.materialization,
                "approvals": tuple(pipeline_ctx.approvals),
                "snapshot": pipeline_ctx.action_snapshot,
                "permission": pipeline_ctx.permission,
                "capability": pipeline_ctx.capability,
                "confirmation": pipeline_ctx.confirmation,
                "result": pipeline_ctx.result,
                "failure": pipeline_ctx.failure,
                "compensation": pipeline_ctx.compensation,
                "updated_at": now,
                "executed_at": now if status == ActionExecutionStatus.EXECUTED else action.executed_at,
            }
        )

    async def _require_action(self, tenant_id: str, action_id: str) -> ActionExecution:
        action = await self._repository.get_by_id(tenant_id=tenant_id, action_id=action_id)
        if action is None:
            raise ValueError(f"Action not found: {action_id}")
        return action

    async def _emit(self, event_cls, action: ActionExecution, payload: dict) -> None:
        event = build_action_event(
            event_cls,
            tenant_id=action.tenant_id,
            correlation_id=action.correlation_id,
            company_id=action.company_id,
            action_id=action.action_id,
            payload=payload,
        )
        await self._outbox.enqueue(DomainEventEnvelope(event=event))

    async def _emit_events(self, action: ActionExecution, pipeline_ctx) -> None:
        for event_name in pipeline_ctx.outbox_events:
            mapping = {
                "ActionProposed": ActionProposedEvent,
                "ActionValidated": ActionValidatedEvent,
                "ActionExecutionStarted": ActionExecutionStartedEvent,
                "ActionExecuted": ActionExecutedEvent,
                "ActionFailed": ActionFailedEvent,
                "ActionCompensated": ActionCompensatedEvent,
            }
            cls = mapping.get(event_name)
            if cls:
                await self._emit(cls, action, {"event": event_name})

    async def _record_metrics(self, action: ActionExecution, pipeline_ctx) -> None:
        await self._repository.increment_metrics(tenant_id=action.tenant_id, metric="proposed")
        if pipeline_ctx.idempotent_hit:
            await self._repository.increment_metrics(tenant_id=action.tenant_id, metric="idempotency_hit")
        if action.status == ActionExecutionStatus.EXECUTED:
            await self._repository.increment_metrics(tenant_id=action.tenant_id, metric="executed")
        elif action.status == ActionExecutionStatus.FAILED:
            await self._repository.increment_metrics(tenant_id=action.tenant_id, metric="failed")
        elif action.status == ActionExecutionStatus.BLOCKED:
            await self._repository.increment_metrics(tenant_id=action.tenant_id, metric="blocked")
        if action.compensation:
            await self._repository.increment_metrics(tenant_id=action.tenant_id, metric="compensated")

    async def _audit_mutation(self, action: ActionExecution, event_name: str, extra: dict | None = None) -> None:
        await self._audit.record(
            tenant_id=action.tenant_id,
            request_id=action.request_id,
            correlation_id=action.correlation_id,
            event_name=event_name,
            payload_redacted={"action_id": action.action_id, "action_type": action.action_type.value, **(extra or {})},
        )

    async def _audit_pipeline(self, action: ActionExecution, pipeline_ctx) -> None:
        for audit_event in pipeline_ctx.audit_events:
            await self._audit.record(
                tenant_id=action.tenant_id,
                request_id=action.request_id,
                correlation_id=action.correlation_id,
                event_name=f"action_runtime.pipeline.{audit_event.get('stage', 'unknown')}",
                payload_redacted=audit_event,
            )
        await self._audit_mutation(action, "action_runtime.action.completed", {"status": action.status.value})

    @staticmethod
    def _resolve_action_type(
        *,
        execution_intent: ExecutionIntent | None,
        action_type: str | None,
    ) -> str:
        if execution_intent is not None:
            if execution_intent.read_only or not execution_intent.mutating:
                raise ValueError(
                    f"Action runtime cannot execute read-only intent: {execution_intent.intent_type}"
                )
            resolved = execution_intent.action_type or execution_intent.intent_type
            if not resolved:
                raise ValueError("ExecutionIntent missing action_type")
            return resolved
        if action_type:
            return action_type
        raise ValueError("execution_intent or action_type is required")

    async def _record_lineage(self, action: ActionExecution, evaluation, pipeline_ctx) -> None:
        eval_node = await self._lineage.append_node(
            tenant_id=action.tenant_id,
            request_id=action.request_id,
            node_type="QualityDecision",
            payload={
                "evaluation_id": evaluation.evaluation_id,
                "decision": evaluation.decision.outcome.value if evaluation.decision else None,
            },
        )
        proposal_node = await self._lineage.append_node(
            tenant_id=action.tenant_id,
            request_id=action.request_id,
            node_type="ActionProposal",
            parent_node_id=eval_node.node_id,
            payload={"action_id": action.action_id, "action_type": action.action_type.value},
        )
        exec_node = await self._lineage.append_node(
            tenant_id=action.tenant_id,
            request_id=action.request_id,
            node_type="ActionExecution",
            parent_node_id=proposal_node.node_id,
            payload={"action_id": action.action_id, "status": action.status.value},
        )
        if action.confirmation:
            await self._lineage.append_node(
                tenant_id=action.tenant_id,
                request_id=action.request_id,
                node_type="ERPConfirmation",
                parent_node_id=exec_node.node_id,
                payload={"erp_reference": action.confirmation.erp_reference},
            )
