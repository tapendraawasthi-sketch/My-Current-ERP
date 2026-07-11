"""Orchestrator stage execution result."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ...domain.value_objects import RetryClassification, StageRunStatus


class StageResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    stage: str
    status: StageRunStatus
    snapshot: dict[str, Any] | None = None
    error: str = ""
    retry_classification: RetryClassification = RetryClassification.NON_RETRYABLE
    duration_ms: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
