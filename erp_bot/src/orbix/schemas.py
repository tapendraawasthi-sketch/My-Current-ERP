"""Typed contracts for Orbix v2 — requests, responses, evidence, tools, memory.

Every factual claim the agent makes must trace back to an EvidenceRef gathered
this session. These schemas make that discipline enforceable end to end.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

SourceType = Literal["code", "ledger", "memory", "web", "generated", "navigation"]
OrbixMode = Literal["auto", "erp_qa", "khata", "code", "report"]


class EvidenceRef(BaseModel):
    """A single grounded piece of evidence the agent observed via a tool."""

    id: str
    source_type: SourceType
    uri: str
    title: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    content_hash: str | None = None
    snippet: str | None = None


class ToolCallRecord(BaseModel):
    """Audit record of one tool execution during the reasoning loop."""

    name: str
    args: dict[str, Any] = Field(default_factory=dict)
    ok: bool = True
    evidence_ids: list[str] = Field(default_factory=list)
    summary: str | None = None
    error: str | None = None


class ToolResult(BaseModel):
    """Return value of a tool handler."""

    ok: bool = True
    summary: str = ""
    evidence: list[EvidenceRef] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None

    def to_record(self, name: str, args: dict[str, Any]) -> ToolCallRecord:
        return ToolCallRecord(
            name=name,
            args=args,
            ok=self.ok,
            evidence_ids=[e.id for e in self.evidence],
            summary=self.summary or None,
            error=self.error,
        )


class OrbixChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(..., min_length=1)
    user_id: str | None = None
    company_id: str | None = None
    current_route: str | None = None
    screen_title: str | None = None
    mode: OrbixMode = "auto"
    # Confirmation handshake for mutations: frontend echoes this back when the
    # user approves a proposed voucher.
    confirm_token: str | None = None
    confirmation_payload: dict[str, Any] | None = None


class OrbixChatResponse(BaseModel):
    answer: str
    intent: str = "general"
    confidence: float = 0.0
    evidence: list[EvidenceRef] = Field(default_factory=list)
    tool_trace: list[ToolCallRecord] = Field(default_factory=list)
    needs_confirmation: bool = False
    confirmation_payload: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)
    session_id: str = ""
    engine: str = "orbix"
    # Optional backward-compatible enrichment (Nepali KB interpretation metadata).
    # Absent/None preserves existing frontend contracts.
    metadata: dict[str, Any] | None = None


class PlanStep(BaseModel):
    id: str
    goal: str
    tool: str | None = None
    args: dict[str, Any] = Field(default_factory=dict)


class Plan(BaseModel):
    intent: str = "general"
    needs_tools: bool = True
    steps: list[PlanStep] = Field(default_factory=list)
    stop_when: str = ""


class AgentAction(BaseModel):
    """One decision the agent makes each loop iteration."""

    type: Literal["tool_call", "final_answer", "ask_clarification"] = "final_answer"
    thought: str | None = None
    tool_name: str | None = None
    args: dict[str, Any] = Field(default_factory=dict)
    answer: str | None = None
    question: str | None = None
    reason: str | None = None


class VerificationResult(BaseModel):
    passed: bool = True
    score: float = 0.0
    unsupported_claims: list[str] = Field(default_factory=list)
    math_errors: list[str] = Field(default_factory=list)
    citation_errors: list[str] = Field(default_factory=list)
    required_fix: str | None = None
    warnings: list[str] = Field(default_factory=list)
