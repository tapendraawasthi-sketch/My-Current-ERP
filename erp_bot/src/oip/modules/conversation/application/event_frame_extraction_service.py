"""MAI-19 slice 1 — structured EventFrame value extraction (deterministic).

Fills MAI-18 EventFrame skeleton from selected spec using purchase/sales
extractors + Nepali-aware party/amount cues. Never posts, never merges drafts,
never grants execution authority.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from ....contracts.common import ConfidenceV1, MoneyV1, ProvenanceKind
from ....contracts.event_frame import (
    EventFrameV1,
    FrameStatus,
    MoneyFieldValueV1,
    TextFieldValueV1,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-19.0.1-slice1"

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
_AMOUNT_BARE = re.compile(
    r"(?:rs\.?|npr|रु\.?|₹)\s*([\d,]+(?:\.\d+)?)|"
    r"\b([\d,]+(?:\.\d+)?)\b",
    re.I,
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


def _money_str(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if isinstance(value, Decimal):
            d = value
        elif isinstance(value, float):
            # Avoid binary float: stringify via Decimal from repr only if needed.
            d = Decimal(str(value))
        else:
            d = Decimal(str(value).replace(",", ""))
        if d.is_nan() or d.is_infinite() or d <= 0:
            return None
        # Normalize trailing zeros for MoneyV1.
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


def _extract_party_nepali(text: str, *, role: str) -> str | None:
    if role == "customer":
        m = _PARTY_LAI.search(text or "")
        if m:
            return m.group(1).strip()
    m = _PARTY_BATA.search(text or "")
    if m:
        return m.group(1).strip()
    return None


def _extract_amount_surface(text: str) -> tuple[str, str] | None:
    """Return (amount_str, surface) or None."""
    raw = text or ""
    m = _AMOUNT_KO.search(raw)
    if m:
        amt = _money_str(m.group(1))
        if amt:
            return amt, m.group(0).strip()
    try:
        from src.nlu.text_normalize import extract_amount

        extracted = extract_amount(raw)
        amt = _money_str(extracted)
        if amt:
            return amt, amt
    except Exception:  # noqa: BLE001
        pass
    m2 = _AMOUNT_BARE.search(raw)
    if m2:
        g = m2.group(1) or m2.group(2)
        amt = _money_str(g)
        if amt:
            return amt, (m2.group(0) or amt).strip()
    return None


def _extract_report_type(text: str) -> str | None:
    for pattern, report_type in _REPORT_TYPES:
        if pattern.search(text or ""):
            return report_type
    return None


def _fill_purchase(text: str) -> tuple[list[Any], list[dict[str, Any]], list[str]]:
    values: list[Any] = []
    parties: list[dict[str, Any]] = []
    filled: list[str] = []
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
        parties.append({"role": "supplier", "name": party})
        values.append(_text_field("party", str(party)))
        filled.append("party")

    amount = _money_str(fields.get("total_amount"))
    surface = amount or ""
    if not amount:
        hit = _extract_amount_surface(text)
        if hit:
            amount, surface = hit
    if amount:
        values.append(_money_field("amount", amount, surface or amount))
        filled.append("amount")
    return values, parties, filled


def _fill_sales(text: str) -> tuple[list[Any], list[dict[str, Any]], list[str]]:
    values: list[Any] = []
    parties: list[dict[str, Any]] = []
    filled: list[str] = []
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
        parties.append({"role": "customer", "name": party})
        values.append(_text_field("party", str(party)))
        filled.append("party")

    amount = _money_str(fields.get("total_amount"))
    surface = amount or ""
    if not amount:
        hit = _extract_amount_surface(text)
        if hit:
            amount, surface = hit
    if amount:
        values.append(_money_field("amount", amount, surface or amount))
        filled.append("amount")
    return values, parties, filled


def _fill_report(text: str) -> tuple[list[Any], list[str]]:
    report_type = _extract_report_type(text)
    if not report_type:
        return [], []
    return [_text_field("report_type", report_type)], ["report_type"]


def extract_into_event_frame(request: CanonicalAIRequestV1) -> EventFrameV1 | None:
    frame = request.event_frame
    if frame is None:
        return None

    # Do not invent into unknown / dialogue / qa skeletons.
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
    values: list[Any] = []
    parties: list[dict[str, Any]] = []
    filled: list[str] = []

    if event_type == "purchase":
        values, parties, filled = _fill_purchase(text)
    elif event_type in {"sales", "sale"}:
        values, parties, filled = _fill_sales(text)
    elif event_type == "report":
        values, filled = _fill_report(text)
        parties = []
    else:
        # Soft: try amount-only for other txn types; leave party missing.
        hit = _extract_amount_surface(text)
        if hit and "amount" in (frame.missing_required_fields or ()):
            amount, surface = hit
            values = [_money_field("amount", amount, surface)]
            filled = ["amount"]

    missing = tuple(
        f for f in (frame.missing_required_fields or ()) if f not in filled
    )
    if not (frame.missing_required_fields or ()) and not filled:
        status = FrameStatus.EMPTY
    elif missing:
        status = FrameStatus.PARTIAL
    else:
        status = FrameStatus.COMPLETE if filled or not frame.missing_required_fields else FrameStatus.EMPTY

    # If skeleton had required fields and we filled none, stay PARTIAL/EMPTY.
    if (frame.missing_required_fields or ()) and not filled:
        status = (
            FrameStatus.EMPTY
            if event_type in {"unknown", "dialogue"}
            else FrameStatus.PARTIAL
        )

    ctx = dict(frame.inherited_context or {})
    ctx.update(
        {
            "extraction_runtime": RUNTIME_VERSION,
            "extraction_status": "COMPLETE" if not missing and filled else "PARTIAL",
            "filled_fields": list(filled),
        }
    )

    return frame.model_copy(
        update={
            "values": tuple(values),
            "parties": tuple(parties) if parties else frame.parties,
            "missing_required_fields": missing,
            "explicit_values": tuple(filled),
            "status": status,
            "confidence_by_field": {f: 0.85 for f in filled},
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
