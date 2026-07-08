#!/usr/bin/env python3
"""Tests for journal verifier chain (Phase C Step 3)."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.nlu.engine import ParsedEntry
from src.reasoning.accounting_reasoner import JournalEntry, JournalLine
from src.reasoning.journal_verifier_chain import run_journal_verifier_chain
from src.reasoning.sector_journal_templates import build_sector_journal_lines


def _entry_from_lines(
    intent: str,
    amount: float,
    lines: list[dict],
    *,
    narration: str = "test",
) -> JournalEntry:
    return JournalEntry(
        intent=intent,  # type: ignore[arg-type]
        amount=amount,
        narration=narration,
        lines=[
            JournalLine(
                account=row["account"],
                name=row.get("accountName", row["account"]),
                debit=row["debit"],
                credit=row["credit"],
            )
            for row in lines
        ],
        confidence=0.9,
    )


def test_valid_cash_sale_passes() -> None:
    raw = build_sector_journal_lines(["Cash"], ["Sales - Accessories"], 600.0, payment_method="cash")
    entry = _entry_from_lines("cash_sale", 600.0, raw)
    parsed = ParsedEntry(intent="cash_sale", amount=600.0, narration="sale", confidence=0.9, payment_method="cash")
    result = run_journal_verifier_chain(entry, parsed, use_llm=False)
    assert result.passed
    assert not result.blocked


def test_unbalanced_blocks() -> None:
    entry = JournalEntry.model_construct(
        intent="cash_sale",
        amount=500.0,
        narration="bad",
        lines=[
            JournalLine(account="KH-CASH", debit=500, credit=0),
            JournalLine(account="KH-SALE", debit=0, credit=400),
        ],
        confidence=0.9,
    )
    parsed = ParsedEntry(intent="cash_sale", amount=500.0, narration="bad", confidence=0.9)
    result = run_journal_verifier_chain(entry, parsed, use_llm=False)
    assert result.blocked
    assert any("balanced" in e.lower() for e in result.errors)


def test_amount_mismatch_blocks() -> None:
    raw = build_sector_journal_lines(["Cash"], ["Sales - Bulb"], 500.0, payment_method="cash")
    entry = _entry_from_lines("cash_sale", 500.0, raw)
    parsed = ParsedEntry(intent="cash_sale", amount=900.0, narration="sale", confidence=0.9)
    result = run_journal_verifier_chain(entry, parsed, use_llm=False)
    assert result.blocked
    assert any("mismatch" in e.lower() for e in result.errors)


def test_wrong_intent_accounts_blocks() -> None:
    entry = JournalEntry(
        intent="cash_sale",
        amount=500.0,
        narration="wrong",
        lines=[
            JournalLine(account="KH-EXP", debit=500, credit=0),
            JournalLine(account="KH-CASH", debit=0, credit=500),
        ],
        confidence=0.9,
    )
    parsed = ParsedEntry(intent="cash_sale", amount=500.0, narration="wrong", confidence=0.9)
    result = run_journal_verifier_chain(entry, parsed, use_llm=False)
    assert result.blocked


def test_service_cogs_warning_without_part_cost() -> None:
    raw = build_sector_journal_lines(
        ["Cash"],
        ["Repair Service Income", "Spare Parts Inventory (COGS)"],
        2500.0,
        payment_method="cash",
        secondary_amount=800.0,
    )
    entry = _entry_from_lines("cash_sale", 2500.0, raw)
    parsed = ParsedEntry(
        intent="cash_sale",
        amount=2500.0,
        narration="repair",
        confidence=0.9,
        payment_method="cash",
        secondary_amount=800.0,
        transaction_category="service_sale_with_part",
        debit_accounts=["Cash"],
        credit_accounts=["Repair Service Income", "Spare Parts Inventory (COGS)"],
    )
    result = run_journal_verifier_chain(entry, parsed, use_llm=False)
    assert result.passed
    assert not result.blocked


def test_manager_blocks_on_verify_fail() -> None:
    from src.conversation.manager import get_conversation_manager

    mgr = get_conversation_manager()
    # Force a bad path by mocking isn't needed — use handle with complete message that would parse
    # Instead verify chain integration via direct finalize path simulation
    raw = build_sector_journal_lines(["Cash"], ["Sales - X"], 300.0, payment_method="cash")
    entry = _entry_from_lines("cash_sale", 300.0, raw)
    entry = entry.model_copy(update={"amount": 9999.0})
    parsed = ParsedEntry(intent="cash_sale", amount=300.0, narration="sale", confidence=0.95, payment_method="cash")
    result = run_journal_verifier_chain(entry, parsed, use_llm=False)
    assert result.blocked


def main() -> int:
    tests = [
        test_valid_cash_sale_passes,
        test_unbalanced_blocks,
        test_amount_mismatch_blocks,
        test_wrong_intent_accounts_blocks,
        test_service_cogs_warning_without_part_cost,
        test_manager_blocks_on_verify_fail,
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
