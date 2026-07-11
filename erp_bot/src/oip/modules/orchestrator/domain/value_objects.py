"""Orchestrator domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExecutionMode(str, Enum):
    LEGACY = "legacy"
    SHADOW = "shadow"
    NATIVE = "native"


class WorkflowState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ROLLED_BACK = "rolled_back"
    ARCHIVED = "archived"


class WorkflowStageName(str, Enum):
    VALIDATION = "validation"
    CONVERSATION = "conversation"
    SESSION = "session"
    PLANNING = "planning"
    ROUTING = "routing"
    KNOWLEDGE = "knowledge"
    MEMORY_STORE = "memory_store"
    EXECUTION = "execution"
    MEMORY_UPDATE = "memory_update"
    QUALITY = "quality"
    ACTION = "action"
    MEMORY_CONSOLIDATION = "memory_consolidation"
    STREAMING = "streaming"
    FINALIZE = "finalize"
    PERSISTENCE = "persistence"
    PUBLICATION = "publication"


class StageRunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ROLLED_BACK = "rolled_back"


class RetryClassification(str, Enum):
    RETRYABLE = "retryable"
    NON_RETRYABLE = "non_retryable"


class RollbackPolicy(str, Enum):
    NONE = "none"
    CANCEL = "cancel"
    COMPENSATE = "compensate"
    CLOSE_STREAM = "close_stream"
    APPEND_FAILURE = "append_failure"


class RetryState(BaseModel):
    model_config = ConfigDict(frozen=True)

    attempt: int = 0
    max_retries: int = 3
    backoff_seconds: float = 1.0
    retry_window_seconds: float = 300.0
    last_attempt_at: str | None = None
    next_attempt_at: str | None = None
    classification: RetryClassification = RetryClassification.RETRYABLE


class RollbackState(BaseModel):
    model_config = ConfigDict(frozen=True)

    required: bool = False
    completed: bool = False
    stages_rolled_back: tuple[str, ...] = Field(default_factory=tuple)
    failure_reason: str = ""


class StageMetrics(BaseModel):
    model_config = ConfigDict(frozen=True)

    stage: str
    started_at: str
    completed_at: str | None = None
    duration_ms: int = 0
    status: StageRunStatus = StageRunStatus.PENDING
    retry_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkflowMetrics(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_duration_ms: int = 0
    stage_count: int = 0
    retry_count: int = 0
    rollback_count: int = 0
    stages: tuple[StageMetrics, ...] = Field(default_factory=tuple)
