"""PolicyDSL compiler — UIL context → policy evaluation for verify() stage."""

from __future__ import annotations

import re
from typing import Any

from ...knowledge.policy_dsl import BOOTSTRAP_POLICIES, evaluate_policy_rules


def compile_policy_context_from_uil(uil: dict[str, Any]) -> dict[str, Any]:
    """Build PolicyDSL evaluation context from UIL."""
    text = uil.get("source_text", "")
    financial = uil.get("financial_effect") or {}
    action = uil.get("action", "query")
    amount = float(financial.get("amount", 0) or 0)

    if not amount:
        amt_m = re.search(r"([\d,]+)", text)
        amount = float(amt_m.group(1).replace(",", "")) if amt_m else 0.0

    cap_hint = "cap.knowledge.nepal.search"
    if action == "tax_query":
        cap_hint = "cap.tax.vat.calculate"
    elif action == "legal_query":
        cap_hint = "cap.legal.act_search"
    elif action in ("sell", "purchase"):
        cap_hint = "cap.engine.accounting"
    elif "cbms" in text.lower():
        cap_hint = "cap.compliance.cbms_submit"

    has_engine = action in ("sell", "purchase", "ledger_query") or bool(amount)
    return {
        "capability_id": cap_hint,
        "has_engine_evidence": has_engine,
        "has_legal_citation": action in ("legal_query", "tax_query"),
        "amount_mentioned": bool(amount) or bool(re.search(r"\d", text)),
        "amount": amount,
        "confidence": float(uil.get("confidence", 0.8)),
        "jurisdiction": "NP",
        "log_output": False,
    }


def evaluate_policies_for_uil(uil: dict[str, Any]) -> dict[str, Any]:
    """Evaluate all PolicyDSL rules against UIL context."""
    ctx = compile_policy_context_from_uil(uil)
    violations = evaluate_policy_rules(BOOTSTRAP_POLICIES, ctx)
    blocking = [v for v in violations if v.get("severity") == "block"]
    return {
        "ok": len(blocking) == 0,
        "violations": violations,
        "blocking_count": len(blocking),
        "policy_context": ctx,
        "rules_evaluated": len(BOOTSTRAP_POLICIES),
    }
