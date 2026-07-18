"""MAI-07R3N5 target-span authority for fresh-holdout evaluation.

R3N4 selected an evaluated span by case-insensitive surface equality.  That
coupled target discovery to analyzer segmentation and made a missing selection
look like simultaneous identity, anchor, idempotence, and path failures.  R3N5
binds every evaluation target to an immutable raw code-point interval before a
candidate is run.  The interval, not a normalized/highlighted string search, is
the evaluation authority.

This contract is evaluation metadata only.  It never changes raw text or grants
runtime/accounting authority.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any


SCHEMA_VERSION = "mai07_r3n5_target_span_v1"
OFFSET_UNIT = "UNICODE_CODE_POINT"


class TargetSpanContractError(ValueError):
    """Raised when a case's target authority is absent, ambiguous, or stale."""


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class TargetSpanV1:
    raw_start: int
    raw_end_exclusive: int
    raw_surface: str
    raw_surface_sha256: str
    source_text_sha256: str
    offset_unit: str = OFFSET_UNIT
    schema_version: str = SCHEMA_VERSION

    def validate(self, raw_text: str) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise TargetSpanContractError("schema_version_mismatch")
        if self.offset_unit != OFFSET_UNIT:
            raise TargetSpanContractError("offset_unit_mismatch")
        if self.raw_start < 0 or self.raw_end_exclusive <= self.raw_start:
            raise TargetSpanContractError("invalid_bounds")
        if self.raw_end_exclusive > len(raw_text):
            raise TargetSpanContractError("bounds_outside_source")
        surface = raw_text[self.raw_start : self.raw_end_exclusive]
        if surface != self.raw_surface:
            raise TargetSpanContractError("raw_surface_mismatch")
        if _sha(surface) != self.raw_surface_sha256:
            raise TargetSpanContractError("raw_surface_digest_mismatch")
        if _sha(raw_text) != self.source_text_sha256:
            raise TargetSpanContractError("source_text_digest_mismatch")

    def to_case_fields(self) -> dict[str, Any]:
        return {
            "target_schema_version": self.schema_version,
            "target_offset_unit": self.offset_unit,
            "target_start": self.raw_start,
            "target_end_exclusive": self.raw_end_exclusive,
            "target_raw_surface": self.raw_surface,
            "target_raw_surface_sha256": self.raw_surface_sha256,
            "target_source_text_sha256": self.source_text_sha256,
        }


def create_target_span(raw_text: str, *, raw_start: int, raw_end_exclusive: int) -> TargetSpanV1:
    if not isinstance(raw_text, str):
        raise TargetSpanContractError("raw_text_must_be_string")
    if raw_start < 0 or raw_end_exclusive <= raw_start or raw_end_exclusive > len(raw_text):
        raise TargetSpanContractError("invalid_bounds")
    surface = raw_text[raw_start:raw_end_exclusive]
    target = TargetSpanV1(
        raw_start=raw_start,
        raw_end_exclusive=raw_end_exclusive,
        raw_surface=surface,
        raw_surface_sha256=_sha(surface),
        source_text_sha256=_sha(raw_text),
    )
    target.validate(raw_text)
    return target


def target_span_from_case(case: dict[str, Any]) -> TargetSpanV1:
    raw_text = case.get("input_text")
    if not isinstance(raw_text, str):
        raise TargetSpanContractError("case_input_text_missing")
    required = (
        "target_start",
        "target_end_exclusive",
        "target_raw_surface",
        "target_raw_surface_sha256",
        "target_source_text_sha256",
    )
    missing = [field for field in required if field not in case]
    if missing:
        raise TargetSpanContractError("missing_target_fields:" + ",".join(missing))
    if case.get("target_schema_version") != SCHEMA_VERSION:
        raise TargetSpanContractError("schema_version_mismatch")
    if case.get("target_offset_unit") != OFFSET_UNIT:
        raise TargetSpanContractError("offset_unit_mismatch")
    start = case["target_start"]
    end = case["target_end_exclusive"]
    if isinstance(start, bool) or not isinstance(start, int):
        raise TargetSpanContractError("target_start_must_be_integer")
    if isinstance(end, bool) or not isinstance(end, int):
        raise TargetSpanContractError("target_end_must_be_integer")
    target = TargetSpanV1(
        raw_start=start,
        raw_end_exclusive=end,
        raw_surface=str(case["target_raw_surface"]),
        raw_surface_sha256=str(case["target_raw_surface_sha256"]),
        source_text_sha256=str(case["target_source_text_sha256"]),
        offset_unit=case["target_offset_unit"],
        schema_version=case["target_schema_version"],
    )
    target.validate(raw_text)
    if case.get("highlighted_span") != target.raw_surface:
        raise TargetSpanContractError("highlighted_span_not_target_surface")
    return target


def select_bundle_span_by_target(bundle: Any, target: TargetSpanV1) -> Any | None:
    """Select exactly one output span by authoritative raw offsets.

    Containing/overlapping spans are deliberately rejected.  A fresh dataset
    must bind targets that the declared analyzer contract exposes exactly.
    """
    matches = [
        span
        for span in bundle.span_results
        if int(span.raw_span.start_offset) == target.raw_start
        and int(span.raw_span.end_offset) == target.raw_end_exclusive
        and span.raw_span.original_text == target.raw_surface
    ]
    return matches[0] if len(matches) == 1 else None


__all__ = [
    "OFFSET_UNIT",
    "SCHEMA_VERSION",
    "TargetSpanContractError",
    "TargetSpanV1",
    "create_target_span",
    "target_span_from_case",
    "select_bundle_span_by_target",
]
