"""Prediction Layer — cashflow, tax liability forecasts from World State."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..representations.world_state.engine import world_state_engine


@dataclass
class ForecastPoint:
    period: str
    value: float
    confidence: float


@dataclass
class PredictionResult:
    prediction_id: str
    metric: str
    horizon_months: int
    points: list[ForecastPoint] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)


class PredictionEngine:
    def forecast_cashflow(
        self,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        balance: dict | None = None,
        monthly_burn: float = 0,
        monthly_inflow: float = 0,
        horizon_months: int = 6,
    ) -> PredictionResult:
        ws = world_state_engine.query(
            intent="scenario",
            tenant_id=tenant_id,
            company_id=company_id,
            balance=balance,
        )
        liquidity = float(ws.summary.get("liquidity") or 0)
        if not monthly_inflow and not monthly_burn:
            recent = ws.summary.get("working_capital", 0) or 0
            monthly_inflow = max(liquidity * 0.05, 10_000)
            monthly_burn = max(monthly_inflow * 0.85, 5_000)

        points: list[ForecastPoint] = []
        running = liquidity
        for m in range(1, horizon_months + 1):
            running += monthly_inflow - monthly_burn
            conf = max(0.5, 0.95 - m * 0.05)
            points.append(ForecastPoint(period=f"M+{m}", value=round(running, 2), confidence=round(conf, 2)))

        return PredictionResult(
            prediction_id=f"pred-cashflow-{horizon_months}m",
            metric="cashflow",
            horizon_months=horizon_months,
            points=points,
            assumptions=[
                f"Starting liquidity Rs. {liquidity:,.2f}",
                f"Monthly inflow Rs. {monthly_inflow:,.2f}",
                f"Monthly burn Rs. {monthly_burn:,.2f}",
            ],
        )

    def forecast_tax_liability(
        self,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        balance: dict | None = None,
        horizon_months: int = 3,
    ) -> PredictionResult:
        ws = world_state_engine.query(
            intent="tax_query",
            tenant_id=tenant_id,
            company_id=company_id,
            balance=balance,
        )
        base_vat = float(ws.summary.get("vat_estimate") or 0)
        monthly_vat = base_vat if base_vat else 5_000

        points = [
            ForecastPoint(
                period=f"M+{m}",
                value=round(monthly_vat * m, 2),
                confidence=round(max(0.6, 0.9 - m * 0.08), 2),
            )
            for m in range(1, horizon_months + 1)
        ]

        return PredictionResult(
            prediction_id=f"pred-tax-{horizon_months}m",
            metric="tax_liability",
            horizon_months=horizon_months,
            points=points,
            assumptions=["VAT accumulator from World State", "Linear accumulation model"],
        )

    def to_dict(self, result: PredictionResult) -> dict[str, Any]:
        return {
            "prediction_id": result.prediction_id,
            "metric": result.metric,
            "horizon_months": result.horizon_months,
            "points": [{"period": p.period, "value": p.value, "confidence": p.confidence} for p in result.points],
            "assumptions": result.assumptions,
        }


prediction_engine = PredictionEngine()
