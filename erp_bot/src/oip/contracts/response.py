"""Canonical AI response envelope — discriminated response_type/payload union."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, default_schema_version
from .draft_preview import DraftReferenceV1, PreviewV1, ReceiptV1
from .errors import ContractErrorCode, ContractValidationError
from .registry import get_contract_registry


class ResponseTypeV1(str, Enum):
    ANSWER = "ANSWER"
    CLARIFICATION = "CLARIFICATION"
    CHOICE = "CHOICE"
    REPORT = "REPORT"
    DRAFT = "DRAFT"
    PREVIEW = "PREVIEW"
    ACTION_PROGRESS = "ACTION_PROGRESS"
    RECEIPT = "RECEIPT"
    CONFLICT = "CONFLICT"
    SAFE_REFUSAL = "SAFE_REFUSAL"
    DEGRADED = "DEGRADED"
    ERROR = "ERROR"


class ResponseStatusV1(str, Enum):
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    REQUIRES_INPUT = "REQUIRES_INPUT"
    FAILED = "FAILED"
    REFUSED = "REFUSED"
    DEGRADED = "DEGRADED"


class AnswerPayloadV1(ContractBase):
    payload_type: Literal["ANSWER"] = "ANSWER"
    propositions: tuple[str, ...] = ()
    evidence_ids: tuple[str, ...] = ()


class ClarificationPayloadV1(ContractBase):
    payload_type: Literal["CLARIFICATION"] = "CLARIFICATION"
    draft_id: str | None = None
    missing_fields: tuple[str, ...] = ()
    ambiguous_fields: tuple[str, ...] = ()
    questions: tuple[str, ...] = ()


class ChoicePayloadV1(ContractBase):
    payload_type: Literal["CHOICE"] = "CHOICE"
    choices: tuple[dict[str, Any], ...] = ()
    prompt: str = ""


class ReportPayloadV1(ContractBase):
    payload_type: Literal["REPORT"] = "REPORT"
    report_spec: dict[str, Any] = Field(default_factory=dict)
    rows_preview: tuple[dict[str, Any], ...] = ()


class DraftPayloadV1(ContractBase):
    payload_type: Literal["DRAFT"] = "DRAFT"
    draft: DraftReferenceV1


class PreviewPayloadV1(ContractBase):
    payload_type: Literal["PREVIEW"] = "PREVIEW"
    preview: PreviewV1


class ActionProgressPayloadV1(ContractBase):
    payload_type: Literal["ACTION_PROGRESS"] = "ACTION_PROGRESS"
    stage: str
    label: str = ""
    percent: int | None = Field(default=None, ge=0, le=100)


class ReceiptPayloadV1(ContractBase):
    payload_type: Literal["RECEIPT"] = "RECEIPT"
    receipt: ReceiptV1


class ConflictPayloadV1(ContractBase):
    payload_type: Literal["CONFLICT"] = "CONFLICT"
    conflict_code: str
    safe_message: str
    local_ids: tuple[str, ...] = ()
    remote_ids: tuple[str, ...] = ()


class SafeRefusalPayloadV1(ContractBase):
    payload_type: Literal["SAFE_REFUSAL"] = "SAFE_REFUSAL"
    reason_code: str
    safe_message: str
    suggested_safe_actions: tuple[str, ...] = ()


class DegradedPayloadV1(ContractBase):
    payload_type: Literal["DEGRADED"] = "DEGRADED"
    reason_code: str
    safe_message: str
    partial_available: bool = False


class ErrorPayloadV1(ContractBase):
    payload_type: Literal["ERROR"] = "ERROR"
    error_code: str
    safe_message: str
    # Explicitly exclude stack traces
    stack_trace: None = None
    exception_type: None = None

    @model_validator(mode="before")
    @classmethod
    def _no_stack(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in ("stack_trace", "traceback", "exception", "exc_info"):
                if data.get(key):
                    raise ContractValidationError(
                        ContractErrorCode.INVALID_RESPONSE_PAYLOAD,
                        "safe error excludes stack traces",
                        field=key,
                    )
        return data


StructuredPayloadV1 = Annotated[
    Union[
        AnswerPayloadV1,
        ClarificationPayloadV1,
        ChoicePayloadV1,
        ReportPayloadV1,
        DraftPayloadV1,
        PreviewPayloadV1,
        ActionProgressPayloadV1,
        ReceiptPayloadV1,
        ConflictPayloadV1,
        SafeRefusalPayloadV1,
        DegradedPayloadV1,
        ErrorPayloadV1,
    ],
    Field(discriminator="payload_type"),
]

_TYPE_TO_PAYLOAD = {
    ResponseTypeV1.ANSWER: "ANSWER",
    ResponseTypeV1.CLARIFICATION: "CLARIFICATION",
    ResponseTypeV1.CHOICE: "CHOICE",
    ResponseTypeV1.REPORT: "REPORT",
    ResponseTypeV1.DRAFT: "DRAFT",
    ResponseTypeV1.PREVIEW: "PREVIEW",
    ResponseTypeV1.ACTION_PROGRESS: "ACTION_PROGRESS",
    ResponseTypeV1.RECEIPT: "RECEIPT",
    ResponseTypeV1.CONFLICT: "CONFLICT",
    ResponseTypeV1.SAFE_REFUSAL: "SAFE_REFUSAL",
    ResponseTypeV1.DEGRADED: "DEGRADED",
    ResponseTypeV1.ERROR: "ERROR",
}


class AIResponseEnvelopeV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    response_id: str = Field(min_length=1)
    request_id: str = Field(min_length=1)
    conversation_id: str = Field(min_length=1)
    response_type: ResponseTypeV1
    status: ResponseStatusV1 = ResponseStatusV1.SUCCESS
    language: str = "en"
    user_visible_text: str = ""
    structured_payload: StructuredPayloadV1
    citations: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    uncertainty: str | None = None
    suggested_safe_actions: tuple[str, ...] = ()
    draft_reference: DraftReferenceV1 | None = None
    trace_reference: str | None = None
    policy_reference: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Intentionally absent from canonical public response:
    # execution_allowed, chain_of_thought, prompts, secrets

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("created_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("created_at must be timezone-aware")
        return v

    @model_validator(mode="before")
    @classmethod
    def _no_authority_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in (
                "execution_allowed",
                "chain_of_thought",
                "thinking",
                "raw_prompt",
                "provider_reasoning",
            ):
                if key in data and data[key] is not None:
                    raise ContractValidationError(
                        ContractErrorCode.EXECUTION_AUTHORITY_FORBIDDEN
                        if key == "execution_allowed"
                        else ContractErrorCode.INVALID_RESPONSE_PAYLOAD,
                        f"canonical response must not include {key}",
                        field=key,
                    )
        return data

    @model_validator(mode="after")
    def _match(self) -> AIResponseEnvelopeV1:
        expected = _TYPE_TO_PAYLOAD[self.response_type]
        actual = getattr(self.structured_payload, "payload_type", None)
        if actual != expected:
            raise ContractValidationError(
                ContractErrorCode.RESPONSE_PAYLOAD_MISMATCH,
                f"response_type={self.response_type.value} requires payload_type={expected}, got {actual}",
            )
        if self.response_type is ResponseTypeV1.PREVIEW:
            if not isinstance(self.structured_payload, PreviewPayloadV1):
                raise ContractValidationError(
                    ContractErrorCode.INVALID_PREVIEW,
                    "PREVIEW requires PreviewPayload",
                )
            if not self.structured_payload.preview.preview_hash:
                raise ContractValidationError(
                    ContractErrorCode.INVALID_PREVIEW,
                    "PREVIEW without valid preview reference",
                )
        if self.response_type is ResponseTypeV1.ANSWER:
            payload = self.structured_payload
            if hasattr(payload, "receipt") or hasattr(payload, "authoritative_record_ids"):
                # AnswerPayload has neither; guard against bad unions via dict extras already forbid.
                pass
            bad = getattr(payload, "model_dump", lambda: {})()
            if isinstance(bad, dict) and (
                bad.get("receipt") or bad.get("authoritative_record_ids") or bad.get("posted")
            ):
                raise ContractValidationError(
                    ContractErrorCode.INVALID_RESPONSE_PAYLOAD,
                    "ANSWER cannot carry mutation receipt fields",
                )
        return self
