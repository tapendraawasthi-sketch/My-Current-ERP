"""Action Runtime pipeline stages."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Protocol

from ....quality_gate.domain.value_objects import QualityDecisionOutcome
from ...domain.action_registry import ActionTypeRegistry
from ...domain.value_objects import (
    ActionExecutionStatus,
    ActionMaterialization,
    ActionPolicy,
    ActionProposal,
    ActionRuntimeType,
    FailureKind,
)
from ..ports.action_runtime_ports import (
    ActionCapabilityTokenPort,
    ActionPolicyPort,
    ApprovalPort,
    CompensationPort,
    ERPCommandPort,
    ERPQueryPort,
    PermissionPort,
    SnapshotPort,
)
from ..ports.action_repository_port import ActionRepositoryPort
from .context import ActionPipelineContext


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_erp_command_type(context: ActionPipelineContext, registry: ActionTypeRegistry) -> str:
    if context.execution_intent and context.execution_intent.erp_command_type:
        return context.execution_intent.erp_command_type
    return registry.require(context.action_type).erp_command_type.value


class ActionStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext: ...


class InputValidationStage:
    name = "input_validation"

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.execution.result is None:
            context.blocked = True
            context.execute = False
        if context.evaluation.decision is None:
            context.blocked = True
            context.execute = False
        context.audit_events.append({"stage": self.name, "valid": not context.blocked})
        return context


class QualityDecisionGateStage:
    name = "quality_decision_gate"

    _ALLOWED = frozenset(
        {
            QualityDecisionOutcome.PASS.value,
            QualityDecisionOutcome.PASS_WITH_WARNING.value,
        }
    )

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked:
            return context
        decision = context.evaluation.decision.outcome.value if context.evaluation.decision else ""
        if decision not in self._ALLOWED:
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.QUALITY_BLOCKED,
                message=f"Quality decision '{decision}' does not permit ERP mutation",
                recoverable=False,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
        else:
            context.outbox_events.append("ActionValidated")
        return context


class ProposalStage:
    name = "proposal"

    def __init__(self, registry: ActionTypeRegistry) -> None:
        self._registry = registry

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked:
            return context
        definition = self._registry.require(context.action_type)
        erp_command_type = _resolve_erp_command_type(context, self._registry)
        proposal = ActionProposal(
            proposal_id=str(uuid.uuid4()),
            action_id=context.action.action_id,
            execution_id=context.execution.execution_id,
            evaluation_id=context.evaluation.evaluation_id,
            tenant_id=context.action.tenant_id,
            action_type=context.action_type,
            payload=dict(context.action.payload),
            idempotency_key=context.action.idempotency_key,
            proposed_at=_utc_now_iso(),
            quality_decision=context.evaluation.decision.outcome.value if context.evaluation.decision else "",
            metadata={"erp_command_type": erp_command_type},
        )
        context.proposal = proposal
        context.outbox_events.append("ActionProposed")
        return context


class PolicyValidationStage:
    name = "policy_validation"

    def __init__(self, policy_port: ActionPolicyPort, registry: ActionTypeRegistry) -> None:
        self._policy = policy_port
        self._registry = registry

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked:
            return context
        policy = await self._policy.resolve_policy(
            tenant_id=context.action.tenant_id,
            action_type=context.action_type,
            payload=context.action.payload,
        )
        context.policy = policy
        valid, reason = await self._policy.validate(
            policy=policy,
            action_type=context.action_type,
            payload=context.action.payload,
            context=context.runtime_context,
        )
        if not valid:
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.POLICY_DENIED,
                message=reason,
                recoverable=False,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
        return context


class ApprovalStage:
    name = "approval"

    def __init__(self, approval_port: ApprovalPort, registry: ActionTypeRegistry) -> None:
        self._approval = approval_port
        self._registry = registry

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked:
            return context
        definition = self._registry.require(context.action_type)
        require = (
            context.runtime_context.get("require_approval")
            or (context.policy.require_approval if context.policy else False)
            or definition.requires_approval
        )
        context.approvals = list(
            await self._approval.determine_approvals(
                action=context.action,
                policy=context.policy or ActionPolicy(policy_id="default", name="default"),
                require_approval=bool(require),
            )
        )
        if require and not context.runtime_context.get("pre_approved"):
            context.execute = False
        return context


class SnapshotValidationStage:
    name = "snapshot_validation"

    def __init__(self, snapshot_port: SnapshotPort) -> None:
        self._snapshot = snapshot_port

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or not context.execute:
            return context
        ttl = int(context.runtime_context.get("snapshot_ttl_seconds", 300))
        erp_snapshot = await self._snapshot.capture(
            tenant_id=context.action.tenant_id,
            company_id=context.action.company_id,
            branch_id=context.action.branch_id,
            user_id=context.action.user_id,
            ttl_seconds=ttl,
        )
        context.erp_snapshot = erp_snapshot
        valid, reason = await self._snapshot.validate_snapshot(
            snapshot=erp_snapshot,
            context=context.runtime_context,
        )
        if not valid:
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.SNAPSHOT_STALE,
                message=reason,
                recoverable=True,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
        else:
            from ...domain.value_objects import ActionSnapshot

            context.action_snapshot = ActionSnapshot(
                action_snapshot_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                erp_snapshot=erp_snapshot,
                validated_at=_utc_now_iso(),
            )
        return context


class ERPGuardStage:
    name = "erp_guard"

    def __init__(self, erp_query: ERPQueryPort) -> None:
        self._erp_query = erp_query

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or not context.execute:
            return context
        ctx = context.runtime_context
        if ctx.get("fiscal_period_closed"):
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.FISCAL_LOCKED,
                message="Fiscal period is closed",
                recoverable=False,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
            return context
        period = await self._erp_query.is_period_open(
            tenant_id=context.action.tenant_id,
            company_id=context.action.company_id,
            branch_id=context.action.branch_id,
            fiscal_period_id=ctx.get("fiscal_period_id"),
        )
        if not period.is_open or ctx.get("force_fiscal_closed"):
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.FISCAL_LOCKED,
                message=period.reason or "Fiscal period is not open",
                recoverable=False,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
            return context
        if ctx.get("inventory_locked"):
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.INVENTORY_LOCKED,
                message="Inventory is locked for this operation",
                recoverable=True,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
        return context


class PermissionCapabilityStage:
    name = "permission_capability"

    def __init__(
        self,
        permission_port: PermissionPort,
        capability_port: ActionCapabilityTokenPort,
    ) -> None:
        self._permission = permission_port
        self._capability = capability_port

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or not context.execute:
            return context
        context.permission = await self._permission.check_permission(
            tenant_id=context.action.tenant_id,
            user_id=context.action.user_id,
            action_type=context.action_type,
            company_id=context.action.company_id,
            branch_id=context.action.branch_id,
            context=context.runtime_context,
        )
        if not context.permission.allowed:
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.PERMISSION_DENIED,
                message=context.permission.reason or "Permission denied",
                recoverable=False,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
            return context
        token_id = context.runtime_context.get("capability_token_id")
        context.capability = await self._capability.validate_capability(
            tenant_id=context.action.tenant_id,
            action_id=context.action.action_id,
            token_id=token_id,
            action_type=context.action_type,
            context=context.runtime_context,
        )
        if not context.capability.valid:
            context.blocked = True
            context.execute = False
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.CAPABILITY_INVALID,
                message="Capability token invalid or missing",
                recoverable=False,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
        return context


class IdempotencyStage:
    name = "idempotency"

    def __init__(self, repository: ActionRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or not context.execute:
            return context
        existing = await self._repository.get_by_idempotency_key(
            tenant_id=context.action.tenant_id,
            idempotency_key=context.action.idempotency_key,
        )
        if existing and existing.action_id != context.action.action_id:
            if existing.status == ActionExecutionStatus.EXECUTED:
                context.idempotent_hit = True
                context.execute = False
                from ...domain.value_objects import ActionResult

                context.result = existing.result or ActionResult(
                    result_id=str(uuid.uuid4()),
                    action_id=existing.action_id,
                    success=True,
                    erp_reference=existing.confirmation.erp_reference if existing.confirmation else None,
                    output={"idempotent": True},
                )
                context.confirmation = existing.confirmation
            else:
                context.blocked = True
                context.execute = False
                from ...domain.value_objects import ActionFailure

                context.failure = ActionFailure(
                    failure_id=str(uuid.uuid4()),
                    action_id=context.action.action_id,
                    kind=FailureKind.IDEMPOTENCY_CONFLICT,
                    message="Duplicate idempotency key with non-terminal action",
                    recoverable=False,
                    occurred_at=_utc_now_iso(),
                )
        return context


class MaterializationStage:
    name = "materialization"

    def __init__(self, registry: ActionTypeRegistry) -> None:
        self._registry = registry

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or not context.execute or context.idempotent_hit:
            return context
        erp_command_type = _resolve_erp_command_type(context, self._registry)
        context.materialization = ActionMaterialization(
            materialization_id=str(uuid.uuid4()),
            action_id=context.action.action_id,
            execution_id=context.execution.execution_id,
            evaluation_id=context.evaluation.evaluation_id,
            action_type=context.action_type,
            erp_command_type=erp_command_type,
            payload=dict(context.action.payload),
            materialized_at=_utc_now_iso(),
        )
        return context


class ExecuteStage:
    name = "execute"

    def __init__(self, erp_command: ERPCommandPort, registry: ActionTypeRegistry) -> None:
        self._erp_command = erp_command
        self._registry = registry

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or not context.execute or context.idempotent_hit:
            return context
        if context.materialization is None:
            return context
        from .....integration.contracts.erp_commands import ErpCommandEnvelope, ErpCommandType

        command_type = ErpCommandType(context.materialization.erp_command_type)
        command_payload = dict(context.action.payload)
        if context.execution_intent:
            command_payload["execution_intent"] = context.execution_intent.model_dump(mode="json")
        envelope = ErpCommandEnvelope(
            command_id=str(uuid.uuid4()),
            command_type=command_type,
            tenant_id=context.action.tenant_id,
            company_id=context.action.company_id,
            branch_id=context.action.branch_id,
            idempotency_key=context.action.idempotency_key,
            payload=command_payload,
        )
        context.outbox_events.append("ActionExecutionStarted")
        try:
            if context.runtime_context.get("force_erp_failure"):
                raise RuntimeError("ERP command failed")
            context.erp_response = await self._erp_command.dispatch(envelope)
        except Exception as exc:
            context.blocked = True
            from ...domain.value_objects import ActionFailure

            context.failure = ActionFailure(
                failure_id=str(uuid.uuid4()),
                action_id=context.action.action_id,
                kind=FailureKind.ERP_COMMAND_FAILED,
                message=str(exc),
                recoverable=True,
                occurred_at=_utc_now_iso(),
            )
            context.outbox_events.append("ActionFailed")
            return context
        return context


class ConfirmationStage:
    name = "confirmation"

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if context.blocked or context.idempotent_hit:
            return context
        if not context.execute or not context.erp_response:
            return context
        from ...domain.value_objects import ActionConfirmation, ActionResult

        erp_ref = context.erp_response.get("erp_reference") or context.erp_response.get("command_id", "")
        context.confirmation = ActionConfirmation(
            confirmation_id=str(uuid.uuid4()),
            action_id=context.action.action_id,
            erp_reference=str(erp_ref),
            erp_command_id=str(context.erp_response.get("command_id", "")),
            confirmed_at=_utc_now_iso(),
            payload=dict(context.erp_response),
        )
        context.result = ActionResult(
            result_id=str(uuid.uuid4()),
            action_id=context.action.action_id,
            success=True,
            erp_reference=str(erp_ref),
            output=dict(context.erp_response),
        )
        context.outbox_events.append("ActionExecuted")
        return context


class CompensationStage:
    name = "compensation"

    def __init__(self, compensation_port: CompensationPort, erp_command: ERPCommandPort) -> None:
        self._compensation = compensation_port
        self._erp_command = erp_command

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        if not context.failure or context.idempotent_hit:
            return context
        if not context.runtime_context.get("compensation_enabled", True):
            return context
        if context.result and context.result.success:
            return context
        compensation = await self._compensation.create_reversal(
            action=context.action,
            reason=context.failure.message,
        )
        if context.result and context.result.success:
            await self._compensation.dispatch_reversal(
                compensation=compensation,
                original_action=context.action,
                erp_command_port=self._erp_command,
            )
            context.compensation = compensation
            context.outbox_events.append("ActionCompensated")
        elif context.failure.kind == FailureKind.ERP_COMMAND_FAILED and context.runtime_context.get("compensate_on_failure"):
            response = await self._compensation.dispatch_reversal(
                compensation=compensation,
                original_action=context.action,
                erp_command_port=self._erp_command,
            )
            context.compensation = compensation.model_copy(
                update={"erp_reference": response.get("erp_reference")}
            )
            context.outbox_events.append("ActionCompensated")
        return context


class AuditStage:
    name = "audit"

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        payload = {
            "action_id": context.action.action_id,
            "blocked": context.blocked,
            "executed": bool(context.result and context.result.success),
            "idempotent_hit": context.idempotent_hit,
        }
        digest = hashlib.sha256(repr(payload).encode()).hexdigest()
        context.audit_events.append({"stage": self.name, "audit_hash": digest, **payload})
        return context


class LineageStage:
    name = "lineage"

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        context.audit_events.append(
            {
                "stage": self.name,
                "execution_id": context.execution.execution_id,
                "evaluation_id": context.evaluation.evaluation_id,
                "action_id": context.action.action_id,
            }
        )
        return context


class OutboxStage:
    name = "outbox"

    async def run(self, context: ActionPipelineContext) -> ActionPipelineContext:
        context.audit_events.append({"stage": self.name, "events": list(context.outbox_events)})
        return context
