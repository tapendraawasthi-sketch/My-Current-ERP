#!/usr/bin/env python3
"""Tests for sector journal templates (Phase C Step 1)."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.nlu.engine import ParsedEntry, get_nlu_engine
from src.nlu.knowledge_enrich import enrich_parsed_entry
from src.reasoning.accounting_reasoner import get_accounting_reasoner
from src.reasoning.sector_journal_templates import (
    build_sector_journal_lines,
    build_templates_from_sector_files,
    can_build_sector_template,
    detect_template_pattern,
    extract_accounts_from_content,
    lookup_sector_template,
    try_build_from_parsed,
    write_sector_templates,
)


def test_extract_accounts_from_content() -> None:
    content = (
        "SECTOR NLU — sector=Mobile Repair Shop\n"
        "User input: cover becheko\n"
        "Debit: Cash\n"
        "Credit: Sales - Accessories\n"
    )
    debits, credits = extract_accounts_from_content(content)
    assert debits == ["Cash"]
    assert credits == ["Sales - Accessories"]


def test_simple_cash_sale_template() -> None:
    lines = build_sector_journal_lines(
        ["Cash"],
        ["Sales - Accessories"],
        600.0,
        payment_method="cash",
    )
    assert len(lines) == 2
    dr = sum(l["debit"] for l in lines)
    cr = sum(l["credit"] for l in lines)
    assert abs(dr - cr) < 0.02
    assert dr == 600.0
    assert lines[0]["account"] == "KH-CASH"
    assert lines[1]["account"] == "KH-SALE"


def test_vat_sale_template() -> None:
    lines = build_sector_journal_lines(
        ["Bank"],
        ["Sales - Generator", "Output VAT"],
        11300.0,
        payment_method="bank",
        vat_inclusive=True,
    )
    dr = sum(l["debit"] for l in lines)
    cr = sum(l["credit"] for l in lines)
    assert abs(dr - cr) < 0.02
    assert any(l["account"] == "KH-VAT-OUT" for l in lines)


def test_cogs_requires_secondary() -> None:
    assert not can_build_sector_template(
        ["Cash"],
        ["Repair Service Income", "Spare Parts Inventory (COGS)"],
        amount=2500.0,
        secondary_amount=None,
    )
    lines = build_sector_journal_lines(
        ["Cash"],
        ["Repair Service Income", "Spare Parts Inventory (COGS)"],
        2500.0,
        payment_method="cash",
        secondary_amount=800.0,
    )
    dr = sum(l["debit"] for l in lines)
    cr = sum(l["credit"] for l in lines)
    assert abs(dr - cr) < 0.02
    assert any(l["account"] == "KH-STOCK" for l in lines)


def test_build_templates_index() -> None:
    write_sector_templates()
    payload = build_templates_from_sector_files()
    assert payload["template_count"] >= 100
    tpl = lookup_sector_template(
        sector_slug="mobile-repair-shop",
        nlu_intent="cash_sale",
        transaction_category="accessory_sale",
    )
    assert tpl is not None
    assert "Cash" in (tpl.get("debit_accounts") or [])


def test_enrich_attaches_accounts() -> None:
    parsed = ParsedEntry(
        intent="unknown",
        narration="मोबाइल कभर ५ पिस बिक्री भयो, नगदमा ६०० रुपैयाँ",
        confidence=0.3,
        amount=600.0,
        payment_method="cash",
    )
    enriched = enrich_parsed_entry(
        parsed,
        parsed.narration,
        sector_profile="mobile-repair-shop",
    )
    assert enriched.debit_accounts
    assert enriched.credit_accounts
    assert enriched.sector_slug == "mobile-repair-shop"


def test_reasoner_sector_template() -> None:
    engine = get_nlu_engine()
    reasoner = get_accounting_reasoner()
    msg = "मोबाइल कभर ५ पिस बिक्री भयो, नगदमा ६०० रुपैयाँ"
    parsed = engine.parse(msg, {"business_sector_slug": "mobile-repair-shop"})
    enriched = enrich_parsed_entry(parsed, msg, sector_profile="mobile-repair-shop")
    enriched = enriched.model_copy(
        update={
            "needs_clarification": False,
            "confidence": 0.9,
            "debit_accounts": ["Cash"],
            "credit_accounts": ["Sales - Accessories"],
        }
    )
    entry = reasoner.reason_entry(enriched)
    dr = sum(l.debit for l in entry.lines)
    cr = sum(l.credit for l in entry.lines)
    assert abs(dr - cr) < 0.02
    assert entry.lines[0].account == "KH-CASH"


def test_try_build_from_parsed() -> None:
    parsed = ParsedEntry(
        intent="cash_sale",
        amount=500.0,
        narration="cash sale",
        confidence=0.9,
        payment_method="cash",
        debit_accounts=["Cash"],
        credit_accounts=["Sales - Bulb"],
    )
    lines = try_build_from_parsed(parsed)
    assert lines is not None
    assert sum(l["debit"] for l in lines) == 500.0


def test_split_payment_sale() -> None:
    debits = ["Cash", "Accounts Receivable - Bimala"]
    credits = ["Sales - Rod", "VAT Payable"]
    assert detect_template_pattern(
        ["Cash", "Accounts Receivable - Bimala"],
        ["Sales - Rod", "VAT Payable"],
    ) == "split_payment_sale"
    lines = build_sector_journal_lines(
        debits,
        credits,
        11300.0,
        payment_method="cash",
        secondary_amount=5000.0,
    )
    assert abs(sum(l["debit"] for l in lines) - sum(l["credit"] for l in lines)) < 0.02
    assert any(l["account"] == "KH-DEBT" for l in lines)


def test_advance_to_supplier() -> None:
    lines = build_sector_journal_lines(
        ["Advance to Supplier"],
        ["Bank"],
        15000.0,
        payment_method="bank",
    )
    assert lines[0]["account"] == "KH-PREPAID"
    assert lines[1]["account"] == "KH-BANK"
    assert sum(l["debit"] for l in lines) == 15000.0


def test_partial_purchase_payment() -> None:
    lines = build_sector_journal_lines(
        ["Purchase - PVC Pipe", "Input VAT"],
        ["Cash", "Accounts Payable - Prince Dealer"],
        11300.0,
        payment_method="cash",
        secondary_amount=5000.0,
    )
    assert abs(sum(l["debit"] for l in lines) - sum(l["credit"] for l in lines)) < 0.02
    assert any(l["account"] == "KH-VAT-IN" for l in lines)
    assert any(l["account"] == "KH-CRED" for l in lines)


def test_trade_in_sale() -> None:
    lines = build_sector_journal_lines(
        ["Inventory - Used Phone", "Cash"],
        ["Sales - Oppo Phone"],
        50000.0,
        payment_method="cash",
        secondary_amount=24000.0,
        tertiary_amount=26000.0,
    )
    assert abs(sum(l["debit"] for l in lines) - 50000.0) < 0.02
    assert any(l["account"] == "KH-STOCK" and l["debit"] == 26000 for l in lines)


def test_inventory_exchange() -> None:
    lines = build_sector_journal_lines(
        ["Inventory - New Size"],
        ["Inventory - Wrong Size"],
        1200.0,
        payment_method="unknown",
    )
    assert lines[0]["debit"] == 1200.0
    assert lines[1]["credit"] == 1200.0


def test_clarification_part_cost_merge() -> None:
    from src.nlu.clarification_planner import merge_slots_into_parsed, parse_slot_values

    slots = parse_slot_values("part cost 800", [])
    assert slots.get("part_cost") == 800.0
    parsed = ParsedEntry(intent="cash_sale", narration="repair", confidence=0.8, amount=2500.0)
    merged = merge_slots_into_parsed(parsed, slots)
    assert merged.secondary_amount == 800.0


def main() -> int:
    tests = [
        test_extract_accounts_from_content,
        test_simple_cash_sale_template,
        test_vat_sale_template,
        test_cogs_requires_secondary,
        test_build_templates_index,
        test_enrich_attaches_accounts,
        test_reasoner_sector_template,
        test_try_build_from_parsed,
        test_split_payment_sale,
        test_advance_to_supplier,
        test_partial_purchase_payment,
        test_trade_in_sale,
        test_inventory_exchange,
        test_clarification_part_cost_merge,
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
