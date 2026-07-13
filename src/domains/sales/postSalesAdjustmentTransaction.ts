/**
 * Authoritative sales returns / credit notes posting ? Model B (Dexie local-first).
 *
 * Creates a new linked document; never mutates the original sales-invoice.
 * Uses historical VAT/cost reversal facts ? never current rates or item cost.
 */

import { getDB, generateId, type DBInvoice } from "@/lib/db";
import { assertDateInFiscalYear } from "@/store/store.types";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import {
  parseMoneyToPaisa,
  paisaToNumber,
  paisaToString,
} from "@/domains/purchase/money";
import { enqueueSalesAdjustmentSyncInTransaction } from "@/platform/sync/enqueueSalesAdjustmentSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { resolveCompanyInventoryPolicy } from "./inventoryAccountingPolicy";
import {
  computeInvoiceRemainingBalance,
  getOrCreateAdjustmentState,
  bumpAdjustmentVersion,
  moneyString,
} from "./remainingBalance";
import {
  computeHistoricalLineReversal,
  computeFinancialCreditReversal,
  type HistoricalLineReversal,
  type StockCondition,
} from "./historicalReversal";

export type SalesAdjustmentType = "inventory_sales_return" | "financial_credit_note";
export type SalesAdjustmentSettlementMethod =
  | "reduce_receivable"
  | "cash_refund"
  | "bank_refund"
  | "customer_credit"
  | "refund_payable"
  | "no_immediate_settlement";
export type SaleAdjustmentCommandSource = "orbix" | "manual_form" | "import" | "test";

export interface SalesAdjustmentLineInput {
  originalSalesLineId: string;
  itemId: string;
  returnQuantity?: string | number | null;
  financialAdjustment?: string | number | null;
  stockCondition?: StockCondition | null;
}

export interface SalesAdjustmentPostingCommand {
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
  source: SaleAdjustmentCommandSource;
  expectedAdjustmentVersion?: number;
  adjustment: {
    adjustmentType: SalesAdjustmentType;
    originalInvoiceId: string;
    transactionDate: string;
    customerId?: string | null;
    settlementMethod: SalesAdjustmentSettlementMethod;
    settlementAccountId?: string | null;
    destinationWarehouseId?: string | null;
    reasonCode: string;
    narration?: string;
    lines: SalesAdjustmentLineInput[];
    currency?: string;
  };
  injectFailure?: "before_stock" | "before_audit" | "before_sync" | null;
}

export interface SalesAdjustmentPostingSuccessPayload {
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
  operation: "post_sales_return" | "post_sales_credit_note";
  original_invoice_id: string;
  original_invoice_number: string;
  adjustment_type: SalesAdjustmentType;
  settlement_method: SalesAdjustmentSettlementMethod;
  returned_quantity?: string;
  revenue_reversal: string;
  vat_reversal: string;
  cogs_reversal: string;
  adjustment_version: number;
  tax_rule_version?: string | null;
  inventory_accounting?: string;
  valuation_method?: string;
}

