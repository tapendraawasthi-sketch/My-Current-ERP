"""EventFrameV1 — structured interpretation candidate (no posting authority)."""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import Field, field_validator, model_validator

from .common import (
    ConfidenceV1,
    ContractBase,
    DateValueV1,
    DurationV1,
    EvidenceReferenceV1,
    IdentifierV1,
    MoneyV1,
    PercentageV1,
    ProvenanceKind,
    QuantityV1,
    SourceSpanV1,
    default_schema_version,
    parse_decimal_string,
)
from .errors import ContractErrorCode, ContractValidationError
from .registry import get_contract_registry


class LifecycleState(str, Enum):
    PLANNED = "PLANNED"
    OCCURRED = "OCCURRED"
    PARTIALLY_SETTLED = "PARTIALLY_SETTLED"
    SETTLED = "SETTLED"
    REVERSED = "REVERSED"
    UNKNOWN = "UNKNOWN"


class FrameStatus(str, Enum):
    EMPTY = "EMPTY"
    PARTIAL = "PARTIAL"
    COMPLETE = "COMPLETE"
    INVALID = "INVALID"
    NOT_RUN = "NOT_RUN"


class FieldValidationStatus(str, Enum):
    VALID = "VALID"
    AMBIGUOUS = "AMBIGUOUS"
    MISSING = "MISSING"
    INVALID = "INVALID"
    UNKNOWN = "UNKNOWN"


class FieldValueBase(ContractBase):
    field_name: str = Field(min_length=1)
    original_surface: str = ""
    source_span: SourceSpanV1 | None = None
    evidence_reference: EvidenceReferenceV1 | None = None
    provenance: ProvenanceKind = ProvenanceKind.EXPLICIT
    confidence: ConfidenceV1 | None = None
    alternatives: tuple[str, ...] = ()
    validation_status: FieldValidationStatus = FieldValidationStatus.VALID


class MoneyFieldValueV1(FieldValueBase):
    value_type: Literal["money"] = "money"
    normalized_value: MoneyV1


class QuantityFieldValueV1(FieldValueBase):
    value_type: Literal["quantity"] = "quantity"
    normalized_value: QuantityV1


class PercentageFieldValueV1(FieldValueBase):
    value_type: Literal["percentage"] = "percentage"
    normalized_value: PercentageV1


class DurationFieldValueV1(FieldValueBase):
    value_type: Literal["duration"] = "duration"
    normalized_value: DurationV1


class DateFieldValueV1(FieldValueBase):
    value_type: Literal["date"] = "date"
    normalized_value: DateValueV1


class IdentifierFieldValueV1(FieldValueBase):
    value_type: Literal["identifier"] = "identifier"
    normalized_value: IdentifierV1


class TextFieldValueV1(FieldValueBase):
    value_type: Literal["text"] = "text"
    normalized_value: str


class BooleanFieldValueV1(FieldValueBase):
    value_type: Literal["boolean"] = "boolean"
    normalized_value: bool


class UnknownNumberFieldValueV1(FieldValueBase):
    """Number whose accounting role is unknown — never silently money."""

    value_type: Literal["unknown_number"] = "unknown_number"
    surface_number: str
    unit_hint: str | None = None

    @field_validator("surface_number", mode="before")
    @classmethod
    def _num(cls, v: Any) -> str:
        if isinstance(v, float):
            raise ContractValidationError(
                ContractErrorCode.MONEY_FLOAT_FORBIDDEN,
                "unknown number cannot be float",
                field="surface_number",
            )
        return parse_decimal_string(v, field="surface_number")


FieldValueV1 = Annotated[
    Union[
        MoneyFieldValueV1,
        QuantityFieldValueV1,
        PercentageFieldValueV1,
        DurationFieldValueV1,
        DateFieldValueV1,
        IdentifierFieldValueV1,
        TextFieldValueV1,
        BooleanFieldValueV1,
        UnknownNumberFieldValueV1,
    ],
    Field(discriminator="value_type"),
]


class EventFrameV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    frame_id: str = Field(min_length=1, max_length=128)
    frame_version: str = "1"
    event_type: str = "unknown"
    lifecycle_state: LifecycleState = LifecycleState.UNKNOWN
    parties: tuple[dict[str, Any], ...] = ()
    items: tuple[dict[str, Any], ...] = ()
    values: tuple[FieldValueV1, ...] = ()
    dates_and_periods: tuple[FieldValueV1, ...] = ()
    locations: tuple[dict[str, Any], ...] = ()
    payment_terms: tuple[dict[str, Any], ...] = ()
    tax_clues: tuple[dict[str, Any], ...] = ()
    document_references: tuple[dict[str, Any], ...] = ()
    source_evidence: tuple[EvidenceReferenceV1, ...] = ()
    inherited_context: dict[str, Any] = Field(default_factory=dict)
    explicit_values: tuple[str, ...] = ()
    inferred_candidates: tuple[str, ...] = ()
    missing_required_fields: tuple[str, ...] = ()
    ambiguous_fields: tuple[str, ...] = ()
    prohibited_assumptions: tuple[str, ...] = ()
    confidence_by_field: dict[str, float] = Field(default_factory=dict)
    ontology_version: str = "none"
    status: FrameStatus = FrameStatus.NOT_RUN
    # Hard exclusion — receipts/execution must not live on frames.
    receipt_id: None = None
    execution_success: None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @model_validator(mode="before")
    @classmethod
    def _no_receipt(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("receipt_id") not in (None,):
                raise ContractValidationError(
                    ContractErrorCode.INVALID_EVENT_FRAME,
                    "EventFrame cannot contain a receipt",
                    field="receipt_id",
                )
            if data.get("execution_success") not in (None, False):
                raise ContractValidationError(
                    ContractErrorCode.INVALID_EVENT_FRAME,
                    "EventFrame cannot contain execution success",
                    field="execution_success",
                )
            # Drop keys silently only if explicitly None — else forbid.
            forbidden = ("authoritative_record_ids", "posted_at", "sync_state")
            for key in forbidden:
                if key in data and data[key] is not None:
                    raise ContractValidationError(
                        ContractErrorCode.INVALID_EVENT_FRAME,
                        f"EventFrame cannot contain {key}",
                        field=key,
                    )
        return data

    @property
    def authorizes_posting(self) -> bool:
        return False
