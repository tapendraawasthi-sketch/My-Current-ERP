"""Plan and tool call/observation contracts."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, default_schema_version
from .errors import ContractErrorCode, ContractValidationError
from .registry import get_contract_registry

# Registered tool schemas (name -> version -> JSON-ish shape flag). Mutation tools require non-empty.
_TOOL_SCHEMAS: dict[str, dict[str, dict[str, Any]]] = {
    "erp.read_balance": {"1.0.0": {"type": "object", "properties": {"account_id": {"type": "string"}}}},
    "erp.preview_draft": {
        "1.0.0": {
            "type": "object",
            "properties": {"draft_id": {"type": "string"}},
            "required": ["draft_id"],
        }
    },
    "erp.confirm_draft": {
        "1.0.0": {
            "type": "object",
            "properties": {"draft_id": {"type": "string"}, "preview_hash": {"type": "string"}},
            "required": ["draft_id"],
            "mutation": True,
        }
    },
}


def register_tool_schema(tool_name: str, version: str, schema: dict[str, Any]) -> None:
    _TOOL_SCHEMAS.setdefault(tool_name, {})[version] = schema


def get_tool_schema(tool_name: str, version: str) -> dict[str, Any] | None:
    return _TOOL_SCHEMAS.get(tool_name, {}).get(version)


class PlanStatus(str, Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class StepStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class ReadOrMutation(str, Enum):
    READ = "READ"
    MUTATION = "MUTATION"


class ToolOrigin(str, Enum):
    DETERMINISTIC = "DETERMINISTIC"
    PLANNER = "PLANNER"
    MODEL_PROPOSED = "MODEL_PROPOSED"


class ToolCallStatus(str, Enum):
    PROPOSED = "PROPOSED"
    AUTHORIZED = "AUTHORIZED"
    DENIED = "DENIED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PlanStepV1(ContractBase):
    step_id: str = Field(min_length=1)
    operation_class: str = Field(min_length=1)
    tool_name: str | None = None
    depends_on: tuple[str, ...] = ()
    expected_output_type: str = "unknown"
    read_or_mutation: ReadOrMutation = ReadOrMutation.READ
    status: StepStatus = StepStatus.PENDING


class PlanV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    plan_id: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    mode: str = "ask"
    ordered_steps: tuple[PlanStepV1, ...] = ()
    allowed_tools: tuple[str, ...] = ()
    prohibited_tools: tuple[str, ...] = ()
    required_evidence: tuple[str, ...] = ()
    stop_conditions: tuple[str, ...] = ()
    max_steps: int = Field(default=8, ge=1, le=64)
    planner_version: str = "none"
    status: PlanStatus = PlanStatus.DRAFT

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)


class ToolCallV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    tool_call_id: str = Field(min_length=1)
    tool_name: str = Field(min_length=1)
    tool_schema_version: str = Field(min_length=1)
    typed_arguments: dict[str, Any] = Field(default_factory=dict)
    tenant_scope_reference: str | None = None
    policy_decision_reference: str | None = None
    timeout_ms: int = Field(default=30000, ge=1, le=600_000)
    retry_policy: str = "none"
    read_or_mutation: ReadOrMutation = ReadOrMutation.READ
    origin: ToolOrigin = ToolOrigin.DETERMINISTIC
    status: ToolCallStatus = ToolCallStatus.PROPOSED
    # Must not look like an observation.
    success: None = None
    typed_result: None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @model_validator(mode="after")
    def _schema(self) -> ToolCallV1:
        schema = get_tool_schema(self.tool_name, self.tool_schema_version)
        if schema is None:
            raise ContractValidationError(
                ContractErrorCode.INVALID_TOOL_ARGUMENTS,
                f"unknown tool schema {self.tool_name}@{self.tool_schema_version}",
                field="tool_schema_version",
            )
        if self.read_or_mutation is ReadOrMutation.MUTATION:
            if not schema or schema.get("type") != "object":
                raise ContractValidationError(
                    ContractErrorCode.INVALID_TOOL_ARGUMENTS,
                    "empty mutation-tool schemas are invalid",
                    field="tool_name",
                )
            props = schema.get("properties") or {}
            if not props:
                raise ContractValidationError(
                    ContractErrorCode.INVALID_TOOL_ARGUMENTS,
                    "empty mutation-tool schemas are invalid",
                    field="typed_arguments",
                )
        if self.success is not None or self.typed_result is not None:
            raise ContractValidationError(
                ContractErrorCode.INVALID_TOOL_ARGUMENTS,
                "ToolCall cannot represent a successful observation",
            )
        return self


class ToolObservationV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    tool_call_id: str = Field(min_length=1)
    success: bool
    typed_result: dict[str, Any] = Field(default_factory=dict)
    source_references: tuple[str, ...] = ()
    snapshot_revision: str | None = None
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error_code: str | None = None
    safe_user_message: str | None = None
    tool_version: str = "1.0.0"
    status: Literal["observed", "failed"] = "observed"

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("observed_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("observed_at must be timezone-aware")
        return v

    @model_validator(mode="after")
    def _fail_msg(self) -> ToolObservationV1:
        if not self.success and not self.error_code:
            raise ValueError("failed observations require error_code")
        return self
