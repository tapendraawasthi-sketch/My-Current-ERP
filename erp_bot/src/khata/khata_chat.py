"""e-Khata conversational LLM via Ollama — CA accounting language brain."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import MODEL_NAME, OLLAMA_BASE_URL
from ..falcon_trader import parse_khata_message
from .system_prompt import KHATA_SYSTEM_PROMPT

_sessions: dict[str, list] = {}
_MAX_HISTORY = 24

_llm = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
    temperature=0.35,
    num_ctx=8192,
)

INTENT_LABELS = {
    "khata_credit_sale": "Credit Sale (Udhaar / Receivable)",
    "khata_cash_sale": "Cash Sale",
    "khata_payment_in": "Payment Received",
    "khata_purchase": "Cash Purchase",
    "khata_payment_out": "Payment Made",
    "khata_expense": "Expense",
    "khata_credit_purchase": "Credit Purchase (Payable)",
    "khata_outstanding_expense": "Accrued Expense",
    "khata_bad_debt_writeoff": "Bad Debt Write-off",
    "khata_bad_debt_recovery": "Bad Debt Recovery",
    "khata_provision_bad_debt": "Provision for Bad Debts",
    "khata_salary_accrual": "Salary Accrual",
    "khata_salary_payment": "Salary Payment",
    "khata_ssf_employee": "SSF Employee (10%)",
    "khata_ssf_employer": "SSF Employer (11%)",
    "khata_gratuity_provision": "Gratuity Provision",
    "khata_gratuity_payment": "Gratuity Payment",
    "khata_vat_sales": "VAT Sale (13%)",
    "khata_vat_purchase": "VAT Purchase",
    "khata_vat_payment": "VAT Payment to IRD",
    "khata_tds_deducted": "TDS Deducted",
    "khata_tds_paid": "TDS Remittance",
    "khata_depreciation": "Depreciation",
    "khata_other_income": "Other Income",
    "khata_capital_introduced": "Capital Introduced",
    "khata_drawings": "Drawings",
    "khata_loan_received": "Loan Received",
    "khata_loan_repayment": "Loan Repayment",
    "khata_stock_purchase": "Stock Purchase",
    "khata_contra_cash_bank": "Contra Cash to Bank",
}


def _detect_language(text: str, hint: str | None = None) -> str:
    if hint in ("nepali", "english", "mixed"):
        return hint
    en = len(re.findall(
        r"\b(the|is|are|what|how|entry|debit|credit|account|journal|asset|liability)\b",
        text, re.I,
    ))
    ne = len(re.findall(
        r"\b(k\s*ho|kasari|udhaar|kharcha|bikri|tiryo|hisab|lekha|chha|hunchha)\b|[\u0900-\u097F]",
        text, re.I,
    ))
    if en > ne * 1.5:
        return "english"
    if ne > en * 1.5:
        return "nepali"
    return "mixed"


def _parsed_to_card(parsed: dict[str, Any], raw_text: str) -> dict[str, Any] | None:
    intent = parsed.get("intent")
    amount = parsed.get("AMOUNT")
    if not intent or not amount:
        return None
    card: dict[str, Any] = {
        "intent": intent,
        "party": None if parsed.get("PARTY") in (None, "UNKNOWN") else parsed.get("PARTY"),
        "amount": int(amount),
        "item": parsed.get("ITEM"),
        "date": parsed.get("DATE") or date.today().isoformat(),
        "raw_text": raw_text,
    }
    if parsed.get("journal_lines"):
        card["journalLines"] = parsed["journal_lines"]
    if parsed.get("ca_explanation"):
        card["caExplanation"] = parsed["ca_explanation"]
    return card


def _template_entry_reply(card: dict[str, Any], lang: str) -> str:
    label = INTENT_LABELS.get(card["intent"], card["intent"])
    party = card.get("party") or ("(no party)" if lang == "english" else "(party chaina)")
    amount = card["amount"]
    if lang == "english":
        return (
            f"I understood this journal entry:\n"
            f"• Type: {label}\n"
            f"• Party: {party}\n"
            f"• Amount: NPR {amount:,}\n\n"
            f"Click **Confirm** if correct."
        )
    return (
        f"Maile yo entry bujhe:\n"
        f"• Prakar: {label}\n"
        f"• Party: {party}\n"
        f"• Rakam: NPR {amount:,}\n\n"
        f"Sahi cha bhane **Confirm** thichnus."
    )


def _template_clarify(question: str, lang: str) -> str:
    if lang == "english" and "Aaple" in question:
        return (
            "Did YOU give credit or did THEY pay?\n"
            "• `Ram lai 500 diye` = credit sale (udhaar)\n"
            "• `Shyam le 500 tiryo` = payment received"
        )
    if "Aaple" in question:
        return (
            f"{question}\n\n"
            "(Udhaar dine ho ki payment dine? Jastai: `Ram lai 500 diye` = udhaar; "
            "`Shyam le 500 diye` = payment.)"
        )
    if lang == "english":
        return f"{question}\n\nPlease include amount and party if applicable."
    return f"{question}\n\nThora clear lekhnus — rakam ra party bhannus."


def _balance_block(balance: dict[str, Any] | None) -> str:
    if not balance:
        return ""
    out = balance.get("udhaar_out")
    inn = balance.get("udhaar_in")
    if out is None and inn is None:
        return ""
    return (
        f"\n\n[CURRENT KHATA BALANCE]\n"
        f"Udharo baahir (receivable): NPR {int(out or 0):,}\n"
        f"Udharo bhitra (payable): NPR {int(inn or 0):,}"
    )


def _lang_instruction(lang: str) -> str:
    if lang == "english":
        return "\n\n[LANGUAGE] User writes in English. Reply in English."
    if lang == "nepali":
        return "\n\n[LANGUAGE] User writes in Nepali. Reply in Nepali (Roman or Devanagari matching user)."
    return "\n\n[LANGUAGE] User uses mixed Nepali/English. Match their style."


def _invoke_llm(
    message: str,
    session_id: str,
    balance: dict[str, Any] | None,
    lang: str,
    context: str = "",
) -> str:
    history = _sessions.setdefault(session_id, [])
    system = KHATA_SYSTEM_PROMPT + _balance_block(balance) + _lang_instruction(lang)
    if context:
        system += f"\n\n[CONTEXT]\n{context}"

    messages = [SystemMessage(content=system)]
    messages.extend(history[-_MAX_HISTORY:])
    messages.append(HumanMessage(content=message))

    try:
        result = _llm.invoke(messages)
        text = result.content if hasattr(result, "content") else str(result)
    except Exception as exc:
        if lang == "english":
            return f"Could not connect to Ollama: {exc}. Start `ollama serve` and erp_bot."
        return f"Ollama sanga jodna sakina: {exc}. `ollama serve` ra erp_bot start garnus."

    history.append(HumanMessage(content=message))
    history.append(AIMessage(content=text))
    if len(history) > _MAX_HISTORY:
        _sessions[session_id] = history[-_MAX_HISTORY:]

    return text.strip()


def _is_transaction_signal(text: str) -> bool:
    return bool(re.search(
        r"\b(\d{2,}|saya|hajar|lakh)\b.*\b(udhaar|salary|ssf|gratuity|vat|tds|"
        r"depreciation|bad\s*debt|loan|capital|drawings|stock|kharcha|bikri|kineko|tiryo)\b",
        text, re.I,
    ))


def khata_chat(
    message: str,
    session_id: str,
    balance: dict[str, Any] | None = None,
    language: str | None = None,
) -> dict[str, Any]:
    """Accounting language brain: rules for entries + Ollama for understanding & chat."""
    text = (message or "").strip()
    lang = _detect_language(text, language)

    if not text:
        empty = (
            "What would you like to enter?"
            if lang == "english"
            else "Ke lekhnu hunthyo? Udaharan: `Ram lai 500 udhaar diye`"
        )
        return {"kind": "chat", "reply": empty, "card": None, "session_id": session_id, "engine": "rules"}

    # Rule-based entry detection (accurate amounts — LLM never invents)
    if _is_transaction_signal(text):
        parsed = parse_khata_message(text)

        if parsed.get("clarifying_question"):
            return {
                "kind": "clarify",
                "reply": _template_clarify(str(parsed["clarifying_question"]), lang),
                "card": None,
                "session_id": session_id,
                "engine": "hybrid",
            }

        card = _parsed_to_card(parsed, text)
        if card:
            llm_reply = _invoke_llm(
                text,
                session_id,
                balance,
                lang,
                context=(
                    f"User posted a transaction. Parsed entry (DO NOT change amounts): "
                    f"{json.dumps(card, ensure_ascii=False)}. "
                    f"Confirm the entry in {'English' if lang == 'english' else 'Nepali'} "
                    f"with Dr/Cr explanation. Tell them to click Confirm."
                ),
            )
            reply = llm_reply if len(llm_reply) > 40 else _template_entry_reply(card, lang)
            return {
                "kind": "entry",
                "reply": reply,
                "card": card,
                "session_id": session_id,
                "engine": "hybrid",
            }

    # Accounting language Q&A and general conversation via Ollama
    reply = _invoke_llm(text, session_id, balance, lang)
    return {
        "kind": "chat",
        "reply": reply,
        "card": None,
        "session_id": session_id,
        "engine": "ollama",
    }


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
