/**
 * Authoritative purchase returns / supplier debit notes posting - Model B (Dexie local-first).
 *
 * Creates a new linked document; never mutates the original purchase-invoice.
 * Uses historical VAT/cost reversal facts - never current rates or item cost.
 */

import { getDB, generateId, type DBInvoice } from "@/lib/db";
import { assertDateInFiscalYear } from "@/store/store.types";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import {
  parseMoneyToPaisa,
  paisaToNumber,
} from "@/domains/purchase/money";
import { enqueuePurchaseAdjustmentSyncInTransaction } from "@/platform/sync/enqueuePurchaseAdjustmentSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { resolveCompanyInventoryPolicy } from "@/domains/sales/inventoryAccountingPolicy";
import {
  computePurchaseInvoiceRemainingBalance,
  getOrCreatePurchaseAdjustmentState,
  bumpPurchaseAdjustmentVersion,
  moneyString,
} from "./remainingBalance";
import {
  computeHistoricalPurchaseLineReversal,
  computeFinancialDebitReversal,
  type HistoricalLineReversal,
  type StockCondition,
} from "./historicalReversal";

export type PurchaseAdjustmentType =
  | "inventory_purchase_return"
  | "financial_supplier_debit_note";
export type PurchaseAdjustmentSettlementMethod =
  | "reduce_payable"
  | "cash_refund_received"
  | "bank_refund_received"
  | "supplier_credit"
  | "supplier_refund_receivable"
  | "adjust_against_advance"
  | "no_immediate_settlement";
export type PurchaseAdjustmentCommandSource = "orbix" | "manual_form" | "import" | "test";

export interface PurchaseAdjustmentLineInput {
  originalPurchaseLineId: string;
  itemId: string;
  returnQuantity?: string | number | null;
  financialAdjustment?: string | number | null;
  stockCondition?: StockCondition | null;
}

export interface PurchaseAdjustmentPostingCommand {
  commandId: string;
  requestId: string;
  conversationId?: string | null;
  draftId?: string | null;
  draftVersion?: number | null;
  previewVersion?: string | number | null;
  previewHash?: string | null;
  idempotencyKey: string;
  tenantId?: string | null;
  companyId: string;
  financialYearId?: string | null;
  userId: string;
  userRole?: string | null;
  orbixMode?: OrbixOperatingMode | null;
  source: PurchaseAdjustmentCommandSource;
  expectedAdjustmentVersion?: number;
  adjustment: {
    adjustmentType: PurchaseAdjustmentType;
    originalInvoiceId: string;
    transactionDate: string;
    supplierId?: string | null;
    settlementMethod: PurchaseAdjustmentSettlementMethod;
    settlementAccountId?: string | null;
    destinationWarehouseId?: string | null;
    reasonCode: string;
    narration?: string;
    lines: PurchaseAdjustmentLineInput[];
    currency?: string;
  };
  injectFailure?: "before_stock" | "before_audit" | "before_sync" | null;
}

export interface PurchaseAdjustmentPostingSuccessPayload {
  posting_id: string;
  invoice_id: string;
  invoice_number: string;
  voucher_id: string;
  voucher_number: string;
  voucher_ids?: string[];
  stock_movement_ids: string[];
  amount: string;
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
  operation: "post_purchase_return" | "post_supplier_debit_note";
  original_invoice_id: string;
  original_invoice_number: string;
  adjustment_type: PurchaseAdjustmentType;
  settlement_method: PurchaseAdjustmentSettlementMethod;
  returned_quantity?: string;
  purchase_reversal: string;
  vat_reversal: string;
  cost_reversal: string;
  adjustment_version: number;
  tax_rule_version?: string | null;
  inventory_accounting?: string;
  valuation_method?: string;
}

export type PurchaseAdjustmentPostingResult =
  | {
      type: "posting_completed";
      status: "success";
      payload: PurchaseAdjustmentPostingSuccessPayload;
    }
  | {
      type: "posting_failed" | "permission_denied" | "validation_error" | "conflict";
      status: "failed";
      payload: {
        error_code: string;
        safe_message: string;
        rolled_back: boolean;
        draft_retained: boolean;
        retryable: boolean;
        draft_id?: string | null;
      };
    };

export interface DBOrbixPurchaseAdjustmentPostingReceipt {
  id: string;
  idempotencyKey: string;
  scopedKey: string;
  tenantId: string;
  companyId: string;
  userId: string;
  operation: "post_purchase_return" | "post_supplier_debit_note";
  draftId: string | null;
  draftVersion: number | null;
  previewVersion: string | null;
  previewHash: string | null;
  status: "processing" | "completed" | "failed";
  postingId: string;
  voucherId: string | null;
  invoiceId: string | null;
  journalId: string | null;
  result: PurchaseAdjustmentPostingSuccessPayload | null;
  createdAt: string;
  completedAt: string | null;
}

