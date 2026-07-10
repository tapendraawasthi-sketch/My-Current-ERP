"""PolicyDSL — executable policies for verify() stage."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass
class PolicyRule:
    id: str
    policy_class: str
    condition: str
    action: str
    message: str
    severity: str = "block"


POLICY_DSL_RULES = """
POLICY policy.ai.no_money_without_engine CLASS ai
WHEN amount_mentioned AND NOT has_engine_evidence AND capability_contains tax
THEN BLOCK "Tax amounts must come from deterministic engine"

POLICY policy.ai.legal_requires_citation CLASS ai
WHEN capability_contains legal AND NOT has_legal_citation
THEN BLOCK "Legal answers require citation"

POLICY policy.accounting.dual_approval CLASS accounting
WHEN amount_gte 500000
THEN REQUIRE_APPROVAL "Payments above Rs.500,000 require dual approval"

POLICY policy.security.pii_redaction CLASS security
WHEN log_output
THEN REDACT "PII must be redacted in logs"

POLICY policy.ai.confidence_floor CLASS ai
WHEN confidence_lt 0.5 AND NOT has_engine_evidence
THEN WARN "Low confidence without engine evidence"

POLICY policy.government.cbms_mandatory CLASS government
WHEN capability_contains cbms AND jurisdiction NP
THEN REQUIRE "CBMS submission mandatory for VAT invoices"
"""


def parse_policy_dsl(text: str) -> list[PolicyRule]:
    rules: list[PolicyRule] = []
    pattern = re.compile(
        r"POLICY\s+(\S+)\s+CLASS\s+(\w+)\s+WHEN\s+(.+?)\s+THEN\s+(\w+)\s+\"(.+?)\"",
        re.I | re.S,
    )
    for m in pattern.finditer(text):
        rules.append(
            PolicyRule(
                id=m.group(1),
                policy_class=m.group(2),
                condition=m.group(3).strip(),
                action=m.group(4).upper(),
                message=m.group(5),
                severity="block" if m.group(4).upper() in ("BLOCK", "REQUIRE") else "warn",
            )
        )
    return rules


BOOTSTRAP_POLICIES = parse_policy_dsl(POLICY_DSL_RULES)


def evaluate_condition(condition: str, ctx: dict[str, Any]) -> bool:
    """Evaluate simple PolicyDSL WHEN clause against context."""
    parts = re.split(r"\s+AND\s+", condition, flags=re.I)
    for part in parts:
        part = part.strip()
        if part == "amount_mentioned":
            if not ctx.get("amount_mentioned"):
                return False
        elif part == "NOT has_engine_evidence":
            if ctx.get("has_engine_evidence"):
                return False
        elif part == "NOT has_legal_citation":
            if ctx.get("has_legal_citation"):
                return False
        elif part.startswith("capability_contains "):
            token = part.split(" ", 1)[1]
            if token not in ctx.get("capability_id", ""):
                return False
        elif part.startswith("amount_gte "):
            threshold = float(part.split(" ", 1)[1])
            if float(ctx.get("amount", 0)) < threshold:
                return False
        elif part.startswith("confidence_lt "):
            threshold = float(part.split(" ", 1)[1])
            if float(ctx.get("confidence", 1)) >= threshold:
                return False
        elif part == "log_output":
            if not ctx.get("log_output"):
                return False
        elif part == "jurisdiction NP":
            if ctx.get("jurisdiction", "NP") != "NP":
                return False
    return True


def evaluate_policy_rules(rules: list[PolicyRule], ctx: dict[str, Any]) -> list[dict[str, str]]:
    violations: list[dict[str, str]] = []
    for rule in rules:
        if evaluate_condition(rule.condition, ctx):
            violations.append({
                "policy_id": rule.id,
                "policy_class": rule.policy_class,
                "message": rule.message,
                "severity": rule.severity,
                "action": rule.action,
            })
    return violations