export type SalesAdjustmentPostingResult =
  | {
      type: "posting_completed";
      status: "success";
      payload: SalesAdjustmentPostingSuccessPayload;
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

export interface DBOrbixSalesAdjustmentPostingReceipt {
  id: string;
  idempotencyKey: string;
  scopedKey: string;
  tenantId: string;
  companyId: string;
  userId: string;
  operation: "post_sales_return" | "post_sales_credit_note";
  draftId: string | null;
  draftVersion: number | null;
  previewVersion: string | null;
  previewHash: string | null;
  status: "processing" | "completed" | "failed";
  postingId: string;
  voucherId: string | null;
  invoiceId: string | null;
  journalId: string | null;
  result: SalesAdjustmentPostingSuccessPayload | null;
  createdAt: string;
  completedAt: string | null;
}

function fail(
  type: SalesAdjustmentPostingResult["type"] & string,
  error_code: string,
  safe_message: string,
  opts?: {
    rolled_back?: boolean;
    retryable?: boolean;
    draft_id?: string | null;
  },
): SalesAdjustmentPostingResult {
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

export function buildSalesAdjustmentScopedIdempotencyKey(
  cmd: SalesAdjustmentPostingCommand,
): string {
  const operation =
    cmd.adjustment.adjustmentType === "inventory_sales_return"
      ? "post_sales_return"
      : "post_sales_credit_note";
  return [cmd.tenantId || "local", cmd.companyId, operation, cmd.idempotencyKey].join("|");
}

/** True when Orbix/khata intent is a sales return or credit note (not a fresh sale). */
export function isSalesAdjustmentIntent(intent: string | undefined | null): boolean {
  const i = (intent || "").trim().toLowerCase();
  return (
    i === "khata_sales_return" ||
    i === "sales_return" ||
    i === "sales-return" ||
    i === "credit_note" ||
    i === "credit-note" ||
    i === "inventory_sales_return" ||
    i === "financial_credit_note"
  );
}

function resolvePartyAccountId(
  method: SalesAdjustmentSettlementMethod,
  settlementAccountId: string | null | undefined,
  receivableAccountId: string,
): string {
  if (method === "cash_refund") {
    return settlementAccountId || "acc-cash";
  }
  if (method === "bank_refund") {
    return settlementAccountId || "acc-bank";
  }
  return settlementAccountId || receivableAccountId;
}

function validateCommand(cmd: SalesAdjustmentPostingCommand): SalesAdjustmentPostingResult | null {
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
      "Your role cannot post sales adjustments.",
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
      "reduce_receivable",
      "cash_refund",
      "bank_refund",
      "customer_credit",
      "refund_payable",
      "no_immediate_settlement",
    ].includes(adj.settlementMethod)
  ) {
    return fail("validation_error", "invalid_settlement", "Settlement method is required.", {
      draft_id: cmd.draftId,
    });
  }
  if (
    adj.adjustmentType !== "inventory_sales_return" &&
    adj.adjustmentType !== "financial_credit_note"
  ) {
    return fail("validation_error", "invalid_adjustment_type", "Unknown adjustment type.", {
      draft_id: cmd.draftId,
    });
  }
  return null;
}

/**
 * Authoritative sales return / credit note post.
 * One Dexie transaction: new document, journal, optional stock/COGS reversal, audit, receipt, sync.
 */
