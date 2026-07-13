/**
 * Phase 5–6 accounting synchronization event contract.
 * Extends the existing SyncEventEnvelope; does not fork a second schema.
 */

import type { EntityId, JsonObject } from "@fios/kernel";
import { computeEventChainHash, computePayloadHash } from "./payloadHash";
import type { SyncEventEnvelope } from "./syncServerContracts";

export const ACCOUNTING_SYNC_SCHEMA_VERSION = "1.0";

export type BankReconciliationEventType =
  | "bank_statement_imported"
  | "bank_reconciliation_matched"
  | "bank_reconciliation_unmatched"
  | "bank_reconciliation_closed"
  | "bank_reconciliation_reopened"
  | "cheque_status_changed"
  | "bank_adjustment_linked";

export type FinancialEventType =
  | "receipt_posted"
  | "payment_posted"
  | "contra_posted"
  | "journal_posted"
  | "settlement_allocated"
  | "advance_applied"
  | "settlement_reversed"
  | BankReconciliationEventType;

export type AccountingEventType =
  | "purchase_posted"
  | "sales_posted"
  | "sales_return_posted"
  | "sales_credit_note_posted"
  | "purchase_return_posted"
  | "supplier_debit_note_posted"
  | FinancialEventType;

export type SyncOrigin = "local_user" | "remote_sync" | "import" | "migration";

export type AccountingSyncStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict"
  | "dead_letter";

export interface PurchasePostedPayload {
  posting_id: string;
  invoice_id: string;
  invoice_number: string;
  voucher_id: string;
  voucher_number: string;
  stock_movement_ids: string[];
  audit_id: string | null;
  transaction_date: string;
  party_id: string | null;
  party_name: string | null;
  payment_method: string;
  item_lines: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  journal_lines?: Array<Record<string, unknown>>;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    grand_total: number;
  };

  currency: string;
  user_id: string;
  company_id: string;
  financial_year_id: string | null;
  local_idempotency_key: string;
  device_id: string;
  source: string;
  aggregate_version: number;
  receipt_id?: string | null;
  narration?: string;
}

export interface SalesPostedPayload {
  posting_id: string;
  invoice_id: string;
  invoice_number: string;
  voucher_id: string;
  voucher_number: string;
  stock_movement_ids: string[];
  audit_id: string | null;
  transaction_date: string;
  party_id: string | null;
  party_name: string | null;
  payment_method: string;
  payment_account_id?: string | null;
  classification?: string;
  warehouse_id?: string | null;
  item_lines: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    cost_rate?: number;
    cogs_amount?: number;
    valuation_method?: string;
    tax_treatment?: string;
    vat_amount?: number;
    cost_layers?: Array<{
      layer_id: string;
      source_purchase_id: string | null;
      quantity_consumed: string;
      unit_cost: string;
      cost: string;
    }>;
  }>;
  journal_lines?: Array<Record<string, unknown>>;
  cogs_journal_lines?: Array<Record<string, unknown>>;
  cogs_voucher_id?: string | null;
  accounting_policy?: {
    inventory_accounting?: string;
    valuation_method?: string;
  };

  tax_rule_version?: string | null;
  price_mode?: string;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    grand_total: number;
    taxable_amount?: number;
    exempt_amount?: number;
    cogs_total?: number;
  };

  currency: string;
  user_id: string;
  company_id: string;
  financial_year_id: string | null;
  local_idempotency_key: string;
  device_id: string;
  source: string;
  aggregate_version: number;
  receipt_id?: string | null;
  narration?: string;
}

