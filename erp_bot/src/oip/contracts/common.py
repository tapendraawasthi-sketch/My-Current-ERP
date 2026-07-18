"""Shared value objects — Decimal strings, spans, timestamps (no float money)."""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .registry import CURRENT_SCHEMA_VERSION

_DECIMAL_RE = re.compile(r"^-?\d+(\.\d+)?$")


class ContractBase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=False)


class ProvenanceKind(str, Enum):
    EXPLICIT = "EXPLICIT"
    CONTEXT_RESOLVED = "CONTEXT_RESOLVED"
    ERP_RETRIEVED = "ERP_RETRIEVED"
    KNOWLEDGE_RETRIEVED = "KNOWLEDGE_RETRIEVED"
    DETERMINISTIC_CALCULATION = "DETERMINISTIC_CALCULATION"
    INFERRED_CANDIDATE = "INFERRED_CANDIDATE"


def _reject_float_money(value: Any) -> None:
    if isinstance(value, float):
        raise ValueError("MONEY_FLOAT_FORBIDDEN: binary float amounts are not allowed")
    if isinstance(value, Decimal) and (value.is_nan() or value.is_infinite()):
        raise ValueError("MONEY_FLOAT_FORBIDDEN: NaN/Infinity not allowed")


def parse_decimal_string(value: Any, *, field: str = "amount") -> str:
    _reject_float_money(value)
    if isinstance(value, Decimal):
        text = format(value, "f")
    elif isinstance(value, int):
        text = str(value)
    elif isinstance(value, str):
        text = value.strip()
    else:
        raise ValueError(f"invalid decimal for {field}")
    if not text or not _DECIMAL_RE.match(text):
        raise ValueError(f"invalid decimal string for {field}")
    try:
        d = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"invalid decimal string for {field}") from exc
    if not d.is_finite():
        raise ValueError(f"non-finite decimal for {field}")
    return format(d, "f")


class IdentifierV1(ContractBase):
    value: str = Field(min_length=1, max_length=256)
    namespace: str = Field(default="generic", min_length=1, max_length=64)
    display_value: str | None = None

    @field_validator("value")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("empty IDs are invalid")
        return v


class SourceSpanV1(ContractBase):
    """Offsets are Unicode code-point indices unless offset_unit says otherwise."""

    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=0)
    original_text: str
    source_message_id: str | None = None
    # MAI-05: backward-compatible optional field (default UNICODE_CODE_POINT).
    offset_unit: str = "UNICODE_CODE_POINT"

    @model_validator(mode="after")
    def _span_ok(self) -> SourceSpanV1:
        if self.end_offset < self.start_offset:
            raise ValueError("end_offset must be >= start_offset")
        return self


class MoneyV1(ContractBase):
    amount: str
    currency: str = Field(min_length=3, max_length=8, default="NPR")
    scale: int | None = Field(default=None, ge=0, le=8)

    @field_validator("amount", mode="before")
    @classmethod
    def _amount(cls, v: Any) -> str:
        return parse_decimal_string(v, field="amount")


class QuantityV1(ContractBase):
    amount: str
    unit: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def _amount(cls, v: Any) -> str:
        return parse_decimal_string(v, field="quantity")


class PercentageV1(ContractBase):
    value: str

    @field_validator("value", mode="before")
    @classmethod
    def _value(cls, v: Any) -> str:
        return parse_decimal_string(v, field="percentage")


class DurationV1(ContractBase):
    value: str
    unit: str = Field(min_length=1, max_length=32)

    @field_validator("value", mode="before")
    @classmethod
    def _value(cls, v: Any) -> str:
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            raise ValueError("non-finite duration")
        if isinstance(v, float):
            # Duration may arrive as int-like float from JSON — still forbid binary money path.
            # Durations allow integers/strings; floats rejected to avoid silent money mixups.
            raise ValueError("duration must be decimal string or integer, not float")
        if isinstance(v, int):
            return str(v)
        return parse_decimal_string(v, field="duration")


class DateCalendar(str, Enum):
    BS = "BS"
    AD = "AD"
    UNKNOWN = "UNKNOWN"


class DateValueV1(ContractBase):
    original_text: str
    calendar: DateCalendar = DateCalendar.UNKNOWN
    normalized_date: str | None = None
    precision: str = "unknown"
    conversion_status: str = "not_converted"


class TimestampV1(ContractBase):
    value: datetime

    @field_validator("value")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("timestamp must be timezone-aware")
        return v.astimezone(timezone.utc)


class ConfidenceV1(ContractBase):
    """Informational only — never authorization."""

    value: float = Field(ge=0.0, le=1.0)
    method: str = "unspecified"
    grants_authority: bool = False

    @field_validator("grants_authority")
    @classmethod
    def _no_auth(cls, v: bool) -> bool:
        if v:
            raise ValueError("confidence cannot grant execution authority")
        return False


class EvidenceReferenceV1(ContractBase):
    evidence_id: str = Field(min_length=1, max_length=128)
    source_span: SourceSpanV1 | None = None


def default_schema_version() -> str:
    return CURRENT_SCHEMA_VERSION