function fail(
  type: PurchaseAdjustmentPostingResult["type"] & string,
  error_code: string,
  safe_message: string,
  opts?: {
    rolled_back?: boolean;
    retryable?: boolean;
    draft_id?: string | null;
  },
): PurchaseAdjustmentPostingResult {
  return {
    type: type as "posting_failed",
    status: "failed",
    payload: {
      error_code,
      safe_message,
      rolled_back: opts?.rolled_back ?? true,
      draft_retained: true,
      retryable: opts?.retryable ?? true,
      draft_id: opts?.draft_id ?? null,
    },
  };
}

export function buildPurchaseAdjustmentScopedIdempotencyKey(
  cmd: PurchaseAdjustmentPostingCommand,
): string {
  const operation =
    cmd.adjustment.adjustmentType === "inventory_purchase_return"
      ? "post_purchase_return"
      : "post_supplier_debit_note";
  return [cmd.tenantId || "local", cmd.companyId, operation, cmd.idempotencyKey].join("|");
}

/** True when Orbix/khata intent is a purchase return or debit note (not a fresh purchase). */
export function isPurchaseAdjustmentIntent(intent: string | undefined | null): boolean {
  const i = (intent || "").trim().toLowerCase();
  return (
    i === "khata_purchase_return" ||
    i === "purchase_return" ||
    i === "purchase-return" ||
    i === "debit_note" ||
    i === "debit-note" ||
    i === "supplier_debit_note" ||
    i === "inventory_purchase_return" ||
    i === "financial_supplier_debit_note"
  );
}

const DEFAULT_PAYABLE_ACCOUNT_ID = "acc-sundry-creditors";
const PURCHASE_ACCOUNT_ID = "acc-purchase";

function resolvePartyAccountId(
  method: PurchaseAdjustmentSettlementMethod,
  settlementAccountId: string | null | undefined,
  payableAccountId: string,
): string {
  if (method === "cash_refund_received") {
    return settlementAccountId || "acc-cash";
  }
  if (method === "bank_refund_received") {
    return settlementAccountId || "acc-bank";
  }
  return settlementAccountId || payableAccountId;
}

function validateCommand(
  cmd: PurchaseAdjustmentPostingCommand,
): PurchaseAdjustmentPostingResult | null {
  if (!cmd.idempotencyKey?.trim()) {
    return fail("validation_error", "missing_idempotency_key", "Idempotency key is required.");
  }
  if (!cmd.companyId?.trim()) {
    return fail("validation_error", "missing_company", "Company is required.");
  }
  if (!cmd.userId?.trim()) {
    return fail("validation_error", "missing_user", "Authenticated user is required.");
  }
  if (cmd.source === "orbix") {
    if (cmd.orbixMode !== "accountant") {
      return fail("permission_denied", "mode_restriction", "Posting requires Accountant Mode.", {
        retryable: true,
        draft_id: cmd.draftId,
      });
    }
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail(
      "permission_denied",
      "permission_denied",
      "Your role cannot post purchase adjustments.",
      { retryable: false, draft_id: cmd.draftId },
    );
  }
  const adj = cmd.adjustment;
  if (!adj?.originalInvoiceId?.trim()) {
    return fail("validation_error", "missing_original_invoice", "Original invoice is required.", {
      draft_id: cmd.draftId,
    });
  }
  if (!adj.lines?.length) {
    return fail("validation_error", "missing_lines", "At least one adjustment line is required.", {
      draft_id: cmd.draftId,
    });
  }
  if (!adj.reasonCode?.trim()) {
    return fail("validation_error", "missing_reason", "Reason code is required.", {
      draft_id: cmd.draftId,
    });
  }
  if (
    ![
      "reduce_payable",
      "cash_refund_received",
      "bank_refund_received",
      "supplier_credit",
      "supplier_refund_receivable",
      "adjust_against_advance",
      "no_immediate_settlement",
    ].includes(adj.settlementMethod)
  ) {
    return fail("validation_error", "invalid_settlement", "Settlement method is required.", {
      draft_id: cmd.draftId,
    });
  }
  if (
    adj.adjustmentType !== "inventory_purchase_return" &&
    adj.adjustmentType !== "financial_supplier_debit_note"
  ) {
    return fail("validation_error", "invalid_adjustment_type", "Unknown adjustment type.", {
      draft_id: cmd.draftId,
    });
  }
  return null;
}

