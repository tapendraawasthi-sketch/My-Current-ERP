"""Universal Simulation Engine — Phase 3."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..engines.tax_engine import compute_payroll, round2


@dataclass
class SimulationResult:
    simulation_id: str
    scenario: str
    baseline: dict[str, Any]
    projected: dict[str, Any]
    deltas: dict[str, float] = field(default_factory=dict)
    impacts: list[str] = field(default_factory=list)
    confidence: float = 1.0


def simulate_salary_increase(
    basic_salary: float,
    increase_percent: float,
    *,
    gross_salary: float | None = None,
    marital_status: str = "single",
    monthly_expenses: float = 0,
    cash_balance: float = 0,
) -> SimulationResult:
    gross = gross_salary or basic_salary
    baseline = compute_payroll(basic_salary, gross_salary=gross, marital_status=marital_status)

    new_basic = basic_salary * (1 + increase_percent / 100)
    new_gross = gross * (1 + increase_percent / 100)
    projected = compute_payroll(new_basic, gross_salary=new_gross, marital_status=marital_status)

    deltas = {
        "gross_salary": round2(projected["gross_salary"] - baseline["gross_salary"]),
        "net_pay": round2(projected["net_pay"] - baseline["net_pay"]),
        "tds_monthly": round2(projected["tds_monthly"] - baseline["tds_monthly"]),
        "employer_cost": round2(projected["employer_cost"] - baseline["employer_cost"]),
    }

    annual_net_delta = deltas["net_pay"] * 12
    annual_employer_delta = deltas["employer_cost"] * 12

    impacts = [
        f"Monthly net pay change: Rs. {deltas['net_pay']:,.2f}",
        f"Monthly TDS change: Rs. {deltas['tds_monthly']:,.2f}",
        f"Annual net impact: Rs. {annual_net_delta:,.2f}",
        f"Annual employer cost increase: Rs. {annual_employer_delta:,.2f}",
    ]

    if cash_balance > 0 and deltas["employer_cost"] > 0:
        months_runway = cash_balance / deltas["employer_cost"] if deltas["employer_cost"] else 0
        impacts.append(f"Additional employer cost consumes ~{months_runway:.1f} months of current cash at this rate")

    if monthly_expenses > 0:
        new_net = projected["net_pay"]
        impacts.append(
            f"Savings rate after increase: {round2((new_net - monthly_expenses) / new_net * 100) if new_net else 0}%"
        )

    return SimulationResult(
        simulation_id=f"sim-salary-{increase_percent}",
        scenario=f"Salary increase {increase_percent}%",
        baseline=baseline,
        projected=projected,
        deltas=deltas,
        impacts=impacts,
        confidence=1.0,
    )


def parse_salary_simulation_from_message(message: str) -> dict | None:
    import re

    m = re.search(
        r"(?:salary|talab|तलब).*?(?:increase|badha|बढ|\+)\s*(\d+(?:\.\d+)?)\s*%",
        message,
        re.I,
    )
    if not m:
        m = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:salary|talab|increase)", message, re.I)
    if not m:
        return None

    salary_m = re.search(r"(?:rs\.?|रू\.?|npr)?\s*(\d{4,})", message, re.I)
    basic = float(salary_m.group(1)) if salary_m else 50_000.0

    return {
        "basic_salary": basic,
        "increase_percent": float(m.group(1)),
    }
