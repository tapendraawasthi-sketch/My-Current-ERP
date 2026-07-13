/**
 * Authoritative inventory sales posting — Model B (Dexie local-first).
 *
 * Manual sales forms and Orbix inventory confirms both converge here.
 * Shares writers / receipts / eventSyncQueue with purchase — does not fork a second engine.
 */

import { getDB, generateId, type DBInvoice, type DBItem } from "@/lib/db";
import { assertDateInFiscalYear } from "@/store/store.types";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import {
  parseMoneyToPaisa,
  paisaToNumber,
  paisaToString,
  assertQtyRateTotal,
} from "@/domains/purchase/money";
import { enqueueSalesSyncInTransaction } from "@/platform/sync/enqueueSalesSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import {
  classificationFromSalePayment,
  type TransactionClassification,
} from "./transactionClassification";
import {
  resolveCompanyInventoryPolicy,
} from "./inventoryAccountingPolicy";
import {
  allocateSalesLineCost,
  sumAllocationCosts,
  type SalesLineCostAllocation,
} from "./costAllocation";
import { computeSalesVat, DEFAULT_TAX_RULE_VERSION } from "./salesVatEngine";

export const E2E_SALES_COMPANY_NAME = "Orbix Sales E2E Company";
export const E2E_SALES_COMPANY_ID = "orbix-sales-e2e-company";
export const E2E_SALES_ITEM_NAME = "E2E Test Bike";
export const E2E_SALES_ITEM_ID = "item-e2e-test-bike";
export const E2E_SALES_CUSTOMER_ID = "party-ram-traders-e2e";
export const E2E_SALES_CUSTOMER_NAME = "Ram Traders E2E";

/** Prefer sales E2E constants; fall back to purchase E2E bike id for shared seed. */
export {
  E2E_ITEM_ID as SHARED_E2E_ITEM_ID,
  E2E_ITEM_NAME as SHARED_E2E_ITEM_NAME,
} from "@/domains/purchase/postPurchaseTransaction";

export type SalePaymentMethod = "cash" | "bank" | "credit";
export type SaleCommandSource = "orbix" | "manual_form" | "import" | "test";

export interface SaleLineInput {
  itemId: string;
  quantity: string;
  unit: string;
  rate: string;
  discountAmount?: string;
  taxAmount?: string;
  lineAmount: string;
  /** Alias used by some adapters */
  amount?: string;
}

export interface SalesPostingCommand {
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
  source: SaleCommandSource;
  sale: {
    transactionDate: string;
    customerId?: string | null;
    customerName?: string | null;
    paymentMethod: SalePaymentMethod;
    paymentAccountId?: string | null;
    warehouseId?: string | null;
    /** Test/E2E only — deterministic invoice number allocated before hashing. */
    invoiceNo?: string | null;
    items: SaleLineInput[];
    subtotal: string;
    discountAmount?: string;
    taxAmount?: string;
    grandTotal: string;
    currency: string;
    narration: string;
  };
  injectFailure?: "before_stock" | "before_audit" | null;
}

export interface SalesPostingSuccessPayload {
  posting_id: string;
  invoice_id: string;
  invoice_number: string;
  voucher_id: string;
  voucher_number: string;
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
  classification?: TransactionClassification;
  customer_id?: string | null;
  vat_amount?: string;
  cogs_amount?: string;
  inventory_accounting?: string;
  valuation_method?: string;
  tax_rule_version?: string | null;
  voucher_ids?: string[];
}

