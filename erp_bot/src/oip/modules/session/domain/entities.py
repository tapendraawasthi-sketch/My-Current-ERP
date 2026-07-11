"""Session domain entity."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import SessionStatus


class IntelligenceSession(BaseModel):
    model_config = ConfigDict(frozen=True)

    session_id: str
    tenant_id: str
    user_id: str
    company_id: str | None = None
    branch_id: str | None = None
    module: str
    conversation_id: str | None = None
    status: SessionStatus = SessionStatus.OPEN
    erp_context: dict[str, Any] = Field(default_factory=dict)
    opened_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
