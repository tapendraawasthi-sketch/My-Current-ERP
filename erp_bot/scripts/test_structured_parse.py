#!/usr/bin/env python3
"""Unit tests for LLM structured extraction parser (no Ollama required)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

# Import module directly — avoid khata.__init__ pulling langchain
import importlib.util

spec = importlib.util.spec_from_file_location(
    "structured_parse",
    SRC / "khata" / "structured_parse.py",
)
structured_parse = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(structured_parse)

parse_extraction_response = structured_parse.parse_extraction_response
structured_parse_to_card = structured_parse.structured_parse_to_card

passed = 0
failed = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name}{': ' + detail if detail else ''}")


# Credit sale with dr/cr journal lines
credit_sale_json = """{
  "intent": "khata_credit_sale",
  "amount_npr": 500,
  "party": "Ram",
  "item": "saman",
  "date_hint": "today",
  "confidence": 0.95,
  "is_question": false,
  "needs_clarification": false,
  "journal_lines": [{"dr": "Sundry Debtors", "cr": "Sales", "amount": 500}],
  "explanation_np": "Ram lai 500 ko saman udhaar ma becheko."
}"""
result = parse_extraction_response(credit_sale_json, "Ram lai 500 udhaar diye")
check("credit sale parses", result.get("ok") and result.get("card") is not None)
card = result.get("card") or {}
check("credit sale intent", card.get("intent") == "khata_credit_sale", str(card.get("intent")))
check("credit sale amount", card.get("amount") == 500, str(card.get("amount")))
check("credit sale party", card.get("party") == "Ram", str(card.get("party")))
lines = card.get("journalLines") or []
check("journal lines balanced", len(lines) == 2 and sum(l["debit"] for l in lines) == 500)

# Question detection
question_json = """{
  "is_question": true,
  "question_type": "definition",
  "intent": null,
  "confidence": 0.9
}"""
q_result = parse_extraction_response(question_json, "provision k ho?")
check("question flagged", q_result.get("is_question") is True)
check("question has no card", q_result.get("card") is None)

# Low confidence → clarification
low_conf_json = """{
  "intent": "khata_credit_sale",
  "amount_npr": 500,
  "confidence": 0.5,
  "is_question": false,
  "needs_clarification": false
}"""
low_result = parse_extraction_response(low_conf_json, "Ram le 500 diye")
check("low confidence clarifies", low_result.get("clarify") is not None)

# Needs clarification explicit
clarify_json = """{
  "needs_clarification": true,
  "clarification_question": "Udhaar dine ho ki payment?",
  "is_question": false
}"""
c_result = parse_extraction_response(clarify_json, "Ram 500")
check("explicit clarify", "Udhaar" in str(c_result.get("clarify")))

# Legacy amount field still works
legacy = structured_parse_to_card(
    {"intent": "khata_payment_in", "amount": 1500, "party": "Shyam"},
    "Shyam le 1500 tiryo",
)
check("legacy amount field", legacy is not None and legacy["amount"] == 1500)

# Invalid JSON
bad = parse_extraction_response("not json at all", "test")
check("invalid json rejected", bad.get("ok") is False)

print(f"\n=== Structured parse tests: {passed} passed, {failed} failed ===")
sys.exit(1 if failed else 0)
