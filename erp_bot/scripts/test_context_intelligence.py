#!/usr/bin/env python3
"""Smoke tests for e-Khata semantic context retrieval."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.khata import context_intelligence as _ci

build_intelligent_context = _ci.build_intelligent_context
classify_message_kind = _ci.classify_message_kind
MessageKind = _ci.MessageKind


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def test_nepali_transaction() -> None:
    msg = "Ram le 500 tiryo"
    ctx = build_intelligent_context(msg)
    _assert(len(ctx) > 50, "non-empty context for nepali transaction")
    _assert("NEPALI GRAMMAR" in ctx or "IFRS" in ctx, "retrieved knowledge present")
    print(f"OK nepali transaction ({len(ctx)} chars)")


def test_english_debit() -> None:
    msg = "Ram khata debit 5000 for credit sale"
    ctx = build_intelligent_context(msg)
    _assert(len(ctx) > 50, "non-empty context for english accounting")
    print(f"OK english debit ({len(ctx)} chars)")


def test_vat_query() -> None:
    msg = "VAT bill dinus 13% inc-VAT 113000"
    ctx = build_intelligent_context(msg)
    _assert(len(ctx) > 50, "non-empty context for vat query")
    print(f"OK vat query ({len(ctx)} chars)")


def test_framework_query() -> None:
    msg = "sampatti ko paribhasha k ho IFRS ma?"
    ctx = build_intelligent_context(msg)
    _assert("IFRS" in ctx, "IFRS context retrieved")
    _assert(ctx.index("IFRS") < ctx.index("NEPALI GRAMMAR") if "NEPALI GRAMMAR" in ctx else True, "IFRS before grammar")
    print(f"OK framework query ({len(ctx)} chars)")


def test_sampati_definition_routing() -> None:
    msg = "sampati k ho"
    kind = classify_message_kind(msg)
    _assert(kind == MessageKind.ACCOUNTING_CONCEPT, f"expected accounting_concept, got {kind}")
    ctx = build_intelligent_context(msg)
    _assert("IFRS" in ctx, "IFRS context for sampati k ho")
    _assert("4.3" in ctx or "present economic resource" in ctx.lower(), "Para 4.3 asset definition present")
    _assert("NEPALI GRAMMAR" not in ctx, "grammar excluded for clear accounting term")
    print(f"OK sampati definition routing ({len(ctx)} chars)")


def test_transaction_keeps_grammar() -> None:
    msg = "Ram le 500 ko saman kinyo"
    kind = classify_message_kind(msg)
    _assert(kind == MessageKind.TRANSACTION, f"expected transaction, got {kind}")
    ctx = build_intelligent_context(msg)
    _assert("NEPALI GRAMMAR" in ctx, "grammar context for transaction")
    print(f"OK transaction grammar ({len(ctx)} chars)")


def test_semantic_not_keyword_rerank() -> None:
    msg = "Shyam lai 1000 udhaar diye"
    ctx = build_intelligent_context(msg)
    _assert("▸" not in ctx, "no keyword-synthesized bullet format")
    _assert("NEPALI GRAMMAR" in ctx, "grammar context header present")
    print(f"OK semantic context ({len(ctx)} chars)")


if __name__ == "__main__":
    test_nepali_transaction()
    test_english_debit()
    test_vat_query()
    test_framework_query()
    test_sampati_definition_routing()
    test_transaction_keeps_grammar()
    test_semantic_not_keyword_rerank()
    print("\nAll context intelligence tests passed.")
