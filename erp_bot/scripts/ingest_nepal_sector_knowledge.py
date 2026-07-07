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
        "advise_consult_professional",
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
    seen: set[str] = set()
    for path in paths:
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            row = parse_line(line)
            if row and row.get("sector"):
                key = str(row.get("user_input") or "")
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
