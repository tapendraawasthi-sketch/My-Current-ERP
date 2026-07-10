"""Investment domain — NEPSE, DCF, NPV, portfolio analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class DcfResult:
    npv: float
    irr: float | None
    payback_years: float | None
    cashflows: list[float]
    discount_rate: float
    assumptions: list[str] = field(default_factory=list)


class InvestmentEngine:
    def _quotes(self) -> dict[str, dict[str, Any]]:
        from ...knowledge.feeds import load_feeds

        feeds = load_feeds()
        return feeds.get("nepse", {})

    def nepse_quote(self, symbol: str) -> dict[str, Any] | None:
        from ...knowledge.feeds import nepse_quote as feed_quote

        quote = feed_quote(symbol)
        if quote:
            return {k: v for k, v in quote.items() if k not in ("symbol", "as_of")}
        return self._quotes().get(symbol.upper())

    def list_nepse(self, sector: str | None = None) -> list[dict]:
        items = [{"symbol": k, **v} for k, v in self._quotes().items()]
        if sector:
            items = [i for i in items if sector.lower() in i.get("sector", "").lower()]
        return items

    def dcf(
        self,
        initial_investment: float,
        cashflows: list[float],
        *,
        discount_rate: float = 0.12,
    ) -> DcfResult:
        rate = discount_rate / 100 if discount_rate > 1 else discount_rate
        npv = -initial_investment
        for i, cf in enumerate(cashflows, start=1):
            npv += cf / ((1 + rate) ** i)

        # Simple IRR via bisection
        irr = self._irr_bisect(initial_investment, cashflows)

        payback = None
        cumulative = -initial_investment
        for i, cf in enumerate(cashflows, start=1):
            cumulative += cf
            if cumulative >= 0:
                payback = float(i)
                break

        return DcfResult(
            npv=round(npv, 2),
            irr=round(irr * 100, 2) if irr else None,
            payback_years=payback,
            cashflows=cashflows,
            discount_rate=rate,
            assumptions=[
                f"Discount rate: {rate * 100:.1f}%",
                f"Initial investment: Rs. {initial_investment:,.2f}",
                f"Projection years: {len(cashflows)}",
            ],
        )

    def portfolio_analyze(self, holdings: list[dict]) -> dict[str, Any]:
        total_value = 0.0
        weighted_pe = 0.0
        lines: list[dict] = []

        for h in holdings:
            sym = h.get("symbol", "").upper()
            qty = float(h.get("qty", 0))
            quote = self.nepse_quote(sym)
            if not quote:
                continue
            value = quote["ltp"] * qty
            total_value += value
            lines.append({"symbol": sym, "qty": qty, "ltp": quote["ltp"], "value": value, "sector": quote["sector"]})

        if total_value > 0:
            for line in lines:
                q = self.nepse_quote(line["symbol"])
                if q and q.get("pe"):
                    weight = line["value"] / total_value
                    weighted_pe += q["pe"] * weight

        sectors: dict[str, float] = {}
        for line in lines:
            sectors[line["sector"]] = sectors.get(line["sector"], 0) + line["value"]

        return {
            "total_value": round(total_value, 2),
            "holdings": lines,
            "weighted_pe": round(weighted_pe, 2),
            "sector_allocation": {k: round(v / total_value * 100, 1) for k, v in sectors.items()} if total_value else {},
        }

    def _irr_bisect(self, initial: float, cashflows: list[float], tol: float = 1e-6) -> float | None:
        low, high = -0.5, 2.0
        for _ in range(100):
            mid = (low + high) / 2
            npv = -initial + sum(cf / ((1 + mid) ** (i + 1)) for i, cf in enumerate(cashflows))
            if abs(npv) < tol:
                return mid
            if npv > 0:
                low = mid
            else:
                high = mid
        return None


investment_engine = InvestmentEngine()
