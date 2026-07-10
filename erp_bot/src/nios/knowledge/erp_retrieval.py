"""Live ERP retrieval — session snapshot parties and balances."""

from __future__ import annotations

import re
from typing import Any

from ...bridges.session_data import get_session_context


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def search_parties(session_id: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
    ctx = get_session_context(session_id)
    parties = ctx.get("parties") or ctx.get("partyBalances") or []
    if not isinstance(parties, list):
        return []

    q = _normalize_name(query)
    if not q:
        return parties[:limit]

    scored: list[tuple[float, dict]] = []
    for p in parties:
        name = _normalize_name(str(p.get("name") or p.get("partyName") or ""))
        if not name:
            continue
        if q in name or name in q:
            scored.append((1.0, p))
        elif any(w in name for w in q.split() if len(w) > 2):
            scored.append((0.7, p))

    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:limit]]


def party_balance(session_id: str, party_name: str) -> dict[str, Any] | None:
    matches = search_parties(session_id, party_name, limit=1)
    if not matches:
        return None
    p = matches[0]
    return {
        "party": p.get("name") or p.get("partyName"),
        "balance": p.get("balance", p.get("closingBalance", 0)),
        "type": p.get("type", "party"),
        "source": "cap.erp.session_snapshot",
    }


def format_party_balance_answer(session_id: str, message: str) -> str | None:
    """Extract party name from message and return balance if found."""
    ctx = get_session_context(session_id)
    parties = ctx.get("parties") or ctx.get("partyBalances") or []
    if not isinstance(parties, list) or not parties:
        return None

    lower = message.lower()
    for p in parties:
        name = str(p.get("name") or p.get("partyName") or "")
        if not name:
            continue
        if name.lower() in lower or any(
            part in lower for part in name.lower().split() if len(part) > 2
        ):
            bal = p.get("balance", p.get("closingBalance", 0))
            return f"{name} ko balance: Rs. {float(bal):,.2f}"

    return None
