"""Unit tests for Orbix Ask / Accountant dual-mode architecture."""

from __future__ import annotations

from decimal import Decimal

import pytest

from src.orbix.mode_policy import (
    ModeValidationError,
    is_tool_allowed,
    normalize_orbix_mode,
    resolve_capabilities,
    user_may_post_purchase,
)
from src.orbix.operation_classifier import OperationClass, classify_operation
from src.orbix.report_spec import parse_report_specification
from src.khata.purchase_draft import (
    extract_purchase_fields,
    get_posted_result,
    mark_posted,
    start_or_merge_purchase,
    validate_and_complete,
)
from src.khata.entry_engine import _extract_amount, generate_confirmation_message, regex_fast_path
from src.oip.integration.khata_preprocess import preprocess_erp_message
from src.oip.integration.mode_aware_erp import handle_mode_aware_erp


class TestModePolicy:
    def test_missing_defaults_to_ask(self):
        assert normalize_orbix_mode(None) == "ask"
        assert normalize_orbix_mode("") == "ask"

    def test_invalid_errors_or_ask(self):
        with pytest.raises(ModeValidationError):
            normalize_orbix_mode("god_mode", invalid_policy="error")
        assert normalize_orbix_mode("god_mode", invalid_policy="ask") == "ask"

    def test_never_defaults_invalid_to_accountant(self):
        assert normalize_orbix_mode("write_all", invalid_policy="ask") != "accountant"

    def test_ask_capabilities_deny_write(self):
        caps = resolve_capabilities("ask", can_post=True)
        assert caps.can_query_erp is True
        assert caps.can_generate_reports is True
        assert caps.can_create_draft is False
        assert caps.can_post_mutation is False

    def test_accountant_post_requires_permission(self):
        caps = resolve_capabilities("accountant", can_post=False)
        assert caps.can_create_draft is True
        assert caps.can_post_mutation is False
        caps2 = resolve_capabilities("accountant", can_post=True)
        assert caps2.can_post_mutation is True

    def test_tool_matrix(self):
        assert is_tool_allowed("ask", "generate_balance_sheet") is True
        assert is_tool_allowed("ask", "create_transaction_draft") is False
        assert is_tool_allowed("ask", "post_purchase") is False
        assert is_tool_allowed("accountant", "create_transaction_draft") is True
        assert is_tool_allowed("accountant", "post_purchase", can_post=False) is False
        assert is_tool_allowed("accountant", "post_purchase", can_post=True) is True

    def test_viewer_cannot_post(self):
        assert user_may_post_purchase(role="viewer") is False
        assert user_may_post_purchase(role="accountant") is True


class TestClassification:
    def test_balance_sheet_is_report(self):
        r = classify_operation("Show my balance sheet.")
        assert r.operation_class == OperationClass.REPORT_REQUEST

    def test_purchase_is_transaction_create(self):
        r = classify_operation("Enter a cash purchase of Rs 5,000.")
        assert r.operation_class == OperationClass.TRANSACTION_CREATE

    def test_hello_is_general(self):
        r = classify_operation("hello")
        assert r.operation_class == OperationClass.GENERAL_QUESTION

    def test_clarification_reply_with_pending_draft(self):
        r = classify_operation(
            "Rice at Rs 80 per kg, paid in cash.",
            has_pending_draft=True,
        )
        assert r.operation_class == OperationClass.CLARIFICATION_REPLY

    def test_report_follow_up(self):
        r = classify_operation("Compare it with last year.", has_active_report=True)
        assert r.operation_class == OperationClass.REPORT_FOLLOW_UP


class TestAmountExtraction:
    def test_quantity_not_treated_as_amount(self):
        assert _extract_amount("I bought 50 kg goods") is None
        assert regex_fast_path("I bought 50 kg goods") is None

    def test_qty_times_rate(self):
        assert _extract_amount("50 kg rice at Rs 80 per kg") == Decimal("4000.00")

    def test_confirmation_never_uses_na(self):
        from src.khata.entry_engine import ParsedTransaction, TransactionType, JournalLine

        txn = ParsedTransaction(
            transaction_type=TransactionType.CASH_PURCHASE,
            amount=Decimal("5000"),
            party=None,
            journal_lines=[
                JournalLine("KH-STOCK", "Stock", debit=Decimal("5000")),
                JournalLine("KH-CASH", "Cash", credit=Decimal("5000")),
            ],
        )
        msg = generate_confirmation_message(txn, language="english")
        assert "N/A" not in msg


