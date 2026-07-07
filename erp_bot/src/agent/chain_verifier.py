"""
Chain-of-verification — fast second-pass check on generated journal entries.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ollama import Client

from ..config import FAST_MODEL, OLLAMA_BASE_URL
from ..reasoning.accounting_reasoner import JournalEntry

logger = logging.getLogger(__name__)

VERIFY_PROMPT = """You are an accounting auditor. Review this journal entry.
List ONLY factual errors (unbalanced, wrong account nature, wrong VAT math).
If no errors, reply exactly: OK
If errors, reply JSON array of error strings, max 3 items.
Do NOT change party or intent. Be strict on Dr=Cr balance."""


def chain_verify(entry: JournalEntry, context: dict[str, Any] | None = None) -> tuple[JournalEntry, list[str]]:
    """
    Second-pass verification via fast model.
    Returns (entry, warnings). Does not block on LLM failure.
    """
    ctx = context or {}
    total_dr = sum(l.debit for l in entry.lines)
    total_cr = sum(l.credit for l in entry.lines)
    if abs(total_dr - total_cr) >= 0.01:
        return entry, [f"Unbalanced: Dr {total_dr:,.2f} ≠ Cr {total_cr:,.2f}"]

    client = Client(host=OLLAMA_BASE_URL)
    payload = {
        "intent": entry.intent,
        "party": entry.party,
        "amount": entry.amount,
        "lines": [{"account": l.account, "debit": l.debit, "credit": l.credit} for l in entry.lines],
        "cash_balance": ctx.get("cash_balance"),
    }

    try:
        response = client.chat(
            model=FAST_MODEL,
            messages=[
                {"role": "system", "content": VERIFY_PROMPT},
                {
                    "role": "user",
                    "content": f"Entry:\n{json.dumps(payload, indent=2)}\n\nErrors or OK?",
                },
            ],
            options={"temperature": 0, "num_ctx": 2048},
        )
        text = (response.message.content or "").strip()
        if text.upper().startswith("OK") or text == "[]":
            return entry, []
        if text.startswith("["):
            errors = json.loads(text)
            return entry, [str(e) for e in errors[:3]]
        if text:
            return entry, [text[:200]]
    except Exception as exc:
        logger.warning("Chain verify failed: %s", exc)

    return entry, []