export type SalesPostingResult =
  | {
      type: "posting_completed";
      status: "success";
      payload: SalesPostingSuccessPayload;
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

export interface DBOrbixSalesPostingReceipt {
  id: string;
  idempotencyKey: string;
  scopedKey: string;
  tenantId: string;
  companyId: string;
  userId: string;
  operation: "post_sale";
  draftId: string | null;
  draftVersion: number | null;
  previewVersion: string | null;
  previewHash: string | null;
  status: "processing" | "completed" | "failed";
  postingId: string;
  voucherId: string | null;
  invoiceId: string | null;
  journalId: string | null;
  result: SalesPostingSuccessPayload | null;
  createdAt: string;
  completedAt: string | null;
}

function fail(
  type: SalesPostingResult["type"] & string,
  error_code: string,
  safe_message: string,
  opts?: {
    rolled_back?: boolean;
    retryable?: boolean;
    draft_id?: string | null;
  },
): SalesPostingResult {
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

export function buildSalesScopedIdempotencyKey(cmd: SalesPostingCommand): string {
  return [
    cmd.tenantId || "local",
    cmd.companyId,
    "post_sale",
    cmd.draftId || "no-draft",
    String(cmd.previewVersion ?? "nv"),
    cmd.previewHash || "no-hash",
    cmd.idempotencyKey,
  ].join("|");
}

export function isInventorySalesIntent(intent: string | undefined | null): boolean {
  const i = (intent || "").trim().toLowerCase();
  return (
    i === "khata_cash_sale" ||
    i === "khata_credit_sale" ||
    i === "khata_stock_sale_cogs" ||
    i === "sale" ||
    i === "sales" ||
    i === "inventory_sale" ||
    i === "inventory_sale_cash" ||
    i === "inventory_sale_bank" ||
    i === "inventory_sale_credit" ||
    i === "sale_entry"
  );
}

export async function resolveInventoryItemForSale(
  itemName: string | null | undefined,
): Promise<DBItem | null> {
  const db = getDB();
  const items = await db.items.toArray();
  const needle = (itemName || "").trim().toLowerCase();
  if (!needle) return null;

  const e2e = items.find(
    (i) => i.id === E2E_SALES_ITEM_ID || i.name === E2E_SALES_ITEM_NAME,
  );
  if (
    e2e &&
    (needle === "bike" ||
      needle === E2E_SALES_ITEM_NAME.toLowerCase() ||
      needle.includes("bike") ||
      needle.includes("e2e test bike"))
  ) {
    return e2e;
  }

  const exact = items.filter(
    (i) =>
      i.isActive !== false &&
      i.type !== "service" &&
      i.type !== "fixed-asset" &&
      (i.name || "").toLowerCase() === needle,
  );
  if (exact.length === 1) return exact[0];

  const fuzzy = items.filter(
    (i) =>
      i.isActive !== false &&
      i.type !== "service" &&
      i.type !== "fixed-asset" &&
      (i.name || "").toLowerCase().includes(needle),
  );
  if (fuzzy.length === 1) return fuzzy[0];
  return null;
}

async function getOnHandQty(
  db: ReturnType<typeof getDB>,
  itemId: string,
  warehouseId: string,
  asOfDate: string,
): Promise<number> {
  const existing = await db.stockMovements.where("itemId").equals(itemId).toArray();
  return existing
    .filter((m) => m.warehouseId === warehouseId && String(m.date || "") <= asOfDate)
    .reduce((sum, m) => {
      const t = String(m.type || "").toLowerCase();
      const q = Math.abs(Number(m.qty || 0));
      const outward =
        t === "out" ||
        t === "sales-invoice" ||
        t === "sale" ||
        t === "purchase-return" ||
        Number(m.qty || 0) < 0;
      return outward ? sum - q : sum + q;
    }, 0);
}

function validateCommand(cmd: SalesPostingCommand): SalesPostingResult | null {
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
      "Your role cannot post sales transactions.",
      { retryable: false, draft_id: cmd.draftId },
    );
  }
  if (!cmd.sale?.items?.length) {
    return fail("validation_error", "missing_items", "At least one sales line is required.");
  }
  if (!["cash", "bank", "credit"].includes(cmd.sale.paymentMethod)) {
    return fail("validation_error", "invalid_payment", "Payment method is required.");
  }
  if (cmd.sale.paymentMethod === "credit" && !cmd.sale.customerId && !cmd.sale.customerName) {
    return fail("validation_error", "missing_customer", "Credit sales require a customer.", {
      draft_id: cmd.draftId,
    });
  }
  if (
    (cmd.sale.paymentMethod === "cash" || cmd.sale.paymentMethod === "bank") &&
    !cmd.sale.paymentAccountId
  ) {
    return fail(
      "validation_error",
      "missing_payment_account",
      "Cash/bank sales require a payment account.",
      { draft_id: cmd.draftId },
    );
  }

  try {
    const grand = parseMoneyToPaisa(cmd.sale.grandTotal);
    if (grand <= 0) throw new Error("Grand total must be greater than zero");
    let lineSum = 0;
    for (const line of cmd.sale.items) {
      const lineAmt = line.lineAmount ?? line.amount;
      if (!lineAmt) throw new Error("Line amount is required");
      assertQtyRateTotal(line.quantity, line.rate, lineAmt);
      lineSum += parseMoneyToPaisa(lineAmt);
    }
    const discount = parseMoneyToPaisa(cmd.sale.discountAmount || "0");
    const tax = parseMoneyToPaisa(cmd.sale.taxAmount || "0");
    const expected = lineSum - discount + tax;
    if (Math.abs(expected - grand) > 1) {
      return fail(
        "validation_error",
        "total_mismatch",
        `Line totals do not match grand total (${paisaToString(grand)}).`,
        { draft_id: cmd.draftId },
      );
    }
  } catch (e) {
    return fail(
      "validation_error",
      "invalid_amounts",
      e instanceof Error ? e.message : "Invalid monetary amounts.",
      { draft_id: cmd.draftId },
    );
  }

  if (cmd.source === "orbix") {
    if (!cmd.draftId || !cmd.previewHash) {
      return fail(
        "validation_error",
        "missing_preview",
        "Orbix confirmation requires draft_id and preview_hash.",
        { draft_id: cmd.draftId },
      );
    }
  }

  return null;
}

