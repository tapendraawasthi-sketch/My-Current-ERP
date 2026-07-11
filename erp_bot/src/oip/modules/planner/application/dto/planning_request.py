"""Planning request DTO."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ...domain.value_objects import PlanningPolicyName


class PlanningRequestDto(BaseModel):
    model_config = ConfigDict(frozen=True)

    request_id: str
    correlation_id: str
    tenant_id: str
    company_id: str | None = None
    branch_id: str | None = None
    user_id: str
    session_id: str
    conversation_id: str | None = None
    module: str
    language: str | None = None
    message: str
    policy_name: PlanningPolicyName = PlanningPolicyName.BALANCED
    attachments: tuple[dict[str, Any], ...] = Field(default_factory=tuple)
    metadata: dict[str, Any] = Field(default_factory=dict)
