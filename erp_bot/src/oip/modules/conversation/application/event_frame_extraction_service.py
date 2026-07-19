"""MAI-19 — structured EventFrame value extraction (deterministic).

Slice 1: party / amount / report_type into MAI-18 skeleton.
Slice 2: optional payment_mode / item / date; ambiguous bare numbers
never silently become money. Never posts, never merges drafts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from ....contracts.common import ConfidenceV1, DateCalendar, DateValueV1, MoneyV1, ProvenanceKind
from ....contracts.event_frame import (
    DateFieldValueV1,
    EventFrameV1,
    FieldValidationStatus,
    FrameStatus,
    MoneyFieldValueV1,
    TextFieldValueV1,
    UnknownNumberFieldValueV1,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-19.0.2-slice2"

# Nepali order: "Ram bata 500" (party before bata).
_PARTY_BATA = re.compile(
    r"\b([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F&.]{1,40})\s+"
    r"(?:bata|sanga|बाट|सँग)\b",
    re.I,
)
_PARTY_LAI = re.compile(
    r"\b([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F&.]{1,40})\s+"
    r"(?:lai|लाई)\b",
    re.I,
)
_AMOUNT_KO = re.compile(
    r"(?:rs\.?|npr|रु\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*ko\b",
    re.I,
)
_AMOUNT_CURRENCY = re.compile(
    r"(?:rs\.?|npr|रु\.?|₹)\s*([\d,]+(?:\.\d+)?)",
    re.I,
)
_AMOUNT_BARE = re.compile(r"\b([\d,]+(?:\.\d+)?)\b")
_QTY_UNIT = re.compile(
    r"\b([\d,]+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|pcs|g|ltr|liter|litre)\b",
    re.I,
)
_CASH = re.compile(r"\b(cash|nagar|नगद)\b", re.I)
_CREDIT = re.compile(r"\b(credit|udhaar|udhar|उधारो?|on\s+account)\b", re.I)
_BANK = re.compile(r"\b(bank|esewa|khalti|fonepay)\b", re.I)
_DATE_ISO = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_DATE_DMY = re.compile(
    r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b"
)
_REPORT_TYPES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bbalance\s+sheet\b|\bbs\b|vasalat", re.I), "balance_sheet"),
    (re.compile(r"\btrial\s+balance\b|\btb\b|parikshan", re.I), "trial_balance"),
    (
        re.compile(r"\bprofit\s*(and|&)\s*loss\b|\bp\s*&\s*l\b|\bpnl\b", re.I),
        "profit_and_loss",
    ),
    (re.compile(r"\bcash\s+flow\b", re.I), "cash_flow"),
    (re.compile(r"\bday\s*book\b", re.I), "day_book"),
    (re.compile(r"\bvat\s+report\b", re.I), "vat_report"),
    (re.compile(r"\bstock\s+summary\b", re.I), "stock_summary"),
)


@dataclass
class _ExtractResult:
    values: list[Any] = field(default_factory=list)
    parties: list[dict[str, Any]] = field(default_factory=list)
    items: list[dict[str, Any]] = field(default_factory=list)
    dates: list[Any] = field(default_factory=list)
    filled: list[str] = field(default_factory=list)
    ambiguous: list[str] = field(default_factory=list)


def _money_str(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if isinstance(value, Decimal):
            d = value
        elif isinstance(value, float):
            d = Decimal(str(value))
        else:
            d = Decimal(str(value).replace(",", ""))
        if d.is_nan() or d.is_infinite() or d <= 0:
            return None
        text = format(d, "f")
        if "." in text:
            text = text.rstrip("0").rstrip(".")
        return text or None
    except (InvalidOperation, ValueError, TypeError):
        return None


def _conf(value: float = 0.85, method: str = "deterministic_extract") -> ConfidenceV1:
    return ConfidenceV1(value=value, method=method, grants_authority=False)


def _text_field(name: str, surface: str) -> TextFieldValueV1:
    return TextFieldValueV1(
        field_name=name,
        original_surface=surface,
        provenance=ProvenanceKind.EXPLICIT,
        confidence=_conf(),
        normalized_value=surface,
    )


def _money_field(name: str, amount: str, surface: str) -> MoneyFieldValueV1:
    return MoneyFieldValueV1(
        field_name=name,
        original_surface=surface,
        provenance=ProvenanceKind.EXPLICIT,
        confidence=_conf(),
        normalized_value=MoneyV1(amount=amount, currency="NPR"),
    )


def _date_field(name: str, original: str, normalized: str | None) -> DateFieldValueV1:
    return DateFieldValueV1(
        field_name=name,
        original_surface=original,
        provenance=ProvenanceKind.EXPLICIT,
        confidence=_conf(0.8, "date_cue"),
        normalized_value=DateValueV1(
            original_text=original,
            calendar=DateCalendar.AD if normalized else DateCalendar.UNKNOWN,
            normalized_date=normalized,
            precision="day" if normalized else "unknown",
            conversion_status="ok" if normalized else "not_converted",
        ),
    )


def _extract_party_nepali(text: str, *, role: str) -> str | None:
    if role == "customer":
        m = _PARTY_LAI.search(text or "")
        if m:
            return m.group(1).strip()
    m = _PARTY_BATA.search(text or "")
    if m:
        return m.group(1).strip()
    return None


def _has_qty_context(text: str) -> bool:
    return bool(_QTY_UNIT.search(text or ""))


def _extract_amount_surface(text: str) -> tuple[str, str] | None:
    """Return (amount_str, surface) preferring money cues over bare digits."""
    raw = text or ""
    m = _AMOUNT_KO.search(raw)
    if m:
        amt = _money_str(m.group(1))
        if amt:
            return amt, m.group(0).strip()
    m_cur = _AMOUNT_CURRENCY.search(raw)
    if m_cur:
        amt = _money_str(m_cur.group(1))
        if amt:
            return amt, m_cur.group(0).strip()
    try:
        from src.nlu.text_normalize import extract_amount

        extracted = extract_amount(raw)
        # extract_amount may return bare digits; allow only without qty conflict
        # or when currency/ko already handled above.
        amt = _money_str(extracted)
        if amt and not _has_qty_context(raw):
            return amt, amt
        if amt and (_AMOUNT_KO.search(raw) or _AMOUNT_CURRENCY.search(raw)):
            return amt, amt
    except Exception:  # noqa: BLE001
        pass
    # Bare digit: only if no qty-unit context (else ambiguous).
    if _has_qty_context(raw):
        return None
    m2 = _AMOUNT_BARE.search(raw)
    if m2:
        amt = _money_str(m2.group(1))
        if amt:
            return amt, m2.group(0).strip()
    return None


def _collect_ambiguous_numbers(text: str) -> list[Any]:
    """Mark qty-unit numbers as unknown_number — never silently money."""
    out: list[Any] = []
    raw = text or ""
    for m in _QTY_UNIT.finditer(raw):
        surface = m.group(1)
        unit = m.group(2).lower()
        out.append(
            UnknownNumberFieldValueV1(
                field_name="quantity_candidate",
                original_surface=m.group(0),
                provenance=ProvenanceKind.EXPLICIT,
                confidence=_conf(0.7, "qty_unit_cue"),
                validation_status=FieldValidationStatus.AMBIGUOUS,
                surface_number=surface.replace(",", ""),
                unit_hint=unit,
            )
        )
    return out


def _extract_payment_mode(text: str, fields: dict[str, Any]) -> str | None:
    pm = fields.get("payment_method")
    if isinstance(pm, str) and pm.strip():
        return pm.strip().lower()
    if _CREDIT.search(text or ""):
        return "credit"
    if _BANK.search(text or ""):
        return "bank"
    if _CASH.search(text or ""):
        return "cash"
    return None


def _extract_item(fields: dict[str, Any]) -> dict[str, Any] | None:
    item = fields.get("item")
    if isinstance(item, dict) and item.get("name"):
        return {
            "name": str(item["name"]),
            "raw_name": str(item.get("raw_name") or item["name"]),
        }
    return None


def _extract_date(text: str) -> tuple[str, str | None] | None:
    """Return (original_surface, normalized_iso_or_none)."""
    raw = text or ""
    m = _DATE_ISO.search(raw)
    if m:
        return m.group(1), m.group(1)
    m2 = _DATE_DMY.search(raw)
    if m2:
        d, mo, y = m2.group(1), m2.group(2), m2.group(3)
        try:
            iso = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
            return m2.group(0), iso
        except ValueError:
            return m2.group(0), None
    try:
        from src.oip.modules.language_runtime.number_roles.application.bs_ad_service import (
            parse_date_role_candidates,
        )

        rows = parse_date_role_candidates(raw) or []
        if rows:
            r0 = rows[0]
            surface = str(r0.get("surface") or r0.get("original_text") or "")
            norm = r0.get("normalized_value") or r0.get("normalized_date")
            if surface:
                return surface, str(norm) if norm else None
    except Exception:  # noqa: BLE001
        pass
    return None


def _extract_report_type(text: str) -> str | None:
    for pattern, report_type in _REPORT_TYPES:
        if pattern.search(text or ""):
            return report_type
    return None


def _append_optional(
    result: _ExtractResult,
    text: str,
    fields: dict[str, Any],
) -> None:
    pm = _extract_payment_mode(text, fields)
    if pm:
        result.values.append(_text_field("payment_mode", pm))
        result.filled.append("payment_mode")

    item = _extract_item(fields)
    if item:
        result.items.append(item)
        result.values.append(_text_field("item", item["name"]))
        result.filled.append("item")

    date_hit = _extract_date(text)
    if date_hit:
        original, normalized = date_hit
        result.dates.append(_date_field("date", original, normalized))
        result.filled.append("date")

    # Ambiguous qty numbers (never money).
    for unk in _collect_ambiguous_numbers(text):
        result.values.append(unk)
        result.ambiguous.append("quantity_candidate")


def _fill_purchase(text: str) -> _ExtractResult:
    result = _ExtractResult()
    fields: dict[str, Any] = {}
    try:
        from src.khata.purchase_draft import extract_purchase_fields

        fields = extract_purchase_fields(text) or {}
    except Exception:  # noqa: BLE001
        fields = {}

    party = None
    if isinstance(fields.get("supplier"), dict):
        party = fields["supplier"].get("name")
    if not party:
        party = _extract_party_nepali(text, role="supplier")
    if party:
        result.parties.append({"role": "supplier", "name": party})
        result.values.append(_text_field("party", str(party)))
        result.filled.append("party")

    amount = _money_str(fields.get("total_amount"))
    surface = amount or ""
    if not amount:
        hit = _extract_amount_surface(text)
        if hit:
            amount, surface = hit
    if amount:
        result.values.append(_money_field("amount", amount, surface or amount))
        result.filled.append("amount")

    _append_optional(result, text, fields)
    return result


def _fill_sales(text: str) -> _ExtractResult:
    result = _ExtractResult()
    fields: dict[str, Any] = {}
    try:
        from src.khata.sales_draft import extract_sale_fields

        fields = extract_sale_fields(text) or {}
    except Exception:  # noqa: BLE001
        fields = {}

    party = None
    if isinstance(fields.get("customer"), dict):
        party = fields["customer"].get("name")
    if not party:
        party = _extract_party_nepali(text, role="customer")
    if not party:
        party = _extract_party_nepali(text, role="supplier")
    if party:
        result.parties.append({"role": "customer", "name": party})
        result.values.append(_text_field("party", str(party)))
        result.filled.append("party")

    amount = _money_str(fields.get("total_amount"))
    surface = amount or ""
    if not amount:
        hit = _extract_amount_surface(text)
        if hit:
            amount, surface = hit
    if amount:
        result.values.append(_money_field("amount", amount, surface or amount))
        result.filled.append("amount")

    _append_optional(result, text, fields)
    return result


def _fill_report(text: str) -> _ExtractResult:
    result = _ExtractResult()
    report_type = _extract_report_type(text)
    if report_type:
        result.values.append(_text_field("report_type", report_type))
        result.filled.append("report_type")
    date_hit = _extract_date(text)
    if date_hit:
        original, normalized = date_hit
        result.dates.append(_date_field("date", original, normalized))
        result.filled.append("date")
    return result


def extract_into_event_frame(request: CanonicalAIRequestV1) -> EventFrameV1 | None:
    frame = request.event_frame
    if frame is None:
        return None

    event_type = (frame.event_type or "unknown").lower()
    if event_type in {"unknown", "dialogue", "accounting_qa"}:
        return frame.model_copy(
            update={
                "inherited_context": {
                    **dict(frame.inherited_context or {}),
                    "extraction_runtime": RUNTIME_VERSION,
                    "extraction_status": "SKIPPED_NON_TRANSACTIONAL",
                }
            }
        )

    text = request.raw_text or ""
    if event_type == "purchase":
        result = _fill_purchase(text)
    elif event_type in {"sales", "sale"}:
        result = _fill_sales(text)
    elif event_type == "report":
        result = _fill_report(text)
    else:
        result = _ExtractResult()
        hit = _extract_amount_surface(text)
        if hit and "amount" in (frame.missing_required_fields or ()):
            amount, surface = hit
            result.values = [_money_field("amount", amount, surface)]
            result.filled = ["amount"]
        _append_optional(result, text, {})

    required = frame.missing_required_fields or ()
    missing = tuple(f for f in required if f not in result.filled)

    if not required and not result.filled:
        status = FrameStatus.EMPTY
    elif missing:
        status = FrameStatus.PARTIAL
    else:
        status = FrameStatus.COMPLETE if result.filled or not required else FrameStatus.EMPTY

    if required and not any(f in result.filled for f in required):
        status = (
            FrameStatus.EMPTY
            if event_type in {"unknown", "dialogue"}
            else FrameStatus.PARTIAL
        )

    ctx = dict(frame.inherited_context or {})
    ctx.update(
        {
            "extraction_runtime": RUNTIME_VERSION,
            "extraction_status": "COMPLETE" if not missing and result.filled else "PARTIAL",
            "filled_fields": list(result.filled),
            "optional_filled": [
                f for f in result.filled if f not in {"party", "amount", "report_type"}
            ],
            "ambiguous_fields": list(result.ambiguous),
        }
    )

    return frame.model_copy(
        update={
            "values": tuple(result.values),
            "parties": tuple(result.parties) if result.parties else frame.parties,
            "items": tuple(result.items) if result.items else frame.items,
            "dates_and_periods": tuple(result.dates)
            if result.dates
            else frame.dates_and_periods,
            "missing_required_fields": missing,
            "ambiguous_fields": tuple(dict.fromkeys(result.ambiguous)),
            "explicit_values": tuple(result.filled),
            "status": status,
            "confidence_by_field": {f: 0.85 for f in result.filled},
            "inherited_context": ctx,
            "ontology_version": frame.ontology_version,
        }
    )


def attach_event_frame_extraction_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    frame = extract_into_event_frame(request)
    if frame is None:
        return request
    return request.model_copy(update={"event_frame": frame})
