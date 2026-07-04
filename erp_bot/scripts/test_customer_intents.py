#!/usr/bin/env python3
"""Customer intent classification regression tests against training corpus.

Usage:
    python erp_bot/scripts/test_customer_intents.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.customer.intent_classifier import classify, classify_with_slots
from src.customer.slot_extractor import parse_amount

CORPUS_PATH = BOT_ROOT / "corpus" / "customer_training_corpus.json"

# Additional edge-case tests not in corpus
EDGE_CASES: list[tuple[str, str]] = [
    ("Ram lai 500 udharo diye", "SALE_CREDIT"),
    ("Ram lai 500 udhaaro diye", "SALE_CREDIT"),
    ("Ram lai 500 udhaar diye", "SALE_CREDIT"),
    ("dedh lakh tirya contractor le", "PAYMENT_RECEIVED"),
    ("pandhra sau rupiya nagad bikri", "SALE_CASH"),
    ("dui hazar paanch sau kamayo aja", "SALE_CASH"),
    ("रामलाई ५०० उधारो दिएँ", "SALE_CREDIT"),
    ("help", "GENERAL"),
    ("kasle paisa tirna baki cha", "QUERY_BALANCE_ALL"),
]


def load_corpus() -> list[dict]:
    with open(CORPUS_PATH, encoding="utf-8") as f:
        return json.load(f)


def test_intent_classification() -> tuple[int, int]:
    corpus = load_corpus()
    passed = 0
    failed = 0
    failures: list[str] = []

    all_cases = [(ex["rom"], ex["intent"]) for ex in corpus] + EDGE_CASES

    for question, expected in all_cases:
        actual = classify(question)
        if actual == expected:
            passed += 1
        else:
            failed += 1
            failures.append(f"  FAIL: {question!r}\n         expected={expected}, got={actual}")

    print(f"\n{'='*60}")
    print(f"Intent classification: {passed} passed, {failed} failed")
    if failures:
        print("\nFailures:")
        for f in failures[:20]:
            print(f)
        if len(failures) > 20:
            print(f"  ... and {len(failures) - 20} more")

    return passed, failed


def test_amount_parsing() -> tuple[int, int]:
    cases = [
        ("500 rupiya", 500, False),
        ("3200", 3200, False),
        ("2 lakh", 200_000, False),
        ("dedh lakh", 150_000, False),
        ("15 percent", 15, True),
        ("pandhra sau", 1500, False),
        ("dui hazar paanch sau", 2500, False),
        ("50000", 50000, False),
    ]
    passed = 0
    failed = 0
    for text, expected_amt, expected_pct in cases:
        amt, is_pct = parse_amount(text)
        if amt == expected_amt and is_pct == expected_pct:
            passed += 1
        else:
            failed += 1
            print(f"  AMOUNT FAIL: {text!r} → got ({amt}, {is_pct}), expected ({expected_amt}, {expected_pct})")
    print(f"Amount parsing: {passed} passed, {failed} failed")
    return passed, failed


def test_slot_extraction() -> tuple[int, int]:
    cases = [
        ("Ram lai 500 udharo diye", "Ram", 500),
        ("Sita ley 500 rupiya tirin", "Sita", 500),
        ("dealer lai 2000 tirey", "Dealer", 2000),
        ("Hari ko kati baki cha", "Hari", None),
    ]
    passed = 0
    failed = 0
    for text, expected_party, expected_amt in cases:
        _, slots, _ = classify_with_slots(text)
        party_ok = slots.party == expected_party
        amt_ok = slots.amount == expected_amt
        if party_ok and amt_ok:
            passed += 1
        else:
            failed += 1
            print(
                f"  SLOT FAIL: {text!r}\n"
                f"    party: got {slots.party!r}, expected {expected_party!r}\n"
                f"    amount: got {slots.amount}, expected {expected_amt}"
            )
    print(f"Slot extraction: {passed} passed, {failed} failed")
    return passed, failed


def test_agent_e2e() -> tuple[int, int]:
    from src.customer.agent import ask_customer

    passed = 0
    failed = 0
    session = "test-session-e2e"

    cases = [
        ("Ram lai 500 udharo diye", "post"),
        ("aja kati kamayo", "query"),
        ("namaste", "greet"),
    ]

    for msg, expected_action in cases:
        result = ask_customer(msg, session)
        if result.get("action") == expected_action:
            passed += 1
        else:
            failed += 1
            print(f"  AGENT FAIL: {msg!r} → action={result.get('action')}, expected {expected_action}")

    print(f"Agent e2e: {passed} passed, {failed} failed")
    return passed, failed


def main() -> int:
    print("Customer Falcon NLU Test Suite")
    print(f"Corpus: {CORPUS_PATH} ({len(load_corpus())} examples)")

    total_pass = 0
    total_fail = 0

    for fn in (test_intent_classification, test_amount_parsing, test_slot_extraction, test_agent_e2e):
        p, f = fn()
        total_pass += p
        total_fail += f

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_pass} passed, {total_fail} failed")
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main())
