#!/usr/bin/env python3
"""Regression tests for erp_action_policy dispatcher."""

from __future__ import annotations

import json
import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.nlu.engine import ParsedEntry
from src.nlu.erp_action_policy import (
    classify_erp_action,
    is_structured_erp_action,
    normalize_erp_action,
    resolve_erp_action_policy,
)


def _parsed(**kwargs) -> ParsedEntry:
    base = {
        "intent": "cash_sale",
        "narration": "test",
        "confidence": 0.8,
    }
    base.update(kwargs)
    return ParsedEntry(**base)


def test_normalize_mixed_case() -> None:
    assert normalize_erp_action("flag_for_TDS_verification") == "flag_for_tds_verification"
    assert normalize_erp_action("  request_EMI_details_before_full_posting  ") == (
        "request_emi_details_before_full_posting"
    )


def test_classify_buckets() -> None:
    assert classify_erp_action("create_sales_invoice") == "post"
    assert classify_erp_action("request_clarification") == "clarify"
    assert classify_erp_action("hold_pending_payment_mode") == "clarify"
    assert classify_erp_action("no_action_conversational") == "no_post"
    assert classify_erp_action("generate_daily_sales_report") == "no_post"
    # Listed in NON_TRANSACTION_ERP → no_post even though it starts with flag_
    assert classify_erp_action("flag_for_manual_tax_review") == "no_post"
    assert classify_erp_action("provide_tax_guidance_refer_ird") == "no_post"
    assert classify_erp_action("flag_bad_debt_risk") == "escalate"
    assert not is_structured_erp_action(
        "Advisory: Consult CA for TDS obligations specific to your dairy shop."
    )
    assert classify_erp_action(
        "Advisory: Consult CA for TDS obligations specific to your dairy shop."
    ) == "no_post"


def test_post_requires_amount() -> None:
    policy = resolve_erp_action_policy(
        erp_action="create_sales_invoice",
        confidence=0.9,
        parsed=_parsed(amount=None, party="Ram"),
        required_fields=["amount"],
    )
    assert policy.policy_action == "clarify"
    assert policy.skip_posting is True
    assert "amount" in policy.required_slots

    policy_ok = resolve_erp_action_policy(
        erp_action="create_sales_invoice",
        confidence=0.9,
        parsed=_parsed(amount=5000.0, party="Ram", payment_method="cash"),
        required_fields=["amount", "payment_mode"],
    )
    assert policy_ok.policy_action == "post"
    assert policy_ok.skip_posting is False


def test_clarify_actions_block_posting() -> None:
    policy = resolve_erp_action_policy(
        erp_action="request_payment_mode",
        confidence=0.85,
        parsed=_parsed(amount=1200.0, party="Sita"),
        clarification_question="Cash ki bank?",
    )
    assert policy.policy_action == "clarify"
    assert policy.skip_posting is True
    assert policy.clarification_question == "Cash ki bank?"


def test_kb_erp_action_coverage() -> None:
    """Every structured erp_action in sector KB must map to a known policy bucket."""
    sector_root = BOT_ROOT.parent / "data" / "ekhata" / "knowledge" / "general" / "sector"
    allowed = {"post", "clarify", "hold", "no_post", "report", "escalate"}
    bad: list[str] = []
    for path in sector_root.rglob("nepal-sector-nlu.jsonl"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            action = str(row.get("erp_action") or "")
            if not action or not is_structured_erp_action(action):
                continue
            bucket = classify_erp_action(action)
            if bucket not in allowed:
                bad.append(action)
    assert not bad, f"unclassified actions: {bad[:10]}"


def main() -> int:
    tests = [
        test_normalize_mixed_case,
        test_classify_buckets,
        test_post_requires_amount,
        test_clarify_actions_block_posting,
        test_kb_erp_action_coverage,
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