export interface SalesAdjustmentPostedPayload {
  posting_id: string;
  invoice_id: string;
  invoice_number: string;
  voucher_id: string;
  voucher_number: string;
  voucher_ids?: string[];
  stock_movement_ids: string[];
  audit_id: string | null;
  transaction_date: string;
  adjustment_type: "inventory_sales_return" | "financial_credit_note";
  original_invoice_id: string;
  original_invoice_number: string;
  original_posting_id?: string | null;
  party_id: string | null;
  party_name: string | null;
  reason_code: string;
  settlement_method: string;
  settlement_account_id?: string | null;
  warehouse_id?: string | null;
  item_lines: Array<{
    original_sales_line_id: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    taxable_amount?: number;
    vat_amount?: number;
    unit_cost?: number;
    cost_amount?: number;
    tax_rule_version?: string | null;
    valuation_method?: string | null;
    stock_condition?: string | null;
  }>;
  journal_lines?: Array<Record<string, unknown>>;
  cogs_journal_lines?: Array<Record<string, unknown>>;
  cogs_voucher_id?: string | null;
  accounting_policy?: {
    inventory_accounting?: string;
    valuation_method?: string;
  };
  tax_rule_version?: string | null;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    taxable_amount?: number;
    exempt_amount?: number;
    grand_total: number;
    cogs_total?: number;
    revenue_reversal?: number;
    vat_reversal?: number;
    cost_reversal?: number;
  };
  currency: string;
  user_id: string;
  company_id: string;
  financial_year_id: string | null;
  local_idempotency_key: string;
  device_id: string;
  source: string;
  /** Version after this adjustment was applied */
  aggregate_version: number;
  adjustment_version_before: number;
  receipt_id?: string | null;
  narration?: string;
}

export interface PurchaseAdjustmentPostedPayload {
  posting_id: string;
  invoice_id: string;
  invoice_number: string;
  voucher_id: string;
  voucher_number: string;
  voucher_ids?: string[];
  stock_movement_ids: string[];
  audit_id: string | null;
  transaction_date: string;
  adjustment_type: "inventory_purchase_return" | "financial_supplier_debit_note";
  original_invoice_id: string;
  original_invoice_number: string;
  original_posting_id?: string | null;
  party_id: string | null;
  party_name: string | null;
  reason_code: string;
  settlement_method: string;
  settlement_account_id?: string | null;
  warehouse_id?: string | null;
  item_lines: Array<{
    original_purchase_line_id: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    taxable_amount?: number;
    vat_amount?: number;
    unit_cost?: number;
    cost_amount?: number;
    tax_rule_version?: string | null;
    valuation_method?: string | null;
    stock_condition?: string | null;
  }>;
  journal_lines?: Array<Record<string, unknown>>;
  inventory_journal_lines?: Array<Record<string, unknown>>;
  inventory_voucher_id?: string | null;
  accounting_policy?: {
    inventory_accounting?: string;
    valuation_method?: string;
  };
  tax_rule_version?: string | null;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    taxable_amount?: number;
    exempt_amount?: number;
    grand_total: number;
    cost_total?: number;
    purchase_reversal?: number;
    vat_reversal?: number;
    cost_reversal?: number;
  };
  currency: string;
  user_id: string;
  company_id: string;
  financial_year_id: string | null;
  local_idempotency_key: string;
  device_id: string;
  source: string;
  /** Version after this adjustment was applied */
  aggregate_version: number;
  adjustment_version_before: number;
  receipt_id?: string | null;
  narration?: string;
}


export interface FinancialTransactionPostedPayload {
  posting_id: string;
  voucher_id: string;
  voucher_number: string;
  voucher_type: "receipt" | "payment" | "contra" | "journal" | string;
  transaction_date: string;
  party_id: string | null;
  party_name?: string | null;
  receipt_type?: string;
  payment_type?: string;
  contra_type?: string;
  cash_or_bank_account_id?: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
  reverses_voucher_id?: string | null;
  amounts: {
    amount: string;
    bank_charges?: string;
    withholding?: string;
    discount?: string;
    writeoff?: string;
    advance?: string;
  };
  journal_lines?: Array<Record<string, unknown>>;
  allocations?: Array<Record<string, unknown>>;
  advance_ids?: string[];
  instrument?: Record<string, unknown> | null;
  settlement_versions?: Record<string, number>;
  audit_id?: string | null;
  currency: string;
  user_id: string;
  company_id: string;
  financial_year_id: string | null;
  local_idempotency_key: string;
  device_id: string;
  source: string;
  aggregate_version: number;
  receipt_id?: string | null;
  narration?: string;
}

/** Phase 10 bank reconciliation / cheque / treasury sync payload. */
/** Bounded statement-line facts for remote upsert (never rematch on Device B). */
export interface BankStatementLineSyncFact {
  id: string;
  line_number: number;
  transaction_date?: string;
  value_date?: string | null;
  description?: string;
  reference?: string | null;
  bank_transaction_id?: string | null;
  debit_paisa?: number;
  credit_paisa?: number;
  signed_amount_paisa?: number;
  balance_paisa?: number | null;
  raw_hash?: string;
  reconciliation_version?: number;
  status?: string;
  remaining_match_paisa?: number;
  currency?: string;
}

