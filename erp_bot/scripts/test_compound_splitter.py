#!/usr/bin/env python3
"""Tests for compound message splitter and batch entry flow."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.conversation.manager import get_conversation_manager
from src.nlu.compound import is_compound_message, split_compound_transactions
from src.nlu.compound_entry_batch import build_batch_card, build_compound_batch
from src.reasoning.accounting_reasoner import get_accounting_reasoner
from src.nlu.engine import get_nlu_engine


def test_split_daily_summary() -> None:
    parts = split_compound_transactions("aaja bikri 8500, rent 8000 tiryo")
    assert len(parts) == 2
    assert "8500" in parts[0]
    assert "8000" in parts[1]


def test_no_split_amount_comma() -> None:
    parts = split_compound_transactions("Ram lai saman becheko Rs 1,500 cash ma")
    assert len(parts) == 1


def test_split_ra_conjunct() -> None:
    parts = split_compound_transactions("Ram lai 5000 becheko ra 2000 kharcha tireko")
    assert len(parts) == 2


def test_is_compound_message() -> None:
    assert is_compound_message("aaja bikri 8500, rent 8000 tiryo")
    assert not is_compound_message("Ram lai 500 cash ma becheko")


def test_build_compound_batch() -> None:
    parts = split_compound_transactions("aaja bikri 8500, rent 8000 tiryo")
    nlu = get_nlu_engine()
    reasoner = get_accounting_reasoner()
    from src.reasoning.accounting_reasoner import SessionContext

    ctx = SessionContext(session_id="compound-test")
    batch = build_compound_batch(
        parts,
        nlu=nlu,
        reasoner=reasoner,
        session_context=ctx,
        verify_ctx={},
    )
    assert batch.ok
    assert len(batch.sub_entries) == 2
    assert batch.sub_entries[0].journal.amount == 8500.0
    assert batch.sub_entries[1].journal.amount == 8000.0
    card = build_batch_card(batch.sub_entries, "aaja bikri 8500, rent 8000 tiryo")
    assert card["compound"] is True
    assert card["compoundCount"] == 2
    assert len(card["parts"]) == 2


def test_manager_compound_flow() -> None:
    mgr = get_conversation_manager()
    session_id = "compound-flow-test"
    resp = mgr.handle_message(
        "aaja bikri 8500, rent 8000 tiryo",
        session_id=session_id,
    )
    assert resp.action == "confirm"
    assert resp.metadata.get("intent") == "compound_batch"
    assert resp.metadata.get("parts") == 2
    session = mgr.get_session(session_id)
    assert session.pending_compound_batch is not None
    assert len(session.pending_compound_batch) == 2

    posted = mgr.handle_message("ho", session_id=session_id)
    assert posted.action == "posted"
    assert posted.metadata.get("compound_batch_posted") == 2


def main() -> int:
    tests = [
        test_split_daily_summary,
        test_no_split_amount_comma,
        test_split_ra_conjunct,
        test_is_compound_message,
        test_build_compound_batch,
        test_manager_compound_flow,
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
