"""ExecutionIntent — canonical execution contract across OIP runtimes."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class IntentDomain(str, Enum):
    ACCOUNTING = "Accounting"
    INVENTORY = "Inventory"
    PAYROLL = "Payroll"
    TAX = "Tax"
    REPORTING = "Reporting"
    CRM = "CRM"
    WORKFLOW = "Workflow"
    GENERAL = "General"


class IntentOperation(str, Enum):
    MUTATE = "mutate"
    QUERY = "query"
    APPROVE = "approve"
    EDUCATE = "educate"
    ANALYZE = "analyze"


class IntentRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ExecutionIntent(BaseModel):
    """Immutable execution intent propagated Planner → Quality → Action → OEC."""

    model_config = ConfigDict(frozen=True)

    intent_type: str
    domain: IntentDomain
    operation: IntentOperation
    risk_level: IntentRiskLevel
    mutating: bool
    read_only: bool
    approval_required: bool
    erp_command_type: str | None = None
    action_type: str | None = None
    required_capabilities: tuple[str, ...] = Field(default_factory=tuple)
    required_permissions: tuple[str, ...] = Field(default_factory=tuple)
    confidence: float = 0.5
    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> ExecutionIntent | None:
        if not data:
            return None
        return cls.model_validate(data)
