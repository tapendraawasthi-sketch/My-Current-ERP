"""Action Runtime pipeline context."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .....integration.contracts.execution_intent import ExecutionIntent
from ....quality_gate.domain.entities import QualityEvaluation
from ....provider_runtime.domain.entities import ExecutionAggregate
from ...domain.entities import ActionExecution
from ...domain.value_objects import (
    ActionApproval,
    ActionCapability,
    ActionCompensation,
    ActionConfirmation,
    ActionExecutionBudget,
    ActionFailure,
    ActionMaterialization,
    ActionPermission,
    ActionPolicy,
    ActionProposal,
    ActionResult,
    ActionRuntimeType,
    ActionSnapshot,
    ErpContextSnapshot,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ActionPipelineContext:
    action: ActionExecution
    execution: ExecutionAggregate
    evaluation: QualityEvaluation
    action_type: ActionRuntimeType
    execution_intent: ExecutionIntent | None = None
    runtime_context: dict[str, Any] = field(default_factory=dict)
    policy: ActionPolicy | None = None
    proposal: ActionProposal | None = None
    materialization: ActionMaterialization | None = None
    approvals: list[ActionApproval] = field(default_factory=list)
    erp_snapshot: ErpContextSnapshot | None = None
    action_snapshot: ActionSnapshot | None = None
    permission: ActionPermission | None = None
    capability: ActionCapability | None = None
    budget: ActionExecutionBudget | None = None
    confirmation: ActionConfirmation | None = None
    result: ActionResult | None = None
    failure: ActionFailure | None = None
    compensation: ActionCompensation | None = None
    erp_response: dict[str, Any] = field(default_factory=dict)
    blocked: bool = False
    execute: bool = True
    idempotent_hit: bool = False
    audit_events: list[dict[str, Any]] = field(default_factory=list)
    outbox_events: list[str] = field(default_factory=list)