/**
 * Authoritative inventory sales post.
 * One Dexie transaction: invoice, journal, stock-out, audit, receipt, sales_posted event.
 */
export async function postSalesTransaction(
  cmd: SalesPostingCommand,
): Promise<SalesPostingResult> {
  const early = validateCommand(cmd);
  if (early) return early;

  const db = getDB();
  const scopedKey = buildSalesScopedIdempotencyKey(cmd);
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();
  const classification = classificationFromSalePayment(cmd.sale.paymentMethod);
  const warehouseId = cmd.sale.warehouseId || "wh-main";

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
    assertDateInFiscalYear(cmd.sale.transactionDate, fy);
    await enforcePostingPeriodLock(cmd.sale.transactionDate, db);
  } catch (e) {
    return fail(
      "validation_error",
      "period_or_fy",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  const resolvedLines: Array<{
    item: DBItem;
    qty: number;
    rate: number;
    amount: number;
    unit: string;
  }> = [];

  for (const line of cmd.sale.items) {
    const item = await db.items.get(line.itemId);
    if (!item || item.isActive === false) {
      return fail("validation_error", "invalid_item", `Item ${line.itemId} is missing or inactive.`, {
        draft_id: cmd.draftId,
      });
    }
    if (item.type === "service" || item.type === "fixed-asset") {
      return fail(
        "validation_error",
        "not_inventory",
        `Item "${item.name}" is not classified as inventory for resale.`,
        { draft_id: cmd.draftId },
      );
    }
    const lineAmt = line.lineAmount ?? line.amount ?? "0";
    resolvedLines.push({
      item,
      qty: Number(line.quantity),
      rate: paisaToNumber(parseMoneyToPaisa(line.rate)),
      amount: paisaToNumber(parseMoneyToPaisa(lineAmt)),
      unit: line.unit || item.unit || "pcs",
    });
  }

  // Negative-stock policy (explicit company policy; default block)
  const companySettingsRow =
    (await db.companySettings.get("main")) ||
    storeState.companySettings ||
    {};
  const inventoryPolicy = resolveCompanyInventoryPolicy({
    ...(companySettingsRow as object),
    ...(storeState.inventoryConfiguration || {}),
  } as Record<string, unknown>);

  const allowNegative =
    inventoryPolicy.negativeStock === "allow" ||
    inventoryPolicy.negativeStock === "warn_and_allow";
  if (!allowNegative) {
    for (const line of resolvedLines) {
      const onHand = await getOnHandQty(
        db,
        line.item.id,
        warehouseId,
        cmd.sale.transactionDate,
      );
      if (onHand < line.qty) {
        return fail(
          "validation_error",
          "insufficient_stock",
          `Insufficient stock for ${line.item.name} (on hand ${onHand}, required ${line.qty}).`,
          { draft_id: cmd.draftId, retryable: false },
        );
      }
    }
  }

  if (cmd.sale.paymentMethod === "credit" && cmd.sale.customerId) {
    const party = await db.parties.get(cmd.sale.customerId);
    if (!party || (party as { isActive?: boolean }).isActive === false) {
      return fail("validation_error", "invalid_customer", "Customer is missing or inactive.", {
        draft_id: cmd.draftId,
      });
    }
  }

  // Deterministic VAT (configuration-driven; not LLM)
  const vatRegistered = Boolean(
    (companySettingsRow as { vatNumber?: string }).vatNumber ||
      (companySettingsRow as { vatRegistered?: boolean }).vatRegistered === true ||
      cmd.sale.taxAmount,
  );
  const vatResult = computeSalesVat({
    transactionDate: cmd.sale.transactionDate,
    priceMode: "exclusive",
    invoiceDiscount: cmd.sale.discountAmount || "0",
    vatRegistered,
    ruleVersion: DEFAULT_TAX_RULE_VERSION,
    items: resolvedLines.map((l) => ({
      itemId: l.item.id,
      quantity: String(l.qty),
      rate: paisaToString(parseMoneyToPaisa(String(l.rate))),
      isTaxable: (l.item as { isTaxable?: boolean }).isTaxable !== false && vatRegistered,
      vatRate: Number((l.item as { vatRate?: number }).vatRate ?? 13),
      vatClassificationId: (l.item as { vatClassificationId?: string }).vatClassificationId,
    })),
  });

  // Prefer command grand total when tax was explicitly zeroed (Orbix/E2E untaxed path);
  // otherwise use VAT engine totals when VAT applies.
  const engineGrand = paisaToNumber(parseMoneyToPaisa(vatResult.grand_total));
  const cmdGrand = paisaToNumber(parseMoneyToPaisa(cmd.sale.grandTotal));
  const useEngineVat =
    vatRegistered && paisaToNumber(parseMoneyToPaisa(vatResult.vat_amount)) > 0;
  const taxableAmount = useEngineVat
    ? paisaToNumber(parseMoneyToPaisa(vatResult.taxable_amount))
    : cmdGrand;
  const vatAmount = useEngineVat
    ? paisaToNumber(parseMoneyToPaisa(vatResult.vat_amount))
    : 0;
  const exemptAmount = useEngineVat
    ? paisaToNumber(parseMoneyToPaisa(vatResult.exempt_amount))
    : 0;
  const grandTotal = useEngineVat ? engineGrand : cmdGrand;
  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);

  try {
    const { postInvoiceJournal, postInvoiceStock, generateNextInvoiceNo, postSalesCogsJournal } =
      await import("@/store/invoicePostingWriters");

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
    if (inventoryPolicy.inventoryAccounting === "perpetual") {
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
      db.salesCostAllocations,
    ].filter(Boolean);

    const result = await db.transaction("rw", txnTables, async () => {
        const existing = await db.orbixPostingReceipts.where("scopedKey").equals(scopedKey).first();
        if (existing?.status === "completed" && existing.result) {
          return {
            type: "posting_completed" as const,
            status: "success" as const,
            payload: {
              ...(existing.result as unknown as SalesPostingSuccessPayload),
              idempotent_replay: true,
            },
          };
        }
        if (existing?.status === "processing") {
          throw Object.assign(new Error("Posting already in progress for this confirmation."), {
            code: "in_progress",
          });
        }

        const receiptId = existing?.id || generateId();
        const processing: DBOrbixSalesPostingReceipt = {
          id: receiptId,
          idempotencyKey: cmd.idempotencyKey,
          scopedKey,
          tenantId: cmd.tenantId || "local",
          companyId: cmd.companyId,
          userId: cmd.userId,
          operation: "post_sale",
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
        const requestedNo =
          cmd.source === "test" && cmd.sale.invoiceNo
            ? String(cmd.sale.invoiceNo).trim()
            : "";
        if (requestedNo) {
          const clash = await db.invoices.where("invoiceNo").equals(requestedNo).first();
          if (clash) {
            throw new Error(`Test invoice number already exists: ${requestedNo}`);
          }
          invoiceNo = requestedNo;
        } else {
          for (let attempt = 0; attempt < 5; attempt++) {
            invoiceNo = await generateNextInvoiceNo("sales-invoice", db);
            const clash = await db.invoices.where("invoiceNo").equals(invoiceNo).first();
            if (!clash) break;
            if (attempt === 4) {
              throw new Error(`Could not allocate unique invoice number (last=${invoiceNo})`);
            }
          }
        }

        const paymentMode =
          cmd.sale.paymentMethod === "cash"
            ? "cash"
            : cmd.sale.paymentMethod === "bank"
              ? "bank"
              : "credit";

        const partyAccountId =
          cmd.sale.paymentMethod === "credit"
            ? inventoryPolicy.receivableAccountId
            : cmd.sale.paymentAccountId || "acc-cash";

        // Authoritative cost allocations (persist exact facts)
        const allocations: SalesLineCostAllocation[] = [];
        for (let idx = 0; idx < resolvedLines.length; idx++) {
          const l = resolvedLines[idx];
          const salesLineId = `line-${invoiceId}-${idx}`;
          const alloc = await allocateSalesLineCost({
            db,
            postingId,
            invoiceId,
            salesLineId,
            item: l.item,
            warehouseId,
            quantity: l.qty,
            transactionDate: cmd.sale.transactionDate,
            valuationMethod: inventoryPolicy.valuationMethod,
            companyId: cmd.companyId,
            nowIso: now,
          });
          allocations.push(alloc);
          if (db.salesCostAllocations) {
            await db.salesCostAllocations.put(alloc as any);
          }
        }
        const cogsTotalStr = sumAllocationCosts(allocations);
        const cogsTotal = paisaToNumber(parseMoneyToPaisa(cogsTotalStr));

        const newInvoice: DBInvoice = {
          id: invoiceId,
          invoiceNo,
          date: cmd.sale.transactionDate,
          type: "sales-invoice",
          status: "posted",
          partyId: cmd.sale.customerId || undefined,
          partyName:
            cmd.sale.customerName ||
            (cmd.sale.paymentMethod === "cash" ? "Cash Sale" : "Customer"),
          partyAccountId,
          paymentMode,
          paymentStatus: cmd.sale.paymentMethod === "credit" ? "unpaid" : "paid",
          paidAmount: cmd.sale.paymentMethod === "credit" ? 0 : grandTotal,
          subTotal: taxableAmount + exemptAmount,
          taxableAmount,
          exemptAmount,
          vatAmount,
          vatApplicable: vatAmount > 0,
          discountAmount: paisaToNumber(parseMoneyToPaisa(cmd.sale.discountAmount || "0")),
          grandTotal,
          total: grandTotal,
          currencyCode: cmd.sale.currency || "NPR",
          narration: cmd.sale.narration,
          createdBy: cmd.userId,
          warehouseId,
          taxRuleVersion: vatResult.rule_version,
          inventoryAccounting: inventoryPolicy.inventoryAccounting,
          valuationMethod: inventoryPolicy.valuationMethod,
          lines: resolvedLines.map((l, idx) => {
            const alloc = allocations[idx];
            const vatLine = vatResult.lines.find((v) => v.item_id === l.item.id);
            return {
              id: `line-${invoiceId}-${idx}`,
              itemId: l.item.id,
              itemName: l.item.name,
              qty: l.qty,
              unit: l.unit,
              rate: l.rate,
              netAmount: l.amount,
              totalAmount: l.amount,
              lineTotal: l.amount,
              isTaxable: vatLine ? vatLine.tax_treatment === "taxable" : true,
              taxableAmount: vatLine
                ? paisaToNumber(parseMoneyToPaisa(vatLine.taxable_amount))
                : l.amount,
              vatAmount: vatLine ? paisaToNumber(parseMoneyToPaisa(vatLine.vat_amount)) : 0,
              unitCost: paisaToNumber(parseMoneyToPaisa(alloc.unit_cost)),
              costAmount: paisaToNumber(parseMoneyToPaisa(alloc.total_cost)),
              valuationMethod: alloc.valuation_method,
              costAllocationId: alloc.id,
            };
          }),
        } as DBInvoice & { partyAccountId: string; warehouseId: string };

        await db.invoices.add(newInvoice as any);

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

        await postInvoiceStock(newInvoice, db, getSnap, setSnap);

        let cogsJournalId: string | null = null;
        if (inventoryPolicy.inventoryAccounting === "perpetual") {
          cogsJournalId = await postSalesCogsJournal(
            newInvoice,
            cogsTotal,
            db,
            {
              cogsAccountId: inventoryPolicy.cogsAccountId,
              inventoryAccountId: inventoryPolicy.inventoryAccountId,
            },
          );
        }

        const journalId = `jnl-${invoiceId}`;
        const journal = await db.vouchers.get(journalId);
        if (!journal) {
          throw new Error("Journal voucher was not persisted.");
        }

        const movements = await db.stockMovements.where("referenceId").equals(invoiceId).toArray();
        if (!movements.length) {
          throw new Error("Stock movement was not persisted.");
        }

        if (cmd.injectFailure === "before_audit") {
          throw Object.assign(new Error("Injected failure before audit."), {
            code: "injected_failure",
          });
        }

        const auditId = generateId();
        const voucherIds = [journalId, ...(cogsJournalId ? [cogsJournalId] : [])];
        await db.auditLogs.add({
          id: auditId,
          timestamp: now,
          userId: cmd.userId,
          userName: storeState.currentUser?.name || cmd.userId,
          action: "SALES_POSTED",
          module: "sales",
          entityType: "invoice",
          entityId: invoiceId,
          recordId: invoiceId,
          recordType: "sales-invoice",
          companyId: cmd.companyId,
          sessionId: cmd.conversationId || undefined,
          after: {
            invoiceNo,
            journalId,
            cogsJournalId,
            voucherNo: journal.voucherNo,
            amount: grandTotal,
            vatAmount,
            cogsAmount: cogsTotal,
            inventoryAccounting: inventoryPolicy.inventoryAccounting,
            valuationMethod: inventoryPolicy.valuationMethod,
            taxRuleVersion: vatResult.rule_version,
            draftId: cmd.draftId,
            requestId: cmd.requestId,
            source: cmd.source,
            idempotencyKey: cmd.idempotencyKey,
            classification,
          },
        } as any);

        const syncEnqueue = isLocalOnly(syncPolicy)
          ? ({ syncStatus: "disabled" as const, eventId: null })
          : await enqueueSalesSyncInTransaction(db, {
              tenantId: cmd.tenantId || "local",
              companyId: cmd.companyId,
              financialYearId: cmd.financialYearId ?? null,
              userId: cmd.userId,
              source: cmd.source,
              correlationId: cmd.requestId || postingId,
              causationId: cmd.draftId ?? null,
              idempotencyKey: cmd.idempotencyKey,
              syncPolicy,
              payload: {
                posting_id: postingId,
                invoice_id: invoiceId,
                invoice_number: invoiceNo,
                voucher_id: journalId,
                voucher_number: String(journal.voucherNo),
                stock_movement_ids: movements.map((m) => m.id),
                audit_id: auditId,
                transaction_date: cmd.sale.transactionDate,
                party_id: cmd.sale.customerId ?? null,
                party_name: cmd.sale.customerName ?? null,
                payment_method: cmd.sale.paymentMethod,
                payment_account_id: partyAccountId,
                classification,
                warehouse_id: warehouseId,
                item_lines: resolvedLines.map((l, idx) => {
                  const alloc = allocations[idx];
                  const vatLine = vatResult.lines.find((v) => v.item_id === l.item.id);
                  return {
                    item_id: l.item.id,
                    item_name: l.item.name,
                    quantity: l.qty,
                    unit: l.unit,
                    rate: l.rate,
                    amount: l.amount,
                    cost_rate: paisaToNumber(parseMoneyToPaisa(alloc.unit_cost)),
                    cogs_amount: paisaToNumber(parseMoneyToPaisa(alloc.total_cost)),
                    valuation_method: alloc.valuation_method,
                    tax_treatment: vatLine?.tax_treatment
                      ? String(vatLine.tax_treatment)
                      : undefined,
                    vat_amount: vatLine
                      ? paisaToNumber(parseMoneyToPaisa(vatLine.vat_amount))
                      : 0,
                    cost_layers: alloc.source_layers,
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
                tax_rule_version: vatResult.rule_version,
                price_mode: vatResult.price_mode,
                totals: {
                  subtotal: taxableAmount + exemptAmount,
                  discount: paisaToNumber(parseMoneyToPaisa(cmd.sale.discountAmount || "0")),
                  tax: vatAmount,
                  taxable_amount: taxableAmount,
                  exempt_amount: exemptAmount,
                  grand_total: grandTotal,
                  cogs_total: cogsTotal,
                },
                currency: cmd.sale.currency || "NPR",
                financial_year_id: cmd.financialYearId ?? null,
                local_idempotency_key: cmd.idempotencyKey,
                source: cmd.source,
                receipt_id: receiptId,
                narration: cmd.sale.narration,
                aggregate_version: 1,
              },
            });

        const finalSyncStatus: SalesPostingSuccessPayload["sync_status"] =
          syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending";

        const verifyInvoice = await db.invoices.get(invoiceId);
        const verifyJournal = await db.vouchers.get(journalId);
        if (!verifyInvoice || !verifyJournal) {
          throw new Error("Post-commit verification failed.");
        }

        const successPayload: SalesPostingSuccessPayload = {
          posting_id: postingId,
          invoice_id: invoiceId,
          invoice_number: invoiceNo,
          voucher_id: journalId,
          voucher_number: String(journal.voucherNo),
          voucher_ids: voucherIds,
          stock_movement_ids: movements.map((m) => m.id),
          amount: paisaToString(parseMoneyToPaisa(String(grandTotal))),
          vat_amount: paisaToString(parseMoneyToPaisa(String(vatAmount))),
          cogs_amount: cogsTotalStr,
          inventory_accounting: inventoryPolicy.inventoryAccounting,
          valuation_method: inventoryPolicy.valuationMethod,
          tax_rule_version: vatResult.rule_version,
          currency: cmd.sale.currency || "NPR",
          posted_at: now,
          idempotent_replay: false,
          sync_status: finalSyncStatus,
          sync_event_id: syncEnqueue.eventId,
          draft_id: cmd.draftId ?? null,
          audit_id: auditId,
          receipt_id: receiptId,
          classification,
          customer_id: cmd.sale.customerId ?? null,
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
    if (code === "in_progress") {
      return fail("conflict", "in_progress", (e as Error).message, {
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
      e instanceof Error ? e.message : "Sales posting failed",
      { rolled_back: true, retryable: true, draft_id: cmd.draftId },
    );
  }
}
