"""Validate ExecutionIntent propagated from Planner — registry-based, no switches."""

from __future__ import annotations

import uuid

from .....integration.contracts.execution_intent import ExecutionIntent, IntentOperation
from ...domain.value_objects import FindingSeverity, QualityLevel, QualityFinding, ViolationKind
from .context import QualityPipelineContext


def _utc_now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


class ExecutionIntentValidationStage:
    name = "execution_intent_validation"

    async def run(self, context: QualityPipelineContext) -> QualityPipelineContext:
        raw = context.validation_context.get("execution_intent")
        if not raw:
            context.audit_events.append({"stage": self.name, "present": False})
            return context

        intent = ExecutionIntent.from_dict(raw)
        if intent is None:
            context.blocked = True
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="intent.schema.invalid",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="INVALID_EXECUTION_INTENT",
                    message="ExecutionIntent payload is malformed",
                    violation_kind=ViolationKind.SCHEMA,
                    created_at=_utc_now_iso(),
                )
            )
            return context

        if intent.mutating == intent.read_only:
            context.blocked = True
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="intent.mutating.read_only",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="INTENT_MUTATING_READ_ONLY_CONFLICT",
                    message="ExecutionIntent mutating and read_only flags are inconsistent",
                    violation_kind=ViolationKind.SCHEMA,
                    created_at=_utc_now_iso(),
                )
            )
            return context

        if intent.mutating and not intent.erp_command_type:
            context.blocked = True
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="intent.mutating.command_required",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="INTENT_ERP_COMMAND_REQUIRED",
                    message="Mutating ExecutionIntent requires erp_command_type",
                    violation_kind=ViolationKind.SCHEMA,
                    created_at=_utc_now_iso(),
                )
            )
            return context

        if intent.mutating and not intent.action_type:
            context.blocked = True
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="intent.mutating.action_required",
                    level=QualityLevel.L0,
                    severity=FindingSeverity.CRITICAL,
                    code="INTENT_ACTION_TYPE_REQUIRED",
                    message="Mutating ExecutionIntent requires action_type",
                    violation_kind=ViolationKind.SCHEMA,
                    created_at=_utc_now_iso(),
                )
            )
            return context

        if intent.approval_required and intent.operation not in (
            IntentOperation.MUTATE,
            IntentOperation.APPROVE,
        ):
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="intent.approval.operation",
                    level=QualityLevel.L1,
                    severity=FindingSeverity.WARNING,
                    code="INTENT_APPROVAL_OPERATION_MISMATCH",
                    message="Approval required but operation is not mutate/approve",
                    violation_kind=ViolationKind.POLICY,
                    created_at=_utc_now_iso(),
                )
            )

        if intent.confidence < 0.3:
            context.add_finding(
                QualityFinding(
                    finding_id=str(uuid.uuid4()),
                    evaluation_id=context.evaluation_id,
                    rule_id="intent.confidence.low",
                    level=QualityLevel.L1,
                    severity=FindingSeverity.WARNING,
                    code="INTENT_LOW_CONFIDENCE",
                    message=f"ExecutionIntent confidence {intent.confidence:.2f} is below threshold",
                    violation_kind=ViolationKind.POLICY,
                    created_at=_utc_now_iso(),
                )
            )

        context.validation_context["execution_intent_validated"] = True
        context.audit_events.append(
            {
                "stage": self.name,
                "present": True,
                "intent_type": intent.intent_type,
                "mutating": intent.mutating,
                "erp_command_type": intent.erp_command_type,
            }
        )
        return context
