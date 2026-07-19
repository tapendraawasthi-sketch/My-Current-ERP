"""Sales return / credit-note draft unit tests."""

from src.khata.sales_return_draft import (
    clarification_message,
    is_financial_credit_note_message,
    is_sales_return_message,
    start_or_merge_return,
    to_confirmation_card,
)
from src.orbix.operation_classifier import OperationClass, classify_operation
from src.oip.integration.mode_aware_erp import handle_mode_aware_erp


def test_return_signal_not_explanation():
    assert is_sales_return_message("Ram Traders returned a bike.")
    assert is_sales_return_message("Return the bike from invoice SI-E2E-CASH-001")
    assert not is_sales_return_message("How is output VAT reversed on a Sales return?")
    assert not is_sales_return_message("I sold a bike.")


def test_credit_note_signal():
    assert is_financial_credit_note_message(
        "Give Ram Traders a Rs 5,000 credit note against invoice SI-E2E-CN-005 "
        "for a pricing error. No goods were returned."
    )
    assert not is_financial_credit_note_message("Ram Traders returned a bike.")


def test_incomplete_return_clarification():
    draft = start_or_merge_return(
        "Ram Traders returned a bike.",
        session_id="ret-1",
        tenant_id="t",
        company_id="c",
        user_id="u",
    )
    assert draft.status == "awaiting_clarification"
    assert "original_invoice_no" in draft.missing_fields
    assert draft.draft_id
    msg = clarification_message(draft)
    assert "invoice" in msg.lower()


def test_complete_cash_return_card():
    draft = start_or_merge_return(
        "Return the bike from invoice SI-E2E-CASH-001 and refund the customer in cash.",
        session_id="ret-2",
        tenant_id="t",
        company_id="c",
        user_id="u",
    )
    assert draft.status == "previewed"
    assert draft.original_invoice_no == "SI-E2E-CASH-001"
    assert draft.settlement_method == "cash_refund"
    card = to_confirmation_card(draft)
    assert card is not None
    assert card["intent"] == "khata_sales_return"
    assert "SI-E2E-CASH-001" in card["raw_text"]
    assert "inventory_sales_return" in (card.get("tags") or [])
    assert card.get("journalLines") == []


def test_partial_credit_return():
    draft = start_or_merge_return(
        "Ram Traders returned 1 of the 2 bikes from invoice SI-E2E-CREDIT-002. "
        "Reduce the outstanding balance.",
        session_id="ret-3",
        user_id="u",
    )
    assert draft.status == "previewed"
    assert draft.quantity == 1
    assert draft.settlement_method == "reduce_receivable"
    assert draft.customer.name and "Ram" in draft.customer.name


def test_financial_credit_note_card():
    draft = start_or_merge_return(
        "Give Ram Traders a Rs 5,000 credit note against invoice SI-E2E-CN-005 "
        "for a pricing error. No goods were returned.",
        session_id="ret-4",
        user_id="u",
    )
    assert draft.adjustment_type == "financial_credit_note"
    assert draft.status == "previewed"
    assert float(draft.financial_amount) == 5000.0
    card = to_confirmation_card(draft)
    assert card is not None
    assert card["intent"] == "financial_credit_note"
    assert "financial_credit_note" in (card.get("tags") or [])
    assert "no_goods" in (card.get("tags") or [])
    assert "SI-E2E-CN-005" in card["raw_text"]


def test_classifier_vat_question_stays_accounting():
    r = classify_operation("How is output VAT reversed on a Sales return?")
    assert r.operation_class == OperationClass.ACCOUNTING_QUESTION


def test_classifier_returned_bike_is_mutating():
    r = classify_operation("Ram Traders returned a bike.")
    assert r.operation_class == OperationClass.TRANSACTION_CREATE


def test_ask_mode_return_restricted():
    result = handle_mode_aware_erp(
        "Record a return for invoice SI-E2E-CASH-001",
        orbix_mode="ask",
        session_id="ask-ret-1",
    )
    assert result is not None
    # NEXT-10 launch freeze: returns are outside the supported set.
    assert result.intent in {"mode_restriction", "launch_event_unsupported"}
    assert result.skip_llm is True


def test_accountant_incomplete_return_via_mode_aware():
    result = handle_mode_aware_erp(
        "Ram Traders returned a bike.",
        orbix_mode="accountant",
        session_id="acc-ret-next10-freeze",
        user_role="accountant",
        tenant_id="t1",
        company_id="c1",
        user_id="u1",
    )
    assert result is not None
    # NEXT-10: sales returns are not in the launch freeze; safe message, no draft.
    assert result.intent == "launch_event_unsupported"
    assert result.draft_id is None
    assert result.error and result.error.get("code") == "LAUNCH_EVENT_UNSUPPORTED"
    assert result.card is None


def test_vat_question_falls_through():
    result = handle_mode_aware_erp(
        "How is output VAT reversed on a Sales return?",
        orbix_mode="accountant",
        session_id="acc-vat-1",
        user_role="accountant",
    )
    assert result is None
