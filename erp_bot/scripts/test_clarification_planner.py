#!/usr/bin/env python3
"""Regression tests for slot-based clarification planner."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.nlu.clarification_planner import (
    extract_qty_rate_amount,
    infer_required_slots,
    parse_payment_method,
    parse_party_name,
    parse_slot_values,
    process_clarification_followup,
)
from src.nlu.engine import ParsedEntry


def _pending(**kwargs) -> ParsedEntry:
    base = {
        "intent": "credit_sale",
        "narration": "Ram lai saman becheko",
        "confidence": 0.6,
        "needs_clarification": True,
    }
    base.update(kwargs)
    return ParsedEntry(**base)


def test_parse_amount_only() -> None:
    found = parse_slot_values("500", ["amount"])
    assert found["amount"] == 500.0


def test_parse_qty_rate() -> None:
    assert extract_qty_rate_amount("5 x 200") == 1000.0
    assert extract_qty_rate_amount("10 piece ma 150") == 1500.0
    assert extract_qty_rate_amount("eutako 500") == 500.0


def test_parse_payment_mode() -> None:
    assert parse_payment_method("cash") == "cash"
    assert parse_payment_method("nagad ma") == "cash"
    assert parse_payment_method("esewa") == "esewa"
    assert parse_payment_method("udhaar") == "unknown"


def test_parse_party_short() -> None:
    assert parse_party_name("Ram") == "Ram"
    assert parse_party_name("Ram ko") == "Ram"
    assert parse_party_name("Sita lai") == "Sita"


def test_followup_fills_amount_then_complete() -> None:
    pending = _pending(party="Ram")
    required = infer_required_slots(pending, {"party": "Ram"})

    step1 = process_clarification_followup(
        pending,
        "500",
        {"party": "Ram"},
        required,
    )
    assert step1.complete is True
    assert step1.parsed.amount == 500.0
    assert step1.parsed.party == "Ram"


def test_followup_fills_payment_mode() -> None:
    pending = _pending(amount=1200.0, party="Sita")
    required = ("payment_method",)

    result = process_clarification_followup(
        pending,
        "cash",
        {"amount": 1200.0, "party": "Sita"},
        required,
    )
    assert result.complete is True
    assert result.parsed.payment_method == "cash"
    assert result.parsed.intent == "cash_sale"


def test_followup_multi_turn_party_then_amount() -> None:
    pending = _pending()
    required = infer_required_slots(pending, {})

    step1 = process_clarification_followup(pending, "Ram", {}, required)
    assert step1.complete is False
    assert step1.filled_slots["party"] == "Ram"

    step2 = process_clarification_followup(
        step1.parsed,
        "500",
        step1.filled_slots,
        required,
    )
    assert step2.complete is True
    assert step2.parsed.amount == 500.0
    assert step2.parsed.party == "Ram"


def test_manager_clarification_flow_smoke() -> None:
    from src.conversation.manager import ConversationManager

    mgr = ConversationManager()
    session_id = "test-clarify-planner"

    r1 = mgr.handle_message("Ram lai saman becheko", session_id=session_id)
    assert r1.action == "clarify"

    r2 = mgr.handle_message("500", session_id=session_id)
    assert r2.action in ("clarify", "confirm")
    if r2.action == "confirm":
        assert r2.entry is not None
        assert float(r2.entry.amount) == 500.0


def main() -> int:
    tests = [
        test_parse_amount_only,
        test_parse_qty_rate,
        test_parse_payment_mode,
        test_parse_party_short,
        test_followup_fills_amount_then_complete,
        test_followup_fills_payment_mode,
        test_followup_multi_turn_party_then_amount,
        test_manager_clarification_flow_smoke,
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
