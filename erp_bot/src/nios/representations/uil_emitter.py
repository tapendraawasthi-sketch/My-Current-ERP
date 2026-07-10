"""UIL Emitter — UIL → natural language (roundtrip with parser)."""

from __future__ import annotations

from typing import Any

from ..contracts.intelligence_contract import UILDocument


_ACTION_PHRASES: dict[str, str] = {
    "sell": "record a sale",
    "purchase": "record a purchase",
    "ledger_query": "check the ledger balance",
    "tax_query": "answer a tax question",
    "legal_query": "look up legal authority",
    "investment_query": "analyze an investment",
    "simulate": "run a what-if simulation",
    "optimize": "optimize a financial decision",
    "query": "answer a question",
}


def emit_from_dict(uil: dict[str, Any]) -> str:
    """Emit NL summary from UIL dict."""
    action = uil.get("action", "query")
    actor = uil.get("actor") or {}
    obj = uil.get("object") or {}
    financial = uil.get("financial_effect") or {}

    party = actor.get("party") if isinstance(actor, dict) else None
    item = obj.get("item") if isinstance(obj, dict) else None
    amount = financial.get("amount") or obj.get("amount") if isinstance(obj, dict) else None

    base = _ACTION_PHRASES.get(action, f"perform {action}")

    if action == "sell" and party and item and amount:
        return f"{party} sold {item} for Rs. {amount:,.0f}"
    if action == "sell" and party and amount:
        return f"{party} le Rs. {amount:,.0f} ko saman becheko"
    if action == "purchase" and party and amount:
        return f"{party} bata Rs. {amount:,.0f} ko saman kineko"
    if action == "ledger_query" and party:
        return f"What is {party}'s balance?"
    if action == "ledger_query":
        return "What is the current ledger balance?"
    if action == "tax_query":
        return "What are the tax implications?"
    if action == "investment_query" and obj.get("symbol"):
        return f"What is the NEPSE quote for {obj['symbol']}?"
    if amount and action in ("sell", "purchase"):
        return f"Please {base} of Rs. {amount:,.0f}"
    if party:
        return f"Please {base} involving {party}"
    return f"Please {base}"


def emit_from_uil(uil: UILDocument) -> str:
    """Emit NL from UILDocument."""
    actor = uil.metadata.get("actor")
    obj = uil.metadata.get("object") or {}
    financial = uil.metadata.get("financial_effect") or {}
    return emit_from_dict({
        "action": uil.action,
        "actor": actor,
        "object": obj if isinstance(obj, dict) else {},
        "financial_effect": financial if isinstance(financial, dict) else {},
        "goals": uil.goals,
        "confidence": uil.confidence,
    })


def roundtrip_check(text: str) -> dict[str, Any]:
    """Parse NL → UIL → NL and compare action preservation."""
    from .uil_parser import parse_to_uil

    uil = parse_to_uil(text)
    emitted = emit_from_uil(uil)
    reparsed = parse_to_uil(emitted)
    return {
        "original": text,
        "emitted": emitted,
        "action_preserved": uil.action == reparsed.action,
        "original_action": uil.action,
        "reparsed_action": reparsed.action,
    }
