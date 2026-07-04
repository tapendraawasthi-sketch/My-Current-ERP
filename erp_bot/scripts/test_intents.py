#!/usr/bin/env python3
"""Intent classification regression test harness.

A standalone script that tests the intent classifier against known
question→intent pairs. Runs without pytest — just import and assert.

Usage:
    python erp_bot/scripts/test_intents.py

Exit codes:
    0 — all tests passed
    1 — one or more tests failed
"""

from __future__ import annotations

import sys
from pathlib import Path

# Bootstrap path so we can import from src.agent
BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.agent.intent_classifier import classify


# ── TEST CASES ─────────────────────────────────────────────────────────────────
# Format: (question, expected_intent)
# These are the critical acceptance tests from the requirements.

TEST_CASES: list[tuple[str, str]] = [
    # ── action_path — "how to make/create X" → path only ───────────────────
    ("how to make a journal entry", "action_path"),
    ("how do I make a journal entry", "action_path"),
    ("how to create a sales invoice", "action_path"),
    ("how do I create a payment voucher", "action_path"),
    ("how to pass a journal", "action_path"),
    ("how can I post a receipt voucher", "action_path"),
    ("how to enter a contra entry", "action_path"),
    ("how do I add a new party", "action_path"),
    ("how to record a purchase invoice", "action_path"),
    ("how to generate a sales return", "action_path"),
    ("how to cut a bill", "action_path"),
    ("how do I book a debit note", "action_path"),

    # ── definition — "what is X" → explanation only ────────────────────────
    ("what is a journal voucher", "definition"),
    ("tell me about journal voucher", "definition"),
    ("what is a debit note", "definition"),
    ("explain sales invoice", "definition"),
    ("what is VAT in Nepal", "definition"),
    ("what are TDS rules", "definition"),
    ("define contra voucher", "definition"),
    ("meaning of fiscal year", "definition"),

    # ── steps — explicit procedure request ─────────────────────────────────
    ("steps to create a payment voucher", "steps"),
    ("step by step process for sales invoice", "steps"),
    ("walk me through creating a journal entry", "steps"),
    ("procedure for posting a receipt voucher", "steps"),
    ("guide me through adding a party", "steps"),
    ("detailed steps for stock transfer", "steps"),

    # ── nav — "where is X" / shortcut ──────────────────────────────────────
    ("where is the day book", "nav"),
    ("where do I find the trial balance", "nav"),
    ("how to open the chart of accounts", "nav"),
    ("shortcut for journal entry", "nav"),
    ("keyboard shortcut for sales invoice", "nav"),
    ("how do I access the VAT report", "nav"),
    ("path to stock summary", "nav"),

    # ── effect — accounting debit/credit entry ─────────────────────────────
    ("what gets debited in a payment voucher", "effect"),
    ("what gets credited in a receipt voucher", "effect"),
    ("accounting entry for sales invoice", "effect"),
    ("journal entry for purchase return", "effect"),
    ("which account is debited for salary payment", "effect"),
    ("debit credit for contra voucher", "effect"),
    ("what is the GL entry for depreciation", "effect"),

    # ── troubleshoot — errors, not working ─────────────────────────────────
    ("why is my journal not balanced", "troubleshoot"),
    ("journal voucher not posting", "troubleshoot"),
    ("error when saving invoice", "troubleshoot"),
    ("sales invoice not working", "troubleshoot"),
    ("can't post payment voucher", "troubleshoot"),
    ("why isn't my stock updating", "troubleshoot"),
    ("getting negative stock error", "troubleshoot"),
    ("voucher won't save", "troubleshoot"),

    # ── code — developer questions ─────────────────────────────────────────
    ("which function renders the sales invoice form", "code"),
    ("where in the code is the journal validation", "code"),
    ("what component handles party master", "code"),
    ("how is VAT calculation implemented", "code"),
    ("which file has the billing logic", "code"),
    ("show me the API endpoint for vouchers", "code"),
    ("database schema for invoices", "code"),
    ("supabase query for stock", "code"),

    # ── general — catch-all ────────────────────────────────────────────────
    ("hello", "general"),
    ("thanks", "general"),
    ("ok", "general"),

    # bare topic + typo tolerance
    ("journal voucher", "definition"),
    ("payment voucher", "definition"),
    ("how to make payment vouche", "action_path"),
]


def run_tests() -> tuple[int, int, list[tuple[str, str, str]]]:
    """Run all test cases and return (passed, failed, failures)."""
    passed = 0
    failed = 0
    failures: list[tuple[str, str, str]] = []

    for question, expected in TEST_CASES:
        actual = classify(question)
        if actual == expected:
            passed += 1
            print(f"  ✓ PASS: \"{question}\" → {actual}")
        else:
            failed += 1
            failures.append((question, expected, actual))
            print(f"  ✗ FAIL: \"{question}\" → expected {expected}, got {actual}")

    return passed, failed, failures


def main() -> int:
    print("=" * 70)
    print("Intent Classification Regression Test")
    print("=" * 70)
    print()

    passed, failed, failures = run_tests()

    print()
    print("=" * 70)
    print(f"SUMMARY: {passed} passed, {failed} failed, {len(TEST_CASES)} total")
    print("=" * 70)

    if failures:
        print()
        print("FAILURES:")
        for question, expected, actual in failures:
            print(f"  • \"{question}\"")
            print(f"    Expected: {expected}")
            print(f"    Actual:   {actual}")
        print()
        return 1

    print()
    print("All tests passed!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
