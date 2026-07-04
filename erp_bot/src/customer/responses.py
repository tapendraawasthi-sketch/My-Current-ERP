"""One-line response formatting for customer Falcon."""

from __future__ import annotations

from .intents import CustomerIntent
from .slot_extractor import Slots


def _rs(amount: float) -> str:
    if amount >= 100_000:
        return f"Rs. {amount:,.0f}"
    if amount == int(amount):
        return f"Rs. {int(amount):,}"
    return f"Rs. {amount:,.2f}"


def format_confirmation(intent: CustomerIntent, slots: Slots) -> str:
    """Format a one-line confirmation for a logged transaction."""
    amt = _rs(slots.amount) if slots.amount is not None else ""
    party = slots.party or ""
    item = f" ({slots.item})" if slots.item else ""
    date = ""
    if slots.date_ref == "yesterday":
        date = " — hijo"
    elif slots.date_ref == "today":
        date = " — aja"

    templates: dict[str, str] = {
        "SALE_CASH": f"Thik cha — aja nagad bikri {amt} record gare.{date}",
        "SALE_CREDIT": f"Thik cha — {party} lai {amt} udharo diye{item}.{date}",
        "PAYMENT_RECEIVED": f"Thik cha — {party} le {amt} tiryo.{date}",
        "PURCHASE_CASH": f"Thik cha — {amt} ko saman kinyo, nagad tiryo.{date}",
        "PURCHASE_CREDIT": f"Thik cha — {amt or 'saman'} supplier bata udharoma lyaayo.{date}",
        "PAYMENT_MADE": f"Thik cha — {party} lai {amt} tiryo.{date}",
        "EXPENSE": f"Thik cha — {amt} kharcha record garyo{(' (' + slots.item + ')') if slots.item else ''}.{date}",
        "RETURN_SALES": f"Thik cha — grahak bata saman return record garyo.{date}",
        "RETURN_PURCHASE": f"Thik cha — supplier lai saman return garyo.{date}",
        "DISCOUNT_GIVEN": f"Thik cha — {amt}{'%' if slots.is_percent else ''} chhut diyo{item}.{date}",
        "OPENING_ENTRY": f"Thik cha — {party} ko opening balance {amt} set garyo.",
        "REMINDER_REQUEST": f"Thik cha — {party} lai payment reminder pathaune?",
    }
    return templates.get(intent, f"Thik cha — {intent} record garyo.")


def format_query_answer(intent: CustomerIntent, data: dict) -> str:
    if intent == "QUERY_BALANCE_ONE":
        party = data.get("party", "")
        balance = data.get("balance", 0)
        direction = data.get("direction", "receivable")
        if direction == "payable":
            return f"{party} lai tirnu baki: {_rs(balance)}"
        return f"{party} le tirnu baki: {_rs(balance)}"

    if intent == "QUERY_BALANCE_ALL":
        lines = data.get("lines", [])
        if not lines:
            return "Ahile koi sanga pani baki chaina."
        parts = [f"{r['party']}: {_rs(r['balance'])}" for r in lines[:5]]
        suffix = f" (+{len(lines)-5} aru)" if len(lines) > 5 else ""
        return "Baki hisab: " + ", ".join(parts) + suffix

    if intent == "QUERY_DAILY_TOTAL":
        total = data.get("total", 0)
        period = data.get("period", "aja")
        label = {"today": "Aja", "yesterday": "Hijo", "this_month": "Yo mahina"}.get(
            period, "Aja"
        )
        return f"{label} jamma bikri/kamai: {_rs(total)}"

    if intent == "QUERY_STOCK":
        item = data.get("item", "saman")
        qty = data.get("quantity", 0)
        unit = data.get("unit", "")
        return f"{item} baki: {qty} {unit}".strip()

    return data.get("message", "Herda sakina — feri sodhnus.")


def format_greeting() -> str:
    return (
        "Namaste! Ma Falcon — tapai ko digital khata. "
        "Udharo, payment, bikri, kharcha — kehi pani Nepali ma bhannus. "
        "Jastai: 'Ram lai 500 udharo diye' wa 'aja kati kamayo'."
    )
