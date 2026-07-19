"""NEXT-10 — narrow launch event spec freeze (ADR_0077)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.launch_event_spec_policy import (
    AUTHORITY,
    DECISION,
    assert_launch_event_honesty,
    classify_launch_family,
    evaluate_launch_event_freeze,
    launch_event_observability,
    load_launch_event_registry,
    unsupported_launch_message,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_has_authority_owners_and_tiny_set() -> None:
    reg = load_launch_event_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    ids = {e["id"] for e in reg["events"]}
    assert ids == {
        "sales_invoice_draft",
        "purchase_invoice_draft",
        "ask_company_report",
    }
    for e in reg["events"]:
        assert e["authority_owner"]
        assert e["launch_support"] in {"SUPPORTED_DRAFT", "SUPPORTED_ASK"}
    assert reg["honesty"]["receipt_payment_in_freeze"] is False
    assert reg["honesty"]["production_approved"] is False


def test_honesty_rejects_false_claims() -> None:
    assert_launch_event_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_launch_event_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="EXECUTION_AUTHORITY"):
        assert_launch_event_honesty({"is_execution_authority": True})
    with pytest.raises(RuntimeError, match="RECEIPT_PAYMENT"):
        assert_launch_event_honesty({"receipt_payment_launch_supported": True})


def test_supported_families_allow() -> None:
    assert (
        evaluate_launch_event_freeze(
            "sold rice 500 to Ram",
            operation_class="transaction_create",
            intent_hint="sales_entry",
        )
        is None
    )
    assert (
        evaluate_launch_event_freeze(
            "kineko sugar 200",
            operation_class="transaction_create",
            intent_hint="purchase_entry",
        )
        is None
    )
    assert (
        evaluate_launch_event_freeze(
            "show balance sheet",
            operation_class="report_request",
            intent_hint="report_generation",
        )
        is None
    )


def test_unsupported_settlement_and_returns_block() -> None:
    blocked = evaluate_launch_event_freeze(
        "received 500 from Ram",
        operation_class="transaction_create",
        intent_hint="customer_receipt",
    )
    assert blocked is not None
    assert blocked["error_code"] == "LAUNCH_EVENT_UNSUPPORTED"
    assert blocked["draft_mutations"] == 0
    assert "launch set" in blocked["text"].lower() or "not in the current" in blocked["text"]

    blocked_ret = evaluate_launch_event_freeze(
        "sales return firta 2 bags",
        operation_class="transaction_create",
        intent_hint="sales_return_entry",
    )
    assert blocked_ret is not None
    assert blocked_ret["family"] == "sales_return"


def test_pending_clarify_passthrough() -> None:
    assert (
        evaluate_launch_event_freeze(
            "5000",
            operation_class="clarification_reply",
            intent_hint="purchase_clarification",
            has_pending=True,
        )
        is None
    )


def test_classify_families() -> None:
    assert (
        classify_launch_family(
            "sold tea",
            operation_class="transaction_create",
            intent_hint="sales_entry",
        )
        == "sales_invoice_draft"
    )
    assert (
        classify_launch_family(
            "hi",
            operation_class="general_question",
            intent_hint="greeting",
        )
        == "passthrough"
    )


def test_mode_aware_wire_blocks_settlement() -> None:
    from src.oip.integration.mode_aware_erp import handle_mode_aware_erp

    result = handle_mode_aware_erp(
        "received 1000 from Sita",
        orbix_mode="accountant",
        session_id="s1",
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
        user_role="admin",
    )
    assert result is not None
    assert result.skip_llm is True
    assert result.method == "mai_next10_launch_event_freeze"
    assert result.error and result.error.get("code") == "LAUNCH_EVENT_UNSUPPORTED"


def test_observability_and_ledger_pointer() -> None:
    obs = launch_event_observability()
    assert obs["launch_event_adr"] == AUTHORITY
    assert "sales_invoice_draft" in obs["supported_event_ids"]
    assert obs["receipt_payment_in_freeze"] is False

    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0077_LAUNCH_EVENT_SPEC_FREEZE.md"
    )
    assert adr.is_file()
    assert "sales_invoice_draft" in adr.read_text(encoding="utf-8")

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B4"
    assert "NEXT-10" in ledger.get("completed_next_steps", [])
    assert ledger.get("launch_event_freeze", {}).get("authority") == "ADR_0077"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B4"
    assert "NEXT-10" in matrix.get("completed_steps", [])


def test_safe_message_nonempty() -> None:
    msg = unsupported_launch_message("customer_receipt")
    assert "sales" in msg.lower() or "purchase" in msg.lower()
    assert "report" in msg.lower()
