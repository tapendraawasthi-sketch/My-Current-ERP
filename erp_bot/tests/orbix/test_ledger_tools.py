"""Deterministic ledger-math tests — no Ollama/network needed.

Run: cd erp_bot && python -m pytest tests/orbix/test_ledger_tools.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.orbix.tools.ledger_tools import (  # noqa: E402
    build_journal_lines,
    normalize_amount,
)
from src.orbix.tools.registry import build_default_registry  # noqa: E402


def test_normalize_amount():
    assert normalize_amount("5000") == 5000
    assert normalize_amount("5,000") == 5000
    assert normalize_amount("Rs 5000") == 5000
    assert normalize_amount("5k") == 5000
    assert normalize_amount("5 hajar") == 5000
    assert normalize_amount("1.5 lakh") == 150000
    assert normalize_amount(9500) == 9500


def test_debtor_settlement_with_discount_is_balanced():
    """Ram le 10000 tiryo tara 500 discount diye -> balanced 3-line journal."""
    event = {
        "event_type": "debtor_settlement_with_discount",
        "party": "Ram",
        "gross_amount": 10000,
        "discount": 500,
        "cash_amount": 9500,
    }
    lines = build_journal_lines(event)
    debit = round(sum(l.debit for l in lines), 2)
    credit = round(sum(l.credit for l in lines), 2)

    assert len(lines) == 3
    assert debit == credit == 10000
    # discount line exists
    assert any(l.account == "Discount Allowed" and l.debit == 500 for l in lines)
    # cash received is net
    assert any(l.account == "Cash" and l.debit == 9500 for l in lines)


def test_credit_sale_creates_receivable():
    event = {"event_type": "credit_sale", "party": "Shyam", "gross_amount": 2000}
    lines = build_journal_lines(event)
    assert any("Receivable" in l.account and l.debit == 2000 for l in lines)
    assert any(l.account == "Sales" and l.credit == 2000 for l in lines)


def test_simulate_voucher_rejects_unbalanced():
    registry = build_default_registry()

    async def run():
        # explicit unbalanced lines
        return await registry.call(
            "simulate_voucher",
            {"lines": [{"account": "Cash", "debit": 100}, {"account": "Sales", "credit": 90}]},
        )

    result = asyncio.run(run())
    assert result.ok is False


def test_post_requires_confirmation_flag():
    registry = build_default_registry()
    tool = registry.get("post_confirmed_voucher")
    assert tool is not None
    assert tool.spec.requires_confirmation is True
    assert tool.spec.read_only is False


if __name__ == "__main__":
    test_normalize_amount()
    test_debtor_settlement_with_discount_is_balanced()
    test_credit_sale_creates_receivable()
    test_simulate_voucher_rejects_unbalanced()
    test_post_requires_confirmation_flag()
    print("All ledger tests passed.")
