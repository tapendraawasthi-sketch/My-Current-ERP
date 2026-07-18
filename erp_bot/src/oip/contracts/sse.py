"""SSE event envelope contracts."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, default_schema_version
from .errors import ContractErrorCode, ContractValidationError
from .registry import get_contract_registry
from .response import AIResponseEnvelopeV1


class SSEEventTypeV1(str, Enum):
    REQUEST_ACCEPTED = "REQUEST_ACCEPTED"
    CONTEXT_READY = "CONTEXT_READY"
    UNDERSTANDING_STATUS = "UNDERSTANDING_STATUS"
    ROUTE = "ROUTE"
    TOOL_STARTED = "TOOL_STARTED"
    TOOL_COMPLETED = "TOOL_COMPLETED"
    ANSWER_DELTA = "ANSWER_DELTA"
    STRUCTURED_RESPONSE = "STRUCTURED_RESPONSE"
    CLARIFICATION = "CLARIFICATION"
    DRAFT_READY = "DRAFT_READY"
    PREVIEW_READY = "PREVIEW_READY"
    ACTION_STATUS = "ACTION_STATUS"
    RECEIPT = "RECEIPT"
    CONFLICT = "CONFLICT"
    COMPLETE = "COMPLETE"
    ERROR = "ERROR"


class SSEPayloadBase(ContractBase):
    pass


class RequestAcceptedPayload(SSEPayloadBase):
    payload_type: Literal["REQUEST_ACCEPTED"] = "REQUEST_ACCEPTED"
    accepted: bool = True


class ContextReadyPayload(SSEPayloadBase):
    payload_type: Literal["CONTEXT_READY"] = "CONTEXT_READY"
    context_keys: tuple[str, ...] = ()


class UnderstandingStatusPayload(SSEPayloadBase):
    payload_type: Literal["UNDERSTANDING_STATUS"] = "UNDERSTANDING_STATUS"
    status: str = "pending"
    safe_label: str = ""


class RoutePayload(SSEPayloadBase):
    payload_type: Literal["ROUTE"] = "ROUTE"
    route: dict[str, Any] = Field(default_factory=dict)


class ToolStartedPayload(SSEPayloadBase):
    payload_type: Literal["TOOL_STARTED"] = "TOOL_STARTED"
    tool_name: str
    tool_call_id: str


class ToolCompletedPayload(SSEPayloadBase):
    payload_type: Literal["TOOL_COMPLETED"] = "TOOL_COMPLETED"
    tool_call_id: str
    success: bool
    safe_summary: str = ""


class AnswerDeltaPayload(SSEPayloadBase):
    payload_type: Literal["ANSWER_DELTA"] = "ANSWER_DELTA"
    text: str = ""

    @model_validator(mode="before")
    @classmethod
    def _text_only(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in ("execution_allowed", "receipt", "preview", "draft_id"):
                if key in data and data[key] is not None:
                    raise ContractValidationError(
                        ContractErrorCode.EXECUTION_AUTHORITY_FORBIDDEN,
                        "ANSWER_DELTA cannot carry execution fields",
                        field=key,
                    )
        return data


class StructuredResponsePayload(SSEPayloadBase):
    payload_type: Literal["STRUCTURED_RESPONSE"] = "STRUCTURED_RESPONSE"
    envelope: AIResponseEnvelopeV1


class ClarificationEventPayload(SSEPayloadBase):
    payload_type: Literal["CLARIFICATION"] = "CLARIFICATION"
    missing_fields: tuple[str, ...] = ()
    questions: tuple[str, ...] = ()


class DraftReadyPayload(SSEPayloadBase):
    payload_type: Literal["DRAFT_READY"] = "DRAFT_READY"
    draft_id: str


class PreviewReadyPayload(SSEPayloadBase):
    payload_type: Literal["PREVIEW_READY"] = "PREVIEW_READY"
    preview_id: str
    preview_hash: str


class ActionStatusPayload(SSEPayloadBase):
    payload_type: Literal["ACTION_STATUS"] = "ACTION_STATUS"
    stage: str
    label: str = ""


class ReceiptEventPayload(SSEPayloadBase):
    payload_type: Literal["RECEIPT"] = "RECEIPT"
    receipt_id: str
    status: str


class ConflictEventPayload(SSEPayloadBase):
    payload_type: Literal["CONFLICT"] = "CONFLICT"
    conflict_code: str
    safe_message: str


class CompletePayload(SSEPayloadBase):
    payload_type: Literal["COMPLETE"] = "COMPLETE"
    response: AIResponseEnvelopeV1


class ErrorEventPayload(SSEPayloadBase):
    payload_type: Literal["ERROR"] = "ERROR"
    error_code: str
    safe_message: str
    stack_trace: None = None

    @model_validator(mode="before")
    @classmethod
    def _safe(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("stack_trace"):
            raise ContractValidationError(
                ContractErrorCode.INVALID_RESPONSE_PAYLOAD,
                "safe ERROR excludes stack traces",
                field="stack_trace",
            )
        return data


SSEPayloadV1 = Annotated[
    Union[
        RequestAcceptedPayload,
        ContextReadyPayload,
        UnderstandingStatusPayload,
        RoutePayload,
        ToolStartedPayload,
        ToolCompletedPayload,
        AnswerDeltaPayload,
        StructuredResponsePayload,
        ClarificationEventPayload,
        DraftReadyPayload,
        PreviewReadyPayload,
        ActionStatusPayload,
        ReceiptEventPayload,
        ConflictEventPayload,
        CompletePayload,
        ErrorEventPayload,
    ],
    Field(discriminator="payload_type"),
]


class SSEEventEnvelopeV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    event_id: str = Field(min_length=1)
    request_id: str = Field(min_length=1)
    conversation_id: str = Field(min_length=1)
    sequence_number: int = Field(ge=0)
    event_type: SSEEventTypeV1
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: SSEPayloadV1

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("timestamp")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("timestamp must be timezone-aware")
        return v

    @model_validator(mode="before")
    @classmethod
    def _no_think(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in ("chain_of_thought", "thinking", "raw_tool_secrets"):
                if data.get(key):
                    raise ContractValidationError(
                        ContractErrorCode.INVALID_RESPONSE_PAYLOAD,
                        f"SSE must not include {key}",
                        field=key,
                    )
        return data

    @model_validator(mode="after")
    def _disc(self) -> SSEEventEnvelopeV1:
        actual = getattr(self.payload, "payload_type", None)
        if actual != self.event_type.value:
            raise ContractValidationError(
                ContractErrorCode.INVALID_EVENT_FRAME
                if False
                else ContractErrorCode.INVALID_CONTRACT,
                f"event_type={self.event_type.value} payload_type={actual}",
            )
        if self.event_type is SSEEventTypeV1.COMPLETE:
            if not isinstance(self.payload, CompletePayload):
                raise ContractValidationError(
                    ContractErrorCode.INVALID_RESPONSE_PAYLOAD,
                    "COMPLETE requires validated AIResponseEnvelope",
                )
            # Accessing payload.response validates nested envelope already.
            _ = self.payload.response.response_id
        return self


def assert_monotonic_sequences(events: list[SSEEventEnvelopeV1]) -> None:
    last = -1
    for ev in events:
        if ev.sequence_number <= last:
            raise ContractValidationError(
                ContractErrorCode.INVALID_CONTRACT,
                "SSE sequence numbers must be monotonic per stream",
                field="sequence_number",
            )
        last = ev.sequence_number
