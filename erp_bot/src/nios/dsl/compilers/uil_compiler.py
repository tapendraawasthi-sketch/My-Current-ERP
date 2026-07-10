"""UIL → Domain DSL compiler orchestrator."""

from __future__ import annotations

from typing import Any

from ...representations.uil_parser import parse_to_uil
from ..tax_rule_dsl import BOOTSTRAP_TAX_RULES, execute_tax_rule
from .accounting_dsl import compile_from_uil, program_to_journal_lines


def uil_dict_from_text(text: str) -> dict[str, Any]:
    uil = parse_to_uil(text)
    obj = uil.metadata.get("object") or {}
    actor = uil.metadata.get("actor") or {}
    return {
        "id": uil.id,
        "action": uil.action,
        "confidence": uil.confidence,
        "goals": uil.goals,
        "actor": actor if isinstance(actor, dict) else {"party": actor},
        "object": obj if isinstance(obj, dict) else {},
        "financial_effect": uil.metadata.get("financial_effect") or _infer_financial(text, uil.action),
        "tax_effect": uil.metadata.get("tax_effect") or {},
        "source_text": text,
    }


def _infer_financial(text: str, action: str) -> dict[str, Any]:
    import re

    m = re.search(r"(\d+(?:\.\d+)?)", text)
    amount = float(m.group(1)) if m else 0.0
    return {"amount": amount, "action": action}


def compile_uil_pipeline(text: str, *, service_type: str = "standard") -> dict[str, Any]:
    """Full NL → UIL → AccountingDSL + TaxRuleDSL + LegalDSL + InvestmentDSL + PolicyDSL → verify."""
    from .investment_dsl import compile_investment_from_uil, execute_investment_program
    from .legal_dsl import compile_legal_from_uil, execute_legal_query
    from .policy_dsl_compiler import evaluate_policies_for_uil

    uil = uil_dict_from_text(text)
    accounting = compile_from_uil(uil)
    journal_lines = program_to_journal_lines(accounting)
    legal = compile_legal_from_uil(uil)
    legal_result = execute_legal_query(legal) if uil.get("action") in ("tax_query", "legal_query", "sell", "purchase") else None

    tax_result = None
    for rule in BOOTSTRAP_TAX_RULES:
        tax_result = execute_tax_rule(
            rule,
            {"service_type": service_type, "taxable_amount": accounting.metadata.get("amount", 0)},
        )
        if tax_result:
            break

    investment_result = None
    if uil.get("action") in ("investment_query", "query") and (
        "nepse" in text.lower() or "dcf" in text.lower() or "invest" in text.lower()
    ):
        inv_prog = compile_investment_from_uil(uil)
        investment_result = execute_investment_program(inv_prog)

    policy_result = evaluate_policies_for_uil(uil)

    return {
        "uil": uil,
        "accounting": {
            "id": accounting.id,
            "action": accounting.action,
            "party": accounting.party,
            "balanced": accounting.balanced,
            "lines": journal_lines,
        },
        "legal": legal_result,
        "tax": tax_result,
        "investment": investment_result,
        "policy": policy_result,
        "ok": (
            (accounting.balanced or accounting.action == "query" or not journal_lines)
            and policy_result.get("ok", True)
        ),
        "pipeline": [
            "observe", "understand", "compile_accounting", "compile_legal",
            "compile_tax", "compile_investment", "compile_policy", "verify",
        ],
    }
