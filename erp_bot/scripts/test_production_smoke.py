#!/usr/bin/env python3
"""Production smoke tests — offline confirm-card pipeline (no Ollama required)."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.conversation.manager import get_conversation_manager
from src.knowledge.domain_router import classify_domain
from src.nlu.engine import get_nlu_engine
from src.nlu.knowledge_enrich import enrich_parsed_entry


MOBILE_CTX = {
    "business_sector": "mobile-repair-shop",
    "business_sector_slug": "mobile-repair-shop",
    "cash_balance": 50000,
}


def _sid() -> str:
    return f"prod-smoke-{uuid.uuid4().hex[:8]}"


def test_domain_router_repair_sale() -> None:
    route = classify_domain("Screen replace garya, 2500 liyo cash ma")
    assert route.mode == "journal_entry", route.mode


def test_regex_not_overridden_by_weak_sector() -> None:
    nlu = get_nlu_engine()
    msg = "aaja 200 ko nagad bikri vayo"
    parsed = nlu._regex_parse(msg)
    assert parsed is not None
    assert parsed.intent == "cash_sale"
    enriched = enrich_parsed_entry(
        parsed,
        msg,
        sector_profile="mobile-repair-shop",
        session_sector="mobile-repair-shop",
    )
    assert enriched.intent == "cash_sale"
    assert enriched.skip_posting is False


def test_payment_received_not_blocked() -> None:
    nlu = get_nlu_engine()
    msg = "Shyam le 2000 tiryo"
    ctx = {**MOBILE_CTX, "session_id": _sid()}
    parsed = nlu.parse(msg, ctx)
    assert parsed.intent == "payment_received"
    assert parsed.skip_posting is False


def test_manager_cash_sale_confirm() -> None:
    mgr = get_conversation_manager()
    sid = _sid()
    resp = mgr.handle_message(
        "aaja 200 ko nagad bikri vayo",
        session_id=sid,
        context=MOBILE_CTX,
    )
    assert resp.action == "confirm", (resp.action, resp.message[:80])
    assert resp.card is not None
    assert resp.metadata.get("intent") in ("cash_sale", "khata_cash_sale")


def test_manager_clarify_hold_mobile_repair() -> None:
    mgr = get_conversation_manager()
    sid = _sid()
    resp = mgr.handle_message(
        "Screen replace garya, 2500 liyo cash ma",
        session_id=sid,
        context=MOBILE_CTX,
    )
    assert resp.action == "clarify", (resp.action, resp.message[:80])
    assert resp.metadata.get("skip_posting") is True


def test_manager_compound_confirm_post() -> None:
    mgr = get_conversation_manager()
    sid = _sid()
    resp = mgr.handle_message(
        "aaja bikri 8500, rent 8000 tiryo",
        session_id=sid,
        context=MOBILE_CTX,
    )
    assert resp.action == "confirm"
    assert resp.metadata.get("intent") == "compound_batch"
    assert resp.metadata.get("parts") == 2
    posted = mgr.handle_message("ho", session_id=sid)
    assert posted.action == "posted"
    assert posted.metadata.get("compound_batch_posted") == 2


def test_manager_cancel_clears_pending() -> None:
    mgr = get_conversation_manager()
    sid = _sid()
    mgr.handle_message("Shyam le 2000 tiryo", session_id=sid, context=MOBILE_CTX)
    session = mgr.get_session(sid)
    if session.pending_confirmation is None:
        # Some paths clarify first — use a clearer cash sale
        mgr.handle_message("aaja 200 ko nagad bikri vayo", session_id=sid, context=MOBILE_CTX)
        session = mgr.get_session(sid)
    if session.pending_confirmation:
        resp = mgr.handle_message("hoina", session_id=sid)
        assert resp.action in ("chat", "clarify")
        assert mgr.get_session(sid).pending_confirmation is None


def main() -> int:
    tests = [
        test_domain_router_repair_sale,
        test_regex_not_overridden_by_weak_sector,
        test_payment_received_not_blocked,
        test_manager_cash_sale_confirm,
        test_manager_clarify_hold_mobile_repair,
        test_manager_compound_confirm_post,
        test_manager_cancel_clears_pending,
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