export interface BankReconciliationPostedPayload {
  posting_id: string;
  bank_account_id: string;
  session_id?: string | null;
  batch_id?: string | null;
  source_hash?: string | null;
  link_id?: string | null;
  statement_line_id?: string | null;
  cheque_id?: string | null;
  voucher_id?: string | null;
  voucher_number?: string | null;
  transaction_date?: string;
  amounts?: {
    amount?: string;
    matched_amount?: string;
    statement_balance?: string;
    book_balance?: string;
    difference?: string;
  };
  /** Facts-only line rows for bank_statement_imported (bounded; no rematch). */
  statement_lines?: BankStatementLineSyncFact[];
  erp_document_ids?: string[];
  statement_line_version?: number;
  cheque_version?: number;
  session_version?: number;
  expected_statement_line_version?: number;
  expected_cheque_version?: number;
  expected_session_version?: number;
  match_type?: string;
  adjustment_type?: string;
  cheque_status_from?: string;
  cheque_status_to?: string;
  /** Cheque create-if-missing facts (cheque_status_changed). */
  instrument_number?: string;
  instrument_type?: string;
  amount_paisa?: number;
  party_id?: string | null;
  cheque_date?: string;
  audit_id?: string | null;
  currency: string;
  user_id: string;
  company_id: string;
  financial_year_id: string | null;
  local_idempotency_key: string;
  device_id: string;
  source: string;
  aggregate_version: number;
  receipt_id?: string | null;
  narration?: string;
}

export type AccountingPostedPayload =
  | PurchasePostedPayload
  | SalesPostedPayload
  | SalesAdjustmentPostedPayload
  | PurchaseAdjustmentPostedPayload
  | FinancialTransactionPostedPayload
  | BankReconciliationPostedPayload;

export function isSalesAdjustmentEventType(
  eventType: string | null | undefined,
): eventType is "sales_return_posted" | "sales_credit_note_posted" {
  return eventType === "sales_return_posted" || eventType === "sales_credit_note_posted";
}

export function isPurchaseAdjustmentEventType(
  eventType: string | null | undefined,
): eventType is "purchase_return_posted" | "supplier_debit_note_posted" {
  return eventType === "purchase_return_posted" || eventType === "supplier_debit_note_posted";
}

export function isBankReconciliationEventType(
  eventType: string | null | undefined,
): eventType is BankReconciliationEventType {
  return (
    eventType === "bank_statement_imported" ||
    eventType === "bank_reconciliation_matched" ||
    eventType === "bank_reconciliation_unmatched" ||
    eventType === "bank_reconciliation_closed" ||
    eventType === "bank_reconciliation_reopened" ||
    eventType === "cheque_status_changed" ||
    eventType === "bank_adjustment_linked"
  );
}

export function isSettlementFinancialEventType(
  eventType: string | null | undefined,
): boolean {
  return (
    eventType === "receipt_posted" ||
    eventType === "payment_posted" ||
    eventType === "contra_posted" ||
    eventType === "journal_posted" ||
    eventType === "settlement_allocated" ||
    eventType === "advance_applied" ||
    eventType === "settlement_reversed"
  );
}

export function isFinancialEventType(
  eventType: string | null | undefined,
): eventType is FinancialEventType {
  return isSettlementFinancialEventType(eventType) || isBankReconciliationEventType(eventType);
}

export function isSupportedAccountingEventType(
  eventType: string | null | undefined,
): eventType is AccountingEventType {
  return (
    eventType === "purchase_posted" ||
    eventType === "sales_posted" ||
    isSalesAdjustmentEventType(eventType) ||
    isPurchaseAdjustmentEventType(eventType) ||
    isFinancialEventType(eventType)
  );
}

export interface AccountingSyncEvent {
  schema_version: typeof ACCOUNTING_SYNC_SCHEMA_VERSION;
  event_id: string;
  event_type: AccountingEventType;
  aggregate_type: "purchase" | "sale" | "settlement" | "treasury";
  aggregate_id: string;
  aggregate_version: number;
  tenant_id: string;
  company_id: string;
  financial_year_id: string | null;
  device_id: string;
  user_id: string;
  source: string;
  origin: SyncOrigin;
  local_sequence: number;
  occurred_at: string;
  recorded_at: string;
  idempotency_key: string;
  correlation_id: string;
  causation_id: string | null;
  payload: AccountingPostedPayload;
  integrity: {
    payload_hash: string;
    previous_event_hash: string | null;
    event_hash: string;
    signature: string | null;
  };

