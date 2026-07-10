"""InvestmentDSL — compile UIL investment effects to NEPSE/DCF programs."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class InvestmentProgram:
    id: str
    action: str
    symbol: str | None = None
    initial_investment: float = 0.0
    cashflows: list[float] = field(default_factory=list)
    discount_rate: float = 12.0
    holdings: list[dict[str, Any]] = field(default_factory=list)
    sector: str | None = None


_SKIP_SYMBOLS = frozenset({"NEPSE", "DCF", "NPV", "IRR", "VAT", "TDS", "EMI", "CBMS"})


def _extract_symbol(text: str, obj: dict) -> str | None:
    symbol = obj.get("symbol") if isinstance(obj, dict) else None
    if symbol:
        return str(symbol).upper()
    for match in re.finditer(r"\b([A-Z]{3,6})\b", text):
        candidate = match.group(1).upper()
        if candidate not in _SKIP_SYMBOLS:
            return candidate
    return None


def compile_investment_from_uil(uil: dict[str, Any]) -> InvestmentProgram:
    """Compile UIL dict to InvestmentDSL program."""
    action = uil.get("action", "query")
    text = uil.get("source_text", "")
    obj = uil.get("object") or {}
    financial = uil.get("financial_effect") or {}

    symbol = _extract_symbol(text, obj if isinstance(obj, dict) else {})

    amount = float(financial.get("amount", 0) or 0)
    if not amount:
        amt_m = re.search(r"(?:rs\.?|npr)?\s*([\d,]+)", text, re.I)
        amount = float(amt_m.group(1).replace(",", "")) if amt_m else 0.0

    inv_action = "quote"
    if re.search(r"\b(dcf|npv|irr)\b", text, re.I) or action == "investment_query" and amount:
        inv_action = "dcf"
    elif re.search(r"\b(portfolio|holdings)\b", text, re.I):
        inv_action = "portfolio"
    elif symbol:
        inv_action = "quote"

    cashflows: list[float] = []
    if inv_action == "dcf" and amount:
        cashflows = [amount * 0.25, amount * 0.30, amount * 0.35, amount * 0.40]

    sector_m = re.search(r"\b(bank|hydro|insurance|finance)\b", text, re.I)
    sector = sector_m.group(1) if sector_m else None

    return InvestmentProgram(
        id=f"inv-{uil.get('id', 'unknown')}",
        action=inv_action,
        symbol=symbol,
        initial_investment=amount,
        cashflows=cashflows,
        discount_rate=12.0,
        holdings=obj.get("holdings", []) if isinstance(obj, dict) else [],
        sector=sector,
    )


def execute_investment_program(prog: InvestmentProgram) -> dict[str, Any]:
    """Execute InvestmentDSL program via deterministic engine."""
    from ...domains.investment.engine import investment_engine

    if prog.action == "quote" and prog.symbol:
        quote = investment_engine.nepse_quote(prog.symbol)
        if not quote:
            return {"ok": False, "summary": f"Symbol {prog.symbol} not found", "action": prog.action}
        return {
            "ok": True,
            "action": prog.action,
            "symbol": prog.symbol,
            "summary": (
                f"{prog.symbol}: LTP Rs.{quote['ltp']:,.2f} | "
                f"P/E {quote['pe']} | EPS {quote['eps']} | {quote['sector']}"
            ),
            **quote,
        }

    if prog.action == "dcf" and prog.initial_investment:
        dcf = investment_engine.dcf(prog.initial_investment, prog.cashflows, discount_rate=prog.discount_rate)
        summary = f"NPV Rs.{dcf.npv:,.2f}"
        if dcf.irr:
            summary += f" | IRR {dcf.irr}%"
        return {
            "ok": True,
            "action": prog.action,
            "summary": summary,
            "npv": dcf.npv,
            "irr": dcf.irr,
            "payback_years": dcf.payback_years,
            "assumptions": dcf.assumptions,
        }

    if prog.action == "portfolio" and prog.holdings:
        analysis = investment_engine.portfolio_analyze(prog.holdings)
        return {
            "ok": True,
            "action": prog.action,
            "summary": f"Portfolio value Rs.{analysis['total_value']:,.2f}",
            **analysis,
        }

    if prog.sector:
        items = investment_engine.list_nepse(sector=prog.sector)
        return {
            "ok": bool(items),
            "action": "sector_scan",
            "summary": f"{len(items)} stocks in {prog.sector} sector",
            "holdings": items[:5],
        }

    return {"ok": True, "action": prog.action, "summary": "Investment query compiled", "program_id": prog.id}
