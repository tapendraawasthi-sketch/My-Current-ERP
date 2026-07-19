"""MAI-09 number-role parser — duration/IDs/dates/word-numerals before bare money."""

from __future__ import annotations

import re
from typing import Iterable

from .....contracts.language import LanguageFrameV1
from .....contracts.number_roles import (
    NumberRoleBundleV1,
    NumberRoleCandidateV1,
    NumberRoleKind,
    NumberRoleStatus,
)
from ...domain.taxonomy import ProtectedKind
from .. import OFFSET_UNIT, RUNTIME_VERSION
from .bs_ad_service import parse_date_role_candidates
from .word_numerals import expand_word_numeral_phrases

_NUM = re.compile(r"(?<!\w)(\d+(?:[.,]\d+)?)(?!\w)")
_DURATION = re.compile(
    r"(?i)\b(\d+)\s*(maina|mahina|month|months|महिना)\b",
)
_PCT = re.compile(r"(\d+(?:[.,]\d+)?)\s*%")
_QTY_CTX = re.compile(
    r"(?i)\b(qty|quantity|pcs|piece|pieces|thaan|वटा|kg|kilo|liter|litre|bora)\b",
)
_MONEY_CTX = re.compile(
    r"(?i)\b(rs\.?|npr|रु\.?|रकम|amount|paid|payo|tiryo|due|total|cash|bank|price|rate)\b",
)
_INV_CTX = re.compile(r"(?i)\b(invoice|bill|inv|बिल)\b")
_ID_CTX = re.compile(r"(?i)\b(pan|vat|प्यान|भ्याट|phone|mobile|नम्बर)\b")

_PROTECTED_ID_KINDS = {
    ProtectedKind.PHONE_CANDIDATE.value,
    ProtectedKind.PAN_CANDIDATE.value,
    ProtectedKind.VAT_IDENTIFIER.value,
    "PHONE_CANDIDATE",
    "PAN_CANDIDATE",
    "VAT_IDENTIFIER",
}
_PROTECTED_INV_KINDS = {
    ProtectedKind.INVOICE_REFERENCE.value,
    ProtectedKind.VOUCHER_REFERENCE.value,
    "INVOICE_REFERENCE",
    "VOUCHER_REFERENCE",
}


def _overlaps(start: int, end: int, spans: Iterable[tuple[int, int, str]]) -> str | None:
    for a, b, kind in spans:
        if start < b and end > a:
            return kind
    return None


def _range_claimed(start: int, end: int, claimed: set[tuple[int, int]]) -> bool:
    for a, b in claimed:
        if start < b and end > a:
            return True
    return False


def _protected_tuples(frame: LanguageFrameV1 | None) -> list[tuple[int, int, str]]:
    out: list[tuple[int, int, str]] = []
    if not frame:
        return out
    for ann in frame.span_annotations or ():
        if ann.protected_reason:
            out.append((ann.start_offset, ann.end_offset, ann.protected_reason))
    return out


