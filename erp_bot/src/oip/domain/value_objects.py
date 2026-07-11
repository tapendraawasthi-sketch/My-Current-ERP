"""Domain value objects — immutable, validation at construction."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ActionType(str, Enum):
    ANSWER = "answer"
    RECOMMENDATION = "recommendation"
    JOURNAL_ENTRY = "journal_entry"
    WORKFLOW = "workflow"
    APPROVAL_REQUEST = "approval_request"
    AUTOMATION = "automation"
    NOTIFICATION = "notification"
    REPORT = "report"
    CALCULATION = "calculation"
    API_CALL = "api_call"
    TOOL_INVOCATION = "tool_invocation"
    CLARIFICATION = "clarification"
    ERROR = "error"


class IntelligenceModule(str, Enum):
    ORBIX = "orbix"
    KHATA = "khata"
    NIOS = "nios"
    FALCON = "falcon"
    REPORTS = "reports"
    OCR = "ocr"


class DataClassification(str, Enum):
    C0_PUBLIC = "c0_public"
    C1_INTERNAL = "c1_internal"
    C2_CONFIDENTIAL = "c2_confidential"
    C3_RESTRICTED = "c3_restricted"


class Principal(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: str
    tenant_id: str
    company_id: str | None = None
    branch_id: str | None = None
    roles: tuple[str, ...] = Field(default_factory=tuple)
    edition: str = "cloud"


class TokenUsage(BaseModel):
    model_config = ConfigDict(frozen=True)

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class ActionPayload(BaseModel):
    model_config = ConfigDict(frozen=True)

    action_type: ActionType
    body: dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.0
    requires_confirmation: bool = False
    evidence_refs: tuple[str, ...] = Field(default_factory=tuple)
