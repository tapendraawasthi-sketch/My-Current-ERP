"""LLM structured transaction parser — primary brain when Ollama is online."""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
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

# Legacy alias kept for any external imports
STRUCTURED_PARSE_INSTRUCTION = "See extraction_prompt.EXTRACTION_SYSTEM_PROMPT"


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


def _resolve_date(date_hint: str | None) -> str:
    hint = (date_hint or "today").lower()
    if hint == "yesterday":
        return (date.today() - timedelta(days=1)).isoformat()
    return date.today().isoformat()


def _normalize_journal_lines(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Accept dr/cr pairs or legacy debit/credit journalLines."""
    raw = data.get("journal_lines") or data.get("journalLines") or []
    lines: list[dict[str, Any]] = []

    for entry in raw:
        if not isinstance(entry, dict):
            continue
        if "dr" in entry or "cr" in entry:
            amount = float(entry.get("amount") or 0)
            dr = str(entry.get("dr") or "").strip()
            cr = str(entry.get("cr") or "").strip()
            if dr and amount > 0:
                lines.append({
                    "accountCode": dr,
                    "accountName": dr,
                    "debit": amount,
                    "credit": 0.0,
                })
            if cr and amount > 0:
                lines.append({
                    "accountCode": cr,
                    "accountName": cr,
                    "debit": 0.0,
                    "credit": amount,
                })
            continue

        account = str(entry.get("account") or entry.get("accountCode") or "").strip()
        debit = float(entry.get("debit") or 0)
        credit = float(entry.get("credit") or 0)
        if account and (debit or credit):
            lines.append({
                "accountCode": account,
                "accountName": account,
                "debit": debit,
                "credit": credit,
            })

    return lines


def structured_parse_to_card(data: dict[str, Any], raw_text: str) -> dict[str, Any] | None:
    intent = data.get("intent")
    amount = data.get("amount_npr") if data.get("amount_npr") is not None else data.get("amount")
    if not intent or intent not in VALID_INTENTS:
        return None
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return None

    lines = _normalize_journal_lines(data)
    total_dr = sum(float(l.get("debit") or 0) for l in lines)
    total_cr = sum(float(l.get("credit") or 0) for l in lines)
    if lines and abs(total_dr - total_cr) > 0.02:
        return None

    card: dict[str, Any] = {
        "intent": intent,
        "party": data.get("party"),
        "amount": int(round(float(amount))),
        "item": data.get("item"),
        "date": _resolve_date(data.get("date_hint")),
        "raw_text": raw_text,
    }
    if lines:
        card["journalLines"] = lines
    explanation = data.get("explanation_np") or data.get("explanation")
    if explanation:
        card["caExplanation"] = str(explanation)
    if data.get("confidence") is not None:
        card["confidence"] = float(data["confidence"])
    return card


def parse_extraction_response(
    llm_text: str,
    raw_text: str,
) -> dict[str, Any]:
    """Parse Stage-1 LLM JSON into a normalized extraction result."""
    data = _extract_json(llm_text)
    if not data:
        return {"ok": False, "reason": "invalid_json"}

    if data.get("is_question"):
        return {
            "ok": True,
            "is_question": True,
            "question_type": data.get("question_type"),
            "card": None,
            "clarify": None,
        }

    if data.get("needs_clarification") or data.get("error") == "clarify":
        question = (
            data.get("clarification_question")
            or data.get("question")
            or "Thora clear lekhnus — rakam ra party bhannus."
        )
        return {"ok": True, "is_question": False, "card": None, "clarify": str(question)}

    confidence = float(data.get("confidence") or 1.0)
    if confidence < 0.7:
        question = data.get("clarification_question") or "Yo transaction thora unclear cha. Thora clear lekhnus."
        return {"ok": True, "is_question": False, "card": None, "clarify": str(question)}

    card = structured_parse_to_card(data, raw_text)
    if not card:
        return {"ok": False, "reason": "invalid_card"}

    return {"ok": True, "is_question": False, "card": card, "clarify": None}


def parse_llm_response(llm_text: str, raw_text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Legacy API — returns (card, clarifying_question)."""
    result = parse_extraction_response(llm_text, raw_text)
    if not result.get("ok"):
        return None, None
    if result.get("is_question"):
        return None, None
    if result.get("clarify"):
        return None, result["clarify"]
    return result.get("card"), None
