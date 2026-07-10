"""InvestmentDSL — parse investment analysis rules."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .engine import investment_engine

INVESTMENT_PATTERN = re.compile(
    r"INVEST\s+(\w+)\s+"
    r"SYMBOL\s+(\w+)\s+"
    r"QTY\s+(\d+(?:\.\d+)?)"
    r"(?:\s+DISCOUNT\s+([\d.]+)%?)?",
    re.I,
)

DCF_PATTERN = re.compile(
    r"DCF\s+INVEST\s+([\d,]+(?:\.\d+)?)\s+"
    r"CASHFLOWS\s+([\d,\s]+)\s+"
    r"RATE\s+([\d.]+)%?",
    re.I,
)


@dataclass
class InvestmentRule:
    rule_id: str
    action: str
    params: dict[str, Any]


def parse_investment_rules(text: str) -> list[InvestmentRule]:
    rules: list[InvestmentRule] = []
    for m in INVESTMENT_PATTERN.finditer(text):
        rules.append(
            InvestmentRule(
                rule_id=m.group(1),
                action="portfolio_hold",
                params={"symbol": m.group(2), "qty": float(m.group(3))},
            )
        )
    for m in DCF_PATTERN.finditer(text):
        cfs = [float(x.replace(",", "")) for x in m.group(2).split()]
        rules.append(
            InvestmentRule(
                rule_id=f"dcf_{m.group(1)}",
                action="dcf",
                params={
                    "initial": float(m.group(1).replace(",", "")),
                    "cashflows": cfs,
                    "rate": float(m.group(3)),
                },
            )
        )
    return rules


BOOTSTRAP_INVESTMENT_RULES = parse_investment_rules(
    """
INVEST hydropower SYMBOL HIDCL QTY 100
DCF INVEST 5000000 CASHFLOWS 1200000 1500000 1800000 2000000 RATE 12%
"""
)


def execute_investment_rule(rule: InvestmentRule) -> dict[str, Any]:
    if rule.action == "portfolio_hold":
        quote = investment_engine.nepse_quote(rule.params["symbol"])
        value = (quote["ltp"] * rule.params["qty"]) if quote else 0
        return {"action": rule.action, "quote": quote, "holding_value": value, "rule_id": rule.rule_id}
    if rule.action == "dcf":
        result = investment_engine.dcf(
            rule.params["initial"],
            rule.params["cashflows"],
            discount_rate=rule.params["rate"],
        )
        return {
            "action": rule.action,
            "npv": result.npv,
            "irr": result.irr,
            "payback_years": result.payback_years,
            "assumptions": result.assumptions,
            "rule_id": rule.rule_id,
        }
    return {"rule_id": rule.rule_id, "error": "unknown action"}