export async function postSalesAdjustmentTransaction(
  cmd: SalesAdjustmentPostingCommand,
): Promise<SalesAdjustmentPostingResult> {
  const early = validateCommand(cmd);
  if (early) return early;

  const db = getDB();
  const adj = cmd.adjustment;
  const operation =
    adj.adjustmentType === "inventory_sales_return"
      ? ("post_sales_return" as const)
      : ("post_sales_credit_note" as const);
  const eventType =
    adj.adjustmentType === "inventory_sales_return"
      ? ("sales_return_posted" as const)
      : ("sales_credit_note_posted" as const);
  const scopedKey = buildSalesAdjustmentScopedIdempotencyKey(cmd);
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();
  const invoiceType =
    adj.adjustmentType === "inventory_sales_return" ? "sales-return" : "credit-note";

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
    return fail("validation_error", "original_not_found", "Original Sales invoice not found.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  if (original.type !== "sales-invoice") {
    return fail(
      "validation_error",
      "invalid_original_type",
      "Original document must be a posted sales-invoice.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }
  if (String(original.status || "").toLowerCase() !== "posted") {
    return fail(
      "validation_error",
      "original_not_posted",
      "Original sales invoice must be posted.",
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

  if (adj.customerId && original.partyId && adj.customerId !== original.partyId) {
    return fail(
      "validation_error",
      "customer_mismatch",
      "Customer does not match original invoice.",
      { draft_id: cmd.draftId },
    );
  }

  const balance = await computeInvoiceRemainingBalance(db, original.id);
  if (!balance) {
    return fail("validation_error", "balance_unavailable", "Could not compute remaining balance.", {
      draft_id: cmd.draftId,
    });
  }

  // Early idempotent replay ? before optimistic-concurrency rejection
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
          ...(existingEarly.result as unknown as SalesAdjustmentPostingSuccessPayload),
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

  const remByLine = new Map(balance.lines.map((l) => [l.original_sales_line_id, l]));
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
      const rem = remByLine.get(line.originalSalesLineId);
      if (!rem) {
        return fail(
          "validation_error",
          "original_line_missing",
          `Original sales line ${line.originalSalesLineId} was not found.`,
          { draft_id: cmd.draftId },
        );
      }
      if (rem.item_id !== line.itemId) {
        return fail(
          "validation_error",
          "original_line_mismatch",
          `Item mismatch for line ${line.originalSalesLineId}.`,
          { draft_id: cmd.draftId },
        );
      }

      if (adj.adjustmentType === "inventory_sales_return") {
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
          computeHistoricalLineReversal({
            balance: rem,
            returnQuantity: qty,
            taxRuleVersion,
            valuationMethod,
            stockCondition: line.stockCondition ?? "resalable",
          }),
        );
      } else {
        const creditRaw = line.financialAdjustment ?? 0;
        const credit =
          typeof creditRaw === "number"
            ? creditRaw
            : paisaToNumber(parseMoneyToPaisa(String(creditRaw)));
        if (!(credit > 0)) {
          return fail(
            "validation_error",
            "zero_credit_amount",
            "Financial adjustment must be positive.",
            { draft_id: cmd.draftId },
          );
        }
        reversals.push(
          computeFinancialCreditReversal({
            balance: rem,
            creditAmount: credit,
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
  /** Journal must balance: party credit = taxable + VAT. */
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
      postSalesCogsReversalJournal,
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
      adj.adjustmentType === "inventory_sales_return" &&
      inventoryPolicy.inventoryAccounting === "perpetual"
    ) {
      await ensureGlAccount(inventoryPolicy.cogsAccountId, "5102", "Cost of Goods Sold", "expense");
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
      db.salesInvoiceAdjustmentState,
    ].filter(Boolean);

    const result = await db.transaction("rw", txnTables, async () => {
      const existing = await db.orbixPostingReceipts.where("scopedKey").equals(scopedKey).first();
      if (existing?.status === "completed" && existing.result) {
        return {
          type: "posting_completed" as const,
          status: "success" as const,
          payload: {
            ...(existing.result as unknown as SalesAdjustmentPostingSuccessPayload),
            idempotent_replay: true,
          },
        };
      }
      if (existing?.status === "processing") {
        throw Object.assign(new Error("Posting already in progress for this confirmation."), {
          code: "in_progress",
        });
      }

      const adjState = await getOrCreateAdjustmentState(db, cmd.companyId, original.id);
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
      const processing: DBOrbixSalesAdjustmentPostingReceipt = {
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
        adj.settlementMethod === "cash_refund"
          ? "cash"
          : adj.settlementMethod === "bank_refund"
            ? "bank"
            : "credit";
      const partyAccountId = resolvePartyAccountId(
        adj.settlementMethod,
        adj.settlementAccountId,
        inventoryPolicy.receivableAccountId,
      );

      const taxableAmount = Math.round(taxableTotal * 100) / 100;
      const vatAmount = Math.round(vatTotal * 100) / 100;
      const finalGrand = settlementTotal;

      const newInvoice: DBInvoice = {
        id: invoiceId,
        invoiceNo,
        date: adj.transactionDate,
        type: invoiceType,
        status: "posted",
        partyId: adj.customerId || original.partyId || undefined,
        partyName: original.partyName || "Customer",
        partyAccountId,
        paymentMode,
        paymentStatus:
          adj.settlementMethod === "cash_refund" || adj.settlementMethod === "bank_refund"
            ? "paid"
            : "unpaid",
        paidAmount:
          adj.settlementMethod === "cash_refund" || adj.settlementMethod === "bank_refund"
            ? finalGrand
            : 0,
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
            adj.adjustmentType === "inventory_sales_return" ? r.return_quantity : 0;
          const lineAmt = r.taxable_reversal;
          const rate =
            qty > 0
              ? Math.round((lineAmt / qty) * 100) / 100
              : lineAmt;
          const origLine = (original.lines || []).find(
            (l, i) =>
              (l.id || `line-${original.id}-${i}`) === r.original_sales_line_id,
          );
          return {
            id: `line-${invoiceId}-${idx}`,
            originalSalesLineId: r.original_sales_line_id,
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

      // Do not mutate original ? snapshot for immutability check only
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
        throw new Error("Original sales invoice was mutated during adjustment posting.");
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
      let cogsJournalId: string | null = null;

      if (adj.adjustmentType === "inventory_sales_return") {
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
          cogsJournalId = await postSalesCogsReversalJournal(
            newInvoice,
            costTotal,
            db,
            {
              cogsAccountId: inventoryPolicy.cogsAccountId,
              inventoryAccountId: inventoryPolicy.inventoryAccountId,
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

      await bumpAdjustmentVersion(db, cmd.companyId, original.id, nextVersion, now);

      const auditId = generateId();
      const voucherIds = [journalId, ...(cogsJournalId ? [cogsJournalId] : [])];
      const auditAction =
        adj.adjustmentType === "inventory_sales_return"
          ? "SALES_RETURN_POSTED"
          : "SALES_CREDIT_NOTE_POSTED";
      await db.auditLogs.add({
        id: auditId,
        timestamp: now,
        userId: cmd.userId,
        userName: storeState.currentUser?.name || cmd.userId,
        action: auditAction,
        module: "sales",
        entityType: "invoice",
        entityId: invoiceId,
        recordId: invoiceId,
        recordType: invoiceType,
        companyId: cmd.companyId,
        sessionId: cmd.conversationId || undefined,
        after: {
          invoiceNo,
          journalId,
          cogsJournalId,
          voucherNo: journal.voucherNo,
          amount: finalGrand,
          vatAmount,
          cogsAmount: costTotal,
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
        : await enqueueSalesAdjustmentSyncInTransaction(db, {
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
              party_id: adj.customerId || original.partyId || null,
              party_name: original.partyName || null,
              reason_code: adj.reasonCode,
              settlement_method: adj.settlementMethod,
              settlement_account_id: partyAccountId,
              warehouse_id: warehouseId,
              item_lines: reversals.map((r, idx) => {
                const invLine = newInvoice.lines[idx];
                return {
                  original_sales_line_id: r.original_sales_line_id,
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
              cogs_journal_lines: (
                cogsJournalId
                  ? ((((await db.vouchers.get(cogsJournalId)) as { lines?: unknown } | undefined)
                      ?.lines || []) as unknown[])
                  : []
              ).filter(
                (l): l is Record<string, unknown> =>
                  typeof l === "object" && l !== null && !Array.isArray(l),
              ),
              cogs_voucher_id: cogsJournalId,
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
                cogs_total: costTotal,
                revenue_reversal: taxableAmount,
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

      const finalSyncStatus: SalesAdjustmentPostingSuccessPayload["sync_status"] =
        syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending";

      const successPayload: SalesAdjustmentPostingSuccessPayload = {
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
        revenue_reversal: moneyString(taxableAmount),
        vat_reversal: moneyString(vatAmount),
        cogs_reversal: moneyString(costTotal),
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
      e instanceof Error ? e.message : "Sales adjustment posting failed",
      { rolled_back: true, retryable: true, draft_id: cmd.draftId },
    );
  }
}

export async function postSalesReturnTransaction(
  command: Omit<SalesAdjustmentPostingCommand, "adjustment"> & {
    adjustment: Omit<SalesAdjustmentPostingCommand["adjustment"], "adjustmentType"> & {
      adjustmentType?: "inventory_sales_return";
    };
  },
): Promise<SalesAdjustmentPostingResult> {
  return postSalesAdjustmentTransaction({
    ...command,
    adjustment: {
      ...command.adjustment,
      adjustmentType: "inventory_sales_return",
    },
  });
}

export async function postSalesCreditNoteTransaction(
  command: Omit<SalesAdjustmentPostingCommand, "adjustment"> & {
    adjustment: Omit<SalesAdjustmentPostingCommand["adjustment"], "adjustmentType"> & {
      adjustmentType?: "financial_credit_note";
    };
  },
): Promise<SalesAdjustmentPostingResult> {
  return postSalesAdjustmentTransaction({
    ...command,
    adjustment: {
      ...command.adjustment,
      adjustmentType: "financial_credit_note",
    },
  });
}
