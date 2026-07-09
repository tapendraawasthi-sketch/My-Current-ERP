"""Deterministic ledger queries from Dexie session snapshots — no LLM guessing."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any

from ..bridges import dexie_bridge
from ..bridges.session_data import get_session_context

_TODAY = re.compile(r"\b(aaja|aaj|today)\b", re.I)
_YESTERDAY = re.compile(r"\b(hijo|yesterday)\b", re.I)
_ENTRY_COUNT = re.compile(
    r"(entry\s*vayo|kunai\s*entry|kati\s*entry|entry\s*gareko|entry\s*cha|"
    r"aajako\s*entry|कति\s*प्रविष्टि|प्रविष्टि\s*भयो)",
    re.I,
)
_CASH = re.compile(r"\b(cash|nagad|नगद)\b", re.I)
_BANK = re.compile(r"\b(bank)\b", re.I)
_PARTY_BALANCE = re.compile(
    r"(\w+)\s+ko\s+(baki|balance|khata)|party\s+balance|"
    r"(\w+)\s+ko\s+udhaar",
    re.I,
)
_SALES = re.compile(r"\b(aajako\s*sales|sales\s*kati)\b", re.I)


def _fmt_amount(n: float | int) -> str:
    return f"Rs. {float(n):,.2f}"


def _entries_for_date(ctx: dict[str, Any], date_iso: str) -> list[dict[str, Any]]:
    return [e for e in (ctx.get("recent_entries") or []) if str(e.get("date", "")) == date_iso]


def handle_ledger_query(question: str, session_id: str) -> dict[str, Any]:
    """Return structured facts from session snapshot for ledger_query intent."""
    dexie_bridge.set_active_session(session_id)
    ctx = get_session_context(session_id)
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    if not ctx:
        return {
            "ok": False,
            "answer": "Khata data sync bhayeko chaina. Orbix panel refresh garnuhos.",
            "facts": {},
        }

    facts: dict[str, Any] = {
        "today_entry_count": ctx.get("today_entry_count"),
        "total_entries": ctx.get("total_entries"),
        "cash_balance": ctx.get("cash_balance"),
        "bank_balance": ctx.get("bank_balance"),
    }

    # Today's / yesterday's entries
    if _ENTRY_COUNT.search(question) or _TODAY.search(question):
        entries = _entries_for_date(ctx, today)
        count = ctx.get("today_entry_count")
        if count is None:
            count = len(entries)
        facts["entries"] = entries[:10]
        facts["date"] = today
        if count == 0:
            answer = "Aaja kunai entry vayeko chaina (0 wota)."
        else:
            lines = [
                f"- {e.get('party') or '—'}: {_fmt_amount(e.get('amount', 0))} ({e.get('narration') or e.get('intent', '')})"
                for e in entries[:5]
            ]
            detail = "\n".join(lines) if lines else ""
            answer = f"Aaja {count} wota entry vayo."
            if detail:
                answer += f"\n{detail}"
        return {"ok": True, "answer": answer, "facts": facts, "template": True}

    if _YESTERDAY.search(question) and _ENTRY_COUNT.search(question):
        entries = _entries_for_date(ctx, yesterday)
        count = len(entries)
        answer = (
            f"Hijo {count} wota entry thiyo."
            if count
            else "Hijo kunai entry vayeko chaina."
        )
        facts["entries"] = entries[:10]
        facts["date"] = yesterday
        return {"ok": True, "answer": answer, "facts": facts, "template": True}

    if _CASH.search(question):
        bal = ctx.get("cash_balance")
        answer = (
            f"Cash balance: {_fmt_amount(bal)}."
            if bal is not None
            else "Cash balance session ma chaina."
        )
        return {"ok": True, "answer": answer, "facts": facts, "template": True}

    if _BANK.search(question):
        bal = ctx.get("bank_balance")
        answer = (
            f"Bank balance: {_fmt_amount(bal)}."
            if bal is not None
            else "Bank balance session ma chaina."
        )
        return {"ok": True, "answer": answer, "facts": facts, "template": True}

    if _SALES.search(question):
        income = ctx.get("month_income", 0)
        answer = f"Yo mahina ko aamdani (approx): {_fmt_amount(income)}."
        return {"ok": True, "answer": answer, "facts": facts, "template": True}

    party_match = _PARTY_BALANCE.search(question)
    if party_match:
        party = party_match.group(1) or party_match.group(3) or ""
        if party and party.lower() not in ("ko", "party"):
            result = dexie_bridge.query_party_balance(party, session_id)
            net = float(result.get("net_balance", 0))
            if net > 0:
                answer = f"{result.get('party', party)} ko baki (receivable): {_fmt_amount(net)}."
            elif net < 0:
                answer = f"{result.get('party', party)} lai dini: {_fmt_amount(abs(net))}."
            else:
                answer = f"{result.get('party', party)} ko baki: {_fmt_amount(0)}."
            facts["party_balance"] = result
            return {"ok": True, "answer": answer, "facts": facts, "template": True}

    # Generic: search recent entries
    hits = dexie_bridge.search_entries(question, days=30, session_id=session_id)
    if hits:
        lines = [
            f"- {h.get('date')}: {h.get('party') or '—'} {_fmt_amount(h.get('amount', 0))}"
            for h in hits[:5]
        ]
        answer = "Yo match hune entries:\n" + "\n".join(lines)
        facts["search_hits"] = hits
        return {"ok": True, "answer": answer, "facts": facts, "template": True}

    # Fallback summary
    count = ctx.get("today_entry_count", 0)
    answer = (
        f"Aaja {count} wota entry. Cash: {_fmt_amount(ctx.get('cash_balance') or 0)}. "
        f"Bank: {_fmt_amount(ctx.get('bank_balance') or 0)}."
    )
    return {"ok": True, "answer": answer, "facts": facts, "template": True}
