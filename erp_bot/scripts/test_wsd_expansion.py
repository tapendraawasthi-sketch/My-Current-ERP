#!/usr/bin/env python3
"""Tests for Phase D WSD particle expansion (ma/bata/ko/ko lagi)."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.nlu.context_wsd import analyze_context_wsd, analyze_particles, apply_wsd_to_parsed
from src.nlu.engine import ParsedEntry, get_nlu_engine


def test_cash_ma_payment() -> None:
    wsd = analyze_context_wsd("Screen replace garya, 2500 liyo cash ma")
    assert wsd.payment_method == "cash"
    parts = analyze_particles("2500 cash ma")
    assert parts["payment_ma"] is True


def test_location_ma_not_payment() -> None:
    wsd = analyze_context_wsd("Kathmandu ma dukan bhada 20000 tiryo")
    parts = analyze_particles("Kathmandu ma dukan bhada")
    assert parts["location_ma"] is True
    assert parts["payment_ma"] is False
    assert wsd.top_intent == "expense"


def test_bata_payment_received() -> None:
    wsd = analyze_context_wsd("Sita bata 3000 aayo")
    assert wsd.top_intent == "payment_received"
    parts = analyze_particles("Sita bata 3000 aayo")
    assert parts["bata_payment_in"] is True


def test_bata_purchase() -> None:
    wsd = analyze_context_wsd("Sita bata saman kineko 3000")
    assert wsd.top_intent == "credit_purchase"
    parts = analyze_particles("Sita bata saman kineko")
    assert parts["bata_purchase"] is True


def test_fonepay_bata() -> None:
    wsd = analyze_context_wsd("Fonepay bata 4500 aayo")
    assert wsd.top_intent == "payment_received"
    parts = analyze_particles("Fonepay bata 4500 aayo")
    assert parts["bata_digital"] is True


def test_le_vs_lai_diye() -> None:
    wsd_lai = analyze_context_wsd("Ram lai 500 diye")
    wsd_le = analyze_context_wsd("Ram le 500 diye")
    assert wsd_lai.top_intent == "credit_sale"
    assert wsd_le.top_intent == "payment_made"


def test_ko_lagi_purpose() -> None:
    parts = analyze_particles("repair ko lagi 500 tiryo")
    assert parts["ko_lagi_purpose"] is True


def test_wsd_overrides_unknown_parse() -> None:
    engine = get_nlu_engine()
    parsed = engine.parse("Ram le 500 tiryo", {"session_id": "wsd-test"})
    wsd = analyze_context_wsd("Ram le 500 tiryo")
    updated = apply_wsd_to_parsed(parsed, wsd)
    assert updated.intent in ("payment_received", parsed.intent)
    assert updated.party in ("Ram", parsed.party)


def test_ko_party_extract() -> None:
    parts = analyze_particles("Ram ko udhaar 500")
    assert parts["ko_party"] is not None
    assert parts["ko_party"].lower().startswith("ram")


def main() -> int:
    tests = [
        test_cash_ma_payment,
        test_location_ma_not_payment,
        test_bata_payment_received,
        test_bata_purchase,
        test_fonepay_bata,
        test_le_vs_lai_diye,
        test_ko_lagi_purpose,
        test_wsd_overrides_unknown_parse,
        test_ko_party_extract,
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