class TestPurchaseDraft:
    def test_incomplete_quantity_only(self):
        draft = start_or_merge_purchase(
            "I bought 50 kg goods.",
            session_id="s1",
            tenant_id="t1",
            company_id="c1",
            user_id="u1",
        )
        assert draft.quantity == Decimal("50")
        assert draft.unit == "kg"
        assert draft.total_amount is None
        assert draft.rate is None
        assert draft.item.name is None
        assert draft.payment_method is None
        assert draft.status == "awaiting_clarification"
        assert "item" in draft.missing_fields
        assert "rate_or_total" in draft.missing_fields
        assert "N/A" not in clarification_safe(draft)

    def test_clarification_merge(self):
        d1 = start_or_merge_purchase(
            "I bought 50 kg goods.",
            session_id="s2",
            tenant_id="t1",
            company_id="c1",
        )
        d2 = start_or_merge_purchase(
            "Rice at Rs 80 per kg, paid in cash.",
            session_id="s2",
            tenant_id="t1",
            company_id="c1",
            existing=d1,
        )
        assert d2.draft_id == d1.draft_id
        assert d2.item.name and "Rice" in d2.item.name
        assert d2.quantity == Decimal("50")
        assert d2.unit == "kg"
        assert d2.rate == Decimal("80.00")
        assert d2.total_amount == Decimal("4000.00")
        assert d2.payment_method == "cash"
        assert d2.status == "previewed"
        assert d2.preview is not None
        assert d2.preview["amount"] == 4000.0

    def test_complete_cash_purchase(self):
        draft = start_or_merge_purchase(
            "I bought 50 kg rice from Ram Traders at Rs 80 per kg in cash.",
            session_id="s3",
            tenant_id="t1",
            company_id="c1",
        )
        assert draft.status == "previewed"
        assert draft.total_amount == Decimal("4000.00")
        assert draft.supplier.name and "Ram" in draft.supplier.name
        assert draft.payment_method == "cash"
        credits = [j for j in draft.preview["journalLines"] if j["credit"]]
        assert credits[0]["accountCode"] == "KH-CASH"

    def test_credit_purchase_creates_payable(self):
        draft = start_or_merge_purchase(
            "I bought 50 kg rice for Rs 4,000 on credit from Ram Traders.",
            session_id="s4",
            tenant_id="t1",
            company_id="c1",
        )
        assert draft.status == "previewed"
        assert draft.rate == Decimal("80.00")
        assert draft.payment_method == "credit"
        credits = [j for j in draft.preview["journalLines"] if j["credit"]]
        assert credits[0]["accountCode"] == "KH-CRED"

    def test_reconciliation_mismatch(self):
        draft = start_or_merge_purchase(
            "I bought 50 kg rice at Rs 80 per kg, total Rs 5,000.",
            session_id="s5",
            tenant_id="t1",
            company_id="c1",
        )
        assert "total_amount" in draft.ambiguous_fields
        assert draft.status == "awaiting_clarification"
        assert draft.preview is None

    def test_bought_rice_no_guesses(self):
        draft = start_or_merge_purchase(
            "I bought rice.",
            session_id="s6",
            tenant_id="t1",
            company_id="c1",
        )
        assert draft.quantity is None
        assert draft.rate is None
        assert draft.total_amount is None
        assert draft.status == "awaiting_clarification"

    def test_idempotent_post_result(self):
        draft = start_or_merge_purchase(
            "I bought 10 kg sugar at Rs 100 per kg in cash.",
            session_id="s7",
            tenant_id="t1",
            company_id="c1",
        )
        assert draft.status == "previewed"
        result = {"voucher_id": "V-1", "posted": True}
        mark_posted(draft, result)
        assert get_posted_result(draft.draft_id) == result
        assert get_posted_result(draft.draft_id) == result  # second read same

    def test_phase4_bike_incomplete_then_clarify(self):
        d1 = start_or_merge_purchase(
            "I bought a bike.",
            session_id="bike-1",
            tenant_id="t-e2e",
            company_id="c-e2e",
        )
        assert d1.item.name == "Bike"
        assert d1.quantity is None
        assert d1.total_amount is None
        assert d1.payment_method is None
        assert d1.status == "awaiting_clarification"
        assert d1.version == 1
        assert "quantity" in d1.missing_fields
        assert "rate_or_total" in d1.missing_fields
        assert "payment_method" in d1.missing_fields

        d2 = start_or_merge_purchase(
            "1, 50000 cash",
            session_id="bike-1",
            tenant_id="t-e2e",
            company_id="c-e2e",
            existing=d1,
        )
        assert d2.draft_id == d1.draft_id
        assert d2.version == 2
        assert d2.quantity == Decimal("1")
        assert d2.unit == "pcs"
        assert d2.total_amount == Decimal("50000.00")
        assert d2.payment_method == "cash"
        assert d2.item.name == "Bike"
        assert d2.status == "previewed"
        assert d2.preview is not None
        assert d2.preview["amount"] == 50000.0
        assert d2.preview_hash
        journal = d2.preview["journalLines"]
        debit = sum(Decimal(str(j["debit"])) for j in journal)
        credit = sum(Decimal(str(j["credit"])) for j in journal)
        assert debit == credit == Decimal("50000")
        assert d2.preview.get("draft_version") == 2
        assert d2.preview.get("preview_version") == 2


