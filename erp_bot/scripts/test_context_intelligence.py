#!/usr/bin/env python3
"""Smoke tests for e-Khata context intelligence synthesis."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.khata import context_intelligence as _ci

analyze_message = _ci.analyze_message
build_intelligent_context = _ci.build_intelligent_context
synthesize_grammar_context = _ci.synthesize_grammar_context
retrieve_grammar_hits = _ci.retrieve_grammar_hits


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def test_nepali_transaction() -> None:
    msg = "Ram le 500 tiryo"
    analysis = analyze_message(msg)
    _assert("tiryo" in analysis.verb_signals, "tiryo verb detected")
    _assert(analysis.is_transaction, "transaction signal")
    ctx = build_intelligent_context(msg)
    _assert(len(ctx) < 3500, f"context too large: {len(ctx)}")
    _assert("NEPALI NLU INTELLIGENCE" in ctx, "synthesized header")
    _assert("Ram le 500 tiryo" not in ctx or "▸" in ctx, "structured bullets")
    print(f"OK nepali transaction ({len(ctx)} chars)")


def test_english_debit() -> None:
    msg = "Ram khata debit 5000 for credit sale"
    analysis = analyze_message(msg)
    _assert(analysis.has_english_accounting, "english accounting detected")
    ctx = build_intelligent_context(msg)
    _assert(len(ctx) > 100, "non-empty context for english accounting")
    _assert("Sec 81" in ctx or "debit" in ctx.lower(), "ledger section relevance")
    print(f"OK english debit ({len(ctx)} chars)")


def test_vat_query() -> None:
    msg = "VAT bill dinus 13% inc-VAT 113000"
    analysis = analyze_message(msg)
    _assert("tax_vat" in analysis.intent_keys, "vat intent")
    hits = retrieve_grammar_hits(analysis)
    ctx = synthesize_grammar_context(hits, analysis)
    _assert("RULE" in ctx or "VAT" in ctx or "13" in ctx, "vat rules extracted")
    print(f"OK vat query ({len(ctx)} chars)")


def test_framework_query() -> None:
    msg = "sampatti ko paribhasha k ho IFRS ma?"
    ctx = build_intelligent_context(msg)
    _assert("IFRS" in ctx or "NLU" in ctx, "framework or grammar context")
    print(f"OK framework query ({len(ctx)} chars)")


def test_synthesis_not_raw_dump() -> None:
    msg = "Shyam lai 1000 udhaar diye"
    ctx = build_intelligent_context(msg)
    # Raw dumps often exceed 5000 chars with 3 full sections
    _assert(len(ctx) < 4000, f"synthesis should be compact, got {len(ctx)}")
    _assert("━━━" not in ctx, "no section delimiter dumps")
    print(f"OK compact synthesis ({len(ctx)} chars)")


if __name__ == "__main__":
    test_nepali_transaction()
    test_english_debit()
    test_vat_query()
    test_framework_query()
    test_synthesis_not_raw_dump()
    print("\nAll context intelligence tests passed.")
