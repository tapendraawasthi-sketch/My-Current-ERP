"""Ledger tools for customer Falcon — in-memory stub until ERP API wiring."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from .intents import CustomerIntent
from .slot_extractor import Slots


@dataclass
class LedgerEntry:
    id: str
    intent: str
    party: str | None
    amount: float
    item: str | None
    date_ref: str
    posted_at: str


@dataclass
class SessionLedger:
    entries: list[LedgerEntry] = field(default_factory=list)
    party_balances: dict[str, float] = field(default_factory=dict)
    daily_totals: dict[str, float] = field(default_factory=dict)
    stock: dict[str, float] = field(default_factory=dict)
    _counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"E{self._counter:04d}"

    def post(self, intent: CustomerIntent, slots: Slots) -> dict[str, Any]:
        entry_id = self._next_id()
        amount = slots.amount or 0.0
        date_key = slots.date_ref or "today"
        party = slots.party

        entry = LedgerEntry(
            id=entry_id,
            intent=intent,
            party=party,
            amount=amount,
            item=slots.item,
            date_ref=date_key,
            posted_at=date.today().isoformat(),
        )
        self.entries.append(entry)

        if intent == "SALE_CASH":
            self.daily_totals[date_key] = self.daily_totals.get(date_key, 0) + amount
        elif intent == "SALE_CREDIT" and party:
            self.party_balances[party] = self.party_balances.get(party, 0) + amount
        elif intent == "PAYMENT_RECEIVED" and party:
            self.party_balances[party] = self.party_balances.get(party, 0) - amount
        elif intent == "PAYMENT_MADE" and party:
            self.party_balances[party] = self.party_balances.get(party, 0) - amount
        elif intent == "PURCHASE_CREDIT" and party:
            self.party_balances[party] = self.party_balances.get(party, 0) - amount
        elif intent == "EXPENSE":
            self.daily_totals[f"expense_{date_key}"] = (
                self.daily_totals.get(f"expense_{date_key}", 0) + amount
            )

        return {"entry_id": entry_id, "status": "posted"}

    def query_balance_one(self, party: str) -> dict[str, Any]:
        balance = self.party_balances.get(party, 0.0)
        direction = "receivable" if balance >= 0 else "payable"
        return {"party": party, "balance": abs(balance), "direction": direction}

    def query_balance_all(self) -> dict[str, Any]:
        lines = [
            {"party": p, "balance": abs(b)}
            for p, b in self.party_balances.items()
            if abs(b) > 0.01
        ]
        lines.sort(key=lambda x: x["balance"], reverse=True)
        return {"lines": lines}

    def query_daily_total(self, date_ref: str = "today") -> dict[str, Any]:
        return {
            "total": self.daily_totals.get(date_ref, 0),
            "period": date_ref,
        }

    def query_stock(self, item: str) -> dict[str, Any]:
        key = item.lower().strip()
        return {
            "item": item,
            "quantity": self.stock.get(key, 0),
            "unit": "",
        }


# Session-scoped ledgers (keyed by session_id in agent.py)
_ledgers: dict[str, SessionLedger] = {}


def get_ledger(session_id: str) -> SessionLedger:
    if session_id not in _ledgers:
        _ledgers[session_id] = SessionLedger()
    return _ledgers[session_id]
