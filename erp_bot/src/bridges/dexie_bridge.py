"""
Dexie bridge — read ledger data from frontend-pushed session snapshots.

The browser is source-of-truth (IndexedDB). Tools call these helpers which
read the latest snapshot for the active session_id.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from .session_data import get_session_context

_CURRENT_SESSION = "default"


def set_active_session(session_id: str) -> None:
    global _CURRENT_SESSION
    _CURRENT_SESSION = session_id or "default"


def _ctx(session_id: str | None = None) -> dict[str, Any]:
    return get_session_context(session_id or _CURRENT_SESSION)


def query_party_balance(party_name: str, session_id: str | None = None) -> dict[str, Any]:
    """Party balance from session snapshot or cached party_balances."""
    ctx = _ctx(session_id)
    balances = ctx.get("party_balances") or {}
    party_key = next(
        (k for k in balances if k.lower() == party_name.lower()),
        None,
    )
    if party_key is not None:
        net = float(balances[party_key])
        return {
            "party": party_key,
            "total_receivable": max(0, net),
            "total_payable": max(0, -net),
            "net_balance": net,
            "source": "session_snapshot",
        }

    detail = (ctx.get("party_details") or {}).get(party_name)
    if detail:
        return detail

    return {
        "party": party_name,
        "total_receivable": 0,
        "total_payable": 0,
        "net_balance": 0,
        "note": "No ledger data in session — open e-Khata panel to sync Dexie snapshot.",
        "source": "empty",
    }


def query_account_balance(account_code: str, session_id: str | None = None) -> dict[str, Any]:
    ctx = _ctx(session_id)
    key = account_code.replace("KH-", "").lower()
    if account_code == "KH-CASH":
        bal = ctx.get("cash_balance")
    elif account_code == "KH-BANK":
        bal = ctx.get("bank_balance")
    else:
        bal = (ctx.get("account_balances") or {}).get(account_code)

    if bal is None:
        return {
            "account_code": account_code,
            "balance": None,
            "note": "Balance not in session snapshot.",
        }
    return {
        "account_code": account_code,
        "balance": float(bal),
        "today_receipts": ctx.get("today_receipts"),
        "today_payments": ctx.get("today_payments"),
    }


def search_entries(query: str, days: int = 30, session_id: str | None = None) -> list[dict[str, Any]]:
    ctx = _ctx(session_id)
    entries = ctx.get("recent_entries") or []
    q = query.lower()
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    results = []
    for e in entries:
        if str(e.get("date", "")) < cutoff:
            continue
        hay = f"{e.get('narration','')} {e.get('party','')} {e.get('amount','')}".lower()
        if q in hay:
            results.append(e)
    return results[:20]


def check_today_duplicates(
    party: str,
    amount: float,
    entry_type: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    ctx = _ctx(session_id)
    today = datetime.now().strftime("%Y-%m-%d")
    for e in ctx.get("recent_entries") or []:
        if (
            e.get("date") == today
            and str(e.get("party", "")).lower() == party.lower()
            and abs(float(e.get("amount", 0)) - amount) < 0.01
            and entry_type in str(e.get("intent", ""))
        ):
            return {"duplicate": True, "match": e}
    return {"duplicate": False}


def compute_trial_balance(session_id: str | None = None) -> dict[str, Any]:
    ctx = _ctx(session_id)
    if ctx.get("trial_balance"):
        return ctx["trial_balance"]
    return {
        "rows": [],
        "totalDebit": 0,
        "totalCredit": 0,
        "isBalanced": ctx.get("trial_balance_balanced", True),
        "note": "Push session snapshot from frontend for full trial balance.",
    }


def compute_pnl(period: str = "current_month", session_id: str | None = None) -> dict[str, Any]:
    ctx = _ctx(session_id)
    if period in ("current_month", "this_month"):
        return {
            "total_income": ctx.get("month_income", 0),
            "total_expenses": ctx.get("month_expense", 0),
            "net_profit": ctx.get("month_profit", 0),
            "period": period,
        }
    return {
        "total_income": ctx.get("month_income", 0),
        "total_expenses": ctx.get("month_expense", 0),
        "net_profit": ctx.get("month_profit", 0),
        "period": period,
        "note": "Granular period P&L requires full Dexie sync.",
    }


def dumps_result(data: Any) -> str:
    return json.dumps(data, default=str)