/**
 * Authoritative purchase return / supplier debit note post.
 * One Dexie transaction: new document, journal, optional stock/inventory reversal, audit, receipt, sync.
 */
export async function postPurchaseAdjustmentTransaction(
  cmd: PurchaseAdjustmentPostingCommand,
): Promise<PurchaseAdjustmentPostingResult> {
  const early = validateCommand(cmd);
  if (early) return early;

  const db = getDB();
  const adj = cmd.adjustment;
  const operation =
    adj.adjustmentType === "inventory_purchase_return"
      ? ("post_purchase_return" as const)
      : ("post_supplier_debit_note" as const);
  const eventType =
    adj.adjustmentType === "inventory_purchase_return"
      ? ("purchase_return_posted" as const)
      : ("supplier_debit_note_posted" as const);
  const scopedKey = buildPurchaseAdjustmentScopedIdempotencyKey(cmd);
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();
  const invoiceType =
    adj.adjustmentType === "inventory_purchase_return" ? "purchase-return" : "debit-note";

  let storeBridge: {
    getState: () => any;
    setState: (partial: any) => void;
  } | null = null;
  try {
    const mod = await import("@/store/useStore");
    storeBridge = { getState: mod.useStore.getState, setState: mod.useStore.setState };
  } catch {
    storeBridge = null;
  }
  const storeState = storeBridge?.getState() || {};

  try {
    let fy = storeState.currentFiscalYear;
    if (!fy) {
      const years = await db.fiscalYears.toArray();
      fy = years.find((y: any) => y.isCurrent) || years[0];
    }
    assertDateInFiscalYear(adj.transactionDate, fy);
    await enforcePostingPeriodLock(adj.transactionDate, db);
  } catch (e) {
    return fail(
      "validation_error",
      "period_or_fy",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  const original = await db.invoices.get(adj.originalInvoiceId);
  if (!original) {
    return fail("validation_error", "original_not_found", "Original Purchase invoice not found.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  if (original.type !== "purchase-invoice") {
    return fail(
      "validation_error",
      "invalid_original_type",
      "Original document must be a posted purchase-invoice.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }
  if (String(original.status || "").toLowerCase() !== "posted") {
    return fail(
      "validation_error",
      "original_not_posted",
      "Original purchase invoice must be posted.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  const companySettingsRow =
    (await db.companySettings.get("main")) || storeState.companySettings || {};
  const settingsCompanyId = String(
    (companySettingsRow as { companyId?: string }).companyId || "",
  );
  const invoiceCompanyId = String((original as { companyId?: string }).companyId || "");
  if (
    (invoiceCompanyId && invoiceCompanyId !== cmd.companyId) ||
    (settingsCompanyId && settingsCompanyId !== cmd.companyId && !invoiceCompanyId)
  ) {
    return fail(
      "validation_error",
      "company_mismatch",
      "Original invoice does not belong to this company.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  if (adj.supplierId && original.partyId && adj.supplierId !== original.partyId) {
    return fail(
      "validation_error",
      "supplier_mismatch",
      "Supplier does not match original invoice.",
      { draft_id: cmd.draftId },
    );
  }

  const balance = await computePurchaseInvoiceRemainingBalance(db, original.id);
  if (!balance) {
    return fail("validation_error", "balance_unavailable", "Could not compute remaining balance.", {
      draft_id: cmd.draftId,
    });
  }

  // Early idempotent replay - before optimistic-concurrency rejection
  {
    const existingEarly = await db.orbixPostingReceipts
      .where("scopedKey")
      .equals(scopedKey)
      .first();
    if (existingEarly?.status === "completed" && existingEarly.result) {
      return {
        type: "posting_completed",
        status: "success",
        payload: {
          ...(existingEarly.result as unknown as PurchaseAdjustmentPostingSuccessPayload),
          idempotent_replay: true,
        },
      };
    }
  }

  if (
    cmd.expectedAdjustmentVersion != null &&
    cmd.expectedAdjustmentVersion !== balance.adjustment_version
  ) {
    return fail(
      "conflict",
      "stale_adjustment_version",
      `Stale adjustment version: expected ${cmd.expectedAdjustmentVersion}, actual ${balance.adjustment_version}.`,
      { draft_id: cmd.draftId, retryable: true },
    );
  }

  const remByLine = new Map(balance.lines.map((l) => [l.original_purchase_line_id, l]));
  const reversals: HistoricalLineReversal[] = [];
  const taxRuleVersion =
    (original as { taxRuleVersion?: string }).taxRuleVersion ||
    (original.lines?.[0] as { taxRuleVersion?: string } | undefined)?.taxRuleVersion ||
    null;
  const valuationMethod =
    (original as { valuationMethod?: string }).valuationMethod ||
    (original.lines?.[0] as { valuationMethod?: string } | undefined)?.valuationMethod ||
    null;

  try {
    for (const line of adj.lines) {
      const rem = remByLine.get(line.originalPurchaseLineId);
      if (!rem) {
        return fail(
          "validation_error",
          "original_line_missing",
          `Original purchase line ${line.originalPurchaseLineId} was not found.`,
          { draft_id: cmd.draftId },
        );
      }
      if (rem.item_id !== line.itemId) {
        return fail(
          "validation_error",
          "original_line_mismatch",
          `Item mismatch for line ${line.originalPurchaseLineId}.`,
          { draft_id: cmd.draftId },
        );
      }

      if (adj.adjustmentType === "inventory_purchase_return") {
        const qty = Number(line.returnQuantity ?? 0);
        if (!(qty > 0)) {
          return fail(
            "validation_error",
            "zero_return_quantity",
            "Return quantity must be positive.",
            { draft_id: cmd.draftId },
          );
        }
        reversals.push(
          computeHistoricalPurchaseLineReversal({
            balance: rem,
            returnQuantity: qty,
            taxRuleVersion,
            valuationMethod,
            stockCondition: line.stockCondition ?? "resalable",
          }),
        );
      } else {
        const debitRaw = line.financialAdjustment ?? 0;
        const debit =
          typeof debitRaw === "number"
            ? debitRaw
            : paisaToNumber(parseMoneyToPaisa(String(debitRaw)));
        if (!(debit > 0)) {
          return fail(
            "validation_error",
            "zero_debit_amount",
            "Financial adjustment must be positive.",
            { draft_id: cmd.draftId },
          );
        }
        reversals.push(
          computeFinancialDebitReversal({
            balance: rem,
            debitAmount: debit,
            taxRuleVersion,
          }),
        );
      }
    }
  } catch (e) {
    const code = (e as { code?: string })?.code || "invalid_amounts";
    return fail(
      "validation_error",
      code,
      e instanceof Error ? e.message : "Invalid adjustment amounts.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  const taxableTotal = reversals.reduce((s, r) => s + r.taxable_reversal, 0);
  const vatTotal = reversals.reduce((s, r) => s + r.vat_reversal, 0);
  const costTotal = reversals.reduce((s, r) => s + r.cost_reversal, 0);
  const qtyTotal = reversals.reduce((s, r) => s + r.return_quantity, 0);
  /** Journal must balance: party debit = taxable + VAT. */
  const settlementTotal = Math.round((taxableTotal + vatTotal) * 100) / 100;

  if (!(settlementTotal > 0)) {
    return fail("validation_error", "zero_adjustment_total", "Adjustment total must be positive.", {
      draft_id: cmd.draftId,
    });
  }

  const inventoryPolicy = resolveCompanyInventoryPolicy({
    ...(companySettingsRow as object),
    ...(storeState.inventoryConfiguration || {}),
  } as Record<string, unknown>);
  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);
  const warehouseId =
    adj.destinationWarehouseId ||
    (original as { warehouseId?: string }).warehouseId ||
    "wh-main";

  try {
    const {
      postInvoiceJournal,
      postInvoiceStock,
      generateNextInvoiceNo,
      postPurchaseInventoryRemovalJournal,
    } = await import("@/store/invoicePostingWriters");

    const ensureGlAccount = async (
      id: string,
      code: string,
      name: string,
      type: string,
    ) => {
      const found = await db.accounts.get(id);
      if (!found) {
        await db.accounts.add({
          id,
          code,
          name,
          type,
          balance: 0,
          level: 1,
          isGroup: false,
          isActive: true,
          createdAt: now,
        } as any);
      }
    };
    if (
      adj.adjustmentType === "inventory_purchase_return" &&
      inventoryPolicy.inventoryAccounting === "perpetual"
    ) {
      await ensureGlAccount(PURCHASE_ACCOUNT_ID, "5101", "Purchases", "expense");
      await ensureGlAccount(inventoryPolicy.inventoryAccountId, "1310", "Inventory", "asset");
    }

    const txnTables = [
      db.invoices,
      db.vouchers,
      db.stockMovements,
      db.accounts,
      db.auditLogs,
      db.orbixPostingReceipts,
      db.items,
      db.parties,
      db.periodLocks,
      db.domainEvents,
      db.eventSyncQueue,
      db.syncLocalSequences,
      db.companySettings,
      db.purchaseInvoiceAdjustmentState,
    ].filter(Boolean);

    const result = await db.transaction("rw", txnTables, async () => {
      const existing = await db.orbixPostingReceipts.where("scopedKey").equals(scopedKey).first();
      if (existing?.status === "completed" && existing.result) {
        return {
          type: "posting_completed" as const,
          status: "success" as const,
          payload: {
            ...(existing.result as unknown as PurchaseAdjustmentPostingSuccessPayload),
            idempotent_replay: true,
          },
        };
      }
      if (existing?.status === "processing") {
        throw Object.assign(new Error("Posting already in progress for this confirmation."), {
          code: "in_progress",
        });
      }

      const adjState = await getOrCreatePurchaseAdjustmentState(db, cmd.companyId, original.id);
      if (
        cmd.expectedAdjustmentVersion != null &&
        cmd.expectedAdjustmentVersion !== adjState.adjustmentVersion
      ) {
        throw Object.assign(
          new Error(
            `Stale adjustment version: expected ${cmd.expectedAdjustmentVersion}, actual ${adjState.adjustmentVersion}.`,
          ),
          { code: "stale_adjustment_version" },
        );
      }
      const nextVersion = adjState.adjustmentVersion + 1;

      const receiptId = existing?.id || generateId();
      const processing: DBOrbixPurchaseAdjustmentPostingReceipt = {
        id: receiptId,
        idempotencyKey: cmd.idempotencyKey,
        scopedKey,
        tenantId: cmd.tenantId || "local",
        companyId: cmd.companyId,
        userId: cmd.userId,
        operation,
        draftId: cmd.draftId ?? null,
        draftVersion: cmd.draftVersion ?? null,
        previewVersion: cmd.previewVersion != null ? String(cmd.previewVersion) : null,
        previewHash: cmd.previewHash ?? null,
        status: "processing",
        postingId,
        voucherId: null,
        invoiceId: null,
        journalId: null,
        result: null,
        createdAt: existing?.createdAt || now,
        completedAt: null,
      };
      await db.orbixPostingReceipts.put(processing as any);

      let invoiceNo = "";
      const invoiceId = generateId();
      for (let attempt = 0; attempt < 5; attempt++) {
        invoiceNo = await generateNextInvoiceNo(invoiceType, db);
        const clash = await db.invoices.where("invoiceNo").equals(invoiceNo).first();
        if (!clash) break;
        if (attempt === 4) {
          throw new Error(`Could not allocate unique invoice number (last=${invoiceNo})`);
        }
      }

      const paymentMode =
        adj.settlementMethod === "cash_refund_received"
          ? "cash"
          : adj.settlementMethod === "bank_refund_received"
            ? "bank"
            : "credit";
      const partyAccountId = resolvePartyAccountId(
        adj.settlementMethod,
        adj.settlementAccountId,
        DEFAULT_PAYABLE_ACCOUNT_ID,
      );

      const taxableAmount = Math.round(taxableTotal * 100) / 100;
      const vatAmount = Math.round(vatTotal * 100) / 100;
      const finalGrand = settlementTotal;
      const isRefund =
        adj.settlementMethod === "cash_refund_received" ||
        adj.settlementMethod === "bank_refund_received";

      const newInvoice: DBInvoice = {
        id: invoiceId,
        invoiceNo,
        date: adj.transactionDate,
        type: invoiceType,
        status: "posted",
        partyId: adj.supplierId || original.partyId || undefined,
        partyName: original.partyName || "Supplier",
        partyAccountId,
        paymentMode,
        paymentStatus: isRefund ? "paid" : "unpaid",
        paidAmount: isRefund ? finalGrand : 0,
        subTotal: taxableAmount,
        taxableAmount,
        exemptAmount: 0,
        vatAmount,
        vatApplicable: vatAmount > 0,
        discountAmount: 0,
        grandTotal: finalGrand,
        total: finalGrand,
        currencyCode: adj.currency || (original as { currencyCode?: string }).currencyCode || "NPR",
        narration:
          adj.narration ||
          `${adj.reasonCode}: ${operation} vs ${original.invoiceNo}`,
        createdBy: cmd.userId,
        warehouseId,
        originalInvoiceId: original.id,
        taxRuleVersion: taxRuleVersion || undefined,
        inventoryAccounting: inventoryPolicy.inventoryAccounting,
        valuationMethod: inventoryPolicy.valuationMethod,
        lines: reversals.map((r, idx) => {
          const qty =
            adj.adjustmentType === "inventory_purchase_return" ? r.return_quantity : 0;
          const lineAmt = r.taxable_reversal;
          const rate =
            qty > 0
              ? Math.round((lineAmt / qty) * 100) / 100
              : lineAmt;
          const origLine = (original.lines || []).find(
            (l, i) =>
              (l.id || `line-${original.id}-${i}`) === r.original_purchase_line_id,
          );
          return {
            id: `line-${invoiceId}-${idx}`,
            originalPurchaseLineId: r.original_purchase_line_id,
            itemId: r.item_id,
            itemName: origLine?.itemName || r.item_id,
            qty,
            unit: origLine?.unit || "pcs",
            rate,
            netAmount: lineAmt,
            totalAmount: Math.round((lineAmt + r.vat_reversal) * 100) / 100,
            lineTotal: Math.round((lineAmt + r.vat_reversal) * 100) / 100,
            isTaxable: r.vat_reversal > 0,
            taxableAmount: lineAmt,
            vatAmount: r.vat_reversal,
            unitCost: r.unit_cost,
            costAmount: r.cost_reversal,
            taxRuleVersion: r.tax_rule_version || undefined,
            valuationMethod: r.valuation_method || undefined,
            stockCondition: r.stock_condition || undefined,
          };
        }),
      } as DBInvoice & { partyAccountId: string; warehouseId: string };

      // Do not mutate original - snapshot for immutability check only
      const originalSnapshot = JSON.stringify({
        id: original.id,
        invoiceNo: original.invoiceNo,
        grandTotal: original.grandTotal,
        lines: original.lines,
        status: original.status,
      });

      await db.invoices.add(newInvoice as any);

      const verifyOriginal = await db.invoices.get(original.id);
      if (
        !verifyOriginal ||
        JSON.stringify({
          id: verifyOriginal.id,
          invoiceNo: verifyOriginal.invoiceNo,
          grandTotal: verifyOriginal.grandTotal,
          lines: verifyOriginal.lines,
          status: verifyOriginal.status,
        }) !== originalSnapshot
      ) {
        throw new Error("Original purchase invoice was mutated during adjustment posting.");
      }

      const itemsSnapshot = await db.items.toArray();
      const warehousesSnapshot =
        storeState.warehouses?.length > 0
          ? storeState.warehouses
          : [{ id: warehouseId, name: "Main Warehouse", isDefault: true }];
      const getSnap = () => ({
        ...storeState,
        items: itemsSnapshot,
        warehouses: warehousesSnapshot,
        currentUser: storeState.currentUser || { id: cmd.userId, name: cmd.userId },
      });
      const setSnap = (_partial: any) => {
        /* defer Zustand refresh until after Dexie commit */
      };

      await postInvoiceJournal(newInvoice, db, getSnap, setSnap);

      if (cmd.injectFailure === "before_stock") {
        throw Object.assign(new Error("Injected failure before stock movement."), {
          code: "injected_failure",
        });
      }

      let movements: Array<{ id: string }> = [];
      let inventoryJournalId: string | null = null;

      if (adj.adjustmentType === "inventory_purchase_return") {
        await postInvoiceStock(newInvoice, db, getSnap, setSnap);
        const stockRows = (await db.stockMovements
          .where("referenceId")
          .equals(invoiceId)
          .toArray()) as Array<{ id: string }>;
        movements = stockRows;
        if (!movements.length) {
          throw new Error("Stock movement was not persisted.");
        }

        if (inventoryPolicy.inventoryAccounting === "perpetual") {
          inventoryJournalId = await postPurchaseInventoryRemovalJournal(
            newInvoice,
            costTotal,
            db,
            {
              inventoryAccountId: inventoryPolicy.inventoryAccountId,
              purchaseAccountId: PURCHASE_ACCOUNT_ID,
            },
          );
        }
      }

      const journalId = `jnl-${invoiceId}`;
      const journal = await db.vouchers.get(journalId);
      if (!journal) {
        throw new Error("Journal voucher was not persisted.");
      }

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), {
          code: "injected_failure",
        });
      }

      await bumpPurchaseAdjustmentVersion(db, cmd.companyId, original.id, nextVersion, now);

      const auditId = generateId();
      const voucherIds = [journalId, ...(inventoryJournalId ? [inventoryJournalId] : [])];
      const auditAction =
        adj.adjustmentType === "inventory_purchase_return"
          ? "PURCHASE_RETURN_POSTED"
          : "SUPPLIER_DEBIT_NOTE_POSTED";
      await db.auditLogs.add({
        id: auditId,
        timestamp: now,
        userId: cmd.userId,
        userName: storeState.currentUser?.name || cmd.userId,
        action: auditAction,
        module: "purchase",
        entityType: "invoice",
        entityId: invoiceId,
        recordId: invoiceId,
        recordType: invoiceType,
        companyId: cmd.companyId,
        sessionId: cmd.conversationId || undefined,
        after: {
          invoiceNo,
          journalId,
          inventoryJournalId,
          voucherNo: journal.voucherNo,
          amount: finalGrand,
          vatAmount,
          costAmount: costTotal,
          originalInvoiceId: original.id,
          adjustmentType: adj.adjustmentType,
          reasonCode: adj.reasonCode,
          settlementMethod: adj.settlementMethod,
          adjustmentVersion: nextVersion,
          taxRuleVersion,
          draftId: cmd.draftId,
          requestId: cmd.requestId,
          source: cmd.source,
          idempotencyKey: cmd.idempotencyKey,
        },
      } as any);

      if (cmd.injectFailure === "before_sync") {
        throw Object.assign(new Error("Injected failure before sync."), {
          code: "injected_failure",
        });
      }

      const syncEnqueue = isLocalOnly(syncPolicy)
        ? ({ syncStatus: "disabled" as const, eventId: null })
        : await enqueuePurchaseAdjustmentSyncInTransaction(db, {
            tenantId: cmd.tenantId || "local",
            companyId: cmd.companyId,
            financialYearId: cmd.financialYearId ?? null,
            userId: cmd.userId,
            source: cmd.source,
            correlationId: cmd.requestId || postingId,
            causationId: cmd.draftId ?? null,
            idempotencyKey: cmd.idempotencyKey,
            syncPolicy,
            eventType,
            payload: {
              posting_id: postingId,
              invoice_id: invoiceId,
              invoice_number: invoiceNo,
              voucher_id: journalId,
              voucher_number: String(journal.voucherNo),
              voucher_ids: voucherIds,
              stock_movement_ids: movements.map((m) => m.id),
              audit_id: auditId,
              transaction_date: adj.transactionDate,
              adjustment_type: adj.adjustmentType,
              original_invoice_id: original.id,
              original_invoice_number: original.invoiceNo,
              party_id: adj.supplierId || original.partyId || null,
              party_name: original.partyName || null,
              reason_code: adj.reasonCode,
              settlement_method: adj.settlementMethod,
              settlement_account_id: partyAccountId,
              warehouse_id: warehouseId,
              item_lines: reversals.map((r, idx) => {
                const invLine = newInvoice.lines[idx];
                return {
                  original_purchase_line_id: r.original_purchase_line_id,
                  item_id: r.item_id,
                  item_name: invLine?.itemName || r.item_id,
                  quantity: r.return_quantity,
                  unit: invLine?.unit || "pcs",
                  rate: invLine?.rate || 0,
                  amount: r.taxable_reversal,
                  taxable_amount: r.taxable_reversal,
                  vat_amount: r.vat_reversal,
                  unit_cost: r.unit_cost,
                  cost_amount: r.cost_reversal,
                  tax_rule_version: r.tax_rule_version,
                  valuation_method: r.valuation_method,
                  stock_condition: r.stock_condition,
                };
              }),
              journal_lines: (((journal as { lines?: unknown }).lines || []) as unknown[]).filter(
                (l): l is Record<string, unknown> =>
                  typeof l === "object" && l !== null && !Array.isArray(l),
              ),
              inventory_journal_lines: (
                inventoryJournalId
                  ? ((((await db.vouchers.get(inventoryJournalId)) as { lines?: unknown } | undefined)
                      ?.lines || []) as unknown[])
                  : []
              ).filter(
                (l): l is Record<string, unknown> =>
                  typeof l === "object" && l !== null && !Array.isArray(l),
              ),
              inventory_voucher_id: inventoryJournalId,
              accounting_policy: {
                inventory_accounting: inventoryPolicy.inventoryAccounting,
                valuation_method: inventoryPolicy.valuationMethod,
              },
              tax_rule_version: taxRuleVersion,
              totals: {
                subtotal: taxableAmount,
                discount: 0,
                tax: vatAmount,
                taxable_amount: taxableAmount,
                exempt_amount: 0,
                grand_total: finalGrand,
                cost_total: costTotal,
                purchase_reversal: taxableAmount,
                vat_reversal: vatAmount,
                cost_reversal: costTotal,
              },
              currency: adj.currency || "NPR",
              financial_year_id: cmd.financialYearId ?? null,
              local_idempotency_key: cmd.idempotencyKey,
              source: cmd.source,
              receipt_id: receiptId,
              narration: newInvoice.narration,
              aggregate_version: nextVersion,
              adjustment_version_before: adjState.adjustmentVersion,
            },
          });

      const finalSyncStatus: PurchaseAdjustmentPostingSuccessPayload["sync_status"] =
        syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending";

      const successPayload: PurchaseAdjustmentPostingSuccessPayload = {
        posting_id: postingId,
        invoice_id: invoiceId,
        invoice_number: invoiceNo,
        voucher_id: journalId,
        voucher_number: String(journal.voucherNo),
        voucher_ids: voucherIds,
        stock_movement_ids: movements.map((m) => m.id),
        amount: moneyString(finalGrand),
        currency: adj.currency || "NPR",
        posted_at: now,
        idempotent_replay: false,
        sync_status: finalSyncStatus,
        sync_event_id: syncEnqueue.eventId,
        draft_id: cmd.draftId ?? null,
        audit_id: auditId,
        receipt_id: receiptId,
        operation,
        original_invoice_id: original.id,
        original_invoice_number: original.invoiceNo,
        adjustment_type: adj.adjustmentType,
        settlement_method: adj.settlementMethod,
        returned_quantity: String(qtyTotal),
        purchase_reversal: moneyString(taxableAmount),
        vat_reversal: moneyString(vatAmount),
        cost_reversal: moneyString(costTotal),
        adjustment_version: nextVersion,
        tax_rule_version: taxRuleVersion,
        inventory_accounting: inventoryPolicy.inventoryAccounting,
        valuation_method: inventoryPolicy.valuationMethod,
      };

      await db.orbixPostingReceipts.put({
        ...processing,
        status: "completed",
        invoiceId,
        voucherId: journalId,
        journalId,
        result: successPayload,
        completedAt: now,
      } as any);

      if (storeBridge) {
        const allInvoices = await db.invoices.toArray();
        const allVouchers = await db.vouchers.toArray();
        const allMovements = await db.stockMovements.toArray();
        const accounts = await db.accounts.toArray();
        storeBridge.setState({
          invoices: allInvoices.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          vouchers: allVouchers.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          stockMovements: allMovements,
          accounts,
        });
      }

      return {
        type: "posting_completed" as const,
        status: "success" as const,
        payload: successPayload,
      };
    });

    if (
      result.type === "posting_completed" &&
      result.payload.sync_status === "pending" &&
      typeof navigator !== "undefined" &&
      navigator.onLine
    ) {
      void import("@/platform/sync/syncCoordinator")
        .then((m) => m.runEventSyncCycle())
        .catch(() => {
          /* sync is best-effort after local commit */
        });
    }

    return result;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "in_progress" || code === "stale_adjustment_version") {
      return fail("conflict", code, (e as Error).message, {
        rolled_back: true,
        retryable: true,
        draft_id: cmd.draftId,
      });
    }
    if (code === "injected_failure") {
      return fail("posting_failed", "injected_failure", (e as Error).message, {
        rolled_back: true,
        retryable: true,
        draft_id: cmd.draftId,
      });
    }
    return fail(
      "posting_failed",
      "posting_exception",
      e instanceof Error ? e.message : "Purchase adjustment posting failed",
      { rolled_back: true, retryable: true, draft_id: cmd.draftId },
    );
  }
}

export async function postPurchaseReturnTransaction(
  command: Omit<PurchaseAdjustmentPostingCommand, "adjustment"> & {
    adjustment: Omit<PurchaseAdjustmentPostingCommand["adjustment"], "adjustmentType"> & {
      adjustmentType?: "inventory_purchase_return";
    };
  },
): Promise<PurchaseAdjustmentPostingResult> {
  return postPurchaseAdjustmentTransaction({
    ...command,
    adjustment: {
      ...command.adjustment,
      adjustmentType: "inventory_purchase_return",
    },
  });
}

export async function postSupplierDebitNoteTransaction(
  command: Omit<PurchaseAdjustmentPostingCommand, "adjustment"> & {
    adjustment: Omit<PurchaseAdjustmentPostingCommand["adjustment"], "adjustmentType"> & {
      adjustmentType?: "financial_supplier_debit_note";
    };
  },
): Promise<PurchaseAdjustmentPostingResult> {
  return postPurchaseAdjustmentTransaction({
    ...command,
    adjustment: {
      ...command.adjustment,
      adjustmentType: "financial_supplier_debit_note",
    },
  });
}