def parse_number_roles(
    text: str,
    *,
    language_frame: LanguageFrameV1 | None = None,
) -> list[dict]:
    """Return role dicts compatible with eval NumberRoleExpectationV1 surfaces."""
    protected = _protected_tuples(language_frame)
    claimed: set[tuple[int, int]] = set()
    roles: list[dict] = []
    cid = 0

    def _add(
        surface: str,
        role: NumberRoleKind,
        start: int,
        end: int,
        *,
        unit: str | None = None,
        reasons: tuple[str, ...] = (),
        normalized_value: str | None = None,
        ambiguous: bool | None = None,
    ) -> None:
        nonlocal cid
        if _range_claimed(start, end, claimed):
            return
        claimed.add((start, end))
        cid += 1
        amb = bool(ambiguous) if ambiguous is not None else (role == NumberRoleKind.UNKNOWN)
        roles.append(
            {
                "candidate_id": f"nr-{cid:04d}",
                "surface": surface.replace(",", "") if role != NumberRoleKind.DATE else surface,
                "role": role.value,
                "normalized_value": normalized_value
                if normalized_value is not None
                else surface.replace(",", ""),
                "unit": unit,
                "raw_start": start,
                "raw_end": end,
                "reason_codes": list(reasons),
                "ambiguous": amb,
            }
        )

    # 1) Dates (claim whole date span so component digits are not re-roled)
    for d in parse_date_role_candidates(text):
        _add(
            d["surface"],
            NumberRoleKind.DATE,
            d["raw_start"],
            d["raw_end"],
            unit=d.get("unit"),
            reasons=tuple(d.get("reason_codes") or ()),
            normalized_value=d.get("normalized_value"),
            ambiguous=d.get("ambiguous"),
        )

    # 2) Word numerals (5 hajar / 2 lakh / 1 crore)
    for w in expand_word_numeral_phrases(text):
        _add(
            w["surface"],
            NumberRoleKind.AMOUNT,
            w["raw_start"],
            w["raw_end"],
            unit=w.get("unit"),
            reasons=tuple(w.get("reason_codes") or ()),
            normalized_value=w.get("normalized_value"),
        )

    # 3) Duration / percent
    for m in _DURATION.finditer(text):
        _add(
            m.group(1),
            NumberRoleKind.DURATION,
            m.start(1),
            m.end(1),
            unit="month",
            reasons=("DURATION_UNIT_CUE",),
        )

    for m in _PCT.finditer(text):
        _add(
            m.group(1),
            NumberRoleKind.PERCENTAGE,
            m.start(1),
            m.end(1),
            reasons=("PERCENT_LITERAL",),
        )

    # 4) Remaining bare numerals
    for m in _NUM.finditer(text):
        surface = m.group(1)
        start, end = m.start(1), m.end(1)
        if _range_claimed(start, end, claimed):
            continue
        kind = _overlaps(start, end, protected)
        if kind and kind in _PROTECTED_ID_KINDS:
            _add(surface, NumberRoleKind.IDENTIFIER, start, end, reasons=("PROTECTED_ID_SPAN", kind))
            continue
        if kind and kind in _PROTECTED_INV_KINDS:
            _add(
                surface,
                NumberRoleKind.INVOICE_NUMBER,
                start,
                end,
                reasons=("PROTECTED_INVOICE_SPAN", kind),
            )
            continue

        left_near = text[max(0, start - 16) : start]
        right_near = text[end : min(len(text), end + 16)]
        local = f"{left_near} {surface} {right_near}"

        money_hit = bool(_MONEY_CTX.search(local))
        inv_hit = bool(_INV_CTX.search(left_near))
        id_hit = bool(_ID_CTX.search(left_near)) or (
            bool(_ID_CTX.search(local)) and len(surface.replace(".", "")) >= 8
        )
        qty_hit = bool(_QTY_CTX.search(local))

        if inv_hit:
            _add(
                surface,
                NumberRoleKind.INVOICE_NUMBER,
                start,
                end,
                reasons=("INVOICE_CONTEXT_CUE",),
            )
            continue
        if id_hit:
            _add(surface, NumberRoleKind.IDENTIFIER, start, end, reasons=("ID_CONTEXT_CUE",))
            continue
        if qty_hit:
            _add(surface, NumberRoleKind.QUANTITY, start, end, reasons=("QUANTITY_CONTEXT_CUE",))
            continue
        if money_hit:
            _add(surface, NumberRoleKind.AMOUNT, start, end, reasons=("MONEY_CONTEXT_CUE",))
            continue
        _add(surface, NumberRoleKind.UNKNOWN, start, end, reasons=("NO_ROLE_CUE",))

    return roles


def build_number_role_bundle(
    text: str,
    *,
    language_frame: LanguageFrameV1 | None = None,
) -> NumberRoleBundleV1:
    parsed = parse_number_roles(text, language_frame=language_frame)
    candidates = tuple(
        NumberRoleCandidateV1(
            candidate_id=r["candidate_id"],
            surface=r["surface"],
            role=NumberRoleKind(r["role"]),
            normalized_value=r.get("normalized_value"),
            unit=r.get("unit"),
            raw_start=r["raw_start"],
            raw_end=r["raw_end"],
            reason_codes=tuple(r.get("reason_codes") or ()),
            ambiguous=bool(r.get("ambiguous")),
            applied=False,
        )
        for r in parsed
    )
    return NumberRoleBundleV1(
        analysis_status=NumberRoleStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        offset_unit=OFFSET_UNIT,
        source_authority="RAW",
        candidates=candidates,
        candidate_count=len(candidates),
        silent_applications=0,
    )


def attach_number_roles_to_frame(frame: LanguageFrameV1) -> LanguageFrameV1:
    raw_before = frame.raw_text
    bundle = build_number_role_bundle(frame.raw_text, language_frame=frame)
    if frame.raw_text != raw_before:
        raise RuntimeError("RAW_TEXT_MUTATION")
    if bundle.silent_applications != 0:
        raise RuntimeError("SILENT_APPLICATIONS_NONZERO")
    legacy = tuple(
        {
            "surface": c.surface,
            "role": c.role.value,
            "normalized_value": c.normalized_value,
            "unit": c.unit,
            "start": c.raw_start,
            "end": c.raw_end,
        }
        for c in bundle.candidates
    )
    versions = dict(frame.analyzer_versions or {})
    versions["number_roles"] = RUNTIME_VERSION
    return frame.model_copy(
        update={
            "number_role_bundle": bundle,
            "number_candidates": legacy,
            "date_candidates": tuple(
                x for x in legacy if x.get("role") == "date"
            ),
            "analyzer_versions": versions,
        }
    )
