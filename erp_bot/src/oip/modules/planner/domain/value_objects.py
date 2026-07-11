"""Planner domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExecutionMode(str, Enum):
    INTERACTIVE = "interactive"
    BATCH = "batch"
    STREAMING = "streaming"
    OFFLINE = "offline"


class ExecutionPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class PlanStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class ExecutionStepType(str, Enum):
    REASON = "reason"
    RETRIEVE = "retrieve"
    TOOL = "tool"
    PROVIDER = "provider"
    QUALITY_GATE = "quality_gate"
    MATERIALIZE_ACTION = "materialize_action"
    STREAM = "stream"
    COMPLETE = "complete"


class PlanningPolicyName(str, Enum):
    FAST = "fast"
    BALANCED = "balanced"
    ACCURATE = "accurate"
    ACCOUNTING = "accounting"
    GOVERNMENT = "government"
    OFFLINE = "offline"
    LOW_COST = "low_cost"


class TaskProfile(BaseModel):
    model_config = ConfigDict(frozen=True)

    intent: str
    module: str
    complexity: str = "medium"
    requires_tools: bool = False
    requires_knowledge: bool = False
    requires_memory: bool = False
    requires_erp_snapshot: bool = True
    confidence: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)


class ContextBudget(BaseModel):
    model_config = ConfigDict(frozen=True)

    erp_snapshot_tokens: int = 0
    knowledge_tokens: int = 0
    conversation_tokens: int = 0
    memory_tokens: int = 0
    attachment_tokens: int = 0
    user_input_tokens: int = 0
    total_tokens: int = 0
    allocations: dict[str, int] = Field(default_factory=dict)


class PlanningPolicy(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: PlanningPolicyName
    execution_mode: ExecutionMode = ExecutionMode.INTERACTIVE
    priority: ExecutionPriority = ExecutionPriority.NORMAL
    max_latency_ms: int = 30_000
    max_tokens: int = 8192
    max_cost_micros: int = 0
    offline_only: bool = False
    quality_gate_required: bool = True
    stream_enabled: bool = False


class ToolRequirement(BaseModel):
    model_config = ConfigDict(frozen=True)

    tool_id: str
    purpose: str
    required: bool = True
    constraints: dict[str, Any] = Field(default_factory=dict)


class SkillRequirement(BaseModel):
    model_config = ConfigDict(frozen=True)

    skill_id: str
    purpose: str
    required: bool = True


class FallbackPolicy(BaseModel):
    model_config = ConfigDict(frozen=True)

    on_provider_failure: str = "retry_then_degrade"
    on_tool_failure: str = "skip_or_clarify"
    on_quality_failure: str = "block_and_clarify"
    max_retries: int = 2
    degrade_to_policy: PlanningPolicyName = PlanningPolicyName.FAST
