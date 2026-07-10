"""Universal Simulation Engine — 9 domains (Phase 6)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from ..engines.tax_engine import compute_payroll, compute_vat, round2
from .engine import simulate_salary_increase

SIMULATION_DOMAINS = [
    "salary",
    "tax",
    "cashflow",
    "inventory",
    "branch",
    "loan",
    "investment",
    "payroll_headcount",
    "vat_filing",
]


@dataclass
class UniversalSimResult:
    simulation_id: str
    domain: str
    baseline: dict[str, Any]
    projected: dict[str, Any]
    deltas: dict[str, float] = field(default_factory=dict)
    impacts: list[str] = field(default_factory=list)
    confidence: float = 1.0


class UniversalSimulationEngine:
    def run(self, domain: str, params: dict[str, Any]) -> UniversalSimResult:
        handler = getattr(self, f"_sim_{domain}", None)
        if not handler:
            raise ValueError(f"Unknown simulation domain: {domain}")
        return handler(params)

    def list_domains(self) -> list[str]:
        return list(SIMULATION_DOMAINS)

    def _sim_salary(self, p: dict) -> UniversalSimResult:
        sim = simulate_salary_increase(
            float(p.get("basic_salary", 50000)),
            float(p.get("increase_percent", 10)),
            cash_balance=float(p.get("cash_balance", 0)),
        )
        return UniversalSimResult(
            simulation_id=f"usim-salary-{uuid4().hex[:8]}",
            domain="salary",
            baseline=sim.baseline,
            projected=sim.projected,
            deltas=sim.deltas,
            impacts=sim.impacts,
        )

    def _sim_tax(self, p: dict) -> UniversalSimResult:
        base = float(p.get("taxable_income", 500000))
        increase = float(p.get("increase_percent", 10))
        from ..engines.tax_engine import compute_nepal_annual_tax

        base_tax = compute_nepal_annual_tax(base)
        proj_tax = compute_nepal_annual_tax(base * (1 + increase / 100))
        delta = proj_tax - base_tax
        return UniversalSimResult(
            simulation_id=f"usim-tax-{uuid4().hex[:8]}",
            domain="tax",
            baseline={"annual_tax": base_tax, "taxable_income": base},
            projected={"annual_tax": proj_tax, "taxable_income": base * (1 + increase / 100)},
            deltas={"annual_tax": delta},
            impacts=[f"Annual tax change: Rs. {delta:,.2f} with {increase}% income increase"],
        )

    def _sim_cashflow(self, p: dict) -> UniversalSimResult:
        liquidity = float(p.get("liquidity", 200000))
        burn = float(p.get("monthly_burn", 50000))
        inflow = float(p.get("monthly_inflow", 80000))
        months = int(p.get("months", 6))
        baseline = {"liquidity": liquidity, "runway_months": liquidity / burn if burn else 0}
        projected_liq = liquidity + (inflow - burn) * months
        return UniversalSimResult(
            simulation_id=f"usim-cf-{uuid4().hex[:8]}",
            domain="cashflow",
            baseline=baseline,
            projected={"liquidity": projected_liq, "runway_months": projected_liq / burn if burn else 0},
            deltas={"liquidity": projected_liq - liquidity},
            impacts=[f"Projected liquidity after {months} months: Rs. {projected_liq:,.2f}"],
        )

    def _sim_inventory(self, p: dict) -> UniversalSimResult:
        stock = float(p.get("stock_value", 500000))
        demand_pct = float(p.get("demand_change_percent", 15))
        projected = stock * (1 - demand_pct / 100 * 0.3)
        return UniversalSimResult(
            simulation_id=f"usim-inv-{uuid4().hex[:8]}",
            domain="inventory",
            baseline={"stock_value": stock},
            projected={"stock_value": projected},
            deltas={"stock_value": round2(projected - stock)},
            impacts=[f"Inventory value after {demand_pct}% demand shift: Rs. {projected:,.2f}"],
        )

    def _sim_branch(self, p: dict) -> UniversalSimResult:
        from ..scenario.engine import compare_branch_opening

        comp = compare_branch_opening(
            float(p.get("monthly_revenue", 200000)),
            float(p.get("monthly_cost", 150000)),
            float(p.get("setup_cost", 500000)),
        )
        best = comp.branches[0] if comp.branches else None
        profit = best.score if best else 0
        return UniversalSimResult(
            simulation_id=f"usim-branch-{uuid4().hex[:8]}",
            domain="branch",
            baseline={"monthly_cost": float(p.get("monthly_cost", 150000))},
            projected={"monthly_profit": profit, "recommendation": comp.recommendation},
            deltas={"monthly_profit": profit},
            impacts=comp.tradeoffs[:3],
        )

    def _sim_loan(self, p: dict) -> UniversalSimResult:
        principal = float(p.get("principal", 1000000))
        rate = float(p.get("rate", 12)) / 100 / 12
        tenure = int(p.get("tenure_months", 60))
        emi = principal * rate * (1 + rate) ** tenure / ((1 + rate) ** tenure - 1) if rate else principal / tenure
        total_pay = emi * tenure
        return UniversalSimResult(
            simulation_id=f"usim-loan-{uuid4().hex[:8]}",
            domain="loan",
            baseline={"principal": principal},
            projected={"emi": round2(emi), "total_payment": round2(total_pay), "total_interest": round2(total_pay - principal)},
            deltas={"emi": round2(emi)},
            impacts=[f"EMI: Rs. {emi:,.2f}/mo for {tenure} months at {p.get('rate', 12)}%"],
        )

    def _sim_investment(self, p: dict) -> UniversalSimResult:
        from ...domains.investment.engine import investment_engine

        dcf = investment_engine.dcf(
            float(p.get("initial", 500000)),
            [float(x) for x in p.get("cashflows", [100000, 120000, 150000])],
            discount_rate=float(p.get("discount_rate", 12)),
        )
        return UniversalSimResult(
            simulation_id=f"usim-invest-{uuid4().hex[:8]}",
            domain="investment",
            baseline={"initial": float(p.get("initial", 500000))},
            projected={"npv": dcf.npv, "irr": dcf.irr, "payback_years": dcf.payback_years},
            deltas={"npv": dcf.npv},
            impacts=[f"NPV: Rs. {dcf.npv:,.2f}", f"IRR: {dcf.irr}%"] if dcf.irr else [f"NPV: Rs. {dcf.npv:,.2f}"],
        )

    def _sim_payroll_headcount(self, p: dict) -> UniversalSimResult:
        headcount = int(p.get("headcount", 10))
        increase = int(p.get("headcount_increase", 2))
        avg_salary = float(p.get("avg_salary", 40000))
        base_cost = headcount * avg_salary * 1.2
        proj_cost = (headcount + increase) * avg_salary * 1.2
        return UniversalSimResult(
            simulation_id=f"usim-hc-{uuid4().hex[:8]}",
            domain="payroll_headcount",
            baseline={"headcount": headcount, "monthly_cost": round2(base_cost)},
            projected={"headcount": headcount + increase, "monthly_cost": round2(proj_cost)},
            deltas={"monthly_cost": round2(proj_cost - base_cost)},
            impacts=[f"Adding {increase} employees increases monthly cost by Rs. {proj_cost - base_cost:,.2f}"],
        )

    def _sim_vat_filing(self, p: dict) -> UniversalSimResult:
        sales = float(p.get("taxable_sales", 1000000))
        increase = float(p.get("sales_increase_percent", 10))
        base_vat = compute_vat(sales)
        proj_vat = compute_vat(sales * (1 + increase / 100))
        return UniversalSimResult(
            simulation_id=f"usim-vat-{uuid4().hex[:8]}",
            domain="vat_filing",
            baseline={"vat_amount": base_vat["vat_amount"], "taxable_sales": sales},
            projected={"vat_amount": proj_vat["vat_amount"], "taxable_sales": sales * (1 + increase / 100)},
            deltas={"vat_amount": round2(proj_vat["vat_amount"] - base_vat["vat_amount"])},
            impacts=[f"VAT liability change with {increase}% sales growth: Rs. {proj_vat['vat_amount'] - base_vat['vat_amount']:,.2f}"],
        )


universal_simulation = UniversalSimulationEngine()
