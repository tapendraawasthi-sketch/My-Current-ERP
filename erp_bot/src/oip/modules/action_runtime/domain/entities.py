"""Action Runtime domain aggregates."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import (
    ActionApproval,
    ActionCapability,
    ActionCompensation,
    ActionConfirmation,
    ActionEvidence,
    ActionExecutionBudget,
    ActionExecutionStatus,
    ActionFailure,
    ActionMaterialization,
    ActionPermission,
    ActionProposal,
    ActionResult,
    ActionRisk,
    ActionRuntimeType,
    ActionSnapshot,
)


class ActionExecution(BaseModel):
    """Root action execution aggregate — immutable via model_copy."""

    model_config = ConfigDict(frozen=True)

    action_id: str
    execution_id: str
    evaluation_id: str
    route_id: str
    plan_id: str
    request_id: str
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    conversation_id: str | None = None
    correlation_id: str
    user_id: str = "system"
    status: ActionExecutionStatus
    action_type: ActionRuntimeType
    quality_decision: str
    idempotency_key: str
    proposal: ActionProposal | None = None
    materialization: ActionMaterialization | None = None
    approvals: tuple[ActionApproval, ...] = Field(default_factory=tuple)
    snapshot: ActionSnapshot | None = None
    evidence: tuple[ActionEvidence, ...] = Field(default_factory=tuple)
    permission: ActionPermission | None = None
    capability: ActionCapability | None = None
    budget: ActionExecutionBudget | None = None
    risk: ActionRisk | None = None
    confirmation: ActionConfirmation | None = None
    result: ActionResult | None = None
    failure: ActionFailure | None = None
    compensation: ActionCompensation | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    executed_at: datetime | None = None
    cancelled_at: datetime | None = None
    archived_at: datetime | None = None
