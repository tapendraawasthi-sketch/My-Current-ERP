/**
 * Authoritative inventory purchase posting — Model B (Dexie local-first).
 *
 * Manual purchase forms and Orbix inventory confirms must both converge here
 * (or on the shared within-transaction writers used by this command).
 */

import { getDB, generateId, type DBInvoice, type DBItem } from "@/lib/db";
import { assertDateInFiscalYear } from "@/store/store.types";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { parseMoneyToPaisa, paisaToNumber, paisaToString, assertQtyRateTotal } from "./money";
import { enqueuePurchaseSyncInTransaction } from "@/platform/sync/enqueuePurchaseSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";

export const E2E_COMPANY_NAME = "Orbix E2E Test Company";
export const E2E_ITEM_NAME = "E2E Test Bike";
export const E2E_ITEM_ID = "item-e2e-test-bike";
export const E2E_COMPANY_ID = "orbix-e2e-company";

export type PurchasePaymentMethod = "cash" | "bank" | "credit";
export type PurchaseCommandSource = "orbix" | "manual_form" | "import" | "test";

export interface PurchaseLineInput {
  itemId: string;
  quantity: string;
  unit: string;
  rate: string;
  amount: string;
}

export interface PurchasePostingCommand {
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
  source: PurchaseCommandSource;
  purchase: {
    transactionDate: string;
    supplierId?: string | null;
    supplierName?: string | null;
    paymentMethod: PurchasePaymentMethod;
    paymentAccountId?: string | null;
    /** Test/E2E only — deterministic invoice number allocated before hashing. */
    invoiceNo?: string | null;
    items: PurchaseLineInput[];
    subtotal: string;
    discount?: string;
    tax?: string;
    grandTotal: string;
    currency: string;
    narration: string;
  };
  /** Dev-only: throw inside Dexie txn after invoice, before stock */
  injectFailure?: "before_stock" | "before_audit" | null;
}

export interface PurchasePostingSuccessPayload {
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
}

