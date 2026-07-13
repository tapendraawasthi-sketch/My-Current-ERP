/**
 * Phase 10 treasury / bank-reconciliation domain types.
 * Money amounts are decimal strings (2 dp) unless noted as paisa.
 */

export type MoneyString = string;

export type TreasuryCommandSource =
  | "orbix"
  | "manual_form"
  | "import"
  | "test"
  | "remote_sync";

export type StatementSourceType =
  | "csv_import"
  | "manual_entry"
  | "api_feed"
  | "ofx"
  | "e2e_fixture"
  | "test_fixture";

export type StatementBatchStatus =
  | "draft"
  | "imported"
  | "superseded"
  | "closed"
  | "rejected";

export type StatementLineStatus =
  | "unmatched"
  | "suggested"
  | "partially_matched"
  | "matched"
  | "excluded"
  | "adjusted";

export type MatchType =
  | "one_to_one"
  | "one_to_many"
  | "many_to_one"
  | "manual"
  | "adjustment_link";

export type MatchMethod =
  | "exact_bank_transaction_id"
  | "exact_cheque_number"
  | "exact_normalized_reference"
  | "exact_amount_date"
  | "amount_date_tolerance"
  | "grouped_suggestion"
  | "manual_confirm"
  | "adjustment_post";

export type ReconciliationLinkStatus =
  | "suggested"
  | "confirmed"
  | "reversed"
  | "superseded";

/** Issued (company writes cheque) and received (customer/supplier cheque) lifecycles. */
export type ChequeInstrumentType = "issued" | "received";

export type ChequeState =
  | "draft"
  | "issued"
  | "received"
  | "deposited"
  | "cleared"
  | "bounced"
  | "cancelled"
  | "stopped"
  | "expired";

export type ReconciliationSessionStatus =
  | "open"
  | "in_progress"
  | "closed"
  | "reopened";

export type TreasuryWarningCode =
  | "min_balance_breach"
  | "overdraft_used"
  | "currency_mismatch"
  | "duplicate_statement_batch"
  | "overmatch"
  | "stale_statement_line_version"
  | "stale_cheque_version"
  | "stale_session_version"
  | "nonzero_recon_difference"
  | "uncleared_instruments"
  | "period_locked"
  | "permission_denied";

export type TreasuryConflictCategory =
  | "stale_statement_line_version"
  | "stale_cheque_version"
  | "stale_session_version"
  | "overmatch"
  | "duplicate_source_hash"
  | "bank_account_mismatch"
  | "currency_mismatch"
  | "company_mismatch"
  | "session_not_open"
  | "session_already_closed"
  | "invalid_cheque_transition"
  | "period_locked"
  | "permission_denied"
  | "device_not_authorized"
  | "duplicate_idempotency"
  | "duplicate_idempotency_key"
  | "payload_hash_mismatch"
  | "unsupported_schema_version"
  | "duplicate_event"
  | "document_not_found"
  | "account_mapping_missing";

export type BankAdjustmentType =
  | "bank_charge"
  | "bank_interest"
  | "direct_deposit"
  | "direct_debit"
  | "bank_transfer";

export type TreasuryPostingResultType =
  | "posting_completed"
  | "posting_denied"
  | "posting_conflict"
  | "posting_failed";

export interface TreasuryPostingSuccessBase {
  posting_id: string;
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
}

export type TreasuryPostingResult<
  TSuccess extends TreasuryPostingSuccessBase = TreasuryPostingSuccessBase,
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
        conflict_category?: TreasuryConflictCategory;
        warning_codes?: TreasuryWarningCode[];
      };
    };

export interface BankAccountRow {
  id: string;
  companyId: string;
  ledgerAccountId: string;
  name: string;
  currency: string;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  minBalancePaisa?: number | null;
  overdraftLimitPaisa?: number | null;
  lastReconciledDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankStatementBatchRow {
  id: string;
  companyId: string;
  bankAccountId: string;
  sourceType: StatementSourceType;
  sourceHash: string;
  status: StatementBatchStatus;
  periodStart: string;
  periodEnd: string;
  currency: string;
  openingBalancePaisa?: number | null;
  closingBalancePaisa?: number | null;
  lineCount: number;
  importedAt: string;
  supersededByBatchId?: string | null;
  createdBy: string;
  version: number;
}

export interface BankStatementLineRow {
  id: string;
  batchId: string;
  bankAccountId: string;
  companyId: string;
  lineNumber: number;
  transactionDate: string;
  valueDate?: string | null;
  description: string;
  reference?: string | null;
  bankTransactionId?: string | null;
  debitPaisa: number;
  creditPaisa: number;
  /** Signed: credit positive (inflow), debit negative (outflow). */
  signedAmountPaisa: number;
  balancePaisa?: number | null;
  status: StatementLineStatus;
  remainingMatchPaisa: number;
  reconciliationVersion: number;
  rawHash: string;
  currency: string;
}

export interface BankReconciliationLinkRow {
  id: string;
  companyId: string;
  bankAccountId: string;
  sessionId?: string | null;
  statementLineId: string;
  /** ERP voucher / cheque / adjustment target ids */
  erpDocumentIds: string[];
  matchedAmountPaisa: number;
  matchType: MatchType;
  matchMethod: MatchMethod;
  status: ReconciliationLinkStatus;
  version: number;
  confidence?: number | null;
  explanation?: string | null;
  confirmedAt?: string | null;
  reversedAt?: string | null;
  createdAt: string;
  createdBy: string;
}

export interface BankReconciliationSessionRow {
  id: string;
  companyId: string;
  bankAccountId: string;
  status: ReconciliationSessionStatus;
  version: number;
  periodStart: string;
  periodEnd: string;
  statementBalancePaisa: number;
  bookBalancePaisa: number;
  clearedBalancePaisa: number;
  differencePaisa: number;
  currency: string;
  openedAt: string;
  closedAt?: string | null;
  reopenedAt?: string | null;
  openedBy: string;
  closedBy?: string | null;
}

export interface ChequeInstrumentRow {
  id: string;
  companyId: string;
  bankAccountId: string;
  partyId?: string | null;
  instrumentType: ChequeInstrumentType;
  instrumentNumber: string;
  status: ChequeState;
  instrumentVersion: number;
  amountPaisa: number;
  currency: string;
  chequeDate: string;
  /** Phase 9 voucher that recorded issue/receive accounting. */
  sourceVoucherId?: string | null;
  bounceVoucherId?: string | null;
  clearedStatementLineId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryForecastItemRow {
  id: string;
  companyId: string;
  date: string;
  side: "inflow" | "outflow";
  amountPaisa: number;
  confidence: "committed" | "expected";
  status: "open" | "realized" | "cancelled";
  label?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}
