"""Proactive insights after entries and on session start."""

from __future__ import annotations

from datetime import datetime
from typing import Any


class ProactiveEngine:
    """Generate contextual insights without being asked."""

    def get_post_entry_insight(
        self,
        entry: Any,
        context: dict[str, Any],
    ) -> str | None:
        insights: list[str] = []
        party = getattr(entry, "party", None) or (entry.get("party") if isinstance(entry, dict) else None)
        amount = float(getattr(entry, "amount", 0) or (entry.get("amount", 0) if isinstance(entry, dict) else 0))

        if party:
            balances = context.get("party_balances") or {}
            bal = balances.get(party)
            if bal is None:
                for k, v in balances.items():
                    if k.lower() == str(party).lower():
                        bal = v
                        break
            if bal is not None and float(bal) + amount > 50000:
                insights.append(
                    f"⚠️ {party} ko total baki Rs {float(bal) + amount:,.0f} pugisakyo. "
                    f"Collection follow-up garnus?"
                )

        cash_bal = context.get("cash_balance")
        if cash_bal is not None and float(cash_bal) < 5000:
            insights.append(
                f"💰 Cash balance low: Rs {float(cash_bal):,.0f}. "
                f"Collection ya bank withdrawal consider garnus?"
            )

        if context.get("similar_entry_today"):
            similar = context["similar_entry_today"]
            insights.append(
                f"🔍 Similar entry aaja bhayisakeko cha: Rs {similar.get('amount', 0):,.0f} "
                f"to {similar.get('party', '')}. Duplicate ta haina?"
            )

        total_entries = context.get("total_entries", 0)
        if total_entries in (100, 500, 1000, 5000):
            insights.append(
                f"🎉 {total_entries} entries completed! Consistent recordkeeping ramro cha."
            )

        return insights[0] if insights else None

    def get_session_greeting(self, context: dict[str, Any]) -> str:
        hour = datetime.now().hour
        if hour < 12:
            greeting = "शुभ प्रभात! (Good morning!)"
        elif hour < 17:
            greeting = "नमस्ते! (Good afternoon!)"
        else:
            greeting = "शुभ सन्ध्या! (Good evening!)"

        parts = [greeting]

        if context.get("month_profit") is not None:
            parts.append(
                f"📊 Yo mahina: Aamdani Rs {context.get('month_income', 0):,.0f}, "
                f"Kharcha Rs {context.get('month_expense', 0):,.0f}."
            )

        balances = context.get("party_balances") or {}
        if balances:
            total = sum(float(v) for v in balances.values() if float(v) > 0)
            count = sum(1 for v in balances.values() if float(v) > 0)
            if count > 0:
                parts.append(f"📋 {count} parties sanga Rs {total:,.0f} baki cha.")

        return "\n".join(parts)

    def get_compliance_alerts(self, context: dict[str, Any]) -> list[str]:
        alerts: list[str] = []
        vat_out = float(context.get("vat_output_total", 0))
        vat_in = float(context.get("vat_input_total", 0))
        vat_payable = vat_out - vat_in
        if vat_payable > 0:
            alerts.append(
                f"🏛️ VAT payable: Rs {vat_payable:,.0f} "
                f"(Output Rs {vat_out:,.0f} - Input Rs {vat_in:,.0f})"
            )

        tds = float(context.get("tds_payable", 0))
        if tds > 0:
            alerts.append(f"🏛️ TDS deposit pending: Rs {tds:,.0f}. 25 gate bhitra jamma garnus.")

        return alerts


_default_engine: ProactiveEngine | None = None


def get_proactive_engine() -> ProactiveEngine:
    global _default_engine
    if _default_engine is None:
        _default_engine = ProactiveEngine()
    return _default_engine