def clarification_safe(draft) -> str:
    from src.khata.purchase_draft import clarification_message

    return clarification_message(draft)


class TestModeAwareErp:
    def test_ask_mode_blocks_purchase(self):
        result = handle_mode_aware_erp(
            "Enter a cash purchase of Rs 5,000.",
            orbix_mode="ask",
            session_id="ask-1",
        )
        assert result is not None
        assert result.skip_llm is True
        assert result.card is None
        assert result.error and result.error["type"] == "mode_restriction"
        assert result.operation_class == "transaction_create"

    def test_accountant_mode_starts_draft(self):
        result = handle_mode_aware_erp(
            "I bought 50 kg goods.",
            orbix_mode="accountant",
            session_id="acc-1",
            tenant_id="t",
            company_id="c",
            user_role="accountant",
        )
        assert result is not None
        assert result.card is None
        assert result.draft_id
        assert result.error and result.error["type"] == "clarification_required"
        assert "50" in result.text and "kg" in result.text

    def test_accountant_balance_sheet_not_draft(self):
        result = handle_mode_aware_erp(
            "Show my balance sheet.",
            orbix_mode="accountant",
            session_id="acc-2",
        )
        # Report path may return None (frontend engine) or report_spec without draft
        if result is not None:
            assert result.draft_id is None
            assert result.card is None

    def test_hello_falls_through(self):
        result = handle_mode_aware_erp("hello", orbix_mode="accountant", session_id="acc-3")
        assert result is None

    def test_preprocess_ask_blocks_legacy_path(self):
        result = preprocess_erp_message(
            "Ram lai 5000 udhaar becheko",
            orbix_mode="ask",
            session_id="ask-legacy",
        )
        assert result is not None
        assert result.card is None
        assert result.intent == "mode_restriction"


class TestReportSpec:
    def test_balance_sheet_with_comparison_and_subgroups(self):
        spec = parse_report_specification(
            "Show the balance sheet for the current year with previous-year comparison, "
            "including groups and subgroups but not ledgers."
        )
        assert spec is not None
        assert spec.report_type == "balance_sheet"
        assert spec.period.financial_year == "current"
        assert spec.comparison.enabled is True
        assert spec.comparison.comparison_type == "previous_financial_year"
        assert spec.include_groups is True
        assert spec.include_subgroups is True
        assert spec.include_ledgers is False

    def test_follow_up_modifies_spec(self):
        spec = parse_report_specification("Show the balance sheet.")
        assert spec is not None
        updated = spec.apply_follow_up("Compare it with last year.")
        updated = updated.apply_follow_up("Include subgroups.")
        updated = updated.apply_follow_up("Expand current assets.")
        assert updated.comparison.enabled is True
        assert updated.include_subgroups is True
        assert "current assets" in updated.expanded_groups

    def test_ledger_under_branch_hide_zeros(self):
        base = parse_report_specification("Show the balance sheet.")
        assert base is not None
        follow = base.apply_follow_up(
            "Show only ledger-level details under current liabilities and hide zero balances."
        )
        assert follow.include_ledgers is True or follow.detail_level == "ledger"
        assert follow.include_zero_balances is False
        assert follow.filters.get("branch") == "current liabilities"
