"""Scenario Engine — multi-branch compare."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from ..simulation.engine import simulate_salary_increase
from ..engines.tax_engine import round2


@dataclass
class ScenarioBranch:
    id: str
    name: str
    assumptions: dict[str, Any]
    results: dict[str, Any] = field(default_factory=dict)
    score: float = 0.0


@dataclass
class ScenarioComparison:
    scenario_id: str
    title: str
    branches: list[ScenarioBranch]
    recommendation: str
    tradeoffs: list[str] = field(default_factory=list)


def compare_salary_scenarios(
    basic_salary: float,
    increases: list[float] | None = None,
    *,
    gross_salary: float | None = None,
    cash_balance: float = 0,
) -> ScenarioComparison:
    increases = increases or [5.0, 10.0, 15.0]
    branches: list[ScenarioBranch] = []

    for pct in increases:
        sim = simulate_salary_increase(
            basic_salary,
            pct,
            gross_salary=gross_salary,
            cash_balance=cash_balance,
        )
        # Score: higher net for employee, lower employer cost pressure
        net_delta = sim.deltas.get("net_pay", 0)
        employer_delta = sim.deltas.get("employer_cost", 1)
        score = net_delta / max(employer_delta, 1)
        branches.append(
            ScenarioBranch(
                id=f"branch-{pct}",
                name=f"Increase {pct}%",
                assumptions={"increase_percent": pct, "basic_salary": basic_salary},
                results={"simulation": sim.__dict__, "deltas": sim.deltas},
                score=round2(score),
            )
        )

    branches.sort(key=lambda b: -b.score)
    best = branches[0]

    tradeoffs = [
        f"{b.name}: net +Rs.{b.results['deltas'].get('net_pay', 0):,.0f}/mo, "
        f"employer +Rs.{b.results['deltas'].get('employer_cost', 0):,.0f}/mo"
        for b in branches
    ]

    return ScenarioComparison(
        scenario_id=str(uuid4()),
        title="Salary increase scenario comparison",
        branches=branches,
        recommendation=f"Recommended: {best.name} (best net-to-cost ratio, score={best.score})",
        tradeoffs=tradeoffs,
    )


def compare_branch_opening(
    monthly_revenue: float,
    monthly_cost: float,
    setup_cost: float,
    *,
    cases: list[dict] | None = None,
) -> ScenarioComparison:
    cases = cases or [
        {"name": "Conservative", "revenue_factor": 0.7, "cost_factor": 1.0},
        {"name": "Base", "revenue_factor": 1.0, "cost_factor": 1.0},
        {"name": "Optimistic", "revenue_factor": 1.3, "cost_factor": 1.1},
    ]
    branches: list[ScenarioBranch] = []

    for case in cases:
        rev = monthly_revenue * case["revenue_factor"]
        cost = monthly_cost * case["cost_factor"]
        monthly_profit = rev - cost
        payback_months = setup_cost / monthly_profit if monthly_profit > 0 else float("inf")
        branches.append(
            ScenarioBranch(
                id=f"branch-{case['name']}",
                name=case["name"],
                assumptions=case,
                results={
                    "monthly_revenue": round2(rev),
                    "monthly_cost": round2(cost),
                    "monthly_profit": round2(monthly_profit),
                    "payback_months": round2(payback_months) if payback_months != float("inf") else None,
                },
                score=round2(monthly_profit),
            )
        )

    branches.sort(key=lambda b: -b.score)
    best = branches[0]

    return ScenarioComparison(
        scenario_id=str(uuid4()),
        title="Branch opening scenario",
        branches=branches,
        recommendation=f"Recommended: {best.name} case (monthly profit Rs. {best.score:,.2f})",
        tradeoffs=[f"{b.name}: profit Rs.{b.score:,.0f}/mo" for b in branches],
    )
