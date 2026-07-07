"""
Bridge Phase 3 NLU examples + Phase 4 intent taxonomy into live parsing.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from ..knowledge.knowledge_registry import KnowledgeChunk, search_tiered_knowledge

if TYPE_CHECKING:
    from .engine import ParsedEntry

PHASE4_TO_NLU: dict[str, str] = {
    "SAL-01": "cash_sale",
    "SAL-02": "credit_sale",
    "SAL-03": "vat_sale",
    "SAL-04": "cash_sale",
    "SAL-05": "cash_sale",
    "SAL-06": "cash_sale",
    "SAL-07": "sales_return",
    "SAL-08": "discount_allowed",
    "SAL-09": "expense",
    "SAL-10": "cash_sale",
    "SAL-11": "cash_sale",
    "SAL-12": "payment_received",
    "SAL-13": "payment_received",
    "SAL-14": "payment_received",
    "SAL-15": "bad_debt_writeoff",
    "PUR-01": "cash_purchase",
    "PUR-02": "credit_purchase",
    "PUR-03": "vat_purchase",
    "PUR-04": "cash_purchase",
    "PUR-05": "credit_purchase",
    "PUR-06": "purchase_return",
    "PUR-07": "credit_purchase",
    "PUR-08": "payment_made",
    "PUR-09": "payment_made",
    "PUR-10": "payment_made",
    "PUR-11": "expense",
    "PUR-12": "expense",
    "PUR-13": "credit_purchase",
    "PUR-14": "credit_purchase",
    "EXP-01": "expense",
    "EXP-02": "salary",
    "EXP-03": "salary",
    "EXP-04": "expense",
    "EXP-05": "expense",
    "EXP-06": "expense",
    "EXP-07": "expense",
    "EXP-08": "expense",
    "EXP-09": "expense",
    "EXP-10": "expense",
    "EXP-11": "expense",
    "EXP-12": "expense",
    "EXP-13": "expense",
    "EXP-14": "expense",
    "EXP-15": "expense",
    "EXP-16": "expense",
    "EXP-17": "bank_charges",
    "EXP-18": "bank_charges",
    "EXP-19": "interest_expense",
    "EXP-20": "expense",
    "EXP-21": "prepaid",
    "EXP-22": "expense",
    "EXP-23": "expense",
    "CB-01": "contra",
    "CB-02": "contra",
    "CB-03": "contra",
    "CB-04": "payment_made",
    "CB-05": "payment_received",
    "CB-06": "payment_received",
    "CB-07": "payment_received",
    "CB-08": "payment_made",
    "CB-09": "capital_introduced",
    "CB-10": "drawings",
    "CB-11": "expense",
    "CB-12": "expense",
    "INV-01": "opening_balance",
    "INV-02": "closing_entry",
    "INV-03": "stock_adjustment",
    "INV-04": "stock_adjustment",
    "INV-05": "stock_adjustment",
    "INV-06": "stock_adjustment",
    "INV-07": "stock_adjustment",
    "INV-08": "stock_adjustment",
    "INV-09": "stock_adjustment",
    "INV-10": "credit_purchase",
    "INV-11": "cash_sale",
    "INV-12": "stock_adjustment",
    "INV-13": "stock_adjustment",
    "AST-01": "expense",
    "AST-02": "cash_sale",
    "AST-03": "depreciation",
    "AST-04": "loan_received",
    "AST-05": "loan_repayment",
    "AST-06": "interest_expense",
    "AST-07": "expense",
    "AST-08": "payment_received",
    "AST-09": "prepaid",
    "AST-10": "prepaid",
    "TAX-01": "vat_sale",
    "TAX-02": "vat_purchase",
    "TAX-03": "vat_sale",
    "TAX-04": "payment_received",
    "TAX-05": "tds_deducted",
    "TAX-06": "tds_paid",
    "TAX-07": "expense",
    "TAX-08": "expense",
    "TAX-09": "expense",
    "COR-01": "journal",
    "COR-02": "journal",
    "COR-03": "journal",
    "COR-04": "journal",
    "COR-05": "journal",
    "COR-06": "contra",
    "COR-07": "journal",
    "COR-08": "cash_sale",
}

RECORD_INTENT_TO_NLU: dict[str, str] = {
    "record_cash_sale": "cash_sale",
    "record_credit_sale": "credit_sale",
    "record_vat_sale": "vat_sale",
    "record_purchase": "cash_purchase",
    "record_credit_purchase": "credit_purchase",
    "record_purchase_non_vat": "credit_purchase",
    "record_expense_payment": "expense",
    "record_expense_accrual": "expense",
    "record_receipt": "payment_received",
    "record_supplier_payment": "payment_made",
    "record_partial_payment": "payment_received",
    "record_drawings": "drawings",
    "record_capital_injection": "capital_introduced",
    "record_fund_transfer": "contra",
    "record_sales_return": "sales_return",
    "record_purchase_return": "purchase_return",
    "record_loan_receipt": "loan_received",
    "record_loan_repayment": "loan_repayment",
    "record_salary_advance": "salary",
    "record_stock_writeoff": "stock_adjustment",
    "record_service_income": "cash_sale",
    "record_customer_advance": "payment_received",
    "record_tax_payment": "tds_paid",
    "record_income": "payment_received",
    "record_asset_purchase": "expense",
    "record_asset_purchase_financed": "loan_received",
    "record_prepaid_expense": "prepaid",
    "record_credit_note": "sales_return",
    "clarify_vat_status": "vat_sale",
    "clarify_payment_mode": "unknown",
    "flag_duplicate_transaction": "unknown",
    "flag_cash_discrepancy": "stock_adjustment",
    "no_transaction": "unknown",
    "policy_question": "unknown",
    "unclear": "unknown",
}

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
    "record_bad_debt_risk": "bad_debt_writeoff",
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
    "correction_request": "unknown",
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

SECTOR_NON_TRANSACTION = frozenset(
    {
        "informal_business_status_comment",
        "informal_status_update",
        "ambiguous_credit_transaction",
        "unclear_intent",
        "advice_request_not_transaction",
        "business_performance_comment",
        "price_update_notification",
        "inventory_price_update",
        "vague_concern_not_transaction",
        "price_discrepancy_query",
        "informal_customer_request",
        "future_intent_not_transaction",
        "record_clearance_sale_policy",
        "personal_comment_not_transaction",
        "informal_operational_comment",
        "tax_query",
        "request_for_report",
        "subjective_comment",
        "data_correction_request",
        "informal_billing_decision",
        "unclear_ambiguous_transaction",
        "irrelevant_personal_comment",
        "informal_business_comment",
        "billing_issue",
        "price_negotiation_update",
        "support_request",
        "task_reminder_not_transaction",
        "record_defective_goods_complaint",
        "record_dispute_on_receivable",
        "record_customer_complaint",
        "record_quality_complaint",
        "record_supplier_replacement_pending",
        "flag_counterfeit_currency_concern",
        "record_pending_wage_liability",
        "risk_concern_not_transaction",
        "missed_recording_admission",
        "emotional_expression_not_transaction",
        "irrelevant_incident_not_transaction",
        "bank_reconciliation_issue",
        "informal_dispute_comment",
        "irrelevant_comment",
        "operational_task_not_transaction",
        "tax_documentation_query",
        "report_pos_system_error",
        "record_clearance_pricing_decision",
        "record_promotional_campaign",
        "operational_issue_not_transaction",
        "business_strategy_question",
        "record_sale_with_system_issue",
        "record_loyalty_points",
        "record_free_sample_receipt",
        "record_online_order_pending",
        "record_dispute_refund_without_receipt",
        "business_planning_not_transaction",
        "informal_business_experiment",
        "unclear_confused_statement",
        "informal_marketing_update",
        "billing_query",
        "record_new_hire_not_transaction",
        "informal_operational_update",
        "subjective_comment",
        "supplier_billing_issue",
        "informal_business_agreement",
        "pending_task_not_transaction",
        "business_performance_query",
        "informal_service_update",
        "informal_hr_issue",
        "informal_promotional_update",
        "record_policy_violation",
        "informal_transaction_note",
        "record_delivery_dispatch",
        "informal_financial_concern",
        "informal_hr_update",
        "record_billing_error",
        "operational_update_not_transaction",
        "informal_service_note",
        "record_pricing_discrepancy_complaint",
        "informal_business_expansion_note",
        "record_asset_order_pending",
        "record_loyalty_point_redemption",
        "informal_business_relationship_note",
        "informal_partnership_accounting",
        "informal_business_note",
        "informal_business_task",
        "record_order_cancellation",
        "informal_credit_terms_negotiation",
        "record_sale_discount_negotiation",
        "informal_business_discussion",
        "tax_compliance_notice",
        "informal_marketing_activity",
        "informal_operational_policy_update",
        "informal_business_relationship_activity",
        "informal_business_technology_update",
        "record_data_entry_error",
        "record_sales_inquiry",
        "informal_planning_task",
        "informal_hr_negotiation",
        "record_credit_limit_review",
        "informal_business_negotiation",
        "informal_operational_request",
        "informal_business_activity",
        "informal_operational_activity",
        "informal_business_proposal",
        "informal_business_policy_update",
        "informal_business_meeting_update",
        "informal_business_research",
        "informal_business_planning",
        "record_discount_claim_verification",
        "record_loyalty_bonus_request",
        "record_client_risk_assessment",
        "inventory_stock_alert",
        "record_operational_error",
        "informal_stock_arrival_update",
        "informal_business_decision_pending",
        "general_comment",
        "sales_inquiry",
        "correct_billing_error",
        "general_inquiry",
        "expense_inquiry",
        "record_overdue_receivable",
        "record_sale_billing_correction",
        "record_hr_note",
        "record_hr_event",
        "record_outstanding_payable",
        "record_pending_payable",
        "no_transaction",
        "unclear_no_data",
        "unclear_business_structure_query",
        "record_sales_on_credit_ambiguous",
        "record_sales_on_credit_informal",
        "no_transaction_status_update",
        "record_sales_discount_policy",
        "future_planning_no_transaction",
        "administrative_update_no_transaction",
        "administrative_event_no_transaction",
        "administrative_note_no_transaction",
        "administrative_request_no_transaction",
        "price_update_note_no_transaction",
        "context_note_no_direct_transaction",
        "business_closure_notice",
        "clarification_dialogue_from_user",
        "vague_status_update",
        "vague_status_update_with_credit_mention",
        "unclear_transaction",
        "record_liability_status",
        "record_aging_receivable_note",
        "record_disputed_receivable",
        "period_close_request",
        "record_stock_shortage_note",
        "record_purchase_intent",
        "record_warranty_complaint",
        "record_stock_transfer_request",
        "record_near_expiry_stock_note",
        "record_inventory_alert",
        "record_product_safety_complaint",
        # Dairy Shop non-transaction intents
        "inventory_status_update",
        "inquiry_debtor_balance",
        "inquiry_daily_profit",
        "inquiry_overdue_debtors",
        "inventory_inquiry",
        "inquiry_tax_invoice",
        "price_update_purchase",
        "inquiry_tax_compliance",
        "record_supply_disruption",
        "price_inquiry_or_update",
        "daily_stock_reconciliation",
        "record_nil_transaction",
        "inquiry_year_end_accounting",
        "customer_complaint",
        "inquiry_digital_wallet_balance",
        "inquiry_family_employee",
        "profit_calculation_query",
        "year_end_stock_taking",
        "upcoming_payment_reminder",
        "price_update",
        "operational_issue",
        "generate_invoice",
        "cost_calculation_query",
        "record_dispute",
        "inquiry_pos_machine",
        "inquire_total_funds",
        "bank_reconciliation",
        "stock_expiry_audit",
        "followup_collection_note",
        "inquiry_vat_registration",
        "inquiry_tds",
        "daily_cash_collection_summary",
        "profit_margin_calculation",
        "correct_duplicate_entry",
        "operational_note",
        "supplier_onboarding",
        "full_financial_report_request",
        "reorder_alert",
        "inquiry_bank_account",
        "inquiry_total_payables",
        "price_comparison_query",
        "stockout_notification",
        "daily_closing_confirmation",
        "supplier_contact_update",
        "product_classification_query",
        "stock_expiry_alert",
        "record_bulk_order",
        "record_order_confirmation",
        "year_end_new_year_setup",
        "inquiry_top_selling_items",
        "daily_status_ok",
        "price_competitiveness_query",
        "inquiry_monthly_revenue_report",
        "inquiry_commission_expense",
        "inquiry_average_sales",
        "followup_overdue_debtor",
        "followup_collection",
        "price_reduction_update",
        # Meat shop non-transaction intents
        "report_request",
        "record_contract_setup",
        "system_query",
        "system_issue",
        "informational_note",
        "acknowledgement",
        "record_multiple_transactions",
        "customer_feedback",
        "customer_inquiry",
        "record_order",
        "system_action",
        "correction_request",
        # Fruit and vegetable shop non-transaction intents
        "backdated_entry_request",
        "inventory_status",
        "clarification_needed_out_of_scope",
        "unclear",
        "no_transaction",
        # Construction material supplier non-transaction intents
        "update_price",
        "request_quotation",
        "log_complaint",
        "request_report",
        "request_writeoff",
        "clarify_transaction",
        "update_price_list",
        "accounting_method_query",
        "accounting_policy_query",
        "credit_limit_alert",
        "general_note",
        "issue_invoice_copy",
        "request_lookup",
        "cancel_order",
        "clarify_compliance",
        "request_reminder",
        "update_business_policy",
        "update_supplier_policy",
        "create_supplier_contract",
        "cancel_invoice",
        "issue_rate_card",
        "credit_policy_decision",
        "record_payable_reminder",
        "system_issue_note",
        "customer_notification",
        "update_payment_terms",
        "rate_confirmation_request",
        "request_documents",
        "issue_statement",
        "record_new_employee",
        # Construction material supplier batch 2 non-transaction intents
        "payable_query",
        "record_stockout_note",
        "issue_delayed_invoice",
        "rate_confirmation",
        "provide_documents",
        "receivables_review",
        "record_delivery_confirmation",
        "record_failed_payment",
        "rate_dispute",
        "record_payment_promise",
        "request_legal_action",
        "record_invoice_correction",
    }
)

NON_TRANSACTION_INTENTS = frozenset(
    {
        "no_transaction",
        "policy_question",
        "request_report",
        "request_reconciliation",
        "request_print_bill",
        "business_setup_info",
        "status_update",
        "unclear",
    }
)

_FIELD_CHECKS: dict[str, Any] = {
    "amount": lambda p: p.amount is not None and p.amount > 0,
    "payment_mode": lambda p: p.payment_method != "unknown",
    "customer_name": lambda p: bool(p.party),
    "supplier_name": lambda p: bool(p.party),
    "party_name": lambda p: bool(p.party),
}


def _extract_clarify_questions(chunk: KnowledgeChunk) -> list[str]:
    qs: list[str] = []
    for line in chunk.content.splitlines():
        m = re.search(r"Clarify ask:\s*(.+)", line)
        if m:
            qs.append(m.group(1).strip())
    in_block = False
    for line in chunk.content.splitlines():
        if "Clarification questions:" in line:
            in_block = True
            continue
        if in_block:
            if line.strip().startswith("- "):
                qs.append(line.strip()[2:].strip())
            elif line.strip() and not line.startswith(" "):
                in_block = False
    if not qs and chunk.metadata.get("clarification_question"):
        qs.append(str(chunk.metadata["clarification_question"]))
    return qs


def _missing_required_fields(chunk: KnowledgeChunk, parsed: ParsedEntry) -> list[str]:
    required = chunk.metadata.get("required_fields") or []
    missing: list[str] = []
    for field in required:
        check = _FIELD_CHECKS.get(field)
        if check and not check(parsed):
            missing.append(field)
    return missing


def search_nlu_knowledge(message: str, *, top_k: int = 5) -> list[KnowledgeChunk]:
    return search_tiered_knowledge(message, task="nlu", top_k=top_k, min_relevance=0.2)


def format_nlu_knowledge_context(message: str, *, max_chars: int = 900) -> str:
    hits = search_nlu_knowledge(message, top_k=3)
    if not hits:
        return ""
    lines = ["[RETRIEVED NLU KNOWLEDGE — intent/clarification only; never hard-code tax rates]"]
    for h in hits:
        code = h.metadata.get("intent_code") or h.id
        name = h.metadata.get("intent_name") or h.title
        req = h.metadata.get("required_fields") or []
        snippet = h.content.split("\nExample user inputs:")[0]
        if len(snippet) > 400:
            snippet = snippet[:397] + "..."
        lines.append(f"--- {code} {name} | required={req} ---\n{snippet}")
    text = "\n\n".join(lines)
    return text[:max_chars] if len(text) > max_chars else text


def _apply_example_chunk(
    parsed: ParsedEntry,
    chunk: KnowledgeChunk,
    *,
    intent_map: dict[str, str],
    non_transaction: frozenset[str],
    strict_clarify: bool = False,
) -> tuple[ParsedEntry, bool, str | None, list[str]]:
    """Apply phase3/sector example chunk; returns (parsed, skip_posting, skip_reason, refs)."""
    refs: list[str] = [chunk.id]
    skip_posting = False
    skip_reason: str | None = None
    record_intent = str(chunk.metadata.get("intent") or "")
    conf = float(chunk.metadata.get("confidence") or 0)

    if record_intent in non_transaction and conf < 0.35:
        skip_posting = True
        skip_reason = record_intent
        parsed.needs_clarification = True
        qs = _extract_clarify_questions(chunk)
        parsed.clarification_question = qs[0] if qs else (
            "Yo transaction entry ho ki general question? Kripaya clear garnus."
        )
        parsed.confidence = min(parsed.confidence, 0.25)
        return parsed, skip_posting, skip_reason, refs

    mapped = intent_map.get(record_intent)
    if mapped and mapped != "unknown" and parsed.confidence < 0.75:
        if parsed.intent == "unknown" or conf >= 0.55:
            parsed.intent = mapped  # type: ignore[assignment]
            parsed.confidence = max(parsed.confidence, min(0.85, conf + 0.1))

    needs_clarify = bool(chunk.metadata.get("clarification_needed"))
    if needs_clarify or (not strict_clarify and ("clarification_required" in chunk.tags)):
        if not strict_clarify or needs_clarify:
            if parsed.confidence < 0.65 or not parsed.amount or (not strict_clarify and not parsed.party):
                parsed.needs_clarification = True
                qs = _extract_clarify_questions(chunk)
                if qs and not parsed.clarification_question:
                    parsed.clarification_question = qs[0]

    missing = _missing_required_fields(chunk, parsed)
    if missing and (needs_clarify or not strict_clarify):
        parsed.needs_clarification = True
        qs = _extract_clarify_questions(chunk)
        if qs and not parsed.clarification_question:
            parsed.clarification_question = qs[0]
        elif not parsed.clarification_question:
            parsed.clarification_question = (
                f"Thap anusar {', '.join(missing)} chahincha — kripaya bataunu hola."
            )

    if "do_not_post" in chunk.tags or conf < 0.35:
        parsed.needs_clarification = True
        if not parsed.clarification_question:
            parsed.clarification_question = (
                "Yo entry post garna yeti detail pugdaina — rakam, party, "
                "ra payment mode confirm garnu hola."
            )

    return parsed, skip_posting, skip_reason, refs


def enrich_parsed_entry(parsed: ParsedEntry, message: str) -> ParsedEntry:
    hits = search_nlu_knowledge(message)
    if not hits:
        return parsed

    phase4 = next((h for h in hits if h.id.startswith("phase4-")), None)
    phase3 = next((h for h in hits if h.id.startswith("phase3-")), None)
    sector = next((h for h in hits if h.id.startswith("sector-")), None)

    refs: list[str] = []
    intent_code: str | None = None
    skip_posting = False
    skip_reason: str | None = None

    if phase4:
        intent_code = str(phase4.metadata.get("intent_code") or phase4.id.replace("phase4-", ""))
        refs.append(phase4.id)
        mapped = PHASE4_TO_NLU.get(intent_code or "")
        if mapped and (
            parsed.intent == "unknown"
            or parsed.confidence < 0.72
            or (mapped != parsed.intent and parsed.confidence < 0.88)
        ):
            parsed.intent = mapped  # type: ignore[assignment]
            parsed.confidence = max(parsed.confidence, 0.72)

        missing = _missing_required_fields(phase4, parsed)
        if missing:
            parsed.needs_clarification = True
            qs = _extract_clarify_questions(phase4)
            if qs and not parsed.clarification_question:
                parsed.clarification_question = qs[0]
            elif not parsed.clarification_question:
                parsed.clarification_question = (
                    f"Thap anusar {', '.join(missing)} chahincha — kripaya bataunu hola."
                )

    if phase3:
        parsed, skip3, reason3, refs3 = _apply_example_chunk(
            parsed, phase3, intent_map=RECORD_INTENT_TO_NLU, non_transaction=NON_TRANSACTION_INTENTS
        )
        refs.extend(refs3)
        if skip3:
            skip_posting = True
            skip_reason = reason3

    if sector and not skip_posting:
        parsed, skip_s, reason_s, refs_s = _apply_example_chunk(
            parsed,
            sector,
            intent_map=SECTOR_INTENT_TO_NLU,
            non_transaction=SECTOR_NON_TRANSACTION,
            strict_clarify=True,
        )
        refs.extend(refs_s)
        if skip_s:
            skip_posting = True
            skip_reason = reason_s

    return parsed.model_copy(
        update={
            "intent_code": intent_code,
            "knowledge_refs": refs,
            "skip_posting": skip_posting,
            "skip_reason": skip_reason,
        }
    )


def is_likely_non_transaction(message: str) -> bool:
    t = (message or "").strip().lower()
    if not t or len(t) <= 3:
        return True
    if t in {"ok", "thik", "thik cha", "thik chha", "yes", "ho", "huncha", "stock", "bill", "paisa", "bikri"}:
        return True
    hits = search_nlu_knowledge(message, top_k=2)
    for h in hits:
        intent = str(h.metadata.get("intent") or "")
        conf = float(h.metadata.get("confidence") or 0)
        if h.id.startswith("phase3-") and intent in NON_TRANSACTION_INTENTS and conf < 0.2:
            return True
        if h.id.startswith("sector-") and intent in SECTOR_NON_TRANSACTION and conf < 0.2:
            return True
    return False