  sync: {
    status: AccountingSyncStatus;
    attempt_count: number;
    next_attempt_at: string | null;
    last_attempt_at: string | null;
    last_error_code: string | null;
    remote_event_id: string | null;
    remote_sequence: number | null;
    acknowledged_at: string | null;
  };

}

export async function buildPurchasePostedEvent(input: {
  eventId: string;
  tenantId: string;
  companyId: string;
  financialYearId: string | null;
  deviceId: string;
  userId: string;
  source: string;
  localSequence: number;
  previousEventHash: string | null;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  payload: PurchasePostedPayload;
  occurredAt?: string;
}): Promise<AccountingSyncEvent> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const recordedAt = new Date().toISOString();
  const payloadHash = await computePayloadHash(input.payload);
  const eventHash = await computeEventChainHash({
    previousEventHash: input.previousEventHash,
    payloadHash,
    eventId: input.eventId,
    eventType: "purchase_posted",
    aggregateId: input.payload.invoice_id,
    aggregateVersion: input.payload.aggregate_version,
    localSequence: input.localSequence,
    companyId: input.companyId,
    deviceId: input.deviceId,
    occurredAt,
  });

  return {
    schema_version: ACCOUNTING_SYNC_SCHEMA_VERSION,
    event_id: input.eventId,
    event_type: "purchase_posted",
    aggregate_type: "purchase",
    aggregate_id: input.payload.invoice_id,
    aggregate_version: input.payload.aggregate_version,
    tenant_id: input.tenantId,
    company_id: input.companyId,
    financial_year_id: input.financialYearId,
    device_id: input.deviceId,
    user_id: input.userId,
    source: input.source,
    origin: "local_user",
    local_sequence: input.localSequence,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    payload: input.payload,
    integrity: {
      payload_hash: payloadHash,
      previous_event_hash: input.previousEventHash,
      event_hash: eventHash,
      signature: null,
    },
    sync: {
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
      last_attempt_at: null,
      last_error_code: null,
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
    },
  };

}

export async function buildSalesPostedEvent(input: {
  eventId: string;
  tenantId: string;
  companyId: string;
  financialYearId: string | null;
  deviceId: string;
  userId: string;
  source: string;
  localSequence: number;
  previousEventHash: string | null;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  payload: SalesPostedPayload;
  occurredAt?: string;
}): Promise<AccountingSyncEvent> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const recordedAt = new Date().toISOString();
  const payloadHash = await computePayloadHash(input.payload);
  const eventHash = await computeEventChainHash({
    previousEventHash: input.previousEventHash,
    payloadHash,
    eventId: input.eventId,
    eventType: "sales_posted",
    aggregateId: input.payload.invoice_id,
    aggregateVersion: input.payload.aggregate_version,
    localSequence: input.localSequence,
    companyId: input.companyId,
    deviceId: input.deviceId,
    occurredAt,
  });

  return {
    schema_version: ACCOUNTING_SYNC_SCHEMA_VERSION,
    event_id: input.eventId,
    event_type: "sales_posted",
    aggregate_type: "sale",
    aggregate_id: input.payload.invoice_id,
    aggregate_version: input.payload.aggregate_version,
    tenant_id: input.tenantId,
    company_id: input.companyId,
    financial_year_id: input.financialYearId,
    device_id: input.deviceId,
    user_id: input.userId,
    source: input.source,
    origin: "local_user",
    local_sequence: input.localSequence,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    payload: input.payload,
    integrity: {
      payload_hash: payloadHash,
      previous_event_hash: input.previousEventHash,
      event_hash: eventHash,
      signature: null,
    },
    sync: {
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
      last_attempt_at: null,
      last_error_code: null,
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
    },
  };

}

