"""Tax and payroll optimization engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ...contracts.intelligence_contract import utc_now
from ..engines.tax_engine import compute_payroll, compute_vat, round2, compute_nepal_annual_tax, EXEMPTION_MARRIED, EXEMPTION_SINGLE


@dataclass
class OptimizationOption:
    label: str
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    score: float
    rationale: str


@dataclass
class OptimizationResult:
    optimization_id: str
    domain: str
    objective: str
    baseline: dict[str, Any]
    options: list[OptimizationOption] = field(default_factory=list)
    recommended: OptimizationOption | None = None
    confidence: float = 0.95
    engine: str = "cap.engine.optimization"


class OptimizationEngine:
    """Deterministic optimizers — LLM never calculates money."""

    def optimize_vat_inclusive_pricing(
        self,
        target_revenue: float,
        *,
        rate: float = 13.0,
    ) -> OptimizationResult:
        """Find taxable base for a VAT-inclusive revenue target."""
        baseline = compute_vat(target_revenue / (1 + rate / 100), rate=rate)
        options: list[OptimizationOption] = []
        for markup in (0, 5, 10, 15):
            taxable = target_revenue / (1 + rate / 100) * (1 + markup / 100)
            result = compute_vat(taxable, rate=rate)
            options.append(
                OptimizationOption(
                    label=f"markup_{markup}pct",
                    inputs={"taxable": round2(taxable), "rate": rate},
                    outputs=result,
                    score=result["grand_total"] / max(target_revenue, 1),
                    rationale=f"Markup {markup}% on taxable base",
                )
            )
        recommended = min(options, key=lambda o: abs(o.outputs["grand_total"] - target_revenue))
        return OptimizationResult(
            optimization_id=f"opt-vat-{int(target_revenue)}",
            domain="tax",
            objective="match_vat_inclusive_revenue",
            baseline=baseline,
            options=options,
            recommended=recommended,
        )

    def optimize_salary_structure(
        self,
        employer_budget: float,
        *,
        marital_status: str = "single",
        basic_ratio_options: list[float] | None = None,
    ) -> OptimizationResult:
        """Maximize net pay within employer cost budget across basic/gross splits."""
        ratios = basic_ratio_options or [0.6, 0.7, 0.8, 0.9, 1.0]
        options: list[OptimizationOption] = []

        # Probe gross levels up to employer budget
        gross_levels = sorted(
            {round2(employer_budget * f) for f in (0.55, 0.65, 0.75, 0.85, 0.95)}
        )
        baseline_payroll = compute_payroll(
            gross_levels[0] * 0.7,
            gross_salary=gross_levels[0],
            marital_status=marital_status,
        )

        for gross in gross_levels:
            for ratio in ratios:
                basic = round2(gross * ratio)
                payroll = compute_payroll(basic, gross_salary=gross, marital_status=marital_status)
                employer_cost = payroll["employer_cost"]
                feasible = employer_cost <= employer_budget
                score = payroll["net_pay"] if feasible else 0
                options.append(
                    OptimizationOption(
                        label=f"gross_{int(gross)}_basic_{int(ratio * 100)}pct",
                        inputs={"basic": basic, "gross": gross, "marital_status": marital_status},
                        outputs=payroll,
                        score=score,
                        rationale=(
                            f"Net Rs.{payroll['net_pay']:,.0f} | employer cost Rs.{employer_cost:,.0f}"
                            + (" (over budget)" if not feasible else "")
                        ),
                    )
                )

        feasible_opts = [o for o in options if o.score > 0]
        recommended = max(feasible_opts, key=lambda o: o.score) if feasible_opts else max(options, key=lambda o: o.outputs["net_pay"])
        return OptimizationResult(
            optimization_id=f"opt-pay-{int(employer_budget)}",
            domain="payroll",
            objective="maximize_net_within_budget",
            baseline=baseline_payroll,
            options=options,
            recommended=recommended,
        )

    def optimize_tax_savings(
        self,
        annual_income: float,
        *,
        marital_status: str = "single",
        cit_monthly_options: list[float] | None = None,
    ) -> OptimizationResult:
        """Compare CIT contribution levels for annual tax minimization."""
        exemption = EXEMPTION_MARRIED if marital_status == "married" else EXEMPTION_SINGLE
        cit_opts = cit_monthly_options or [0, 2000, 5000, 10000]
        monthly_gross = annual_income / 12
        baseline_tax = compute_nepal_annual_tax(max(0, annual_income - exemption))

        options: list[OptimizationOption] = []
        for cit in cit_opts:
            deductions = cit * 12
            taxable = max(0, annual_income - exemption - deductions)
            tax = compute_nepal_annual_tax(taxable)
            net_annual = annual_income - tax - deductions
            options.append(
                OptimizationOption(
                    label=f"cit_{int(cit)}",
                    inputs={"cit_monthly": cit, "annual_income": annual_income},
                    outputs={"annual_tax": tax, "cit_annual": deductions, "net_annual": round2(net_annual)},
                    score=net_annual,
                    rationale=f"Tax Rs.{tax:,.0f} | CIT Rs.{deductions:,.0f} | net Rs.{net_annual:,.0f}",
                )
            )

        recommended = max(options, key=lambda o: o.score)
        return OptimizationResult(
            optimization_id=f"opt-tax-{int(annual_income)}",
            domain="tax",
            objective="maximize_net_after_tax_and_cit",
            baseline={"annual_tax": baseline_tax, "annual_income": annual_income},
            options=options,
            recommended=recommended,
        )

    def optimize_inventory_eoq(
        self,
        annual_demand: float,
        order_cost: float,
        holding_cost_per_unit: float,
    ) -> OptimizationResult:
        """Economic Order Quantity — classic EOQ formula."""
        import math

        eoq = math.sqrt((2 * annual_demand * order_cost) / max(holding_cost_per_unit, 0.01))
        eoq = round2(eoq)
        orders_per_year = annual_demand / max(eoq, 1)
        total_cost = round2(orders_per_year * order_cost + (eoq / 2) * holding_cost_per_unit)
        baseline = {"eoq": eoq, "total_cost": total_cost}
        options = []
        for safety in (0, 0.1, 0.2):
            adj = round2(eoq * (1 + safety))
            opc = annual_demand / max(adj, 1)
            cost = round2(opc * order_cost + (adj / 2) * holding_cost_per_unit)
            options.append(
                OptimizationOption(
                    label=f"eoq_safety_{int(safety * 100)}pct",
                    inputs={"eoq": adj, "safety_factor": safety},
                    outputs={"eoq": adj, "total_cost": cost, "orders_per_year": round2(opc)},
                    score=-cost,
                    rationale=f"EOQ {adj:.0f} units | annual cost Rs.{cost:,.0f}",
                )
            )
        recommended = max(options, key=lambda o: o.score)
        return OptimizationResult(
            optimization_id=f"opt-eoq-{int(annual_demand)}",
            domain="inventory",
            objective="minimize_ordering_holding_cost",
            baseline=baseline,
            options=options,
            recommended=recommended,
        )

    def optimize_pricing(
        self,
        unit_cost: float,
        demand_elasticity: float = 1.2,
        *,
        markup_options: list[float] | None = None,
    ) -> OptimizationResult:
        """Margin optimization over markup candidates."""
        marks = markup_options or [0.1, 0.15, 0.2, 0.25, 0.3, 0.35]
        options: list[OptimizationOption] = []
        for m in marks:
            price = round2(unit_cost * (1 + m))
            # Simplified demand: decreases with price
            demand_units = max(1, 1000 / (price ** (demand_elasticity / 10)))
            profit = round2((price - unit_cost) * demand_units)
            options.append(
                OptimizationOption(
                    label=f"markup_{int(m * 100)}pct",
                    inputs={"unit_cost": unit_cost, "markup": m, "price": price},
                    outputs={"price": price, "demand_units": round2(demand_units), "profit": profit},
                    score=profit,
                    rationale=f"Price Rs.{price:.2f} | est. profit Rs.{profit:,.0f}",
                )
            )
        recommended = max(options, key=lambda o: o.score)
        return OptimizationResult(
            optimization_id=f"opt-price-{int(unit_cost)}",
            domain="pricing",
            objective="maximize_profit",
            baseline={"unit_cost": unit_cost},
            options=options,
            recommended=recommended,
        )

    def optimize_supplier(self, suppliers: list[dict[str, Any]]) -> OptimizationResult:
        """Multi-criteria supplier selection: price, lead time, risk."""
        options: list[OptimizationOption] = []
        for s in suppliers:
            price = float(s.get("price", 100))
            lead = float(s.get("lead_days", 7))
            risk = float(s.get("risk", 0.3))
            # Lower is better for price/lead/risk — invert to score
            score = round2(1000 / price - lead * 2 - risk * 100)
            options.append(
                OptimizationOption(
                    label=str(s.get("name", "supplier")),
                    inputs=s,
                    outputs={"composite_score": score},
                    score=score,
                    rationale=f"{s.get('name')}: Rs.{price} | {lead}d lead | risk {risk:.0%}",
                )
            )
        recommended = max(options, key=lambda o: o.score) if options else None
        return OptimizationResult(
            optimization_id="opt-supplier",
            domain="supplier",
            objective="best_supplier_multi_criteria",
            baseline={},
            options=options,
            recommended=recommended,
        )

    def to_dict(self, result: OptimizationResult) -> dict[str, Any]:
        return {
            "optimization_id": result.optimization_id,
            "domain": result.domain,
            "objective": result.objective,
            "baseline": result.baseline,
            "recommended": {
                "label": result.recommended.label,
                "inputs": result.recommended.inputs,
                "outputs": result.recommended.outputs,
                "score": result.recommended.score,
                "rationale": result.recommended.rationale,
            }
            if result.recommended
            else None,
            "options": [
                {
                    "label": o.label,
                    "inputs": o.inputs,
                    "outputs": o.outputs,
                    "score": o.score,
                    "rationale": o.rationale,
                }
                for o in result.options
            ],
            "confidence": result.confidence,
            "engine": result.engine,
            "timestamp": utc_now(),
        }


optimization_engine = OptimizationEngine()
