"""OIP API contracts — IntelligenceRequest / IntelligenceResponse (Constitution)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ...domain.value_objects import ActionPayload, TokenUsage


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IntelligenceRequestDto(BaseModel):
    """Standard intelligence request — ERP never references providers."""

    model_config = ConfigDict(frozen=True)

    request_id: str
    correlation_id: str
    idempotency_key: str = ""
    tenant_id: str
    company_id: str | None = None
    branch_id: str | None = None
    user_id: str
    session_id: str
    conversation_id: str
    module: str
    language: str | None = None
    question: str
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    received_at: datetime = Field(default_factory=utc_now)


class IntelligenceResponseDto(BaseModel):
    """Standard intelligence response — never a plain string."""

    model_config = ConfigDict(frozen=True)

    request_id: str
    correlation_id: str
    actions: tuple[ActionPayload, ...] = Field(default_factory=tuple)
    metadata: dict[str, Any] = Field(default_factory=dict)
    provider: str | None = None
    model: str | None = None
    latency_ms: int = 0
    token_usage: TokenUsage = Field(default_factory=TokenUsage)
    completed_at: datetime = Field(default_factory=utc_now)
