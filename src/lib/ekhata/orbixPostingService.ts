/**
 * Authoritative Orbix posting service — Model B (local-first Dexie).
 *
 * Inventory purchases → postPurchaseTransaction (same engine as manual purchase invoices).
 * Inventory sales → postSalesTransaction (same engine as manual sales invoices).
 * Non-inventory khata intents → confirmKhataViaProposal / confirmKhataEntry.
 *
 * UI must not write vouchers/journals/stock directly.
 */

import { confirmKhataViaProposal } from "../../domains/nios";
import type { KhataConfirmationCard } from "./types";
import { ORBIX_QWEN_URL } from "./orbixQwenClient";
import type { OrbixOperatingMode } from "./orbixOperatingMode";
import { isAccountantOrAdmin } from "../permissions";
import { useStore } from "@/store/useStore";
import {
  isInventoryPurchaseIntent,
  postPurchaseTransaction,
  resolveInventoryItemForPurchase,
  type PurchasePostingResult,
} from "@/domains/purchase/postPurchaseTransaction";
import {
  isInventorySalesIntent,
  postSalesTransaction,
  resolveInventoryItemForSale,
  E2E_SALES_CUSTOMER_ID,
  E2E_SALES_CUSTOMER_NAME,
  type SalesPostingResult,
} from "@/domains/sales/postSalesTransaction";
import {
  isSalesAdjustmentIntent,
  postSalesAdjustmentTransaction,
  type SalesAdjustmentPostingResult,
  type SalesAdjustmentSettlementMethod,
} from "@/domains/sales/postSalesAdjustmentTransaction";
import {
  isPurchaseAdjustmentIntent,
  postPurchaseAdjustmentTransaction,
  type PurchaseAdjustmentPostingResult,
  type PurchaseAdjustmentSettlementMethod,
} from "@/domains/purchase/postPurchaseAdjustmentTransaction";
import {
  postReceiptTransaction,
  type ReceiptPostingResult,
} from "@/domains/settlement/postReceiptTransaction";
import {
  postPaymentTransaction,
  type PaymentPostingResult,
} from "@/domains/settlement/postPaymentTransaction";
import {
  postContraTransaction,
  type ContraPostingResult,
} from "@/domains/settlement/postContraTransaction";
import {
  postJournalTransaction,
  type JournalPostingResult,
} from "@/domains/settlement/postJournalTransaction";
import type { ContraType, ReceiptType, PaymentType } from "@/domains/settlement/types";
import { paisaToString, parseMoneyToPaisa } from "@/domains/purchase/money";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/db";
import { createStatementBatch } from "@/domains/treasury/statementBatch";
import { confirmBankMatch } from "@/domains/treasury/postConfirmBankMatch";
import { reverseBankMatch } from "@/domains/treasury/postReverseBankMatch";
import { postBankAdjustmentFromStatement } from "@/domains/treasury/postBankAdjustmentFromStatement";
import { postChequeStatusChange } from "@/domains/treasury/chequeLifecycle";
import { closeBankReconciliation } from "@/domains/treasury/reconciliationSession";
import { computeTreasuryPosition } from "@/domains/treasury/treasuryPosition";
import {
  E2E_SAMPLE_STATEMENT_CSV,
  E2E_BANK_ACCOUNT_ID,
  E2E_BANK_LEDGER_ID,
  E2E_CUSTOMER_ID,
  E2E_RV_001_ID,
} from "@/domains/treasury/e2eSeed";
import type { BankAdjustmentType, ChequeState } from "@/domains/treasury/types";
import {
  consumeConfirmToken,
  postingSuccessHasReceipt,
  validateConfirmToken,
} from "./confirmPathAuthority";

export type OrbixPostingStage =
  | "confirmation_received"
  | "authorization_checked"
  | "validation_started"
  | "validation_completed"
  | "posting_started"
  | "voucher_created"
  | "audit_recorded"
  | "posting_completed"
  | "posting_failed"
  | "idempotent_replay";

export interface OrbixConfirmCommand {
  requestId: string;
  conversationId: string;
  draftId: string | null;
  draftVersion: number | null;
  previewVersion: string | number | null;
  previewHash: string | null;
  companyId: string | null;
  orbixMode: OrbixOperatingMode;
  idempotencyKey: string;
  confirmation: true;
  card: KhataConfirmationCard;
  /** NEXT-05 short-lived Model B confirm token (also accepted on card.confirm_token) */
  confirmToken?: string | null;
  userRole?: string | null;
  /** Development-only failure injection */
  injectFailure?: "after_validation" | "before_stock" | "before_audit" | null;
}

export interface OrbixPostingResult {
  response_type: "posting_completed" | "posting_failed" | "permission_denied" | "validation_error";
  status: "success" | "failed";
  payload: {
    draft_id: string | null;
    posting_id: string;
    voucher_id?: string | null;
    voucher_number?: string | null;
    invoice_id?: string | null;
    invoice_number?: string | null;
    journal_id?: string | null;
    stock_movement_ids?: string[];
    amount?: string | null;
    currency: string;
    posted_at?: string | null;
    idempotent_replay: boolean;
    sync_status?: string;
    sync_event_id?: string | null;
    error_code?: string;
    safe_message?: string;
    rolled_back?: boolean | null;
    retryable?: boolean;
    draft_retained?: boolean;
  };
  stages: OrbixPostingStage[];
}

export function buildIdempotencyKey(parts: {
  draftId?: string | null;
  previewHash?: string | null;
  sessionId?: string | null;
}): string {
  const base =
    parts.draftId && parts.previewHash
      ? `${parts.draftId}:${parts.previewHash}`
      : `${parts.sessionId || "session"}:${Date.now()}`;
  return `orbix-post-${base}`;
}

