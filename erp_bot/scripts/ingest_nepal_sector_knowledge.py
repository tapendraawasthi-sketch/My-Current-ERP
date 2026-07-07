#!/usr/bin/env python3
"""Ingest sector-specific NLU training JSONL into general/sector/<slug>/."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INGEST_DIR = ROOT / "data" / "ekhata" / "knowledge" / "_ingest"
SOURCE = "Nepal SME Sector NLU Dataset (AI Training)"

SECTOR_SLUG: dict[str, str] = {
    "Kirana/General Grocery Shop": "kirana-grocery",
    "Mini Mart": "mini-mart",
    "Wholesale Grocery": "wholesale-grocery",
    "Clothing/Fashion Shop": "clothing-fashion",
    "Footwear Shop": "footwear",
    "Cosmetic Shop": "cosmetic",
    "Pharmacy/Medical Store": "pharmacy-medical",
    "Clinic/health service": "clinic-health",
    "Restaurant/cafe": "restaurant-cafe",
    "Bakery": "bakery",
    "Dairy Shop": "dairy-shop",
    "Meat shop": "meat-shop",
    "Fruit and vegetable shop": "fruit-vegetable-shop",
    "Hardware shop": "hardware-shop",
    "Construction Material Supplier": "construction-material-supplier",
    "Cement & Rod Retail Shop": "cement-rod-retail-shop",
}

NON_TRANSACTION_ERP = frozenset(
    {
        "no_action_conversational",
        "no_action_log_closed_day",
        "no_action_request_clarification",
        "no_action_advisory",
        "no_action_offer_report",
        "no_action_future_intent",
        "no_action_log_only",
        "no_action_required",
        "no_entry_required",
        "no_financial_entry_but_flag_compliance_note",
        "no_financial_entry_flag_for_document_format_update",
        "no_entry_required_log_as_pending_quotation",
        "no_entry_required_unless_fuel_purchased_separately",
        "update_price_master_no_journal_entry",
        "no_entry_log_closed_day",
        "generate_sales_report",
        "generate_daily_sales_report",
        "generate_credit_report_today",
        "generate_receivables_summary_report",
        "generate_summary_report_from_existing_ledger_no_new_entry",
        "advise_consult_professional",
        "no_entry_required_unless_sample_value_significant",
        "no_entry_required_until_service_completed_and_billed",
        "no_financial_entry_administrative_only",
        "no_financial_entry_flag_for_IT_support",
        "update_rent_master_no_journal_entry_yet",
        "update_staff_master_no_journal_entry_yet",
        "no_entry_yet_flag_for_next_day_discount_sale",
        "no_entry_until_advance_or_delivery_occurs",
        "no_entry_required_until_cake_delivered_and_billed",
        "no_financial_entry_log_feedback_only",
        "no_action_acknowledgement",
        "enable_realtime_sales_tracking_feature",
        "queue_entry_for_offline_sync",
        "log_technical_issue_no_financial_entry",
        "no_financial_action_log_customer_note",
        "no_financial_action_log_lead",
        "no_financial_action_log_preference",
        "no_financial_action_customer_inquiry",
        "log_feedback_no_financial_entry",
        "log_complaint_pending_resolution",
        "reject_insufficient_detail",
        "generate_daily_sales_report",
        "generate_weekly_sales_report",
        "generate_receivable_aging_report",
        "execute_day_end_closing_process",
        "route_to_loyalty_program_settings",
        "route_to_discount_policy_settings",
        "route_to_payment_policy_settings",
        "update_price_master",
        "generate_monthly_average_sales_report",
        "flag_for_professional_tax_verification",
        "flag_for_business_closure_process_and_tax_verification",
        "no_financial_action_log_new_lead",
        "generate_discount_report_for_today",
        "log_no_transaction_day",
        "no_action_out_of_business_scope",
        "reject_insufficient_context",
        "update_price_list",
        "create_quotation_draft",
        "generate_stock_report",
        "flag_for_manual_tax_review",
        "create_complaint_ticket",
        "create_purchase_dispute_ticket",
        "flag_for_accounting_policy_review",
        "flag_credit_limit_exceeded",
        "create_employee_master_pending",
        "log_note_only",
        "log_communication_note",
        "cancel_pending_order",
        "flag_for_compliance_review",
        "generate_payment_reminder",
        "update_billing_policy_setting",
        "update_party_master_note",
        "update_supplier_master_note",
        "generate_bulk_payment_reminders",
        "search_invoice_history",
        "flag_for_credit_review",
        "flag_payable_reminder",
        "flag_for_rate_verification",
        "generate_audit_document_bundle_pending",
        "log_communication_note_and_update_price",
        "update_party_payment_terms",
        "update_credit_policy_setting",
        "update_supplier_payment_policy_pending",
        "log_operational_issue",
        "flag_for_price_list_update",
        "create_sales_order_pending",
        "create_sales_order_urgent",
        "flag_for_payable_review",
        "create_sales_order_confirmed_pending_detail",
        "cancel_order_release_stock_pending",
        "create_payable_accrual_voucher",
        "create_postdated_cheque_record_pending",
        "create_bank_charge_adjustment_pending",
        "flag_for_credit_risk_review",
        "create_suspense_sale_pending_detail",
        "update_payment_policy_setting",
        "create_delayed_invoice_pending",
        "log_communication_note_and_confirm_price",
        "generate_invoice_bundle_for_customer_pending",
        "flag_for_aging_review",
        "update_order_status_delivered_pending_reference",
        "log_payment_failure_pending_retry",
        "flag_customer_churn_check_balance",
        "flag_for_rate_negotiation_review",
        "log_communication_note_pending_reference",
        "create_cheque_deposit_record_pending",
        "create_barter_settlement_voucher_pending",
        "log_communication_note_pending_detail",
        "flag_for_master_data_merge",
        "update_party_payment_terms_pending",
        "create_donation_voucher_pending_detail",
        "flag_payment_promise_followup_date",
        "log_communication_note_pending_validity",
        "create_stock_variance_adjustment_pending",
        "flag_for_legal_escalation_pending_approval",
        "log_communication_note_pending_date",
        "create_sample_dispatch_voucher_pending",
        "flag_for_pan_correction_pending",
        "create_split_sales_voucher_pending_detail",
        "create_advance_order_voucher_pending_detail",
        "create_invoice_correction_record_pending",
        "create_sales_order_pending_detail",
        "flag_stockout_and_notify_customer",
        "flag_for_duplicate_investigation",
        "flag_credit_limit_review",
        "create_suspense_entry",
        "update_party_master_pending",
    }
)

SECTOR_INTENT_TO_NLU: dict[str, str] = {
    "record_sale": "cash_sale",
    "record_credit_sale": "credit_sale",
    "record_purchase": "credit_purchase",
    "record_payment_received": "payment_received",
    "record_payment_made": "payment_made",
    "record_expense": "expense",
    "record_inventory_writeoff": "stock_adjustment",
    "record_inventory_loss": "stock_adjustment",
    "record_inventory_loss_theft": "stock_adjustment",
    "record_inventory_discrepancy": "stock_adjustment",
    "record_sales_return": "sales_return",
    "record_purchase_return": "purchase_return",
    "record_sale_with_discount": "discount_allowed",
    "record_partial_payment_sale": "credit_sale",
    "record_bank_deposit": "contra",
    "record_asset_purchase": "expense",
    "record_salary_advance": "salary",
    "record_payment_with_tds": "tds_deducted",
    "record_bulk_order_with_advance": "payment_received",
    "record_seasonal_sale": "cash_sale",
    "record_bulk_sale": "credit_sale",
    "record_promotional_giveaway": "expense",
    "record_cash_discrepancy": "stock_adjustment",
    "record_goods_receipt_pending_bill": "credit_purchase",
    "record_purchase_pending_payment": "credit_purchase",
    "record_credit_sale_with_existing_balance": "credit_sale",
    "record_sale_with_change": "cash_sale",
    "tax_query": "unknown",
    "request_for_report": "unknown",
    "informal_business_status_comment": "unknown",
    "informal_status_update": "unknown",
    "ambiguous_credit_transaction": "unknown",
    "unclear_intent": "unknown",
    "advice_request_not_transaction": "unknown",
    "business_performance_comment": "unknown",
    "price_update_notification": "unknown",
    "inventory_price_update": "unknown",
    "vague_concern_not_transaction": "unknown",
    "price_discrepancy_query": "unknown",
    "informal_customer_request": "unknown",
    "record_purchase_order_pending": "unknown",
    "future_intent_not_transaction": "unknown",
    "record_clearance_sale_policy": "unknown",
    "personal_comment_not_transaction": "unknown",
    "record_cash_loan_given": "unknown",
    "record_bad_debt_risk": "bad_debt_writeoff",
    "informal_operational_comment": "unknown",
    "record_advance_payment": "prepaid",
    "record_vat_sale_with_pan": "vat_sale",
    "record_owner_drawing": "drawings",
    "record_bank_withdrawal": "contra",
    "record_loan_repayment": "loan_repayment",
    "record_credit_sale_b2b": "credit_sale",
    "record_bulk_credit_sale": "credit_sale",
    "record_credit_sale_summary": "credit_sale",
    "record_bulk_sale_partial_payment": "credit_sale",
    "record_clearance_sale": "cash_sale",
    "record_inventory_transfer_for_processing": "stock_adjustment",
    "record_accounting_discrepancy": "stock_adjustment",
    "record_potential_theft": "stock_adjustment",
    "record_purchase_damage": "stock_adjustment",
    "record_capital_injection": "capital_introduced",
    "record_purchase_return_refund": "purchase_return",
    "record_seasonal_sales_summary": "cash_sale",
    "record_purchase_discount": "credit_purchase",
    "record_payment_made_full_settlement": "payment_made",
    "record_daily_sales_summary_breakdown": "cash_sale",
    "record_daily_sales_summary": "cash_sale",
    "record_purchase_order": "credit_purchase",
    "record_promotional_sale": "cash_sale",
    "record_category_wise_sales": "cash_sale",
    "record_credit_note_received": "purchase_return",
    "record_asset_or_expense": "expense",
    "record_sale_with_voucher": "cash_sale",
    "record_shift_wise_sales_summary": "cash_sale",
    "record_sales_return_refund": "sales_return",
    "record_asset_purchase_with_financing": "loan_received",
    "record_cash_discrepancy_excess": "stock_adjustment",
    "record_purchase_with_discount": "cash_purchase",
    "record_purchase_vat_breakdown": "vat_purchase",
    "record_bulk_sale_advance": "payment_received",
    "record_expense_arrears_settlement": "expense",
    "record_sale_with_manual_entry": "cash_sale",
    "record_bulk_sale": "credit_sale",
    "record_cash_collection": "payment_received",
    "record_sale_with_pan": "vat_sale",
    "record_asset_disposal": "cash_sale",
    "record_sale_cancellation_refund": "sales_return",
    "record_sale_with_coupon_discount": "discount_allowed",
    "record_multiple_sales": "cash_sale",
    "record_voucher_sale": "payment_received",
    "record_sale_with_store_credit": "cash_sale",
    "record_government_contract_order": "credit_sale",
    "record_import_expense": "cash_purchase",
    "record_supplier_refund": "payment_received",
    "record_loyalty_point_redemption": "discount_allowed",
    "record_daily_closing_summary": "cash_sale",
    "record_bulk_purchase": "credit_purchase",
    "record_bulk_credit_sale_multiple_parties": "credit_sale",
    "record_inventory_loss_pest_damage": "stock_adjustment",
    "record_order_cancellation": "unknown",
    "record_inventory_discrepancy_investigation": "stock_adjustment",
    "record_advance_received": "payment_received",
    "record_bulk_credit_sale_multiple": "credit_sale",
    "record_expense_pending": "expense",
    "record_partial_payment_received": "payment_received",
    "record_purchase_order_received": "unknown",
    "informal_credit_terms_negotiation": "unknown",
    "record_sale_discount_negotiation": "unknown",
    "informal_business_discussion": "unknown",
    "record_partial_goods_receipt": "credit_purchase",
    "record_data_entry_error": "unknown",
    "record_free_sample_given": "expense",
    "tax_compliance_notice": "unknown",
    "record_capital_expenditure": "expense",
    "informal_marketing_activity": "unknown",
    "informal_operational_policy_update": "unknown",
    "record_bounced_cheque": "payment_received",
    "informal_business_relationship_activity": "unknown",
    "record_import_purchase": "credit_purchase",
    "record_inventory_loss_pest": "stock_adjustment",
    "informal_business_technology_update": "unknown",
    "record_dispute_settlement": "expense",
    "record_bad_debt_writeoff": "bad_debt_writeoff",
    "record_expense_or_asset": "expense",
    "record_sales_inquiry": "unknown",
    "record_early_payment_discount_request": "discount_allowed",
    "record_inventory_loss_accident": "stock_adjustment",
    "record_sales_order_confirmed": "unknown",
    "record_tds_payment": "tds_paid",
    "informal_planning_task": "unknown",
    "informal_hr_negotiation": "unknown",
    "record_export_sale": "credit_sale",
    "record_credit_limit_review": "unknown",
    "record_quality_issue_complaint": "purchase_return",
    "informal_business_negotiation": "unknown",
    "informal_operational_request": "unknown",
    "informal_business_activity": "unknown",
    "record_subsidy_received": "payment_received",
    "informal_operational_activity": "unknown",
    "record_payment_received_multiple": "payment_received",
    "informal_business_proposal": "unknown",
    "informal_business_policy_update": "unknown",
    "record_forex_loss": "expense",
    "record_automated_purchase_order": "unknown",
    "informal_business_meeting_update": "unknown",
    "record_provision_doubtful_debts": "bad_debt_writeoff",
    "record_vat_filing": "unknown",
    "informal_business_research": "unknown",
    "informal_business_planning": "unknown",
    "record_discount_claim_verification": "unknown",
    "record_loyalty_bonus_request": "unknown",
    "record_depreciation": "depreciation",
    "record_bank_transfer": "contra",
    "record_client_risk_assessment": "unknown",
    "record_year_end_closing_summary": "unknown",
    "record_monthly_sales_summary": "cash_sale",
    "inventory_stock_alert": "unknown",
    "record_sale_pending_exchange": "credit_sale",
    "record_promotional_sale_summary": "cash_sale",
    "record_operational_error": "unknown",
    "informal_stock_arrival_update": "unknown",
    "record_sale_with_credit_note": "cash_sale",
    "informal_business_decision_pending": "unknown",
    "record_service_expense": "expense",
    "record_staff_commission_expense": "expense",
    "sales_inquiry": "unknown",
    "record_rent_expense": "expense",
    "record_sale_no_invoice": "cash_sale",
    "general_comment": "unknown",
    "record_advance_receipt": "payment_received",
    "record_inventory_discrepancy": "stock_adjustment",
    "record_free_stock_received": "credit_purchase",
    "correct_billing_error": "unknown",
    "record_potential_inventory_writeoff": "stock_adjustment",
    "record_payment_received_or_made": "unknown",
    "record_online_marketplace_sale": "cash_sale",
    "update_recurring_expense": "expense",
    "record_payroll_expense": "salary",
    "general_inquiry": "unknown",
    "record_inventory_damage_claim": "stock_adjustment",
    "record_potential_theft_investigation": "stock_adjustment",
    "record_sale_with_promotion": "cash_sale",
    "record_loan_given": "unknown",
    "record_cash_deposit": "contra",
    "expense_inquiry": "unknown",
    "record_sale_order": "unknown",
    "record_outstanding_liability": "expense",
    "record_sale_with_bank_charge": "cash_sale",
    "record_exchange_request": "sales_return",
    "record_final_payment_settlement": "payment_received",
    "record_overdue_receivable": "unknown",
    "record_capital_investment": "capital_introduced",
    "record_potential_inventory_loss": "stock_adjustment",
    "record_sale_billing_correction": "unknown",
    "record_purchase_with_advance": "prepaid",
    "record_bank_reconciliation_discrepancy": "stock_adjustment",
    "record_hr_note": "unknown",
    "record_inventory_theft_loss": "stock_adjustment",
    "record_asset_purchase_with_installment": "loan_received",
    "record_expense_summary": "expense",
    "record_outstanding_payable": "unknown",
    "period_close_request": "unknown",
    "record_stock_shortage_note": "unknown",
    "record_purchase_intent": "unknown",
    "record_warranty_complaint": "unknown",
    "record_stock_transfer_request": "unknown",
    "record_near_expiry_stock_note": "unknown",
    "record_product_safety_complaint": "unknown",
    "record_credit_purchase": "credit_purchase",
    "record_insurance_receipt": "payment_received",
    "record_loan_received": "loan_received",
    "record_payable_settlement": "payment_made",
    "record_inventory_alert": "unknown",
    "record_receivable_settlement": "payment_received",
    "record_reconciliation_issue": "stock_adjustment",
    "record_hr_event": "unknown",
    "record_theft_loss": "stock_adjustment",
    "record_customer_complaint": "unknown",
    "record_pending_payable": "unknown",
    "record_sales_revenue": "cash_sale",
    "record_sales_on_credit": "credit_sale",
    "record_receivable_collection": "payment_received",
    "record_sales_on_credit_ambiguous": "unknown",
    "record_sales_discount": "discount_allowed",
    "record_purchase_on_credit": "credit_purchase",
    "unclear_no_data": "unknown",
    "record_dishonored_cheque": "payment_received",
    "record_no_revenue_csr_activity": "expense",
    "record_sales_on_credit_informal": "unknown",
    "record_cash_to_bank_transfer": "contra",
    "record_sales_revenue_split_payment": "cash_sale",
    "unclear_business_structure_query": "unknown",
    "record_refund": "sales_return",
    "no_transaction_status_update": "unknown",
    "no_transaction": "unknown",
    "record_expense_with_tax_query": "expense",
    "record_salary_deduction": "salary",
    "record_income_other": "payment_received",
    "record_free_stock_receipt": "credit_purchase",
    "record_purchase_damage_claim": "stock_adjustment",
    "record_receivable_writeoff_or_reclass": "bad_debt_writeoff",
    "record_expense_prepaid": "prepaid",
    "record_asset_deposit": "prepaid",
    "record_sales_discount_policy": "unknown",
    "record_sales_revenue_with_platform_fee": "cash_sale",
    "unclear_transaction": "unknown",
    "vague_status_update": "unknown",
    "record_liability_status": "unknown",
    "record_sales_with_vat_bill_request": "vat_sale",
    "reconciliation_issue": "stock_adjustment",
    "record_cash_discrepancy_sales": "stock_adjustment",
    "business_closure_notice": "unknown",
    "record_cash_loss": "stock_adjustment",
    "record_cheque_deposit": "payment_received",
    "future_planning_no_transaction": "unknown",
    "vague_status_update_with_credit_mention": "unknown",
    "record_partial_payment": "credit_sale",
    "administrative_update_no_transaction": "unknown",
    "administrative_event_no_transaction": "unknown",
    "price_update_note_no_transaction": "unknown",
    "record_disputed_receivable": "unknown",
    "administrative_note_no_transaction": "unknown",
    "record_aging_receivable_note": "unknown",
    "record_sales_foreign_currency_query": "cash_sale",
    "context_note_no_direct_transaction": "unknown",
    "context_note_with_implied_transaction": "unknown",
    "clarification_dialogue_from_user": "unknown",
    "record_expense_incomplete": "expense",
    "administrative_request_no_transaction": "unknown",
    "record_liability": "unknown",
    "record_bad_debt": "bad_debt_writeoff",
    "record_sales_revenue_installment": "credit_sale",
    "record_sales_revenue_with_platform_commission": "cash_sale",
    "record_staff_meal_expense": "expense",
    "record_service_charge_liability": "payment_received",
    "record_contract_agreement": "unknown",
    "record_income_other_restricted": "payment_received",
    "record_income_settlement": "payment_received",
    "record_purchase_no_bill": "cash_purchase",
    "record_purchase_receipt": "credit_purchase",
    "record_receivable_installment_plan": "credit_sale",
    "record_sales_on_credit_corporate": "credit_sale",
    "record_split_payment_insurance": "credit_sale",
    "record_owner_drawing_or_personal_expense": "drawings",
    "record_inventory_valuation": "stock_adjustment",
    "record_cash_loss_or_prevention": "stock_adjustment",
    "record_correction_request": "unknown",
    "correction_request": "unknown",
    "record_pending_uncertain_transaction": "unknown",
    "record_transaction_pending_verification": "unknown",
    "record_sales_with_govt_scheme_ambiguous": "unknown",
    "sector_mismatch_flag": "unknown",
    "year_end_adjustment_request": "depreciation",
    "compliance_action_request": "unknown",
    "compliance_reminder_no_transaction": "unknown",
    "customer_complaint_no_direct_transaction": "unknown",
    "monthly_summary_report_request": "unknown",
    "business_closure_planning": "unknown",
    "billing_request_clarification": "unknown",
    "clarification_dialogue_discount_query": "unknown",
    "clarification_dialogue_tax_query": "unknown",
    "administrative_query_no_transaction": "unknown",
    "query_no_direct_transaction": "unknown",
    "no_transaction_pending": "unknown",
    "no_transaction_pending_service": "unknown",
    "no_transaction_operational_note": "unknown",
    "no_transaction_status_note": "unknown",
    "no_transaction_technical_issue": "unknown",
    "no_transaction_customer_feedback": "unknown",
    "record_sales_revenue_completion": "payment_received",
    "record_inventory_status_note": "unknown",
    "record_promotional_expense": "expense",
    "record_order_pending_no_transaction": "unknown",
    "record_advance_refund": "sales_return",
  # Dairy Shop sector
    "record_spoilage_loss": "stock_adjustment",
    "record_credit_sale_arrangement": "credit_sale",
    "record_payment_receipt": "payment_received",
    "record_purchase_shortfall": "credit_purchase",
    "record_mixed_sale": "credit_sale",
    "record_sale_on_credit": "credit_sale",
    "inventory_status_update": "unknown",
    "daily_stock_summary": "cash_sale",
    "inquiry_debtor_balance": "unknown",
    "inquiry_daily_profit": "unknown",
    "setup_recurring_credit_sale": "credit_sale",
    "inquiry_overdue_debtors": "unknown",
    "inventory_inquiry": "unknown",
    "record_partial_payment_to_supplier": "payment_made",
    "inquiry_tax_invoice": "unknown",
    "record_purchase_without_invoice": "cash_purchase",
    "price_update_purchase": "unknown",
    "inquiry_tax_compliance": "unknown",
    "record_supply_disruption": "unknown",
    "record_payment_to_supplier": "payment_made",
    "record_sale_and_spoilage": "cash_sale",
    "record_creditor_settlement": "payment_made",
    "price_inquiry_or_update": "unknown",
    "daily_stock_reconciliation": "unknown",
    "record_receipt": "payment_received",
    "record_nil_transaction": "unknown",
    "record_sale_multiple_sku": "cash_sale",
    "record_fire_loss": "stock_adjustment",
    "record_bank_interest_income": "payment_received",
    "record_credit_purchase": "credit_purchase",
    "record_daily_expenses": "expense",
    "record_expiry_loss": "stock_adjustment",
    "price_reduction_update": "unknown",
    "record_production_and_unsold_stock": "stock_adjustment",
    "inquiry_year_end_accounting": "unknown",
    "customer_complaint": "unknown",
    "record_digital_wallet_settlement": "contra",
    "inquiry_digital_wallet_balance": "unknown",
    "record_payment": "payment_made",
    "inquiry_family_employee": "unknown",
    "profit_calculation_query": "unknown",
    "record_loan_receipt": "loan_received",
    "record_owner_withdrawal": "drawings",
    "year_end_stock_taking": "unknown",
    "record_purchase_return_or_spoilage": "purchase_return",
    "record_cash_shortage": "stock_adjustment",
    "record_promotional_discount_day": "cash_sale",
    "upcoming_payment_reminder": "unknown",
    "price_update": "unknown",
    "operational_issue": "unknown",
    "generate_invoice": "unknown",
    "record_correction_entry": "unknown",
    "cost_calculation_query": "unknown",
    "record_drawings_or_personal_expense": "drawings",
    "record_mixed_daily_sales": "credit_sale",
    "record_dispute": "unknown",
    "record_sale_split_payment": "cash_sale",
    "record_fake_currency_loss": "stock_adjustment",
    "inquiry_pos_machine": "unknown",
    "inquire_total_funds": "unknown",
    "bank_reconciliation": "unknown",
    "stock_expiry_audit": "unknown",
    "followup_collection_note": "unknown",
    "inquiry_vat_registration": "unknown",
    "inquiry_tds": "unknown",
    "record_opening_balance": "capital_introduced",
    "daily_cash_collection_summary": "unknown",
    "profit_margin_calculation": "unknown",
    "record_purchase_with_vat": "vat_purchase",
    "record_spoilage_due_to_power_cut": "stock_adjustment",
    "correct_duplicate_entry": "unknown",
    "operational_note": "unknown",
    "supplier_onboarding": "unknown",
    "full_financial_report_request": "unknown",
    "reorder_alert": "unknown",
    "record_bonus_expense": "expense",
    "record_debit_note_received": "purchase_return",
    "inquiry_bank_account": "unknown",
    "record_delayed_payment_receipt": "payment_received",
    "inquiry_total_payables": "unknown",
    "price_comparison_query": "unknown",
    "stockout_notification": "unknown",
    "daily_closing_confirmation": "unknown",
    "supplier_contact_update": "unknown",
    "product_classification_query": "unknown",
    "stock_expiry_alert": "unknown",
    "record_bulk_order": "unknown",
    "record_order_confirmation": "unknown",
    "record_goods_taken_for_personal_use": "drawings",
    "record_commission_expense": "expense",
    "year_end_new_year_setup": "unknown",
    "record_personal_loan_from_business": "drawings",
    "inquiry_top_selling_items": "unknown",
    "record_digital_wallet_bank_settlement": "contra",
    "record_opening_stock": "stock_adjustment",
    "correct_inventory_error": "stock_adjustment",
    "daily_status_ok": "unknown",
    "record_pending_digital_payment_sale": "credit_sale",
    "price_competitiveness_query": "unknown",
    "inquiry_monthly_revenue_report": "unknown",
    "inquiry_commission_expense": "unknown",
    "inquiry_average_sales": "unknown",
    "followup_overdue_debtor": "unknown",
    "followup_collection": "unknown",
    "setup_regular_b2b_supply": "credit_sale",
    "record_fixed_asset_purchase": "expense",
    "record_fixed_asset_disposal": "cash_sale",
    # Meat shop sector
    "record_loss": "stock_adjustment",
    "record_partial_receipt": "payment_received",
    "inventory_adjustment": "stock_adjustment",
    "report_request": "unknown",
    "record_sale_with_immediate_return": "sales_return",
    "record_income": "payment_received",
    "record_contract_setup": "unknown",
    "system_query": "unknown",
    "system_issue": "unknown",
    "record_sale_and_receivable_settlement": "payment_received",
    "informational_note": "unknown",
    "acknowledgement": "unknown",
    "record_multiple_transactions": "unknown",
    "customer_feedback": "unknown",
    "customer_inquiry": "unknown",
    "record_order": "unknown",
    "record_sale_pending": "credit_sale",
    "system_action": "unknown",
    # Fruit and vegetable shop sector
    "backdated_entry_request": "unknown",
    "inventory_status": "unknown",
    "record_purchase_pending": "credit_purchase",
    "clarification_needed_out_of_scope": "unknown",
    "unclear": "unknown",
    # Construction material supplier sector
    "update_price": "unknown",
    "request_quotation": "unknown",
    "log_complaint": "unknown",
    "request_report": "unknown",
    "record_payroll": "salary",
    "record_staff_advance": "salary",
    "request_writeoff": "bad_debt_writeoff",
    "clarify_transaction": "unknown",
    "update_price_list": "unknown",
    "record_advance_payment_request": "prepaid",
    "accounting_method_query": "unknown",
    "accounting_policy_query": "unknown",
    "credit_limit_alert": "unknown",
    "record_new_employee": "unknown",
    "general_note": "unknown",
    "issue_invoice_copy": "unknown",
    "request_lookup": "unknown",
    "cancel_order": "unknown",
    "clarify_compliance": "unknown",
    "request_reminder": "unknown",
    "record_cheque_clearance": "contra",
    "record_cheque_bounce": "unknown",
    "update_business_policy": "unknown",
    "update_supplier_policy": "unknown",
    "record_writeoff": "bad_debt_writeoff",
    "record_final_settlement": "payment_received",
    "record_incident": "unknown",
    "create_supplier_contract": "unknown",
    "record_stock_count": "unknown",
    "cancel_invoice": "unknown",
    "issue_rate_card": "unknown",
    "credit_policy_decision": "unknown",
    "record_payable_reminder": "unknown",
    "record_theft": "stock_adjustment",
    "record_loan_payment": "loan_repayment",
    "record_goodwill_adjustment": "expense",
    "system_issue_note": "unknown",
    "customer_notification": "unknown",
    "record_stock_adjustment": "stock_adjustment",
    "update_payment_terms": "unknown",
    "rate_confirmation_request": "unknown",
    "request_documents": "unknown",
    "issue_statement": "unknown",
    "data_correction_request": "unknown",
    # Construction material supplier sector batch 2
    "payable_query": "unknown",
    "record_postdated_cheque": "contra",
    "record_stockout_note": "unknown",
    "issue_delayed_invoice": "unknown",
    "rate_confirmation": "unknown",
    "provide_documents": "unknown",
    "receivables_review": "unknown",
    "record_delivery_confirmation": "unknown",
    "record_failed_payment": "unknown",
    "rate_dispute": "unknown",
    "record_barter_settlement": "payment_received",
    "record_donation_in_kind": "expense",
    "record_payment_promise": "unknown",
    "request_legal_action": "unknown",
    "record_sample_dispatch": "expense",
    "record_invoice_correction": "unknown",
    "record_account_closure": "payment_received",
    "record_cheque_deposit": "contra",
}


def slug_for_sector(sector: str) -> str:
    return SECTOR_SLUG.get(sector) or re.sub(r"[^a-z0-9]+", "-", sector.lower()).strip("-")


def infer_language(row: dict) -> str:
    if row.get("language_type"):
        return str(row["language_type"])
    text = str(row.get("user_input") or "")
    if re.search(r"[\u0900-\u097F]", text):
        return "nepali"
    if re.search(r"\b(sold|purchased|received|deposit|cash|bank)\b", text, re.I):
        return "english"
    return "romanized"


def chunk_id(row: dict, idx: int) -> str:
    sector = slug_for_sector(str(row.get("sector") or "unknown"))
    h = hashlib.md5((row.get("user_input") or "")[:80].encode()).hexdigest()[:8]
    return f"sector-{sector}-{idx:04d}-{h}"


def build_content(row: dict) -> str:
    parts = [
        f"SECTOR NLU — sector={row.get('sector', '')}",
        f"User input: {row.get('user_input', '')}",
        f"Meaning: {row.get('normalized_meaning', '')}",
        f"Intent: {row.get('intent', '')}",
        f"Category: {row.get('transaction_category', '')}",
        f"ERP action: {row.get('erp_action', '')}",
        f"Confidence: {row.get('confidence', '')}",
        f"Payment mode: {row.get('payment_mode', '')}",
        f"Party: {row.get('party', '')}",
        f"Amount: {row.get('amount', '')}",
    ]
    if row.get("missing_fields"):
        parts.append(f"Missing fields: {', '.join(row['missing_fields'])}")
    if row.get("required_fields_detected"):
        parts.append(f"Detected fields: {', '.join(row['required_fields_detected'])}")
    if row.get("debit_accounts"):
        parts.append(f"Debit: {', '.join(row['debit_accounts'])}")
    if row.get("credit_accounts"):
        parts.append(f"Credit: {', '.join(row['credit_accounts'])}")
    if row.get("inventory_effect"):
        parts.append(f"Inventory: {row['inventory_effect']}")
    if row.get("tax_effect"):
        parts.append(f"Tax: {row['tax_effect']}")
    if row.get("clarification_needed") and row.get("clarification_question"):
        parts.append(f"Clarify ask: {row['clarification_question']}")
    return "\n".join(parts)


def row_to_chunk(row: dict, idx: int) -> dict:
    sector = str(row.get("sector") or "Unknown")
    slug = slug_for_sector(sector)
    segment = f"general.sector.{slug.replace('-', '.')}" if slug else "general.sector.unknown"
    # segment id uses dots: kirana-grocery -> general.sector.kirana-grocery (keep hyphen in segment id)
    segment = f"general.sector.{slug}"

    lang = infer_language(row)
    intent = str(row.get("intent") or "")
    conf = float(row.get("confidence") or 0)
    erp_action = str(row.get("erp_action") or "")
    tags = ["sector", "sector_nlu", slug, lang, row.get("transaction_category") or "unknown"]
    if intent:
        tags.append(intent)
    nlu_map = SECTOR_INTENT_TO_NLU.get(intent)
    if nlu_map:
        tags.append(nlu_map)
    clarify = bool(row.get("clarification_needed"))
    if clarify or conf < 0.5:
        tags.append("clarification_required")
    if erp_action in NON_TRANSACTION_ERP or "not_a_transaction" in str(row.get("transaction_category", "")):
        tags.append("non_transaction")
    if conf < 0.35:
        tags.append("do_not_post")

    title_src = row.get("user_input") or "Sector example"
    title = (title_src[:70] + "…") if len(title_src) > 70 else title_src

    missing = row.get("missing_fields") or []
    return {
        "id": chunk_id(row, idx),
        "title": title,
        "content": build_content(row),
        "segment": segment,
        "language": list({lang, "nepali", "english", "romanized"}),
        "tags": tags,
        "source": SOURCE,
        "sector": sector,
        "sector_slug": slug,
        "intent": intent,
        "nlu_intent": nlu_map,
        "confidence": conf,
        "language_type": lang,
        "transaction_category": row.get("transaction_category"),
        "erp_action": erp_action,
        "clarification_needed": clarify,
        "clarification_question": row.get("clarification_question") or "",
        "required_fields": missing if clarify else [],
        "required_fields_detected": row.get("required_fields_detected") or [],
        "payment_mode": row.get("payment_mode"),
        "party": row.get("party"),
        "amount": row.get("amount"),
    }


def parse_line(line: str) -> dict | None:
    line = line.strip()
    if line.startswith("Copy"):
        line = line[4:].strip()
    if not line.startswith("{"):
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def load_rows(*paths: Path) -> list[dict]:
    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for path in paths:
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            row = parse_line(line)
            if row and row.get("sector"):
                key = (str(row.get("sector") or ""), str(row.get("user_input") or ""))
                if key in seen:
                    continue
                seen.add(key)
                rows.append(row)
            elif line.strip().startswith("{") or line.strip().startswith("Copy{"):
                print(f"Skip bad line {i} in {path.name}")
    return rows


def ingest(raw_paths: list[Path]) -> dict[str, int]:
    rows = load_rows(*raw_paths)
    by_segment: dict[str, list[dict]] = {}
    for row in rows:
        slug = slug_for_sector(str(row.get("sector") or "Unknown"))
        segment = f"general.sector.{slug}"
        by_segment.setdefault(segment, []).append(row)

    counts: dict[str, int] = {}
    for segment, segment_rows in by_segment.items():
        chunks = [row_to_chunk(row, i) for i, row in enumerate(segment_rows)]
        slug = segment.replace("general.sector.", "")
        out_dir = ROOT / "data" / "ekhata" / "knowledge" / "general" / "sector" / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "nepal-sector-nlu.jsonl"
        with out_path.open("w", encoding="utf-8") as f:
            for c in chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        counts[segment] = len(chunks)
        print(f"Wrote {len(chunks)} → {out_path.relative_to(ROOT)}")
    return counts


def main() -> None:
    if len(sys.argv) > 1:
        paths = [Path(p) for p in sys.argv[1:]]
    else:
        paths = sorted(INGEST_DIR.glob("sector_*_*.jsonl"))
    missing = [p for p in paths if not p.exists()]
    if missing or not paths:
        print(f"Missing: {missing or 'no sector raw files'}")
        sys.exit(1)
    print("Ingesting:", ", ".join(p.name for p in paths))
    counts = ingest(paths)
    print("Total by segment:", counts, "sum=", sum(counts.values()))

    sys.path.insert(0, str(ROOT / "erp_bot"))
    from src.knowledge.knowledge_registry import load_all_chunks

    print("KB total chunks:", len(load_all_chunks(force_reload=True)))


if __name__ == "__main__":
    main()
