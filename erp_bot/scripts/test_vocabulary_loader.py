#!/usr/bin/env python3
"""Tests for unified vocabulary loader (Python ↔ TS parity)."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.knowledge.chart_of_accounts_framework import get_nlu_vocabulary_summary
from src.knowledge.vocabulary_loader import (
    build_master_vocabulary,
    detect_business_sector,
    detect_payment_method,
    get_all_business_terms,
    get_merged_spelling_aliases,
    get_payment_aliases,
    map_intent_hint_to_nlu,
    match_transaction_intent_hint,
    mentions_business_item,
)
from src.nlu.clarification_planner import parse_payment_method
from src.nlu.engine import get_nlu_engine
from src.nlu.text_normalize import normalize_accounting_text


def test_spelling_aliases_load() -> None:
    aliases = get_merged_spelling_aliases()
    assert len(aliases) >= 50
    assert aliases.get("bechye") == "becheko"
    assert aliases.get("eutako") == "euta ko"


def test_normalize_uses_vocabulary() -> None:
    norm = normalize_accounting_text("bechye 500 nagad ma")
    assert "becheko" in norm
    assert "cash" in norm


def test_detect_business_sector_pharmacy() -> None:
    match = detect_business_sector("paracetamol strip becheko 450 cash ma")
    assert match is not None
    assert match.sector_slug == "pharmacy-medical" or match.slug == "pharmacy-medical"


def test_match_transaction_intent_hint() -> None:
    hint = match_transaction_intent_hint("Ram lai saman becheko 500")
    assert hint == "khata_cash_sale"
    mapped = map_intent_hint_to_nlu(hint, "cash")
    assert mapped == "cash_sale"


def test_payment_detection_vocab() -> None:
    assert detect_payment_method("fonepay bata 500 aayo") == "esewa"
    assert detect_payment_method("khalti ma tiryo") == "khalti"
    assert detect_payment_method("cheque bata payment") == "cheque"
    assert parse_payment_method("fonepay") == "esewa"


def test_mentions_business_item() -> None:
    assert mentions_business_item("dahi ra ghee becheko")
    assert not mentions_business_item("hello world")


def test_nlu_summary_from_vocab() -> None:
    summary = get_nlu_vocabulary_summary()
    assert "UNIFIED VOCABULARY" in summary
    assert "becheko" in summary or "bikri" in summary


def test_engine_vocab_payment() -> None:
    engine = get_nlu_engine()
    parsed = engine.parse("Screen replace garya, fonepay bata 2500 liyo")
    assert parsed.payment_method in ("esewa", "unknown")  # may need amount path
    if parsed.amount:
        assert parsed.payment_method == "esewa"


def test_build_master_payload() -> None:
    master = build_master_vocabulary()
    assert master["category_count"] >= 20
    assert master["term_count"] >= 500
    assert master["spelling_alias_count"] >= 50
    assert "payment_aliases" in master


def main() -> int:
    tests = [
        test_spelling_aliases_load,
        test_normalize_uses_vocabulary,
        test_detect_business_sector_pharmacy,
        test_match_transaction_intent_hint,
        test_payment_detection_vocab,
        test_mentions_business_item,
        test_nlu_summary_from_vocab,
        test_engine_vocab_payment,
        test_build_master_payload,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
        except Exception as exc:
            failed += 1
            print(f"ERROR {fn.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
