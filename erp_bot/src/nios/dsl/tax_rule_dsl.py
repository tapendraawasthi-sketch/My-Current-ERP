"""TaxRuleDSL — parse and execute tax rules."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ..execution.engines.tax_engine import compute_vat


@dataclass
class TaxRule:
    id: str
    effective_from: str
    effective_to: str
    jurisdiction: str
    condition: dict[str, Any]
    action: dict[str, Any]
    cite: str


RULE_PATTERN = re.compile(
    r"RULE\s+(\w+)\s+"
    r"EFFECTIVE\s+([\d-]+)\s+TO\s+(\S+)\s+"
    r"JURISDICTION\s+(\w+)\s+"
    r"WHEN\s+(.+?)\s+"
    r"THEN\s+(.+?)\s+"
    r"CITE\s+\"(.+?)\"",
    re.I | re.S,
)


def parse_tax_rules(text: str) -> list[TaxRule]:
    rules: list[TaxRule] = []
    for m in RULE_PATTERN.finditer(text):
        when_part = m.group(5).strip()
        then_part = m.group(6).strip()
        conditions = {}
        for part in when_part.split("AND"):
            part = part.strip()
            if "=" in part:
                k, v = part.split("=", 1)
                conditions[k.strip()] = v.strip().strip('"')
        actions = {}
        if "vat_rate" in then_part:
            rate_m = re.search(r"vat_rate\s*=\s*([\d.]+)%?", then_part, re.I)
            if rate_m:
                actions["vat_rate"] = float(rate_m.group(1))
        rules.append(
            TaxRule(
                id=m.group(1),
                effective_from=m.group(2),
                effective_to=m.group(3),
                jurisdiction=m.group(4),
                condition=conditions,
                action=actions,
                cite=m.group(7),
            )
        )
    return rules


def execute_tax_rule(rule: TaxRule, context: dict[str, Any]) -> dict | None:
    for key, expected in rule.condition.items():
        if str(context.get(key, "")).lower() != str(expected).lower():
            return None
    if "vat_rate" in rule.action:
        amount = float(context.get("taxable_amount", 0))
        result = compute_vat(amount, rate=rule.action["vat_rate"])
        result["cite"] = rule.cite
        result["rule_id"] = rule.id
        return result
    return {"rule_id": rule.id, "action": rule.action, "cite": rule.cite}


# Bootstrap rules from Nepal VAT knowledge
BOOTSTRAP_TAX_RULES = parse_tax_rules(
    """
RULE vat_standard
EFFECTIVE 2022-07-16 TO *
JURISDICTION NP
WHEN service_type = "standard"
THEN vat_rate = 13%
CITE "VAT Act 2052"

RULE vat_export_services
EFFECTIVE 2022-07-16 TO *
JURISDICTION NP
WHEN service_type = "export" AND place_of_supply = "outside_np"
THEN vat_rate = 0%
CITE "VAT Act 2052 s.7(2)"
"""
)