export async function buildSalesAdjustmentPostedEvent(input: {
  eventId: string;
  tenantId: string;
  companyId: string;
  financialYearId: string | null;
  deviceId: string;
  userId: string;
  source: string;
  localSequence: number;
  previousEventHash: string | null;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  eventType: "sales_return_posted" | "sales_credit_note_posted";
  payload: SalesAdjustmentPostedPayload;
  occurredAt?: string;
}): Promise<AccountingSyncEvent> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const recordedAt = new Date().toISOString();
  const payloadHash = await computePayloadHash(input.payload);
  const eventHash = await computeEventChainHash({
    previousEventHash: input.previousEventHash,
    payloadHash,
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateId: input.payload.invoice_id,
    aggregateVersion: input.payload.aggregate_version,
    localSequence: input.localSequence,
    companyId: input.companyId,
    deviceId: input.deviceId,
    occurredAt,
  });

  return {
    schema_version: ACCOUNTING_SYNC_SCHEMA_VERSION,
    event_id: input.eventId,
    event_type: input.eventType,
    aggregate_type: "sale",
    aggregate_id: input.payload.invoice_id,
    aggregate_version: input.payload.aggregate_version,
    tenant_id: input.tenantId,
    company_id: input.companyId,
    financial_year_id: input.financialYearId,
    device_id: input.deviceId,
    user_id: input.userId,
    source: input.source,
    origin: "local_user",
    local_sequence: input.localSequence,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    payload: input.payload,
    integrity: {
      payload_hash: payloadHash,
      previous_event_hash: input.previousEventHash,
      event_hash: eventHash,
      signature: null,
    },
    sync: {
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
      last_attempt_at: null,
      last_error_code: null,
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
    },
  };
}

export async function buildPurchaseAdjustmentPostedEvent(input: {
  eventId: string;
  tenantId: string;
  companyId: string;
  financialYearId: string | null;
  deviceId: string;
  userId: string;
  source: string;
  localSequence: number;
  previousEventHash: string | null;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  eventType: "purchase_return_posted" | "supplier_debit_note_posted";
  payload: PurchaseAdjustmentPostedPayload;
  occurredAt?: string;
}): Promise<AccountingSyncEvent> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const recordedAt = new Date().toISOString();
  const payloadHash = await computePayloadHash(input.payload);
  const eventHash = await computeEventChainHash({
    previousEventHash: input.previousEventHash,
    payloadHash,
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateId: input.payload.invoice_id,
    aggregateVersion: input.payload.aggregate_version,
    localSequence: input.localSequence,
    companyId: input.companyId,
    deviceId: input.deviceId,
    occurredAt,
  });

  return {
    schema_version: ACCOUNTING_SYNC_SCHEMA_VERSION,
    event_id: input.eventId,
    event_type: input.eventType,
    aggregate_type: "purchase",
    aggregate_id: input.payload.invoice_id,
    aggregate_version: input.payload.aggregate_version,
    tenant_id: input.tenantId,
    company_id: input.companyId,
    financial_year_id: input.financialYearId,
    device_id: input.deviceId,
    user_id: input.userId,
    source: input.source,
    origin: "local_user",
    local_sequence: input.localSequence,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    payload: input.payload,
    integrity: {
      payload_hash: payloadHash,
      previous_event_hash: input.previousEventHash,
      event_hash: eventHash,
      signature: null,
    },
    sync: {
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
      last_attempt_at: null,
      last_error_code: null,
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
    },
  };
}


function resolveFinancialAggregateId(
  payload: FinancialTransactionPostedPayload | BankReconciliationPostedPayload,
): string {
  const p = payload as unknown as Record<string, unknown>;
  return String(
    p.voucher_id ||
      p.link_id ||
      p.session_id ||
      p.batch_id ||
      p.cheque_id ||
      p.statement_line_id ||
      p.posting_id ||
      "",
  );
}

