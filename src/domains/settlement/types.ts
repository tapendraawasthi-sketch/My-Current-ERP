/**
 * Phase 9 settlement domain types - receipt / payment / contra / journal.
 * Money amounts are decimal strings (2 dp) unless noted as paisa.
 */

export type SettlementVoucherType = "receipt" | "payment" | "contra" | "journal";

export type ReceiptType =
  | "customer_receipt"
  | "other_receipt"
  | "customer_advance_receipt"
  | "unapplied_customer_receipt";

export type PaymentType =
  | "supplier_payment"
  | "expense_payment"
  | "supplier_advance_payment"
  | "unapplied_supplier_payment";

export type ContraType =
  | "cash_to_bank"
  | "bank_to_cash"
  | "bank_to_bank"
  | "cash_to_cash";

export type JournalType =
  | "general_journal"
  | "adjustment_journal"
  | "accrual_journal"
  | "prepayment_journal"
  | "correction_journal"
  | "reclassification_journal"
  | "writeoff_journal"
  | "reversal_journal";

export type SettlementCommandSource =
  | "orbix"
  | "manual_form"
  | "import"
  | "test"
  | "remote_sync";

export type SettlementConflictCategory =
  | "stale_settlement_version"
  | "stale_advance_version"
  | "over_allocation"
  | "party_mismatch"
  | "in_progress"
  | "duplicate_idempotency"
  | "insufficient_advance"
  | "account_mismatch"
  | "document_not_found"
  | "invalid_document_type"
  | "allocation_company_mismatch"
  | "allocation_currency_mismatch"
  | "invoice_already_settled"
  | "advance_already_applied"
  | "period_locked"
  | "device_not_authorized"
  | "journal_integrity_mismatch"
  | "payload_hash_mismatch"
  | "receipt_number_collision"
  | "payment_number_collision"
  | "contra_number_collision"
  | "journal_number_collision"
  | "bank_account_mismatch"
  | "account_mapping_missing"
  | "withholding_rule_mismatch"
  | "unsupported_schema_version"
  | "duplicate_event"
  | "duplicate_idempotency_key";

export type SettlementAllocationComponent =
  | "principal"
  | "discount"
  | "withholding"
  | "writeoff";

export type MoneyString = string;

export type AdvancePartySide = "customer" | "supplier";

export type UnappliedBalanceClassification =
  | "customer_advance"
  | "supplier_advance"
  | "unapplied_customer_receipt"
  | "unapplied_supplier_payment"
  | "other";

export interface SettlementInstrumentMeta {
  instrument_type?: "cash" | "cheque" | "bank_transfer" | "card" | "other" | null;
  instrument_no?: string | null;
  instrument_date?: string | null;
  bank_name?: string | null;
  reference_no?: string | null;
  [key: string]: unknown;
}

export interface SettlementAllocationInput {
  document_id: string;
  amount: MoneyString;
  discount?: MoneyString | null;
  withholding?: MoneyString | null;
  writeoff?: MoneyString | null;
  expected_settlement_version?: number | null;
}

export interface SettlementAllocationFact {
  id: string;
  companyId: string;
  voucherId: string;
  voucherType: SettlementVoucherType;
  targetDocumentId: string;
  partyId: string | null;
  component: SettlementAllocationComponent;
  amount: MoneyString;
  amountPaisa: number;
  currency: string;
  status: "posted" | "reversed";
  reversedByAllocationId?: string | null;
  createdAt: string;
  source: SettlementCommandSource;
}

export interface DocumentSettlementStateRow {
  id: string;
  companyId: string;
  settlementVersion: number;
  updatedAt: string;
}

export interface PartyAdvanceStateRow {
  id: string;
  companyId: string;
  partyId: string;
  side: AdvancePartySide;
  remainingAmount: MoneyString;
  remainingPaisa: number;
  currency: string;
  advanceVersion: number;
  status: "open" | "fully_applied" | "cancelled";
  sourceVoucherId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface UnappliedBalanceRow {
  id: string;
  companyId: string;
  partyId: string | null;
  classification: UnappliedBalanceClassification;
  amount: MoneyString;
  amountPaisa: number;
  currency: string;
  sourceVoucherId: string;
  advanceId: string | null;
  status: "open" | "applied" | "reversed";
  createdAt: string;
}

export type SettlementPostingResultType =
  | "posting_completed"
  | "posting_denied"
  | "posting_conflict"
  | "posting_failed";

export interface SettlementPostingSuccessBase {
  posting_id: string;
  voucher_id: string;
  voucher_number: string;
  voucher_type: SettlementVoucherType;
  amount: MoneyString;
  currency: string;
  posted_at: string;
  idempotent_replay: boolean;
  sync_status:
    | "pending"
    | "disabled"
    | "syncing"
    | "synced"
    | "failed"
    | "conflict"
    | "waiting_to_sync"
    | "offline_will_sync";
  sync_event_id?: string | null;
  audit_id?: string | null;
  receipt_id?: string | null;
  draft_id?: string | null;
  allocation_ids?: string[];
  advance_ids?: string[];
}

export type SettlementPostingResult<
  TSuccess extends SettlementPostingSuccessBase = SettlementPostingSuccessBase,
> =
  | {
      type: "posting_completed";
      status: "success";
      payload: TSuccess;
    }
  | {
      type: "posting_denied" | "posting_conflict" | "posting_failed";
      status: "failed";
      payload: {
        error_code: string;
        safe_message: string;
        rolled_back: boolean;
        draft_retained: boolean;
        retryable: boolean;
        draft_id?: string | null;
        conflict_category?: SettlementConflictCategory;
      };
    };