async function ackDraftPostedOnBackend(
  draftId: string,
  result: { voucher_number: string; posting_id: string; invoice_number?: string },
): Promise<void> {
  if (!ORBIX_QWEN_URL || !draftId || draftId === "legacy-local") return;
  try {
    const { readAccessToken } = await import("@/platform/identity/session");
    const token = readAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    await fetch(`${ORBIX_QWEN_URL}/orbix/drafts/${encodeURIComponent(draftId)}/mark-posted`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        voucher_number: result.voucher_number,
        posting_id: result.posting_id,
        posted_at: new Date().toISOString(),
        client_verified: true,
        invoice_number: result.invoice_number,
        orbix_mode: "accountant",
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* draft ack is best-effort; Dexie is authoritative */
  }
}

function mapDomainResult(
  result:
    | PurchasePostingResult
    | SalesPostingResult
    | SalesAdjustmentPostingResult
    | PurchaseAdjustmentPostingResult
    | ReceiptPostingResult
    | PaymentPostingResult
    | ContraPostingResult
    | JournalPostingResult,
  stages: OrbixPostingStage[],
  draftId: string | null,
): OrbixPostingResult {
  if (result.type === "posting_completed") {
    const nextStages: OrbixPostingStage[] = [
      ...stages,
      ...(result.payload.idempotent_replay ? (["idempotent_replay"] as const) : []),
      "voucher_created",
      "audit_recorded",
      "posting_completed",
    ];
    const payloadDraftId =
      "draft_id" in result.payload
        ? (result.payload.draft_id as string | null | undefined)
        : undefined;
    const p = result.payload as unknown as Record<string, unknown>;
    const successPayload = {
      draft_id: payloadDraftId ?? draftId,
      posting_id: String(p.posting_id),
      voucher_id: String(p.voucher_id ?? ""),
      voucher_number: String(p.voucher_number ?? ""),
      invoice_id: p.invoice_id != null ? String(p.invoice_id) : undefined,
      invoice_number: p.invoice_number != null ? String(p.invoice_number) : undefined,
      journal_id: String(p.voucher_id ?? ""),
      stock_movement_ids: Array.isArray(p.stock_movement_ids)
        ? (p.stock_movement_ids as string[])
        : undefined,
      amount: p.amount != null ? String(p.amount) : null,
      currency: String(p.currency || "NPR"),
      posted_at: p.posted_at != null ? String(p.posted_at) : null,
      idempotent_replay: Boolean(p.idempotent_replay),
      sync_status: p.sync_status != null ? String(p.sync_status) : undefined,
      sync_event_id:
        "sync_event_id" in p ? ((p.sync_event_id as string | null | undefined) ?? null) : null,
    };
    return enforceSuccessReceipt({
      response_type: "posting_completed",
      status: "success",
      stages: nextStages,
      payload: successPayload,
    });
  }

  const response_type =
    result.type === "posting_denied"
      ? "permission_denied"
      : result.type === "posting_conflict"
        ? "validation_error"
        : "posting_failed";

  return {
    response_type,
    status: "failed",
    stages: [...stages, "posting_failed"],
    payload: {
      draft_id: result.payload.draft_id ?? draftId,
      posting_id: draftId || "failed",
      currency: "NPR",
      idempotent_replay: false,
      error_code: result.payload.error_code,
      safe_message: result.payload.safe_message,
      rolled_back: result.payload.rolled_back,
      retryable: result.payload.retryable,
      draft_retained: result.payload.draft_retained,
    },
  };
}

/** Detect receipt / payment / contra / journal settlement intents from structured cards. */
export function isSettlementFinancialIntent(intent: string | null | undefined): boolean {
  const i = String(intent || "").toLowerCase();
  return (
    i === "khata_payment_in" ||
    i === "khata_customer_advance" ||
    i === "khata_payment_out" ||
    i === "khata_expense" ||
    i === "khata_contra_cash_bank" ||
    i === "khata_bank_charges" ||
    i === "receipt" ||
    i === "payment" ||
    i === "contra" ||
    i === "journal" ||
    i === "customer_receipt" ||
    i === "supplier_payment" ||
    i === "cash_to_bank" ||
    i === "bank_to_cash" ||
    i === "bank_to_bank" ||
    i.includes("receipt") ||
    i.includes("payment_in") ||
    i.includes("payment_out") ||
    i.includes("payment") ||
    i.includes("contra") ||
    i === "general_journal" ||
    i === "khata_opening_balance"
  );
}


async function resolvePartyIdFromCard(card: KhataConfirmationCard): Promise<string | null> {
  const explicit = (card as { party_id?: string | null }).party_id;
  if (explicit) return String(explicit);
  const name = String(card.party || "").trim();
  if (!name) return null;
  const db = getDB();
  const parties = await db.parties.toArray();
  const hit = parties.find(
    (p) => String(p.name || "").toLowerCase() === name.toLowerCase(),
  );
  return hit?.id || null;
}

async function resolveSettlementAllocations(
  allocations: Array<{
    document_id?: string;
    invoice_no?: string;
    invoiceNo?: string;
    amount: string | number;
    expected_settlement_version?: number | null;
    withholding?: string | number | null;
  }>,
): Promise<
  Array<{
    document_id: string;
    amount: string;
    expected_settlement_version?: number | null;
    withholding?: string | null;
  }>
> {
  const db = getDB();
  const out: Array<{
    document_id: string;
    amount: string;
    expected_settlement_version?: number | null;
    withholding?: string | null;
  }> = [];
  for (const a of allocations || []) {
    let docId = String(a.document_id || "").trim();
    const invNo = String(a.invoice_no || a.invoiceNo || "").trim();
    if (!docId && invNo) {
      const inv = await db.invoices.where("invoiceNo").equals(invNo).first();
      docId = inv?.id || "";
    }
    if (!docId) continue;
    out.push({
      document_id: docId,
      amount: String(a.amount),
      expected_settlement_version: a.expected_settlement_version ?? null,
      withholding: a.withholding != null ? String(a.withholding) : null,
    });
  }
  return out;
}

function detectSettlementKind(
  card: KhataConfirmationCard,
): "receipt" | "payment" | "contra" | "journal" | null {
  // Phase 10 bank-recon cards must never be routed as settlement RPCJ.
  if (detectBankReconKind(card)) return null;
  const intent = String(card.intent || "").toLowerCase();
  const tags = (card.tags || []).map((t) => String(t).toLowerCase());
  const raw = String(card.raw_text || "").toLowerCase();
  const extended = card as KhataConfirmationCard & {
    voucher_type?: string;
    settlement_kind?: string;
    allocations?: unknown[];
    from_account?: string;
    to_account?: string;
    cash_or_bank?: string;
  };

  const explicit = String(extended.settlement_kind || extended.voucher_type || "").toLowerCase();
  if (explicit === "receipt" || explicit === "payment" || explicit === "contra" || explicit === "journal") {
    return explicit;
  }
  if (
    intent === "khata_payment_in" ||
    intent === "khata_customer_advance" ||
    intent.includes("receipt") ||
    tags.includes("receipt")
  ) {
    return "receipt";
  }
  if (
    intent === "khata_payment_out" ||
    intent === "khata_expense" ||
    intent.includes("payment_out") ||
    tags.includes("payment")
  ) {
    return "payment";
  }
  if (intent === "khata_contra_cash_bank" || intent.includes("contra") || tags.includes("contra")) {
    return "contra";
  }
  if (
    intent === "khata_bank_charges" ||
    intent === "khata_opening_balance" ||
    intent === "journal" ||
    intent === "general_journal" ||
    tags.includes("journal") ||
    (Array.isArray(card.journalLines) &&
      card.journalLines.length >= 2 &&
      !isInventorySalesIntent(card.intent) &&
      !isInventoryPurchaseIntent(card.intent) &&
      !/\b(receipt|payment|contra)\b/i.test(raw))
  ) {
    // Prefer journal when multi-line JE without receipt/payment/contra signal
    if (
      Array.isArray(card.journalLines) &&
      card.journalLines.length >= 2 &&
      intent !== "khata_payment_in" &&
      intent !== "khata_payment_out" &&
      intent !== "khata_contra_cash_bank"
    ) {
      return "journal";
    }
  }
  if (isSettlementFinancialIntent(intent)) {
    if (intent.includes("contra")) return "contra";
    if (intent.includes("payment_out") || intent === "khata_expense") return "payment";
    if (intent.includes("payment_in") || intent.includes("advance") || intent.includes("receipt"))
      return "receipt";
    if (card.journalLines && card.journalLines.length >= 2) return "journal";
  }
  return null;
}

function inferPaymentMethod(card: KhataConfirmationCard): "cash" | "bank" | "credit" {
  const raw = `${card.raw_text || ""} ${(card.tags || []).join(" ")} ${card.intent || ""}`.toLowerCase();
  const paymentField = String((card as { payment?: string }).payment || "").toLowerCase();
  if (paymentField === "credit" || paymentField === "bank" || paymentField === "cash") {
    return paymentField;
  }
  if (card.intent === "khata_credit_sale" || /\bcredit|udhaar|udharo\b/.test(raw)) return "credit";
  if (/\bbank\b/.test(raw)) return "bank";
  return "cash";
}

function resolveQtyAndRate(card: KhataConfirmationCard): {
  qty: number;
  rateStr: string;
  amountStr: string;
} {
  const amountStr = paisaToString(parseMoneyToPaisa(card.amount));
  const qtyRaw = (card as { quantity?: string | number }).quantity;
  const qty = qtyRaw != null && Number(qtyRaw) > 0 ? Number(qtyRaw) : 1;
  const rateRaw = (card as { rate?: string | number }).rate;
  let rateStr = amountStr;
  if (rateRaw != null && Number(rateRaw) > 0) {
    rateStr = paisaToString(parseMoneyToPaisa(rateRaw));
  } else if (qty > 1) {
    rateStr = paisaToString(Math.round(parseMoneyToPaisa(card.amount) / qty));
  }
  return { qty, rateStr, amountStr };
}

/**
 * Purchase return / supplier debit note detector.
 * Prefers explicit purchase-side language and must be checked BEFORE the
 * (narrower) sales-adjustment detector so purchase returns are never stolen.
 */
function detectPurchaseAdjustmentIntent(card: KhataConfirmationCard): boolean {
  if (isPurchaseAdjustmentIntent(card.intent)) return true;
  const method = String((card as { method?: string }).method || "").toLowerCase();
  if (method === "purchase_return_draft") return true;
  const tags = (card.tags || []).map((t) => String(t).toLowerCase()).join(" ");
  const raw = `${card.raw_text || ""} ${tags}`.toLowerCase();
  if ((card.tags || []).some((t) => /purchase_return|supplier_debit_note|financial_supplier_debit_note/i.test(String(t)))) {
    return true;
  }
  if (/\bpurchase\s*return|debit\s*note|supplier\s*return|return(?:ed)?\s+to\s+(?:the\s+)?supplier\b/.test(raw)) {
    return true;
  }
  const hasReturn = /\breturn|firta\b/.test(raw);
  // "return … PI-…" or return with explicit purchase/supplier context
  if (hasReturn && /\bpi-[\w-]+/i.test(raw)) return true;
  if (hasReturn && /\b(purchase|supplier)\b/.test(raw)) return true;
  return false;
}

/**
 * Sales return / credit note detector.
 * Narrowed so a purchase return / supplier debit note (or bare "return" with
 * purchase/supplier/PI- context) is not misrouted to the sales adjustment path.
 */
function detectSalesAdjustmentIntent(card: KhataConfirmationCard): boolean {
  if (isSalesAdjustmentIntent(card.intent)) return true;
  // Never steal purchase returns / supplier debit notes.
  if (detectPurchaseAdjustmentIntent(card)) return false;
  const tags = (card.tags || []).map((t) => String(t).toLowerCase()).join(" ");
  const raw = `${card.raw_text || ""} ${tags}`.toLowerCase();
  const hasPurchaseContext =
    /\b(purchase|supplier)\b/.test(raw) || /\bpi-[\w-]+/i.test(raw) || /\bdebit\s*note\b/.test(raw);
  const hasSalesContext =
    /\bsales\s*return|credit[\s-]?note|si-[\w-]+|customer\b/i.test(raw);
  // Bare "return" with purchase context but no sales markers → not a sales adjustment.
  if (hasPurchaseContext && !hasSalesContext) return false;
  return /\b(sales\s*return|return|credit[\s-]?note|firta)\b/.test(raw);
}

function parseOriginalInvoiceNo(rawText: string | null | undefined): string | null {
  const text = String(rawText || "");
  const si = text.match(/\b(SI-[\w-]+)\b/i);
  if (si?.[1]) return si[1];
  const cn = text.match(/\binvoice\s+(?:no\.?|number|#)?\s*([A-Z0-9][A-Z0-9/-]*)/i);
  if (cn?.[1]) return cn[1];
  const labeled = text.match(/\boriginal\s+(?:invoice|sale)\s+(?:no\.?|number|#)?\s*([A-Z0-9][A-Z0-9/-]*)/i);
  if (labeled?.[1]) return labeled[1];
  return null;
}

function inferAdjustmentSettlement(card: KhataConfirmationCard): SalesAdjustmentSettlementMethod {
  const raw = `${card.raw_text || ""} ${(card.tags || []).join(" ")}`.toLowerCase();
  if (/\bcash\s*refund|refund\s*cash|nagad\s*refund\b/.test(raw) || /\bcash\b/.test(raw)) {
    return "cash_refund";
  }
  if (/\bbank\s*refund|refund\s*bank|\bbank\b/.test(raw)) {
    return "bank_refund";
  }
  if (/\bgoodwill|customer\s*credit|store\s*credit\b/.test(raw)) {
    return "customer_credit";
  }
  return "reduce_receivable";
}

function parseOriginalPurchaseInvoiceNo(rawText: string | null | undefined): string | null {
  const text = String(rawText || "");
  const pi = text.match(/\b(PI-[\w-]+)\b/i);
  if (pi?.[1]) return pi[1];
  const labeled = text.match(
    /\boriginal\s+(?:invoice|purchase)\s+(?:no\.?|number|#)?\s*(PI-[A-Z0-9/-]*|[A-Z0-9][A-Z0-9/-]*)/i,
  );
  if (labeled?.[1]) return labeled[1];
  const cn = text.match(/\binvoice\s+(?:no\.?|number|#)?\s*(PI-[A-Z0-9/-]*)/i);
  if (cn?.[1]) return cn[1];
  return null;
}

function inferPurchaseSettlement(card: KhataConfirmationCard): PurchaseAdjustmentSettlementMethod {
  const settlementField = String((card as { settlement?: string }).settlement || "").toLowerCase();
  if (
    (
      [
        "reduce_payable",
        "cash_refund_received",
        "bank_refund_received",
        "supplier_credit",
      ] as string[]
    ).includes(settlementField)
  ) {
    return settlementField as PurchaseAdjustmentSettlementMethod;
  }
  const raw = `${card.raw_text || ""} ${(card.tags || []).join(" ")}`.toLowerCase();
  if (/\bcash\s*refund|refund\s*cash|nagad\s*refund\b/.test(raw) || (/\brefund\b/.test(raw) && /\bcash\b/.test(raw))) {
    return "cash_refund_received";
  }
  if (/\bbank\s*refund|refund\s*bank\b/.test(raw) || (/\brefund\b/.test(raw) && /\bbank\b/.test(raw))) {
    return "bank_refund_received";
  }
  if (/\bsupplier\s*credit|store\s*credit|goodwill\b/.test(raw)) {
    return "supplier_credit";
  }
  return "reduce_payable";
}

function isFinancialSupplierDebitNoteIntent(card: KhataConfirmationCard): boolean {
  const intent = String(card.intent || "").toLowerCase();
  if (
    intent === "financial_supplier_debit_note" ||
    intent === "supplier_debit_note" ||
    intent === "debit_note" ||
    intent === "debit-note"
  ) {
    return true;
  }
  const raw = `${card.raw_text || ""} ${(card.tags || []).join(" ")}`.toLowerCase();
  const qtyRaw = (card as { quantity?: string | number }).quantity;
  const hasReturnQty = qtyRaw != null && Number(qtyRaw) > 0;
  if (/\bno\s*goods|without\s*(goods|stock|return)|pricing\s*error|rate\s*difference|goodwill\b/.test(raw)) {
    return true;
  }
  if (/\bdebit\s*note\b/.test(raw) && !/\breturn|firta\b/.test(raw) && !hasReturnQty) {
    return true;
  }
  if ((card.tags || []).some((t) => /financial_supplier_debit_note|no_goods/i.test(String(t)))) {
    return true;
  }
  return false;
}

function isFinancialCreditNoteIntent(card: KhataConfirmationCard): boolean {
  const intent = String(card.intent || "").toLowerCase();
  if (intent === "financial_credit_note" || intent === "credit_note" || intent === "credit-note") {
    return true;
  }
  const raw = `${card.raw_text || ""} ${(card.tags || []).join(" ")}`.toLowerCase();
  const qtyRaw = (card as { quantity?: string | number }).quantity;
  const hasReturnQty = qtyRaw != null && Number(qtyRaw) > 0;
  if (/\bno\s*goods|without\s*(goods|stock|return)|pricing\s*error|rate\s*difference|goodwill\b/.test(raw)) {
    return true;
  }
  if (/\bcredit\s*note\b/.test(raw) && !/\breturn|firta\b/.test(raw) && !hasReturnQty) {
    return true;
  }
  if ((card.tags || []).some((t) => /financial_credit_note|no_goods/i.test(String(t)))) {
    return true;
  }
  return false;
}

/**
 * Single authoritative confirmation entry point for Orbix.
 */
function detectBankReconKind(
  card: KhataConfirmationCard,
): string | null {
  const ext = card as KhataConfirmationCard & {
    bank_recon_kind?: string | null;
    bank_account_id?: string | null;
    cheque_id?: string | null;
    cheque_number?: string | null;
    settlement_kind?: string | null;
  };
  const kind = ext.bank_recon_kind != null ? String(ext.bank_recon_kind).trim() : "";
  if (kind && kind !== "null" && kind !== "undefined") return kind;
  const intent = String(card.intent || "").toLowerCase();
  const tags = (card.tags || []).map((t) => String(t).toLowerCase());
  const settlementKind = String(ext.settlement_kind || "").toLowerCase();
  // Phase 9 settlement / contra intents must never be treated as Phase 10 bank recon.
  if (
    tags.includes("phase9_settlement") ||
    settlementKind === "receipt" ||
    settlementKind === "payment" ||
    settlementKind === "contra" ||
    settlementKind === "journal" ||
    intent === "bank_to_bank" ||
    intent === "bank_to_cash" ||
    intent === "cash_to_bank" ||
    intent === "cash_to_cash" ||
    intent === "khata_contra_cash_bank" ||
    intent === "khata_bank_charges"
  ) {
    return null;
  }
  const isPhase10 =
    tags.includes("phase10_treasury") ||
    tags.some((t) =>
      /statement_import|bank_match|bank_adjustment|cheque_status|recon_close|treasury/.test(t),
    ) ||
    intent.startsWith("bank_statement") ||
    intent.startsWith("bank_match") ||
    intent.startsWith("bank_adjustment") ||
    intent.startsWith("bank_recon") ||
    intent.includes("cheque_status") ||
    intent.includes("treasury_position") ||
    Boolean(ext.bank_account_id) ||
    Boolean(ext.cheque_id) ||
    Boolean(ext.cheque_number);
  if (!isPhase10) {
    return null;
  }
  if (intent.includes("treasury") || tags.includes("treasury_query")) return "treasury_query";
  if (intent.includes("import") || tags.includes("statement_import")) return "statement_import";
  if (intent.includes("unmatch") || intent.includes("reverse") || tags.includes("bank_unmatch"))
    return "bank_unmatch";
  if (intent.includes("cheque") || tags.includes("cheque_status")) return "cheque_status";
  if (
    intent.includes("adjustment") ||
    intent.includes("charge") ||
    tags.includes("bank_adjustment")
  )
    return "bank_adjustment";
  if (intent.includes("close") || tags.includes("recon_close")) return "recon_close";
  if (intent.includes("match") || tags.includes("bank_match")) return "bank_match";
  if (tags.includes("statement_import")) return "statement_import";
  if (ext.cheque_id || ext.cheque_number) return "cheque_status";
  if (tags.includes("phase10_treasury") && Number(card.amount) <= 0) return "statement_import";
  return "bank_match";
}

/** Test/helper export for Phase 10 confirm routing. */
export function detectBankReconKindForTests(card: KhataConfirmationCard): string | null {
  return detectBankReconKind(card);
}

function resolveConfirmToken(cmd: OrbixConfirmCommand): string | null {
  const fromCmd = String(cmd.confirmToken || "").trim();
  if (fromCmd) return fromCmd;
  const fromCard = String(cmd.card.confirm_token || "").trim();
  return fromCard || null;
}

function denyConfirmToken(
  stages: OrbixPostingStage[],
  cmd: OrbixConfirmCommand,
  error_code: string,
): OrbixPostingResult {
  const messages: Record<string, string> = {
    confirm_token_required: "A short-lived confirm token is required before posting.",
    confirm_token_unknown: "Confirm token is not recognized. Generate a new preview.",
    confirm_token_expired: "Confirm token expired. Generate a new preview before confirming.",
    confirm_token_reuse: "Confirm token was already used. Generate a new preview before confirming.",
    confirm_token_tenant_mismatch: "Confirm token does not match this company.",
  };
  return {
    response_type: "validation_error",
    status: "failed",
    stages: [...stages, "validation_started", "posting_failed"],
    payload: {
      draft_id: cmd.draftId,
      posting_id: cmd.requestId,
      currency: "NPR",
      idempotent_replay: false,
      error_code,
      safe_message: messages[error_code] || "Confirm token validation failed.",
      rolled_back: true,
      retryable: error_code !== "confirm_token_tenant_mismatch",
      draft_retained: true,
    },
  };
}

function enforceSuccessReceipt(result: OrbixPostingResult): OrbixPostingResult {
  if (result.status !== "success") return result;
  if (postingSuccessHasReceipt(result.payload)) return result;
  return {
    response_type: "posting_failed",
    status: "failed",
    stages: [...result.stages, "posting_failed"],
    payload: {
      ...result.payload,
      idempotent_replay: false,
      error_code: "receipt_required",
      safe_message: "Success cannot be claimed without a posting receipt.",
      rolled_back: true,
      retryable: false,
      draft_retained: true,
    },
  };
}

export async function executeOrbixConfirm(
  cmd: OrbixConfirmCommand,
): Promise<OrbixPostingResult> {
  const stages: OrbixPostingStage[] = ["confirmation_received"];

  if (!cmd.confirmation) {
    return {
      response_type: "validation_error",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "confirmation_required",
        safe_message: "Explicit confirmation is required before posting.",
        rolled_back: true,
        retryable: false,
        draft_retained: true,
      },
    };
  }

  const confirmToken = resolveConfirmToken(cmd);
  const tokenBind = {
    companyId: cmd.companyId,
    draftId: cmd.draftId,
    previewHash: cmd.previewHash,
  };
  const tokenCheck = validateConfirmToken(confirmToken, tokenBind);
  if (!tokenCheck.ok) {
    return denyConfirmToken(stages, cmd, tokenCheck.error_code);
  }

  if (cmd.orbixMode !== "accountant") {
    stages.push("authorization_checked", "posting_failed");
    return {
      response_type: "permission_denied",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "mode_restriction",
        safe_message: "Posting requires Accountant Mode.",
        rolled_back: true,
        retryable: true,
        draft_retained: true,
      },
    };
  }

  const role = cmd.userRole;
  if (!isAccountantOrAdmin(role) && role !== "manager") {
    stages.push("authorization_checked", "posting_failed");
    return {
      response_type: "permission_denied",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "permission_denied",
        safe_message: "Your role cannot post purchase, sales, or khata entries.",
        rolled_back: true,
        retryable: false,
        draft_retained: true,
      },
    };
  }
  stages.push("authorization_checked");

  const cardHash =
    (cmd.card as KhataConfirmationCard & { preview_hash?: string }).preview_hash ??
    (cmd.card as KhataConfirmationCard & { previewHash?: string }).previewHash;
  if (cmd.previewHash && cardHash && cmd.previewHash !== String(cardHash)) {
    stages.push("validation_started", "posting_failed");
    return {
      response_type: "validation_error",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "stale_preview",
        safe_message: "This preview is out of date. Generate a new preview before confirming.",
        rolled_back: true,
        retryable: true,
        draft_retained: true,
      },
    };
  }

  stages.push("validation_started");
  // Sales returns / credit notes carry quantity or financial amount on the card, but
  // authoritative journals are derived by postSalesAdjustmentTransaction — empty
  // journalLines + amount 0 is expected for qty-based inventory returns.
  const isSalesAdjustment = detectSalesAdjustmentIntent(cmd.card);
  const isPurchaseAdjustment = detectPurchaseAdjustmentIntent(cmd.card);
  const settlementKind = detectSettlementKind(cmd.card);
  const bankReconKindEarly = detectBankReconKind(cmd.card);
  const amountOk = Number(cmd.card.amount) > 0;
  const hasBankAccountHint = Boolean(
    (cmd.card as { bank_account_id?: string | null }).bank_account_id ||
      (cmd.card as { cheque_id?: string | null }).cheque_id ||
      (cmd.card as { cheque_number?: string | null }).cheque_number,
  );
  if (
    !isSalesAdjustment &&
    !isPurchaseAdjustment &&
    !settlementKind &&
    !bankReconKindEarly &&
    !hasBankAccountHint &&
    !cmd.card.journalLines?.length &&
    !amountOk
  ) {
    stages.push("posting_failed");
    return {
      response_type: "validation_error",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "invalid_preview",
        safe_message: "Confirmation payload is incomplete.",
        rolled_back: true,
        retryable: true,
        draft_retained: true,
      },
    };
  }
  stages.push("validation_completed");

  if (cmd.injectFailure === "after_validation") {
    stages.push("posting_failed");
    return {
      response_type: "posting_failed",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "injected_failure",
        safe_message: "Development failure injection — no accounting records were posted.",
        rolled_back: true,
        retryable: true,
        draft_retained: true,
      },
    };
  }

  const consumed = consumeConfirmToken(confirmToken, tokenBind);
  if (!consumed.ok) {
    return denyConfirmToken(stages, cmd, consumed.error_code);
  }

  const store = useStore.getState();
  const settings = store.companySettings as
    | { id?: string; companyId?: string }
    | null
    | undefined;
  const companyId =
    cmd.companyId || String(settings?.companyId || settings?.id || "main");

  // ── Inventory sales → authoritative sales-invoice engine ─────────────────
  if (isInventorySalesIntent(cmd.card.intent)) {
    const item = await resolveInventoryItemForSale(cmd.card.item);
    if (!item) {
      if (cmd.card.item && String(cmd.card.item).trim()) {
        stages.push("posting_failed");
        return {
          response_type: "validation_error",
          status: "failed",
          stages,
          payload: {
            draft_id: cmd.draftId,
            posting_id: cmd.requestId,
            currency: "NPR",
            idempotent_replay: false,
            error_code: "classification_required",
            safe_message:
              "Is this an inventory item for resale, a fixed asset disposal, or non-inventory income? Select a seeded inventory item before posting.",
            rolled_back: true,
            retryable: true,
            draft_retained: true,
          },
        };
      }
    } else {
      const paymentMethod = inferPaymentMethod(cmd.card);
      const { qty, rateStr, amountStr } = resolveQtyAndRate(cmd.card);
      const partyName = cmd.card.party || null;
      let customerId: string | null = null;
      if (
        partyName &&
        (partyName === E2E_SALES_CUSTOMER_NAME ||
          partyName.toLowerCase().includes("ram traders"))
      ) {
        customerId = E2E_SALES_CUSTOMER_ID;
      }

      stages.push("posting_started");
      const salesResult = await postSalesTransaction({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        conversationId: cmd.conversationId,
        draftId: cmd.draftId,
        draftVersion: cmd.draftVersion,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        sale: {
          transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
          customerId,
          customerName: partyName,
          paymentMethod,
          paymentAccountId:
            paymentMethod === "cash"
              ? "acc-cash"
              : paymentMethod === "bank"
                ? "acc-bank"
                : null,
          warehouseId: "wh-main",
          items: [
            {
              itemId: item.id,
              quantity: String(qty),
              unit: item.unit || "pcs",
              rate: rateStr,
              lineAmount: amountStr,
            },
          ],
          subtotal: amountStr,
          discountAmount: "0",
          taxAmount: "0",
          grandTotal: amountStr,
          currency: "NPR",
          narration: cmd.card.raw_text || `Sale of ${item.name}`,
        },
        injectFailure:
          cmd.injectFailure === "before_stock" || cmd.injectFailure === "before_audit"
            ? cmd.injectFailure
            : null,
      });

      const mapped = mapDomainResult(salesResult, stages, cmd.draftId);
      if (mapped.status === "success" && mapped.payload.voucher_number && cmd.draftId) {
        await ackDraftPostedOnBackend(cmd.draftId, {
          voucher_number: mapped.payload.voucher_number,
          posting_id: mapped.payload.posting_id,
          invoice_number: mapped.payload.invoice_number || undefined,
        });
      }
      return mapped;
    }
  }

  // ── Inventory purchase → authoritative purchase-invoice engine ───────────
  if (isInventoryPurchaseIntent(cmd.card.intent)) {
    const item = await resolveInventoryItemForPurchase(cmd.card.item);
    if (!item) {
      if (cmd.card.item && String(cmd.card.item).trim()) {
        stages.push("posting_failed");
        return {
          response_type: "validation_error",
          status: "failed",
          stages,
          payload: {
            draft_id: cmd.draftId,
            posting_id: cmd.requestId,
            currency: "NPR",
            idempotent_replay: false,
            error_code: "classification_required",
            safe_message:
              "Is this inventory for resale or a fixed asset for business use? Seed or select an inventory item before posting.",
            rolled_back: true,
            retryable: true,
            draft_retained: true,
          },
        };
      }
    } else {
      const raw = `${cmd.card.raw_text || ""} ${(cmd.card.tags || []).join(" ")}`.toLowerCase();
      const paymentMethod = /\bcredit|udhaar\b/.test(raw)
        ? "credit"
        : /\bbank\b/.test(raw)
          ? "bank"
          : "cash";
      const { qty, rateStr, amountStr } = resolveQtyAndRate(cmd.card);

      stages.push("posting_started");
      const purchaseResult = await postPurchaseTransaction({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        conversationId: cmd.conversationId,
        draftId: cmd.draftId,
        draftVersion: cmd.draftVersion,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        purchase: {
          transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
          supplierId: null,
          supplierName: cmd.card.party || null,
          paymentMethod,
          paymentAccountId:
            paymentMethod === "cash" ? "acc-cash" : paymentMethod === "bank" ? "acc-cash" : null,
          items: [
            {
              itemId: item.id,
              quantity: String(qty),
              unit: item.unit || "pcs",
              rate: rateStr,
              amount: amountStr,
            },
          ],
          subtotal: amountStr,
          discount: "0",
          tax: "0",
          grandTotal: amountStr,
          currency: "NPR",
          narration: cmd.card.raw_text || `Purchase of ${item.name}`,
        },
        injectFailure:
          cmd.injectFailure === "before_stock" || cmd.injectFailure === "before_audit"
            ? cmd.injectFailure
            : null,
      });

      const mapped = mapDomainResult(purchaseResult, stages, cmd.draftId);
      if (mapped.status === "success" && mapped.payload.voucher_number && cmd.draftId) {
        await ackDraftPostedOnBackend(cmd.draftId, {
          voucher_number: mapped.payload.voucher_number,
          posting_id: mapped.payload.posting_id,
          invoice_number: mapped.payload.invoice_number || undefined,
        });
      }
      return mapped;
    }
  }

  // ── Purchase return / supplier debit note → authoritative adjustment engine ─
  // Checked BEFORE sales adjustments so purchase-side intents are never stolen.
  if (detectPurchaseAdjustmentIntent(cmd.card)) {
    const invoiceNo = parseOriginalPurchaseInvoiceNo(cmd.card.raw_text);
    if (!invoiceNo) {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "missing_original_invoice",
          safe_message:
            "Which original purchase invoice should this return / debit note reverse? Include the invoice number (e.g. PI-…).",
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const db = getDB();
    const original = await db.invoices.where("invoiceNo").equals(invoiceNo).first();
    if (!original || String(original.type) !== "purchase-invoice") {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "original_invoice_not_found",
          safe_message: `Original purchase invoice ${invoiceNo} was not found. Confirm the invoice number before posting.`,
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const financialOnly = isFinancialSupplierDebitNoteIntent(cmd.card);
    const item = await resolveInventoryItemForPurchase(cmd.card.item);
    if (!item && !financialOnly) {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "classification_required",
          safe_message:
            "Could not resolve the returned item. Name the inventory item or post a financial supplier debit note (no goods).",
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const origLines = original.lines || [];
    let matchedIdx = -1;
    if (item) {
      matchedIdx = origLines.findIndex((l) => String(l.itemId) === String(item.id));
    }
    if (matchedIdx < 0 && financialOnly && origLines.length === 1) {
      matchedIdx = 0;
    }
    if (matchedIdx < 0) {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "original_line_missing",
          safe_message: `Item was not found on original invoice ${original.invoiceNo}.`,
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const origLine = origLines[matchedIdx];
    const originalPurchaseLineId =
      (origLine as { id?: string }).id || `line-${original.id}-${matchedIdx}`;
    const lineItemId = String(origLine.itemId || item?.id || "");
    const { qty, amountStr } = resolveQtyAndRate(cmd.card);
    const settlementMethod = inferPurchaseSettlement(cmd.card);
    const adjustmentType = financialOnly
      ? ("financial_supplier_debit_note" as const)
      : ("inventory_purchase_return" as const);

    stages.push("posting_started");
    const adjResult = await postPurchaseAdjustmentTransaction({
      commandId: cmd.requestId,
      requestId: cmd.requestId,
      conversationId: cmd.conversationId,
      draftId: cmd.draftId,
      draftVersion: cmd.draftVersion,
      previewVersion: cmd.previewVersion,
      previewHash: cmd.previewHash,
      idempotencyKey: cmd.idempotencyKey,
      companyId,
      userId: store.currentUser?.id || "orbix-user",
      userRole: cmd.userRole,
      orbixMode: cmd.orbixMode,
      source: "orbix",
      adjustment: {
        adjustmentType,
        originalInvoiceId: original.id,
        transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
        supplierId: original.partyId || null,
        settlementMethod,
        settlementAccountId:
          settlementMethod === "cash_refund_received"
            ? "acc-cash"
            : settlementMethod === "bank_refund_received"
              ? "acc-bank"
              : null,
        destinationWarehouseId:
          (original as { warehouseId?: string }).warehouseId || "wh-main",
        reasonCode: financialOnly ? "pricing_error" : "supplier_rejection",
        narration: cmd.card.raw_text || `${adjustmentType} vs ${original.invoiceNo}`,
        lines: [
          financialOnly
            ? {
                originalPurchaseLineId,
                itemId: lineItemId,
                financialAdjustment: amountStr,
              }
            : {
                originalPurchaseLineId,
                itemId: lineItemId,
                returnQuantity: qty,
                stockCondition: "resalable" as const,
              },
        ],
        currency: "NPR",
      },
      injectFailure:
        cmd.injectFailure === "before_stock" || cmd.injectFailure === "before_audit"
          ? cmd.injectFailure
          : null,
    });

    const mapped = mapDomainResult(adjResult, stages, cmd.draftId);
    if (mapped.status === "success" && mapped.payload.voucher_number && cmd.draftId) {
      await ackDraftPostedOnBackend(cmd.draftId, {
        voucher_number: mapped.payload.voucher_number,
        posting_id: mapped.payload.posting_id,
        invoice_number: mapped.payload.invoice_number || undefined,
      });
    }
    return mapped;
  }

  // ── Sales return / credit note → authoritative adjustment engine ──────────
  if (detectSalesAdjustmentIntent(cmd.card)) {
    const invoiceNo = parseOriginalInvoiceNo(cmd.card.raw_text);
    if (!invoiceNo) {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "missing_original_invoice",
          safe_message:
            "Which original sales invoice should this return/credit note reverse? Include the invoice number (e.g. SI-…).",
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const db = getDB();
    const original = await db.invoices.where("invoiceNo").equals(invoiceNo).first();
    if (!original || String(original.type) !== "sales-invoice") {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "original_invoice_not_found",
          safe_message: `Original sales invoice ${invoiceNo} was not found. Confirm the invoice number before posting.`,
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const financialOnly = isFinancialCreditNoteIntent(cmd.card);
    const item = await resolveInventoryItemForSale(cmd.card.item);
    if (!item && !financialOnly) {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "classification_required",
          safe_message:
            "Could not resolve the returned item. Name the inventory item or post a financial credit note (no goods).",
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const origLines = original.lines || [];
    let matchedIdx = -1;
    if (item) {
      matchedIdx = origLines.findIndex((l) => String(l.itemId) === String(item.id));
    }
    if (matchedIdx < 0 && financialOnly && origLines.length === 1) {
      matchedIdx = 0;
    }
    if (matchedIdx < 0) {
      stages.push("posting_failed");
      return {
        response_type: "validation_error",
        status: "failed",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: cmd.requestId,
          currency: "NPR",
          idempotent_replay: false,
          error_code: "original_line_missing",
          safe_message: `Item was not found on original invoice ${original.invoiceNo}.`,
          rolled_back: true,
          retryable: true,
          draft_retained: true,
        },
      };
    }

    const origLine = origLines[matchedIdx];
    const originalSalesLineId =
      (origLine as { id?: string }).id || `line-${original.id}-${matchedIdx}`;
    const lineItemId = String(origLine.itemId || item?.id || "");
    const { qty, amountStr } = resolveQtyAndRate(cmd.card);
    const settlementMethod = inferAdjustmentSettlement(cmd.card);
    const adjustmentType = financialOnly
      ? ("financial_credit_note" as const)
      : ("inventory_sales_return" as const);

    stages.push("posting_started");
    const adjResult = await postSalesAdjustmentTransaction({
      commandId: cmd.requestId,
      requestId: cmd.requestId,
      conversationId: cmd.conversationId,
      draftId: cmd.draftId,
      draftVersion: cmd.draftVersion,
      previewVersion: cmd.previewVersion,
      previewHash: cmd.previewHash,
      idempotencyKey: cmd.idempotencyKey,
      companyId,
      userId: store.currentUser?.id || "orbix-user",
      userRole: cmd.userRole,
      orbixMode: cmd.orbixMode,
      source: "orbix",
      adjustment: {
        adjustmentType,
        originalInvoiceId: original.id,
        transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
        customerId: original.partyId || null,
        settlementMethod,
        settlementAccountId:
          settlementMethod === "cash_refund"
            ? "acc-cash"
            : settlementMethod === "bank_refund"
              ? "acc-bank"
              : null,
        destinationWarehouseId:
          (original as { warehouseId?: string }).warehouseId || "wh-main",
        reasonCode: financialOnly ? "pricing_error" : "customer_rejection",
        narration: cmd.card.raw_text || `${adjustmentType} vs ${original.invoiceNo}`,
        lines: [
          financialOnly
            ? {
                originalSalesLineId,
                itemId: lineItemId,
                financialAdjustment: amountStr,
              }
            : {
                originalSalesLineId,
                itemId: lineItemId,
                returnQuantity: qty,
                stockCondition: "resalable" as const,
              },
        ],
        currency: "NPR",
      },
      injectFailure:
        cmd.injectFailure === "before_stock" || cmd.injectFailure === "before_audit"
          ? cmd.injectFailure
          : null,
    });

    const mapped = mapDomainResult(adjResult, stages, cmd.draftId);
    if (mapped.status === "success" && mapped.payload.voucher_number && cmd.draftId) {
      await ackDraftPostedOnBackend(cmd.draftId, {
        voucher_number: mapped.payload.voucher_number,
        posting_id: mapped.payload.posting_id,
        invoice_number: mapped.payload.invoice_number || undefined,
      });
    }
    return mapped;
  }


  // ── Phase 10 treasury / bank recon — before confirmKhata / after inventory ─
  const bankReconKind = detectBankReconKind(cmd.card);
  if (bankReconKind) {
    stages.push("posting_started");
    const ext = cmd.card as KhataConfirmationCard & {
      bank_account_id?: string;
      statement_line_id?: string;
      erp_document_ids?: string[];
      cheque_id?: string;
      cheque_number?: string;
      cheque_next_status?: string;
      adjustment_type?: string;
      expected_statement_line_version?: number;
      reference?: string;
    };
    const bankAccountId = ext.bank_account_id || E2E_BANK_ACCOUNT_ID;
    const amountStr =
      cmd.card.amount > 0 ? Number(cmd.card.amount).toFixed(2) : "0.00";

    if (bankReconKind === "treasury_query") {
      const pos = await computeTreasuryPosition({
        companyId,
        bankAccountId,
      });
      const acct = pos.accounts[0];
      stages.push("posting_completed");
      return {
        response_type: "posting_completed",
        status: "success",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: `treasury-${cmd.requestId}`,
          currency: "NPR",
          idempotent_replay: false,
          book_balance: acct?.bookBalance,
          available_balance: acct?.availableBalance,
          read_only: true,
        } as any,
      };
    }

    let treasuryResult: { type: string; status: string; payload: any };

    if (bankReconKind === "statement_import") {
      treasuryResult = await createStatementBatch({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        bankAccountId,
        csvText: E2E_SAMPLE_STATEMENT_CSV,
        sourceType: "e2e_fixture",
        supersedeDuplicate: true,
      });
    } else if (bankReconKind === "bank_match") {
      const db = getDB();
      let statementLineId = ext.statement_line_id;
      const erpIds = ext.erp_document_ids?.length
        ? ext.erp_document_ids
        : [E2E_RV_001_ID];
      if (!statementLineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines
          .where("bankAccountId")
          .equals(bankAccountId)
          .toArray();
        const unmatched = lines.filter(
          (l: any) => l.status === "unmatched" || Number(l.remainingMatchPaisa) > 0,
        );
        const refNeedle = String(ext.reference || erpIds[0] || "").toUpperCase();
        const amountPaisa = Math.round(Number(amountStr || 0) * 100);
        const byRef = unmatched.find((l: any) => {
          const blob = `${l.reference || ""} ${l.description || ""}`.toUpperCase();
          return refNeedle && blob.includes(refNeedle);
        });
        const byAmount = unmatched.find(
          (l: any) =>
            Number(l.creditPaisa || 0) === amountPaisa ||
            Number(l.debitPaisa || 0) === amountPaisa ||
            Number(l.amountPaisa || 0) === amountPaisa,
        );
        // Grouped (one-to-many): prefer exact statement amount over a single-ref line.
        statementLineId =
          (erpIds.length > 1 && byAmount?.id) ||
          byRef?.id ||
          byAmount?.id ||
          unmatched[0]?.id;
      }
      const line = statementLineId
        ? await (db as any).bankStatementLines.get(statementLineId)
        : null;
      const resolved: string[] = [];
      for (const id of erpIds) {
        if (String(id).startsWith("RV-") || String(id).startsWith("PV-")) {
          const v = await db.vouchers
            .filter((x: any) => String(x.voucherNo || "").toUpperCase() === String(id).toUpperCase())
            .first();
          resolved.push(v?.id || id);
        } else {
          resolved.push(id);
        }
      }
      const matchType =
        resolved.length > 1 ? ("one_to_many" as const) : ("one_to_one" as const);
      treasuryResult = await confirmBankMatch({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        bankAccountId,
        statementLineId: statementLineId || "",
        erpDocumentIds: resolved,
        matchedAmount: amountStr,
        matchType,
        matchMethod: "manual_confirm",
        expectedStatementLineVersion: Number(
          ext.expected_statement_line_version ?? line?.reconciliationVersion ?? 1,
        ),
        expectedErpMatchVersions: {},
        currency: "NPR",
      });
    } else if (bankReconKind === "bank_adjustment") {
      const db = getDB();
      let statementLineId = ext.statement_line_id;
      const adjType = (ext.adjustment_type as BankAdjustmentType) || "bank_charge";
      if (!statementLineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines
          .where("bankAccountId")
          .equals(bankAccountId)
          .toArray();
        const descRe =
          adjType === "bank_interest"
            ? /interest/i
            : adjType === "direct_deposit"
              ? /direct\s+deposit/i
              : adjType === "direct_debit"
                ? /direct\s+debit/i
                : /charge|fee/i;
        const charge = lines.find((l: any) => descRe.test(String(l.description || "")));
        statementLineId = charge?.id || lines.find((l: any) => l.status === "unmatched")?.id;
      }
      const line = statementLineId
        ? await (db as any).bankStatementLines.get(statementLineId)
        : null;
      treasuryResult = await postBankAdjustmentFromStatement({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        bankAccountId,
        statementLineId: statementLineId || "",
        expectedStatementLineVersion: Number(
          ext.expected_statement_line_version ?? line?.reconciliationVersion ?? 1,
        ),
        adjustmentType: adjType,
        amount: amountStr !== "0.00" ? amountStr : undefined,
        useJournal: true,
        narration: cmd.card.raw_text || "Orbix bank adjustment",
      });
    } else if (bankReconKind === "cheque_status") {
      const db = getDB();
      let chequeId = ext.cheque_id;
      if (!chequeId && ext.cheque_number && (db as any).chequeInstruments) {
        const all = await (db as any).chequeInstruments.toArray();
        chequeId = all.find(
          (c: any) =>
            String(c.instrumentNumber).toUpperCase() ===
            String(ext.cheque_number).toUpperCase(),
        )?.id;
      }
      const cheque = chequeId ? await (db as any).chequeInstruments.get(chequeId) : null;
      let statementLineId = ext.statement_line_id;
      if (!statementLineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines.toArray();
        statementLineId = lines.find((l: any) =>
          String(l.reference || "").toUpperCase().includes(
            String(ext.cheque_number || cheque?.instrumentNumber || "").toUpperCase(),
          ),
        )?.id;
      }
      const nextStatus = (ext.cheque_next_status as ChequeState) || "cleared";
      const bounceAmount =
        amountStr !== "0.00"
          ? amountStr
          : cheque
            ? paisaToString(Number(cheque.amountPaisa || 0))
            : "0.00";
      let bounceJournalLines: Array<{
        accountId: string;
        debit?: string;
        credit?: string;
        narration?: string;
      }> | undefined;
      if (nextStatus === "bounced" && cheque) {
        const bank = await (db as any).bankAccounts?.get?.(cheque.bankAccountId);
        const bankLedgerId = String(bank?.ledgerAccountId || E2E_BANK_LEDGER_ID);
        const partyLedgerId = "acc-sundry-debtors";
        // Restore customer outstanding / reverse bank: Dr Debtors, Cr Bank
        bounceJournalLines = [
          {
            accountId: partyLedgerId,
            debit: bounceAmount,
            narration: `Cheque bounce ${cheque.instrumentNumber}`,
          },
          {
            accountId: bankLedgerId,
            credit: bounceAmount,
            narration: `Cheque bounce ${cheque.instrumentNumber}`,
          },
        ];
      }
      treasuryResult = await postChequeStatusChange({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        chequeId: chequeId || "",
        nextStatus,
        expectedInstrumentVersion: Number(cheque?.instrumentVersion ?? 1),
        statementLineId: statementLineId || null,
        bounceJournalLines,
        bounceNarration: cmd.card.raw_text || `Cheque bounce`,
      });
    } else if (bankReconKind === "bank_unmatch") {
      const db = getDB();
      const links = (db as any).bankReconciliationLinks
        ? await (db as any).bankReconciliationLinks.toArray()
        : [];
      const link = links.find((l: any) => l.status === "confirmed");
      treasuryResult = await reverseBankMatch({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        linkId: link?.id || "",
        expectedLinkVersion: Number(link?.version ?? 1),
        expectedStatementLineVersion: 1,
      });
    } else if (bankReconKind === "recon_close") {
      const db = getDB();
      const sessions = (db as any).bankReconciliationSessions
        ? await (db as any).bankReconciliationSessions.toArray()
        : [];
      const open = sessions.find((s: any) => s.status === "open" || s.status === "in_progress");
      treasuryResult = await closeBankReconciliation({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        sessionId: open?.id || "",
        expectedVersion: Number(open?.version ?? 1),
      });
    } else {
      treasuryResult = {
        type: "posting_failed",
        status: "failed",
        payload: {
          error_code: "unsupported_bank_recon_kind",
          safe_message: `Unsupported bank recon kind: ${bankReconKind}`,
          rolled_back: true,
          draft_retained: true,
          retryable: false,
        },
      };
    }

    const mapped = mapDomainResult(treasuryResult as any, stages, cmd.draftId);
    if (mapped.status === "success" && cmd.draftId) {
      await ackDraftPostedOnBackend(cmd.draftId, {
        voucher_number: (mapped.payload as any).voucher_number || (mapped.payload as any).batch_id || "BANK",
        posting_id: mapped.payload.posting_id,
      });
    }
    return mapped;
  }

  // ── Phase 9 settlement: receipt / payment / contra / journal ─────────────
  // Do not use confirmKhataEntry as authority for these.
  if (settlementKind) {
    stages.push("posting_started");
    const amountStr =
      cmd.card.amount > 0
        ? Number(cmd.card.amount).toFixed(2)
        : paisaToString(parseMoneyToPaisa(String(cmd.card.amount || "0")));
    const ext = cmd.card as KhataConfirmationCard & {
      allocations?: Array<{
        document_id: string;
        amount: string | number;
        expected_settlement_version?: number;
      }>;
      cash_or_bank_account_id?: string;
      from_account_id?: string;
      to_account_id?: string;
      party_id?: string;
      receipt_type?: ReceiptType;
      payment_type?: PaymentType;
      contra_type?: ContraType;
    };

    let settlementResult:
      | ReceiptPostingResult
      | PaymentPostingResult
      | ContraPostingResult
      | JournalPostingResult;

    if (settlementKind === "receipt") {
      settlementResult = await postReceiptTransaction({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        conversationId: cmd.conversationId,
        draftId: cmd.draftId,
        draftVersion: cmd.draftVersion,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        receipt: {
          receiptType:
            (ext.receipt_type as ReceiptType) ||
            (cmd.card.intent === "khata_customer_advance" ||
            cmd.card.intent === "customer_advance_receipt" ||
            (cmd.card.tags || []).some((t) => /advance/i.test(String(t)))
              ? "customer_advance_receipt"
              : "customer_receipt"),
          transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
          partyId: ext.party_id || (await resolvePartyIdFromCard(cmd.card)),
          cashOrBankAccountId: ext.cash_or_bank_account_id || "acc-cash",
          amount: amountStr,
          currency: "NPR",
          narration: cmd.card.raw_text || "Orbix receipt",
          allocations: await resolveSettlementAllocations(
            (ext.allocations || cmd.card.allocations || []) as any,
          ),
        },
      });
    } else if (settlementKind === "payment") {
      settlementResult = await postPaymentTransaction({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        conversationId: cmd.conversationId,
        draftId: cmd.draftId,
        draftVersion: cmd.draftVersion,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        payment: {
          paymentType: ext.payment_type || "supplier_payment",
          transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
          partyId: ext.party_id || (await resolvePartyIdFromCard(cmd.card)),
          cashOrBankAccountId: ext.cash_or_bank_account_id || "acc-cash",
          amount: amountStr,
          currency: "NPR",
          narration: cmd.card.raw_text || "Orbix payment",
          withholding:
            ext.withholding != null
              ? String(ext.withholding)
              : cmd.card.withholding != null
                ? String(cmd.card.withholding)
                : null,
          allocations: await resolveSettlementAllocations(
            (ext.allocations || cmd.card.allocations || []) as any,
          ),
        },
      });
    } else if (settlementKind === "contra") {
      settlementResult = await postContraTransaction({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        conversationId: cmd.conversationId,
        draftId: cmd.draftId,
        draftVersion: cmd.draftVersion,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        contra: {
          contraType: (ext.contra_type as ContraType) || "cash_to_bank",
          transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
          fromAccountId: ext.from_account_id || "acc-cash",
          toAccountId: ext.to_account_id || "acc-bank",
          amount: amountStr,
          currency: "NPR",
          narration: cmd.card.raw_text || "Orbix contra",
          bankCharges:
            (ext as { bank_charges?: string | number; bank_charge?: string | number }).bank_charges !=
            null
              ? String((ext as { bank_charges?: string | number }).bank_charges)
              : (ext as { bank_charge?: string | number }).bank_charge != null
                ? String((ext as { bank_charge?: string | number }).bank_charge)
                : cmd.card.bank_charge != null
                  ? String(cmd.card.bank_charge)
                  : null,
        },
      });
    } else {
      const rawLines = cmd.card.journalLines || [];
      const db = getDB();
      const accounts = await db.accounts.toArray();
      const resolveAccountId = (line: {
        accountId?: string;
        accountCode?: string;
        accountName?: string;
      }) => {
        if (line.accountId && accounts.some((a) => a.id === line.accountId)) return line.accountId;
        if (line.accountCode) {
          const byCode = accounts.find(
            (a) => String(a.code || "").toLowerCase() === String(line.accountCode).toLowerCase(),
          );
          if (byCode) return byCode.id;
          if (accounts.some((a) => a.id === line.accountCode)) return line.accountCode;
        }
        if (line.accountName) {
          const byName = accounts.find(
            (a) =>
              String(a.name || "").toLowerCase() === String(line.accountName).toLowerCase() ||
              String(a.name || "")
                .toLowerCase()
                .includes(String(line.accountName).toLowerCase()),
          );
          if (byName) return byName.id;
        }
        return line.accountId || line.accountCode || null;
      };
      const lines = rawLines
        .map((l) => {
          const accountId = resolveAccountId(l as any);
          return {
            accountId: accountId || "",
            accountName: l.accountName,
            debit: l.debit > 0 ? Number(l.debit).toFixed(2) : "0.00",
            credit: l.credit > 0 ? Number(l.credit).toFixed(2) : "0.00",
            narration: l.narration,
          };
        })
        .filter((l) => l.accountId);
      settlementResult = await postJournalTransaction({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        conversationId: cmd.conversationId,
        draftId: cmd.draftId,
        draftVersion: cmd.draftVersion,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        journal: {
          transactionDate: cmd.card.date || new Date().toISOString().slice(0, 10),
          lines,
          narration: cmd.card.raw_text || "Orbix journal",
          currency: "NPR",
          allowRestrictedControlAccounts: true,
        },
      });
    }

    const mapped = mapDomainResult(settlementResult, stages, cmd.draftId);
    if (mapped.status === "success" && mapped.payload.voucher_number && cmd.draftId) {
      await ackDraftPostedOnBackend(cmd.draftId, {
        voucher_number: mapped.payload.voucher_number,
        posting_id: mapped.payload.posting_id,
      });
    }
    return mapped;
  }

  // ── Non-inventory khata → existing voucher path ──────────────────────────
  stages.push("posting_started");
  try {
    const { voucherNo } = await confirmKhataViaProposal(cmd.card, cmd.conversationId);
    stages.push("voucher_created", "audit_recorded", "posting_completed");

    const postingId = `post-${cmd.requestId}`;
    const result: OrbixPostingResult = {
      response_type: "posting_completed",
      status: "success",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: postingId,
        voucher_id: null,
        voucher_number: voucherNo,
        journal_id: null,
        amount: String(cmd.card.amount ?? ""),
        currency: "NPR",
        posted_at: new Date().toISOString(),
        idempotent_replay: false,
      },
    };

    if (cmd.draftId) {
      await ackDraftPostedOnBackend(cmd.draftId, {
        voucher_number: voucherNo,
        posting_id: postingId,
      });
    }

    return result;
  } catch (error) {
    stages.push("posting_failed");
    return {
      response_type: "posting_failed",
      status: "failed",
      stages,
      payload: {
        draft_id: cmd.draftId,
        posting_id: cmd.requestId,
        currency: "NPR",
        idempotent_replay: false,
        error_code: "khata_post_failed",
        safe_message: error instanceof Error ? error.message : "Khata posting failed.",
        rolled_back: true,
        retryable: true,
        draft_retained: true,
      },
    };
  }
}

/** Test helper — Dexie-backed posting receipts; no in-memory cache to clear. */
export function clearOrbixPostingIdempotencyForTests(): void {
  /* no-op: idempotency is stored in orbixPostingReceipts */
}
