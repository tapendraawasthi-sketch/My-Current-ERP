"""e-Khata conversational LLM via Ollama (no API keys)."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import MODEL_NAME, OLLAMA_BASE_URL
from ..falcon_trader import parse_khata_message
from .system_prompt import KHATA_SYSTEM_PROMPT

# Session memory (process-local; fresh session_id = fresh thread)
_sessions: dict[str, list] = {}
_MAX_HISTORY = 20

_llm = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
    temperature=0.45,
    num_ctx=8192,
)

INTENT_LABELS = {
    "khata_credit_sale": "Udharo (Credit Sale)",
    "khata_cash_sale": "Nagad Bikri (Cash Sale)",
    "khata_payment_in": "Payment Aayo",
    "khata_purchase": "Kharid",
    "khata_payment_out": "Payment Gareko",
    "khata_expense": "Kharcha",
}


def _parsed_to_card(parsed: dict[str, Any], raw_text: str) -> dict[str, Any] | None:
    intent = parsed.get("intent")
    amount = parsed.get("AMOUNT")
    if not intent or not amount:
        return None
    return {
        "intent": intent,
        "party": None if parsed.get("PARTY") in (None, "UNKNOWN") else parsed.get("PARTY"),
        "amount": int(amount),
        "item": parsed.get("ITEM"),
        "date": parsed.get("DATE") or date.today().isoformat(),
        "raw_text": raw_text,
    }


def _template_entry_reply(card: dict[str, Any]) -> str:
    label = INTENT_LABELS.get(card["intent"], card["intent"])
    party = card.get("party") or "(party chaina)"
    amount = card["amount"]
    return (
        f"Maile yo transaction bujhe:\n"
        f"• Prakar: {label}\n"
        f"• Party: {party}\n"
        f"• Rakam: NPR {amount:,}\n\n"
        f"Sahi cha bhane **Confirm** thichnus."
    )


def _template_clarify(question: str) -> str:
    if "Aaple" in question:
        return (
            f"{question}\n\n"
            "(Udhaar dine ho ki payment dine? Jastai: `Ram lai 500 diye` = udhaar; "
            "`Shyam le 500 diye` = payment.)"
        )
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
        f"Udharo baahir (dainu baki): NPR {int(out or 0):,}\n"
        f"Udharo bhitra (linu baki): NPR {int(inn or 0):,}"
    )


def _invoke_llm(message: str, session_id: str, balance: dict[str, Any] | None) -> str:
    history = _sessions.setdefault(session_id, [])
    system = KHATA_SYSTEM_PROMPT + _balance_block(balance)
    messages = [SystemMessage(content=system)]
    messages.extend(history[-_MAX_HISTORY:])
    messages.append(HumanMessage(content=message))

    try:
        result = _llm.invoke(messages)
        text = result.content if hasattr(result, "content") else str(result)
    except Exception as exc:
        return f"Ollama sanga jodna sakina: {exc}. `ollama serve` ra erp_bot start garnus."

    history.append(HumanMessage(content=message))
    history.append(AIMessage(content=text))
    if len(history) > _MAX_HISTORY:
        _sessions[session_id] = history[-_MAX_HISTORY:]

    return text.strip()


def khata_chat(
    message: str,
    session_id: str,
    balance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Main entry: rule-based entry detection + Ollama conversation."""
    text = (message or "").strip()
    if not text:
        return {
            "kind": "chat",
            "reply": "Ke lekhnu hunthyo? Udaharan: `Ram lai 500 udhaar diye`",
            "card": None,
            "session_id": session_id,
            "engine": "rules",
        }

    parsed = parse_khata_message(text)

    if parsed.get("clarifying_question"):
        return {
            "kind": "clarify",
            "reply": _template_clarify(str(parsed["clarifying_question"])),
            "card": None,
            "session_id": session_id,
            "engine": "rules",
        }

    card = _parsed_to_card(parsed, text)
    if card:
        # LLM polishes the confirm message but card comes from rules (accurate amounts)
        llm_reply = _invoke_llm(
            f"User le yo khata entry garyo (confirm card dekhau): {text}\n"
            f"Parsed: {json.dumps(card, ensure_ascii=False)}",
            session_id,
            balance,
        )
        reply = llm_reply if len(llm_reply) > 30 else _template_entry_reply(card)
        return {
            "kind": "entry",
            "reply": reply,
            "card": card,
            "session_id": session_id,
            "engine": "hybrid",
        }

    # Free conversation via Ollama
    reply = _invoke_llm(text, session_id, balance)
    return {
        "kind": "chat",
        "reply": reply,
        "card": None,
        "session_id": session_id,
        "engine": "ollama",
    }


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
