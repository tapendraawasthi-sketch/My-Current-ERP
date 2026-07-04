"""Customer-facing Falcon agent — rule-based NLU with optional LLM fallback."""

from __future__ import annotations

import re
from typing import Any

from .intents import QUERY_INTENTS, TRANSACTION_INTENTS
from .nlu import parse_message
from .responses import format_confirmation, format_greeting, format_query_answer
from .tools import get_ledger


def ask_customer(question: str, session_id: str = "default") -> dict[str, Any]:
    """Process a customer chat message and return a one-line response."""
    parsed = parse_message(question)
    ledger = get_ledger(session_id)

    # Clarification needed
    if parsed.needs_clarification and parsed.clarification:
        return {
            "answer": parsed.clarification,
            "sources": [],
            "intent": parsed.intent,
            "slots": parsed.slots.to_dict(),
            "mode": "customer",
            "action": "clarify",
        }

    intent = parsed.intent
    slots = parsed.slots

    # Greeting
    if intent == "GENERAL":
        q = question.strip().lower()
        if re.match(r"^(hi|hello|hey|namaste|namaskar|help|madat)\b", q):
            return {
                "answer": format_greeting(),
                "sources": [],
                "intent": intent,
                "slots": slots.to_dict(),
                "mode": "customer",
                "action": "greet",
            }
        return {
            "answer": (
                "Maile bujhina — udharo, payment, bikri, wa kharcha jastai "
                "ek line ma bhannus. Jastai: 'Ram lai 500 udharo diye'."
            ),
            "sources": [],
            "intent": intent,
            "slots": slots.to_dict(),
            "mode": "customer",
            "action": "fallback",
        }

    # Query intents
    if intent in QUERY_INTENTS:
        if intent == "QUERY_BALANCE_ONE" and slots.party:
            data = ledger.query_balance_one(slots.party)
            answer = format_query_answer(intent, data)
        elif intent == "QUERY_BALANCE_ALL":
            data = ledger.query_balance_all()
            answer = format_query_answer(intent, data)
        elif intent == "QUERY_DAILY_TOTAL":
            date_ref = slots.date_ref or "today"
            data = ledger.query_daily_total(date_ref)
            answer = format_query_answer(intent, data)
        elif intent == "QUERY_STOCK" and slots.item:
            data = ledger.query_stock(slots.item)
            answer = format_query_answer(intent, data)
        elif intent == "REMINDER_REQUEST" and slots.party:
            answer = format_confirmation(intent, slots)
        else:
            return {
                "answer": parsed.clarification or "Thap bhayena — feri bhannus.",
                "sources": [],
                "intent": intent,
                "slots": slots.to_dict(),
                "mode": "customer",
                "action": "clarify",
            }

        return {
            "answer": answer,
            "sources": [],
            "intent": intent,
            "slots": slots.to_dict(),
            "mode": "customer",
            "action": "query",
        }

    # Transaction intents — post to ledger
    if intent in TRANSACTION_INTENTS:
        result = ledger.post(intent, slots)
        answer = format_confirmation(intent, slots)
        return {
            "answer": answer,
            "sources": [],
            "intent": intent,
            "slots": slots.to_dict(),
            "mode": "customer",
            "action": "post",
            "entry_id": result.get("entry_id"),
        }

    return {
        "answer": "Maile bujhina — feri sodhnus.",
        "sources": [],
        "intent": intent,
        "slots": slots.to_dict(),
        "mode": "customer",
        "action": "fallback",
    }