export async function buildFinancialPostedEvent(input: {
  eventId: string;
  tenantId: string;
  companyId: string;
  financialYearId: string | null;
  deviceId: string;
  userId: string;
  source: string;
  localSequence: number;
  previousEventHash: string | null;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  eventType: FinancialEventType;
  payload: FinancialTransactionPostedPayload | BankReconciliationPostedPayload;
  occurredAt?: string;
}): Promise<AccountingSyncEvent> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const recordedAt = new Date().toISOString();
  const payloadHash = await computePayloadHash(input.payload);
  const aggregateId = resolveFinancialAggregateId(input.payload);
  const isBank = isBankReconciliationEventType(input.eventType);
  const eventHash = await computeEventChainHash({
    previousEventHash: input.previousEventHash,
    payloadHash,
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateId,
    aggregateVersion: input.payload.aggregate_version,
    localSequence: input.localSequence,
    companyId: input.companyId,
    deviceId: input.deviceId,
    occurredAt,
  });

  return {
    schema_version: ACCOUNTING_SYNC_SCHEMA_VERSION,
    event_id: input.eventId,
    event_type: input.eventType,
    aggregate_type: isBank ? "treasury" : "settlement",
    aggregate_id: aggregateId,
    aggregate_version: input.payload.aggregate_version,
    tenant_id: input.tenantId,
    company_id: input.companyId,
    financial_year_id: input.financialYearId,
    device_id: input.deviceId,
    user_id: input.userId,
    source: input.source,
    origin: "local_user",
    local_sequence: input.localSequence,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    payload: input.payload,
    integrity: {
      payload_hash: payloadHash,
      previous_event_hash: input.previousEventHash,
      event_hash: eventHash,
      signature: null,
    },
    sync: {
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
      last_attempt_at: null,
      last_error_code: null,
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
    },
  };
}

/** Map Phase 5-8 event -> existing SyncEventEnvelope for transport compatibility. */
export function accountingEventToEnvelope(event: AccountingSyncEvent): SyncEventEnvelope {
  const businessKey =
    event.event_type === "sales_posted"
      ? "sale"
      : isSalesAdjustmentEventType(event.event_type)
        ? "sale_adjustment"
        : isPurchaseAdjustmentEventType(event.event_type)
          ? "purchase_adjustment"
          : isBankReconciliationEventType(event.event_type)
            ? "treasury"
            : isFinancialEventType(event.event_type)
              ? "settlement"
              : "purchase";
  return {
    eventId: event.event_id as EntityId,
    globalSequence: event.local_sequence,
    aggregateId: event.aggregate_id as EntityId,
    aggregateType: event.aggregate_type,
    aggregateVersion: event.aggregate_version,
    tenantId: event.tenant_id as EntityId,
    principalId: event.user_id as EntityId,
    timestamp: event.occurred_at,
    eventType: event.event_type,
    payload: {
      schema_version: event.schema_version,
      company_id: event.company_id,
      financial_year_id: event.financial_year_id,
      device_id: event.device_id,
      source: event.source,
      origin: event.origin,
      local_sequence: event.local_sequence,
      idempotency_key: event.idempotency_key,
      integrity: event.integrity,
      [businessKey]: event.payload,
    } as JsonObject,
    correlationId: event.correlation_id as EntityId,
    causationId: (event.causation_id ?? undefined) as EntityId | undefined,
    hash: event.integrity.event_hash,
    signature: event.integrity.signature ?? "",
  };
}

export async function verifyAccountingEnvelopeIntegrity(
  envelope: SyncEventEnvelope,
): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!envelope.eventId || !envelope.hash || !envelope.eventType) {
    return { ok: false, code: "invalid_schema" };
  }

  if (!isSupportedAccountingEventType(envelope.eventType)) {
    return { ok: false, code: "unsupported_event_version" };
  }

  const payload = envelope.payload as Record<string, unknown>;
  const integrity = payload.integrity as
    | { payload_hash?: string; previous_event_hash?: string | null; event_hash?: string }
    | undefined;
  const business =
    envelope.eventType === "sales_posted"
      ? payload.sale ?? payload.purchase
      : isSalesAdjustmentEventType(envelope.eventType)
        ? payload.sale_adjustment ?? payload.sale ?? payload.purchase
        : isPurchaseAdjustmentEventType(envelope.eventType)
          ? payload.purchase_adjustment ?? payload.purchase ?? payload.sale
          : isBankReconciliationEventType(envelope.eventType)
            ? payload.treasury ?? payload.financial ?? payload.settlement ?? payload
            : isFinancialEventType(envelope.eventType)
              ? payload.financial ?? payload.settlement ?? payload.purchase ?? payload.sale
              : payload.purchase ?? payload.sale;
  if (!integrity?.payload_hash || !business) {
    return { ok: false, code: "invalid_schema" };
  }

  const expectedPayloadHash = await computePayloadHash(business);
  if (expectedPayloadHash !== integrity.payload_hash) {
    return { ok: false, code: "integrity_hash_mismatch" };
  }

  if (integrity.event_hash && integrity.event_hash !== envelope.hash) {
    return { ok: false, code: "integrity_hash_mismatch" };
  }

  return { ok: true };
}
