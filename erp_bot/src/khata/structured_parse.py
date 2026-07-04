"""LLM structured transaction parser — fallback when regex rules miss."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

VALID_INTENTS = {
    "khata_credit_sale",
    "khata_cash_sale",
    "khata_payment_in",
    "khata_purchase",
    "khata_payment_out",
    "khata_expense",
    "khata_credit_purchase",
    "khata_outstanding_expense",
    "khata_prepaid_expense",
    "khata_bad_debt_writeoff",
    "khata_bad_debt_recovery",
    "khata_provision_bad_debt",
    "khata_salary_payment",
    "khata_salary_accrual",
    "khata_ssf_employee",
    "khata_ssf_employer",
    "khata_gratuity_provision",
    "khata_gratuity_payment",
    "khata_vat_sales",
    "khata_vat_purchase",
    "khata_vat_payment",
    "khata_tds_deducted",
    "khata_tds_paid",
    "khata_other_income",
    "khata_depreciation",
    "khata_bank_charges",
    "khata_discount_allowed",
    "khata_discount_received",
    "khata_capital_introduced",
    "khata_drawings",
    "khata_loan_received",
    "khata_loan_repayment",
    "khata_stock_purchase",
    "khata_stock_sale_cogs",
    "khata_contra_cash_bank",
    "khata_sales_return",
    "khata_purchase_return",
    "khata_customer_advance",
    "khata_employee_advance",
    "khata_opening_balance",
    "khata_asset_disposal",
    "khata_inventory_write_down",
    "khata_commission_income",
    "khata_rent_expense",
}

STRUCTURED_PARSE_INSTRUCTION = """You are e-Khata CA parser for Nepal businesses.
Parse the user's transaction message into JSON ONLY — no markdown, no explanation.

Schema:
{
  "intent": "khata_<type>",
  "amount": <number NPR>,
  "party": <string or null>,
  "item": <string or null>,
  "journalLines": [{"account":"<code>","debit":<n>,"credit":<n>}],
  "explanation": "<one sentence CA reasoning>"
}

Rules:
- Use valid intent from khata_* list (credit_sale, payment_in, purchase, expense, vat_sales, etc.)
- amount must come from user text — NEVER invent
- journalLines must balance (total debit = total credit)
- Account codes: KH-CASH, KH-BANK, KH-DEBT, KH-CRED, KH-SALE, KH-PUR, KH-EXP, KH-STOCK, etc.
- If unclear, return {"error":"clarify","question":"..."}"""


def _extract_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


def structured_parse_to_card(data: dict[str, Any], raw_text: str) -> dict[str, Any] | None:
    if data.get("error") == "clarify":
        return None

    intent = data.get("intent")
    amount = data.get("amount")
    if not intent or intent not in VALID_INTENTS:
        return None
    if not amount or not isinstance(amount, (int, float)) or amount <= 0:
        return None

    lines = data.get("journalLines") or []
    total_dr = sum(float(l.get("debit") or 0) for l in lines)
    total_cr = sum(float(l.get("credit") or 0) for l in lines)
    if lines and abs(total_dr - total_cr) > 0.02:
        return None

    card: dict[str, Any] = {
        "intent": intent,
        "party": data.get("party"),
        "amount": int(round(float(amount))),
        "item": data.get("item"),
        "date": date.today().isoformat(),
        "raw_text": raw_text,
    }
    if lines:
        card["journalLines"] = [
            {
                "accountCode": l.get("account", ""),
                "accountName": l.get("account", ""),
                "debit": float(l.get("debit") or 0),
                "credit": float(l.get("credit") or 0),
            }
            for l in lines
        ]
    if data.get("explanation"):
        card["caExplanation"] = str(data["explanation"])
    return card


def parse_llm_response(llm_text: str, raw_text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Returns (card, clarifying_question)."""
    data = _extract_json(llm_text)
    if not data:
        return None, None
    if data.get("error") == "clarify":
        return None, str(data.get("question") or "Thora clear lekhnus.")
    card = structured_parse_to_card(data, raw_text)
    return card, None