export type PurchasePostingResult =
  | {
      type: "posting_completed";
      status: "success";
      payload: PurchasePostingSuccessPayload;
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

export interface DBOrbixPostingReceipt {
  id: string;
  idempotencyKey: string;
  scopedKey: string;
  tenantId: string;
  companyId: string;
  userId: string;
  operation: "post_purchase";
  draftId: string | null;
  draftVersion: number | null;
  previewVersion: string | null;
  previewHash: string | null;
  status: "processing" | "completed" | "failed";
  postingId: string;
  voucherId: string | null;
  invoiceId: string | null;
  journalId: string | null;
  result: PurchasePostingSuccessPayload | null;
  createdAt: string;
  completedAt: string | null;
}

function fail(
  type: PurchasePostingResult["type"] & string,
  error_code: string,
  safe_message: string,
  opts?: Partial<PurchasePostingResult extends { status: "failed" } ? never : never> & {
    rolled_back?: boolean;
    retryable?: boolean;
    draft_id?: string | null;
  },
): PurchasePostingResult {
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

export function buildScopedIdempotencyKey(cmd: PurchasePostingCommand): string {
  return [
    cmd.tenantId || "local",
    cmd.companyId,
    "post_purchase",
    cmd.draftId || "no-draft",
    String(cmd.previewVersion ?? "nv"),
    cmd.previewHash || "no-hash",
    cmd.idempotencyKey,
  ].join("|");
}

export function isInventoryPurchaseIntent(intent: string | undefined | null): boolean {
  const i = (intent || "").trim().toLowerCase();
  return (
    i === "khata_purchase" ||
    i === "khata_stock_purchase" ||
    i === "khata_credit_purchase" ||
    i === "khata_cash_purchase" ||
    i === "khata_cash_purchase_with_party" ||
    i === "purchase" ||
    i === "inventory_purchase"
  );
}

/** Resolve seeded E2E bike or matching inventory item; null if ambiguous. */
export async function resolveInventoryItemForPurchase(
  itemName: string | null | undefined,
): Promise<DBItem | null> {
  const db = getDB();
  const items = await db.items.toArray();
  const needle = (itemName || "").trim().toLowerCase();
  if (!needle) return null;

  const e2e = items.find((i) => i.id === E2E_ITEM_ID || i.name === E2E_ITEM_NAME);
  if (e2e && (needle === "bike" || needle === E2E_ITEM_NAME.toLowerCase() || needle.includes("bike"))) {
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

function validateCommand(cmd: PurchasePostingCommand): PurchasePostingResult | null {
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
      "Your role cannot post purchase transactions.",
      { retryable: false, draft_id: cmd.draftId },
    );
  }
  if (!cmd.purchase?.items?.length) {
    return fail("validation_error", "missing_items", "At least one purchase line is required.");
  }
  if (!["cash", "bank", "credit"].includes(cmd.purchase.paymentMethod)) {
    return fail("validation_error", "invalid_payment", "Payment method is required.");
  }
  if (cmd.purchase.paymentMethod === "credit" && !cmd.purchase.supplierId && !cmd.purchase.supplierName) {
    return fail(
      "validation_error",
      "missing_supplier",
      "Credit purchases require a supplier.",
      { draft_id: cmd.draftId },
    );
  }
  if (
    (cmd.purchase.paymentMethod === "cash" || cmd.purchase.paymentMethod === "bank") &&
    !cmd.purchase.paymentAccountId
  ) {
    return fail(
      "validation_error",
      "missing_payment_account",
      "Cash/bank purchases require a payment account.",
      { draft_id: cmd.draftId },
    );
  }

  try {
    const grand = parseMoneyToPaisa(cmd.purchase.grandTotal);
    if (grand <= 0) throw new Error("Grand total must be greater than zero");
    let lineSum = 0;
    for (const line of cmd.purchase.items) {
      assertQtyRateTotal(line.quantity, line.rate, line.amount);
      lineSum += parseMoneyToPaisa(line.amount);
    }
    if (Math.abs(lineSum - grand) > 1) {
      return fail(
        "validation_error",
        "total_mismatch",
        `Line totals (${paisaToString(lineSum)}) do not match grand total (${paisaToString(grand)}).`,
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
 * Authoritative inventory purchase post.
 * Opens one Dexie transaction covering invoice, journal, stock, audit, sync, receipt.
 */
export async function postPurchaseTransaction(
  cmd: PurchasePostingCommand,
): Promise<PurchasePostingResult> {
  const early = validateCommand(cmd);
  if (early) return early;

  const db = getDB();
  const scopedKey = buildScopedIdempotencyKey(cmd);
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();

  // Optional Zustand bridge — avoid hard import cycle with store/index
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

  // FY / period checks before txn
  try {
    let fy = storeState.currentFiscalYear;
    if (!fy) {
      const years = await db.fiscalYears.toArray();
      fy = years.find((y: any) => y.isCurrent) || years[0];
    }
    assertDateInFiscalYear(cmd.purchase.transactionDate, fy);
    await enforcePostingPeriodLock(cmd.purchase.transactionDate, db);
  } catch (e) {
    return fail(
      "validation_error",
      "period_or_fy",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  // Resolve items
  const resolvedLines: Array<{
    item: DBItem;
    qty: number;
    rate: number;
    amount: number;
    unit: string;
  }> = [];
  for (const line of cmd.purchase.items) {
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
    resolvedLines.push({
      item,
      qty: Number(line.quantity),
      rate: paisaToNumber(parseMoneyToPaisa(line.rate)),
      amount: paisaToNumber(parseMoneyToPaisa(line.amount)),
      unit: line.unit || item.unit || "pcs",
    });
  }

  const grandTotal = paisaToNumber(parseMoneyToPaisa(cmd.purchase.grandTotal));
  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);

  try {
    // Lazy import avoids circular dependency with store/index.ts
    const { postInvoiceJournal, postInvoiceStock, generateNextInvoiceNo } = await import(
      "@/store/invoicePostingWriters"
    );

    const result = await db.transaction(
      "rw",
      [
        db.invoices,
        db.vouchers,
        db.stockMovements,
        db.accounts,
        db.auditLogs,
        db.syncOutbox,
        db.orbixPostingReceipts,
        db.items,
        db.periodLocks,
        db.domainEvents,
        db.eventSyncQueue,
        db.syncLocalSequences,
        db.companySettings,
      ].filter(Boolean),
      async () => {
        const existing = await db.orbixPostingReceipts.where("scopedKey").equals(scopedKey).first();
        if (existing?.status === "completed" && existing.result) {
          return {
            type: "posting_completed" as const,
            status: "success" as const,
            payload: { ...existing.result, idempotent_replay: true },
          };
        }
        if (existing?.status === "processing") {
          throw Object.assign(new Error("Posting already in progress for this confirmation."), {
            code: "in_progress",
          });
        }

        const receiptId = existing?.id || generateId();
        const processing: DBOrbixPostingReceipt = {
          id: receiptId,
          idempotencyKey: cmd.idempotencyKey,
          scopedKey,
          tenantId: cmd.tenantId || "local",
          companyId: cmd.companyId,
          userId: cmd.userId,
          operation: "post_purchase",
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
        await db.orbixPostingReceipts.put(processing);

        // Allocate invoice number inside txn (retry on collision)
        let invoiceNo = "";
        const invoiceId = generateId();
        const requestedNo =
          cmd.source === "test" && cmd.purchase.invoiceNo
            ? String(cmd.purchase.invoiceNo).trim()
            : "";
        if (requestedNo) {
          const clash = await db.invoices.where("invoiceNo").equals(requestedNo).first();
          if (clash) {
            throw new Error(`Test invoice number already exists: ${requestedNo}`);
          }
          invoiceNo = requestedNo;
        } else {
          for (let attempt = 0; attempt < 5; attempt++) {
            invoiceNo = await generateNextInvoiceNo("purchase-invoice", db);
            const clash = await db.invoices.where("invoiceNo").equals(invoiceNo).first();
            if (!clash) break;
            if (attempt === 4) {
              throw new Error(`Could not allocate unique invoice number (last=${invoiceNo})`);
            }
          }
        }

        const paymentMode =
          cmd.purchase.paymentMethod === "cash"
            ? "cash"
            : cmd.purchase.paymentMethod === "bank"
              ? "bank"
              : "credit";

        const partyAccountId =
          cmd.purchase.paymentMethod === "credit"
            ? "acc-sundry-creditors"
            : cmd.purchase.paymentAccountId || "acc-cash";

        const newInvoice: DBInvoice = {
          id: invoiceId,
          invoiceNo,
          date: cmd.purchase.transactionDate,
          type: "purchase-invoice",
          status: "posted",
          partyId: cmd.purchase.supplierId || undefined,
          partyName:
            cmd.purchase.supplierName ||
            (cmd.purchase.paymentMethod === "cash" ? "Cash Purchase" : "Supplier"),
          partyAccountId,
          paymentMode,
          paymentStatus: cmd.purchase.paymentMethod === "credit" ? "unpaid" : "paid",
          paidAmount: cmd.purchase.paymentMethod === "credit" ? 0 : grandTotal,
          subTotal: grandTotal,
          taxableAmount: grandTotal,
          exemptAmount: 0,
          vatAmount: 0,
          vatApplicable: false,
          discountAmount: 0,
          grandTotal,
          total: grandTotal,
          currencyCode: cmd.purchase.currency || "NPR",
          narration: cmd.purchase.narration,
          createdBy: cmd.userId,
          lines: resolvedLines.map((l, idx) => ({
            id: `line-${invoiceId}-${idx}`,
            itemId: l.item.id,
            itemName: l.item.name,
            qty: l.qty,
            unit: l.unit,
            rate: l.rate,
            netAmount: l.amount,
            totalAmount: l.amount,
            lineTotal: l.amount,
            isTaxable: true,
            taxableAmount: l.amount,
          })),
        } as DBInvoice & { partyAccountId: string };

        await db.invoices.add(newInvoice as any);

        // Shared journal writer (same as manual purchase form)
        const itemsSnapshot = await db.items.toArray();
        const warehousesSnapshot =
          storeState.warehouses?.length > 0
            ? storeState.warehouses
            : [{ id: "wh-main", name: "Main Warehouse", isDefault: true }];
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
        await db.auditLogs.add({
          id: auditId,
          timestamp: now,
          userId: cmd.userId,
          userName: storeState.currentUser?.name || cmd.userId,
          action: "PURCHASE_POSTED",
          module: "purchase",
          entityType: "invoice",
          entityId: invoiceId,
          recordId: invoiceId,
          recordType: "purchase-invoice",
          companyId: cmd.companyId,
          sessionId: cmd.conversationId || undefined,
          after: {
            invoiceNo,
            journalId,
            voucherNo: journal.voucherNo,
            amount: grandTotal,
            draftId: cmd.draftId,
            requestId: cmd.requestId,
            source: cmd.source,
            idempotencyKey: cmd.idempotencyKey,
          },
        } as any);

        // Phase 6 cutover: accounting invoices/vouchers/stock use eventSyncQueue only.
        // Do not write legacy syncOutbox rows for posted purchase invoices.

        // Phase 5: durable accounting sync event (same Dexie transaction)
        const syncEnqueue = isLocalOnly(syncPolicy)
          ? ({ syncStatus: "disabled" as const, eventId: null })
          : await enqueuePurchaseSyncInTransaction(db, {
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
            transaction_date: cmd.purchase.transactionDate,
            party_id: cmd.purchase.supplierId ?? null,
            party_name: cmd.purchase.supplierName ?? null,
            payment_method: cmd.purchase.paymentMethod,
            item_lines: resolvedLines.map((l) => ({
              item_id: l.item.id,
              item_name: l.item.name,
              quantity: l.qty,
              unit: l.unit,
              rate: l.rate,
              amount: l.amount,
            })),
            totals: {
              subtotal: grandTotal,
              discount: 0,
              tax: 0,
              grand_total: grandTotal,
            },
            currency: cmd.purchase.currency || "NPR",
            financial_year_id: cmd.financialYearId ?? null,
            local_idempotency_key: cmd.idempotencyKey,
            source: cmd.source,
            receipt_id: receiptId,
            narration: cmd.purchase.narration,
            aggregate_version: 1,
          },
        });

        const finalSyncStatus: PurchasePostingSuccessPayload["sync_status"] =
          syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending";

        // Persisted verification before success
        const verifyInvoice = await db.invoices.get(invoiceId);
        const verifyJournal = await db.vouchers.get(journalId);
        if (!verifyInvoice || !verifyJournal) {
          throw new Error("Post-commit verification failed.");
        }

        const successPayload: PurchasePostingSuccessPayload = {
          posting_id: postingId,
          invoice_id: invoiceId,
          invoice_number: invoiceNo,
          voucher_id: journalId,
          voucher_number: String(journal.voucherNo),
          stock_movement_ids: movements.map((m) => m.id),
          amount: paisaToString(parseMoneyToPaisa(cmd.purchase.grandTotal)),
          currency: cmd.purchase.currency || "NPR",
          posted_at: now,
          idempotent_replay: false,
          sync_status: finalSyncStatus,
          sync_event_id: syncEnqueue.eventId,
          draft_id: cmd.draftId ?? null,
          audit_id: auditId,
          receipt_id: receiptId,
        };

        await db.orbixPostingReceipts.put({
          ...processing,
          status: "completed",
          invoiceId,
          voucherId: journalId,
          journalId,
          result: successPayload,
          completedAt: now,
        });

        // Refresh Zustand slices used by UI lists
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
      },
    );

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
    const tableNames = (() => {
      try {
        return getDB()
          .tables.map((t) => t.name)
          .join(",");
      } catch {
        return "unavailable";
      }
    })();
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
      `${e instanceof Error ? e.message : "Purchase posting failed"} | tables=${tableNames} | verno=${getDB().verno}`,
      { rolled_back: true, retryable: true, draft_id: cmd.draftId },
    );
  }
}
