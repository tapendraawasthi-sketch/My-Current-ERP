/**
 * Full AppShell bootstrap for UI visual QA + Orbix E2E (dev/e2e only).
 */
import { DEFAULT_FISCAL_YEAR } from "../store/store.types";
import { openDB, getDB, resetDB } from "../lib/db";
import Dexie from "dexie";
import { useEKhataStore } from "../store/eKhataStore";
import { useStore } from "../store/useStore";
import { executeOrbixConfirm, buildIdempotencyKey } from "../lib/ekhata/orbixPostingService";
import {
  resetOrbixE2ECompany,
  seedOrbixE2ECompany,
  E2E_COMPANY_ID,
  E2E_COMPANY_NAME,
  E2E_ITEM_ID,
  E2E_USER_AUTHORIZED,
  E2E_USER_RESTRICTED,
  postPurchaseTransaction,
  postPurchaseAdjustmentTransaction,
} from "../domains/purchase";
import {
  resetOrbixSalesE2ECompany,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_COMPANY_NAME,
  E2E_SALES_ITEM_ID,
  E2E_SALES_CUSTOMER_ID,
  E2E_SALES_USER_AUTHORIZED,
  E2E_SALES_USER_RESTRICTED,
  postSalesTransaction,
  postSalesAdjustmentTransaction,
} from "../domains/sales";
import { getEventSyncClient } from "../platform/sync/syncClient";
import {
  seedSettlementE2ECompany,
  seedE2ESalesInvoice,
  seedE2EPurchaseInvoice,
  E2E_CUSTOMER_ID,
  E2E_SUPPLIER_ID,
  E2E_FY_ID,
} from "../domains/settlement/e2eSeed";
import { postReceiptTransaction } from "../domains/settlement/postReceiptTransaction";
import { postPaymentTransaction } from "../domains/settlement/postPaymentTransaction";
import { getOrCreateDocumentSettlementState } from "../domains/settlement/settlementState";
import { computeDocumentOutstanding } from "../domains/settlement/outstandingBalance";
import {
  seedTreasuryE2ECompany,
  E2E_BANK_ACCOUNT_ID,
  E2E_SAMPLE_STATEMENT_CSV,
  E2E_CHEQUE_CLEARED_ID,
  E2E_RV_001_ID,
} from "../domains/treasury/e2eSeed";
import { createStatementBatch } from "../domains/treasury/statementBatch";
import { confirmBankMatch } from "../domains/treasury/postConfirmBankMatch";
import { postChequeStatusChange } from "../domains/treasury/chequeLifecycle";
import { computeTreasuryPosition } from "../domains/treasury/treasuryPosition";
import type { ChequeState } from "../domains/treasury/types";

declare global {
  interface Window {
    __uiQaHarnessStep?: string;
    __uiQaGoto?: (page: string) => void;
    __uiQaSetTheme?: (theme: "light" | "dark") => void;
    __orbixE2E?: {
      resetAndSeed: () => Promise<{
        companyId: string;
        itemId: string;
        authorizedUserId: string;
      }>;
      resetAndSeedSales: () => Promise<{
        companyId: string;
        itemId: string;
        customerId: string;
        authorizedUserId: string;
      }>;
      seedPhase7OriginalSales: () => Promise<Record<string, string>>;
      seedPhase8OriginalPurchases: () => Promise<Record<string, string>>;
      seedPhase9SettlementDocs: () => Promise<{
        invoiceIds: Record<string, string>;
        settlementVersions: Record<string, number>;
        companyId: string;
      }>;
      seedPhase10TreasuryDocs: () => Promise<{
        companyId: string;
        bankAccountId: string;
        sampleCsv: string;
      }>;
      getTreasurySnapshot: () => Promise<Record<string, unknown>>;
      importE2EStatement: (opts?: {
        supersedeDuplicate?: boolean;
        idempotencyKey?: string;
      }) => Promise<Record<string, unknown>>;
      postE2EBankMatch: (opts: {
        reference?: string;
        amount: string;
        expectedVersion?: number;
        statementLineId?: string;
        erpDocumentId?: string;
      }) => Promise<Record<string, unknown>>;
      postE2EChequeTransition: (opts: {
        chequeId?: string;
        chequeNumber?: string;
        nextStatus: "cleared" | "bounced" | string;
        expectedInstrumentVersion?: number;
        statementLineId?: string;
        bounceAmount?: string;
        idempotencyKey?: string;
      }) => Promise<Record<string, unknown>>;
      getSettlementSnapshot: () => Promise<Record<string, unknown>>;
      pullRemoteEvents?: () => Promise<Record<string, unknown>>;
      postE2EReceipt: (opts: {
        invoiceNo?: string;
        amount: string;
        cashOrBankAccountId?: string;
        partyId?: string;
        receiptType?: string;
        allocations?: Array<{
          document_id?: string;
          invoice_no?: string;
          amount: string;
          expected_settlement_version?: number;
        }>;
        idempotencyKey?: string;
      }) => Promise<Record<string, unknown>>;
      postE2EPayment: (opts: {
        invoiceNo?: string;
        amount: string;
        cashOrBankAccountId?: string;
        partyId?: string;
        paymentType?: string;
        withholding?: string;
        allocations?: Array<{
          document_id?: string;
          invoice_no?: string;
          amount: string;
          expected_settlement_version?: number;
        }>;
        idempotencyKey?: string;
      }) => Promise<Record<string, unknown>>;
      assertSafeCompany: () => boolean;
      getSnapshot: () => Promise<Record<string, unknown>>;
      getLedgerSnapshot: () => Promise<Record<string, unknown>>;
      getAdjustmentSnapshot: () => Promise<Record<string, unknown>>;
      getPurchaseAdjustmentSnapshot: () => Promise<Record<string, unknown>>;
      getDraftState: () => Record<string, unknown>;
      setAccountant: () => void;
      setRestrictedUser: () => void;
      postE2EPurchase: (opts?: {
        amount?: string;
        quantity?: string;
        paymentMethod?: "cash" | "bank" | "credit";
        idempotencyKey?: string;
        invoiceNo?: string;
        supplierId?: string;
        supplierName?: string;
      }) => Promise<Record<string, unknown>>;
      postE2ESale: (opts?: {
        amount?: string;
        quantity?: string;
        paymentMethod?: "cash" | "bank" | "credit";
        idempotencyKey?: string;
        invoiceNo?: string;
      }) => Promise<Record<string, unknown>>;
      /** Conflict / sync isolation helper — not the primary Orbix chat path. */
      postE2ESalesAdjustment: (opts: {
        originalInvoiceNo: string;
        quantity?: number;
        settlementMethod?:
          | "cash_refund"
          | "bank_refund"
          | "reduce_receivable"
          | "customer_credit";
        adjustmentType?: "inventory_sales_return" | "financial_credit_note";
        financialAmount?: number;
        idempotencyKey?: string;
      }) => Promise<Record<string, unknown>>;
      /** Conflict / sync isolation helper — not the primary Orbix chat path. */
      postE2EPurchaseAdjustment: (opts: {
        originalInvoiceNo: string;
        quantity?: number;
        settlementMethod?:
          | "reduce_payable"
          | "cash_refund_received"
          | "bank_refund_received"
          | "supplier_credit";
        adjustmentType?: "inventory_purchase_return" | "financial_supplier_debit_note";
        financialAmount?: number;
        idempotencyKey?: string;
      }) => Promise<Record<string, unknown>>;
      pushSyncPending: () => Promise<number>;
      flushSyncQueue: (opts?: { maxRounds?: number }) => Promise<{ pushed: number; remaining: number }>;
      pullSyncRemote: (companyId?: string) => Promise<number>;
      getSyncQueueSnapshot: () => Promise<Record<string, unknown>[]>;
      confirmWithInject: (
        injectFailure: "after_validation" | "before_stock" | "before_audit",
      ) => Promise<Record<string, unknown>>;
      confirmAgain: () => Promise<Record<string, unknown>>;
      replayConfirm: (card: Record<string, unknown>) => Promise<Record<string, unknown>>;
      staleConfirm: (card: Record<string, unknown>) => Promise<Record<string, unknown>>;
      mutatePendingPreview: (patch: { amount?: number; preview_hash?: string }) => void;
      reloadFromDexie: () => Promise<void>;
      dbInfo: () => { verno: number; tables: string[] };
    };
  }
}

function setStep(step: string): void {
  if (typeof window !== "undefined") {
    window.__uiQaHarnessStep = step;
  }
  console.log(`[ui-qa-harness] ${step}`);
}

/** Ensure Dexie schema includes Orbix posting tables (v27+). */
async function ensureOrbixSchema(): Promise<void> {
  await openDB();
  const db = getDB();
  const names = db.tables.map((t) => t.name);
  const need =
    db.verno < 31 ||
    !names.includes("orbixPostingReceipts") ||
    !names.includes("periodLocks") ||
    !names.includes("syncLocalSequences") ||
    !names.includes("salesInvoiceAdjustmentState") ||
    !names.includes("purchaseInvoiceAdjustmentState");
  if (!need) return;

  setStep(`schema upgrade required verno=${db.verno} tables=${names.length}`);
  try {
    db.close();
  } catch {
    /* ignore */
  }
  await Dexie.delete("SutraERPDatabase");
  await resetDB();
  await openDB();
  const after = getDB();
  if (
    after.verno < 31 ||
    !after.tables.some((t) => t.name === "orbixPostingReceipts") ||
    !after.tables.some((t) => t.name === "syncLocalSequences") ||
    !after.tables.some((t) => t.name === "salesInvoiceAdjustmentState") ||
    !after.tables.some((t) => t.name === "purchaseInvoiceAdjustmentState")
  ) {
    throw new Error(
      `Orbix E2E schema incomplete after recreate: verno=${after.verno} tables=${after.tables
        .map((t) => t.name)
        .join(",")}`,
    );
  }
}

async function applySalesE2EUserState(): Promise<void> {
  const db = getDB();
  const company = await db.companySettings.get("main");
  const fiscalYears = await db.fiscalYears.toArray();
  const items = await db.items.toArray();
  const accounts = await db.accounts.toArray();
  const parties = await db.parties.toArray();
  const invoices = await db.invoices.toArray();
  const vouchers = await db.vouchers.toArray();
  const stockMovements = await db.stockMovements.toArray();
  const currentFy =
    fiscalYears.find((y) => Boolean((y as { isCurrent?: boolean }).isCurrent)) ||
    fiscalYears[0] ||
    DEFAULT_FISCAL_YEAR;
  useStore.setState({
    isDbReady: true,
    isInitializing: false,
    isAuthenticated: true,
    authStage: "authenticated",
    selectedCompanyId: "main",
    currentUser: {
      id: E2E_SALES_USER_AUTHORIZED,
      username: "e2e.sales.accountant",
      name: "E2E Sales Accountant",
      role: "accountant",
      isActive: true,
    },
    companySettings: {
      ...(company as object),
      id: "main",
      companyId: E2E_SALES_COMPANY_ID,
      name: E2E_SALES_COMPANY_NAME,
      companyName: E2E_SALES_COMPANY_NAME,
      allowNegativeStock: false,
    } as never,
    currentFiscalYear: currentFy as never,
    fiscalYears: (fiscalYears.length ? fiscalYears : [DEFAULT_FISCAL_YEAR]) as never,
    accounts: accounts as never,
    items: items as never,
    parties: parties as never,
    vouchers: vouchers as never,
    invoices: invoices as never,
    stockMovements: stockMovements as never,
    warehouses: [
      { id: "wh-main", name: "Main Warehouse", isDefault: true, isActive: true },
    ] as never,
    currentPage: "dashboard",
  });
  useEKhataStore.getState().setOrbixMode("accountant");
}

/** Force invoice number on E2E sales company only; also patch pending sync envelopes. */
async function renameE2ESalesInvoiceNo(
  invoiceId: string,
  invoiceNo: string,
): Promise<void> {
  const settings = useStore.getState().companySettings as {
    companyId?: string;
    name?: string;
    companyName?: string;
  } | null;
  const id = String(settings?.companyId || "");
  const name = String(settings?.name || settings?.companyName || "");
  if (id !== E2E_SALES_COMPANY_ID && name !== E2E_SALES_COMPANY_NAME) {
    throw new Error("Refuse renameE2ESalesInvoiceNo outside E2E sales company");
  }
  const db = getDB();
  await db.invoices.update(invoiceId, { invoiceNo });
  if (db.eventSyncQueue) {
    const queue = await db.eventSyncQueue.toArray();
    for (const row of queue) {
      const env = row.envelope as {
        payload?: {
          sale?: { invoice_id?: string; invoice_number?: string };
        };
      };
      const sale = env?.payload?.sale;
      if (sale?.invoice_id === invoiceId) {
        sale.invoice_number = invoiceNo;
        await db.eventSyncQueue.put({ ...row, envelope: env as never });
      }
    }
  }
  if (db.domainEvents) {
    const events = await db.domainEvents.toArray();
    for (const e of events) {
      const p = e.payload as {
        sale?: { invoice_id?: string; invoice_number?: string };
      };
      if (p?.sale?.invoice_id === invoiceId) {
        p.sale.invoice_number = invoiceNo;
        await db.domainEvents.put({ ...e, payload: p as never });
      }
    }
  }
}

async function applyE2EUserState(role: "accountant" | "viewer" = "accountant"): Promise<void> {
  const db = getDB();
  const company = await db.companySettings.get("main");
  const fiscalYears = await db.fiscalYears.toArray();
  const items = await db.items.toArray();
  const accounts = await db.accounts.toArray();
  const invoices = await db.invoices.toArray();
  const vouchers = await db.vouchers.toArray();
  const stockMovements = await db.stockMovements.toArray();
  const currentFy =
    fiscalYears.find((y) => Boolean((y as { isCurrent?: boolean }).isCurrent)) ||
    fiscalYears[0] ||
    DEFAULT_FISCAL_YEAR;

  const isAccountant = role === "accountant";
  useStore.setState({
    isDbReady: true,
    isInitializing: false,
    isAuthenticated: true,
    authStage: "authenticated",
    selectedCompanyId: "main",
    currentUser: isAccountant
      ? {
          id: E2E_USER_AUTHORIZED,
          username: "e2e.accountant",
          name: "E2E Accountant",
          role: "accountant",
          isActive: true,
        }
      : {
          id: E2E_USER_RESTRICTED,
          username: "e2e.viewer",
          name: "E2E Viewer",
          role: "viewer",
          isActive: true,
        },
    companySettings: {
      ...(company as object),
      id: "main",
      companyId: E2E_COMPANY_ID,
      name: E2E_COMPANY_NAME,
      companyName: E2E_COMPANY_NAME,
    } as never,
    currentFiscalYear: currentFy as never,
    fiscalYears: (fiscalYears.length ? fiscalYears : [DEFAULT_FISCAL_YEAR]) as never,
    accounts: accounts as never,
    items: items as never,
    parties: [],
    vouchers: vouchers as never,
    invoices: invoices as never,
    stockMovements: stockMovements as never,
    warehouses: [{ id: "wh-main", name: "Main Warehouse", isDefault: true, isActive: true }] as never,
    currentPage: "dashboard",
  });

  useEKhataStore.getState().setOrbixMode("accountant");
}

export async function bootstrapUiQaHarness(): Promise<void> {
  setStep("bootstrap start");
  await ensureOrbixSchema();

  setStep("seed e2e company");
  await seedOrbixE2ECompany();
  await applyE2EUserState("accountant");

  window.__uiQaGoto = (page: string) => {
    useStore.getState().setCurrentPage(page);
    if (page === "orbix") {
      useEKhataStore.getState().openPanel();
      useEKhataStore.getState().maximizePanel();
      useEKhataStore.getState().setOrbixMode("accountant");
    }
  };

  window.__orbixE2E = {
    async resetAndSeed() {
      await ensureOrbixSchema();
      await resetOrbixE2ECompany();
      await applyE2EUserState("accountant");
      useEKhataStore.getState().newChat();
      return {
        companyId: E2E_COMPANY_ID,
        itemId: E2E_ITEM_ID,
        authorizedUserId: E2E_USER_AUTHORIZED,
      };
    },
    async resetAndSeedSales() {
      await ensureOrbixSchema();
      await resetOrbixSalesE2ECompany();
      await applySalesE2EUserState();
      useEKhataStore.getState().newChat();
      return {
        companyId: E2E_SALES_COMPANY_ID,
        itemId: E2E_SALES_ITEM_ID,
        customerId: E2E_SALES_CUSTOMER_ID,
        authorizedUserId: E2E_SALES_USER_AUTHORIZED,
      };
    },
    async seedPhase7OriginalSales() {
      await window.__orbixE2E!.resetAndSeedSales();
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse seedPhase7OriginalSales — company not E2E sales after seed");
      }

      const map: Record<string, string> = {};
      const postNamed = async (
        invoiceNo: string,
        opts: {
          quantity: string;
          amount: string;
          paymentMethod: "cash" | "bank" | "credit";
        },
      ) => {
        const result = await window.__orbixE2E!.postE2ESale({
          ...opts,
          invoiceNo,
          idempotencyKey: `e2e-phase7-${invoiceNo}-${Date.now()}`,
        });
        const payload = (result.payload || result) as { invoice_id?: string };
        const invoiceId = String(payload.invoice_id || "");
        if (!invoiceId) {
          throw new Error(`seedPhase7: missing invoice_id for ${invoiceNo}: ${JSON.stringify(result)}`);
        }
        map[invoiceNo] = invoiceId;
      };

      await postNamed("SI-E2E-CASH-001", {
        quantity: "1",
        amount: "60000.00",
        paymentMethod: "cash",
      });
      await postNamed("SI-E2E-CREDIT-002", {
        quantity: "2",
        amount: "60000.00",
        paymentMethod: "credit",
      });
      await postNamed("SI-E2E-BANK-003", {
        quantity: "1",
        amount: "60000.00",
        paymentMethod: "bank",
      });
      await postNamed("SI-E2E-CREDITBAL-004", {
        quantity: "1",
        amount: "60000.00",
        paymentMethod: "credit",
      });
      await postNamed("SI-E2E-CN-005", {
        quantity: "1",
        amount: "60000.00",
        paymentMethod: "credit",
      });
      await postNamed("SI-E2E-CONFLICT-006", {
        quantity: "2",
        amount: "60000.00",
        paymentMethod: "credit",
      });

      await window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 });
      await window.__orbixE2E!.reloadFromDexie();
      return map;
    },
    async seedPhase8OriginalPurchases() {
      await window.__orbixE2E!.resetAndSeed();
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse seedPhase8OriginalPurchases — company not E2E after seed");
      }

      const map: Record<string, string> = {};
      const postNamed = async (
        invoiceNo: string,
        opts: {
          quantity: string;
          amount: string;
          paymentMethod: "cash" | "bank" | "credit";
        },
      ) => {
        const result = await window.__orbixE2E!.postE2EPurchase({
          ...opts,
          invoiceNo,
          idempotencyKey: `e2e-phase8-${invoiceNo}-${Date.now()}`,
        });
        const payload = (result.payload || result) as { invoice_id?: string };
        const invoiceId = String(payload.invoice_id || "");
        if (!invoiceId) {
          throw new Error(`seedPhase8: missing invoice_id for ${invoiceNo}: ${JSON.stringify(result)}`);
        }
        map[invoiceNo] = invoiceId;
      };

      await postNamed("PI-E2E-CASH-001", {
        quantity: "1",
        amount: "50000.00",
        paymentMethod: "cash",
      });
      await postNamed("PI-E2E-CREDIT-002", {
        quantity: "2",
        amount: "50000.00",
        paymentMethod: "credit",
      });
      await postNamed("PI-E2E-BANK-003", {
        quantity: "1",
        amount: "50000.00",
        paymentMethod: "bank",
      });
      await postNamed("PI-E2E-CREDITBAL-004", {
        quantity: "1",
        amount: "50000.00",
        paymentMethod: "credit",
      });
      await postNamed("PI-E2E-DN-005", {
        quantity: "1",
        amount: "50000.00",
        paymentMethod: "credit",
      });
      await postNamed("PI-E2E-CONFLICT-006", {
        quantity: "2",
        amount: "50000.00",
        paymentMethod: "credit",
      });

      await window.__orbixE2E!.flushSyncQueue({ maxRounds: 16 });
      await window.__orbixE2E!.reloadFromDexie();
      return map;
    },

    async seedPhase9SettlementDocs() {
      await ensureOrbixSchema();
      await seedSettlementE2ECompany();
      await applyE2EUserState("accountant");
      useEKhataStore.getState().newChat();
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse seedPhase9SettlementDocs — company not E2E after seed");
      }

      const sales = [
        { invoiceNo: "SI-E2E-001", grandTotal: 100000 },
        { invoiceNo: "SI-E2E-002", grandTotal: 100000 },
        { invoiceNo: "SI-E2E-003", grandTotal: 100000 },
      ];
      const purchases = [
        { invoiceNo: "PI-E2E-001", grandTotal: 100000 },
        { invoiceNo: "PI-E2E-002", grandTotal: 100000 },
      ];

      const invoiceIds: Record<string, string> = {};
      const settlementVersions: Record<string, number> = {};
      const db = getDB();

      for (const s of sales) {
        const inv = await seedE2ESalesInvoice({
          id: `inv-${s.invoiceNo.toLowerCase()}`,
          invoiceNo: s.invoiceNo,
          grandTotal: s.grandTotal,
          date: "2026-07-12",
        });
        invoiceIds[s.invoiceNo] = inv.id;
        const st = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);
        settlementVersions[s.invoiceNo] = st.settlementVersion;
      }
      for (const p of purchases) {
        const inv = await seedE2EPurchaseInvoice({
          id: `inv-${p.invoiceNo.toLowerCase()}`,
          invoiceNo: p.invoiceNo,
          grandTotal: p.grandTotal,
          date: "2026-07-12",
        });
        invoiceIds[p.invoiceNo] = inv.id;
        const st = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);
        settlementVersions[p.invoiceNo] = st.settlementVersion;
      }

      await window.__orbixE2E!.reloadFromDexie();
      return { invoiceIds, settlementVersions, companyId: E2E_COMPANY_ID };
    },

    async seedPhase10TreasuryDocs() {
      await ensureOrbixSchema();
      const seeded = await seedTreasuryE2ECompany();
      await applyE2EUserState("accountant");
      useEKhataStore.getState().newChat();
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse seedPhase10TreasuryDocs — company not E2E after seed");
      }
      await window.__orbixE2E!.reloadFromDexie();
      return {
        companyId: seeded.companyId,
        bankAccountId: seeded.bankAccountId,
        sampleCsv: seeded.sampleCsv,
      };
    },
    async getTreasurySnapshot() {
      const db = getDB();
      const batches = (db as any).bankStatementBatches
        ? await (db as any).bankStatementBatches.toArray()
        : [];
      const lines = (db as any).bankStatementLines
        ? await (db as any).bankStatementLines.toArray()
        : [];
      const links = (db as any).bankReconciliationLinks
        ? await (db as any).bankReconciliationLinks.toArray()
        : [];
      const cheque = (db as any).chequeInstruments
        ? await (db as any).chequeInstruments.get(E2E_CHEQUE_CLEARED_ID)
        : null;
      let position: Record<string, unknown> | null = null;
      try {
        const pos = await computeTreasuryPosition({
          companyId: E2E_COMPANY_ID,
          bankAccountId: E2E_BANK_ACCOUNT_ID,
        });
        position = pos.accounts[0]
          ? {
              bookBalance: pos.accounts[0].bookBalance,
              availableBalance: pos.accounts[0].availableBalance,
            }
          : null;
      } catch {
        position = null;
      }
      return {
        batchCount: batches.length,
        lineCount: lines.length,
        linkCount: links.filter((l: any) => l.status === "confirmed").length,
        chequeClearedStatus: cheque?.status || null,
        position,
      };
    },
    async importE2EStatement(opts = {}) {
      const idempotencyKey =
        opts.idempotencyKey?.trim() || "e2e-stable-import";
      const result = await createStatementBatch({
        commandId: `e2e-import-${idempotencyKey}`,
        requestId: `e2e-import-${idempotencyKey}-${Date.now()}`,
        idempotencyKey,
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        bankAccountId: E2E_BANK_ACCOUNT_ID,
        csvText: E2E_SAMPLE_STATEMENT_CSV,
        sourceType: "e2e_fixture",
        supersedeDuplicate: opts.supersedeDuplicate,
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async postE2EBankMatch(opts) {
      const db = getDB();
      let lineId = opts.statementLineId;
      if (!lineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines.toArray();
        const ref = String(opts.reference || "RV-E2E-001").toUpperCase();
        const hit = lines.find(
          (l: any) => String(l.reference || "").toUpperCase() === ref,
        );
        lineId = hit?.id;
      }
      const line = lineId ? await (db as any).bankStatementLines.get(lineId) : null;
      let erpId = opts.erpDocumentId || E2E_RV_001_ID;
      if (opts.reference && String(opts.reference).startsWith("RV-")) {
        const v = await db.vouchers
          .filter(
            (x: any) =>
              String(x.voucherNo || "").toUpperCase() ===
              String(opts.reference).toUpperCase(),
          )
          .first();
        if (v?.id) erpId = v.id;
      }
      const result = await confirmBankMatch({
        commandId: `e2e-match-${Date.now()}`,
        requestId: `e2e-match-${Date.now()}`,
        idempotencyKey: `e2e-match-${Date.now()}-${opts.expectedVersion ?? "auto"}`,
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        bankAccountId: E2E_BANK_ACCOUNT_ID,
        statementLineId: lineId || "",
        erpDocumentIds: [erpId],
        matchedAmount: opts.amount,
        matchType: "one_to_one",
        matchMethod: "manual_confirm",
        expectedStatementLineVersion: Number(
          opts.expectedVersion ?? line?.reconciliationVersion ?? 1,
        ),
        expectedErpMatchVersions: {},
        currency: "NPR",
      });
      await window.__orbixE2E!.reloadFromDexie();
      return {
        type: result.type,
        error_code: (result as any).payload?.error_code,
        conflict_category: (result as any).payload?.conflict_category,
        ...(result.type === "posting_completed" ? result.payload : {}),
      } as Record<string, unknown>;
    },
    async postE2EChequeTransition(opts) {
      const db = getDB();
      let chequeId = opts.chequeId;
      if (!chequeId && opts.chequeNumber && (db as any).chequeInstruments) {
        const all = await (db as any).chequeInstruments.toArray();
        chequeId = all.find(
          (c: any) =>
            String(c.instrumentNumber || "").toUpperCase() ===
            String(opts.chequeNumber).toUpperCase(),
        )?.id;
      }
      if (!chequeId) chequeId = E2E_CHEQUE_CLEARED_ID;
      const cheque = await (db as any).chequeInstruments?.get(chequeId);
      let statementLineId = opts.statementLineId;
      if (
        !statementLineId &&
        opts.nextStatus === "cleared" &&
        (db as any).bankStatementLines
      ) {
        const lines = await (db as any).bankStatementLines.toArray();
        const needle = String(
          opts.chequeNumber || cheque?.instrumentNumber || "CH-E2E-001",
        ).toUpperCase();
        statementLineId = lines.find((l: any) =>
          String(l.reference || "").toUpperCase().includes(needle),
        )?.id;
      }
      const amount =
        opts.bounceAmount ||
        (cheque?.amountPaisa != null
          ? (Number(cheque.amountPaisa) / 100).toFixed(2)
          : "10000.00");
      const result = await postChequeStatusChange({
        commandId: `e2e-cheque-${Date.now()}`,
        requestId: `e2e-cheque-${Date.now()}`,
        idempotencyKey:
          opts.idempotencyKey ||
          `e2e-cheque-${chequeId}-${opts.nextStatus}-${opts.expectedInstrumentVersion ?? "auto"}-${Date.now()}`,
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        chequeId: chequeId || "",
        nextStatus: opts.nextStatus as ChequeState,
        expectedInstrumentVersion: Number(
          opts.expectedInstrumentVersion ?? cheque?.instrumentVersion ?? 1,
        ),
        statementLineId: statementLineId || null,
        bounceJournalLines:
          opts.nextStatus === "bounced"
            ? [
                {
                  accountId: "acc-sundry-debtors",
                  debit: amount,
                  credit: "0.00",
                },
                {
                  accountId: "acc-bank",
                  debit: "0.00",
                  credit: amount,
                },
              ]
            : null,
        bounceNarration: `E2E bounce ${opts.chequeNumber || chequeId}`,
      });
      await window.__orbixE2E!.reloadFromDexie();
      return {
        type: result.type,
        error_code: (result as any).payload?.error_code,
        conflict_category: (result as any).payload?.conflict_category,
        ...(result.type === "posting_completed" ? result.payload : {}),
      } as Record<string, unknown>;
    },
    async pullRemoteEvents() {
      const companyId = E2E_COMPANY_ID;
      return (await getEventSyncClient().pullRemote(companyId)) as Record<string, unknown>;
    },
    async getSettlementSnapshot() {
      const db = getDB();
      const vouchers = await db.vouchers.toArray();
      const byType = (t: string) =>
        vouchers.filter((v) => {
          const vt = String(
            (v as { voucherType?: string; type?: string }).voucherType ||
              (v as { type?: string }).type ||
              "",
          ).toLowerCase();
          return vt === t || vt.includes(t);
        });
      const allocations = db.settlementAllocations
        ? await db.settlementAllocations.toArray()
        : [];
      const advances = db.partyAdvances ? await db.partyAdvances.toArray() : [];
      const settlementState = db.documentSettlementState
        ? await db.documentSettlementState.toArray()
        : [];
      const invoices = await db.invoices.toArray();
      const outstanding: Record<string, unknown> = {};
      for (const inv of invoices) {
        const no = String((inv as { invoiceNo?: string }).invoiceNo || "");
        if (!no.startsWith("SI-E2E-") && !no.startsWith("PI-E2E-")) continue;
        const o = await computeDocumentOutstanding(db, E2E_COMPANY_ID, inv.id);
        outstanding[no] = o;
      }
      const queue = db.eventSyncQueue ? await db.eventSyncQueue.toArray() : [];
      const outbound = queue.filter(
        (r) =>
          r.origin !== "remote_sync" &&
          (r.status === "pending" || r.status === "syncing" || r.status === "failed"),
      );
      return {
        receipts: byType("receipt"),
        payments: byType("payment"),
        contras: byType("contra"),
        journals: byType("journal"),
        vouchers,
        allocations,
        advances,
        settlementState,
        outstanding,
        eventSyncQueueOutboundCount: outbound.length,
        companyId: E2E_COMPANY_ID,
      };
    },
    async postE2EReceipt(opts) {
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse postE2EReceipt outside E2E company");
      }
      const db = getDB();
      const amount = opts.amount;
      const allocations = [];
      for (const a of opts.allocations || []) {
        let docId = a.document_id || "";
        if (!docId && a.invoice_no) {
          const inv = await db.invoices.where("invoiceNo").equals(a.invoice_no).first();
          docId = inv?.id || "";
        }
        if (!docId && opts.invoiceNo) {
          const inv = await db.invoices.where("invoiceNo").equals(opts.invoiceNo).first();
          docId = inv?.id || "";
        }
        if (!docId) continue;
        const st = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, docId);
        allocations.push({
          document_id: docId,
          amount: a.amount || amount,
          expected_settlement_version:
            a.expected_settlement_version != null
              ? a.expected_settlement_version
              : st.settlementVersion,
        });
      }
      if (!allocations.length && opts.invoiceNo) {
        const inv = await db.invoices.where("invoiceNo").equals(opts.invoiceNo).first();
        if (inv) {
          const st = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);
          allocations.push({
            document_id: inv.id,
            amount,
            expected_settlement_version: st.settlementVersion,
          });
        }
      }
      const isAdvance = String(opts.receiptType || "").includes("advance");
      const result = await postReceiptTransaction({
        commandId: `e2e-rcpt-${Date.now()}`,
        requestId: `e2e-rcpt-${Date.now()}`,
        idempotencyKey: opts.idempotencyKey || `e2e-rcpt-${Date.now()}`,
        companyId: E2E_COMPANY_ID,
        financialYearId: E2E_FY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        receipt: {
          receiptType: (opts.receiptType as any) || (isAdvance ? "customer_advance_receipt" : "customer_receipt"),
          transactionDate: "2026-07-12",
          partyId: opts.partyId || E2E_CUSTOMER_ID,
          cashOrBankAccountId: opts.cashOrBankAccountId || "acc-bank",
          amount,
          allocations: isAdvance ? [] : allocations,
          currency: "NPR",
          narration: "E2E harness receipt",
        },
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async postE2EPayment(opts) {
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse postE2EPayment outside E2E company");
      }
      const db = getDB();
      const amount = opts.amount;
      const allocations = [];
      for (const a of opts.allocations || []) {
        let docId = a.document_id || "";
        if (!docId && a.invoice_no) {
          const inv = await db.invoices.where("invoiceNo").equals(a.invoice_no).first();
          docId = inv?.id || "";
        }
        if (!docId && opts.invoiceNo) {
          const inv = await db.invoices.where("invoiceNo").equals(opts.invoiceNo).first();
          docId = inv?.id || "";
        }
        if (!docId) continue;
        const st = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, docId);
        allocations.push({
          document_id: docId,
          amount: a.amount || amount,
          expected_settlement_version:
            a.expected_settlement_version != null
              ? a.expected_settlement_version
              : st.settlementVersion,
        });
      }
      if (!allocations.length && opts.invoiceNo) {
        const inv = await db.invoices.where("invoiceNo").equals(opts.invoiceNo).first();
        if (inv) {
          const st = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);
          allocations.push({
            document_id: inv.id,
            amount,
            expected_settlement_version: st.settlementVersion,
          });
        }
      }
      const isAdvance = String(opts.paymentType || "").includes("advance");
      const result = await postPaymentTransaction({
        commandId: `e2e-pay-${Date.now()}`,
        requestId: `e2e-pay-${Date.now()}`,
        idempotencyKey: opts.idempotencyKey || `e2e-pay-${Date.now()}`,
        companyId: E2E_COMPANY_ID,
        financialYearId: E2E_FY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        payment: {
          paymentType: (opts.paymentType as any) || (isAdvance ? "supplier_advance_payment" : "supplier_payment"),
          transactionDate: "2026-07-12",
          partyId: opts.partyId || E2E_SUPPLIER_ID,
          cashOrBankAccountId: opts.cashOrBankAccountId || "acc-cash",
          amount,
          withholding: opts.withholding || null,
          allocations: isAdvance ? [] : allocations,
          currency: "NPR",
          narration: "E2E harness payment",
        },
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    dbInfo() {
      const db = getDB();
      return { verno: db.verno, tables: db.tables.map((t) => t.name) };
    },
    assertSafeCompany() {
      const settings = useStore.getState().companySettings as {
        companyId?: string;
        name?: string;
        companyName?: string;
      } | null;
      const id = String(settings?.companyId || "");
      const name = String(settings?.name || settings?.companyName || "");
      const userId = String(useStore.getState().currentUser?.id || "");
      const purchaseOk =
        (id === E2E_COMPANY_ID || name === E2E_COMPANY_NAME) &&
        (userId === E2E_USER_AUTHORIZED || userId === E2E_USER_RESTRICTED);
      const salesOk =
        (id === E2E_SALES_COMPANY_ID || name === E2E_SALES_COMPANY_NAME) &&
        (userId === E2E_SALES_USER_AUTHORIZED ||
          userId === E2E_SALES_USER_RESTRICTED ||
          userId === E2E_USER_AUTHORIZED);
      return purchaseOk || salesOk;
    },
    getDraftState() {
      const s = useEKhataStore.getState();
      const pending = s.pendingCard
        ? (s.pendingCard as unknown as Record<string, unknown>)
        : null;
      const lastAssistant = [...s.messages].reverse().find((m) => m.role === "assistant") || null;
      const structured = (lastAssistant as { structured?: Record<string, unknown> } | null)
        ?.structured;
      const payload = (structured?.payload || structured || {}) as Record<string, unknown>;
      return {
        activeSessionId: s.activeSessionId,
        conversation_id: s.activeSessionId,
        activeDraftId: s.activeDraftId,
        draftId: s.activeDraftId || pending?.draft_id || payload.draft_id || null,
        draftVersion:
          pending?.draft_version ??
          payload.draft_version ??
          (lastAssistant as { draftVersion?: number } | null)?.draftVersion ??
          null,
        previewVersion: pending?.preview_version ?? payload.preview_version ?? null,
        previewHash: pending?.preview_hash ?? payload.preview_hash ?? null,
        idempotencyKey: pending?.idempotency_key ?? payload.idempotency_key ?? null,
        orbixMode: s.orbixMode,
        pendingCard: pending ? { ...pending } : null,
        lastPostingResult: s.lastPostingResult,
        messageCount: s.messages.length,
        lastAssistant,
        response_type: structured?.response_type ?? null,
      };
    },
    async getLedgerSnapshot() {
      return window.__orbixE2E!.getSnapshot();
    },
    async getAdjustmentSnapshot() {
      const db = getDB();
      const invoices = await db.invoices.toArray();
      const returns = invoices.filter((i) => i.type === "sales-return");
      const creditNotes = invoices.filter((i) => i.type === "credit-note");
      const adjIds = new Set([...returns, ...creditNotes].map((i) => i.id));
      const stockMovements = await db.stockMovements.toArray();
      const stockIns = stockMovements.filter(
        (m) =>
          Number(m.qty) > 0 &&
          (adjIds.has(String(m.referenceId || "")) ||
            String(m.referenceType || "").includes("sales-return") ||
            String(m.referenceType || "").includes("return")),
      );
      const adjustmentState = db.salesInvoiceAdjustmentState
        ? await db.salesInvoiceAdjustmentState.toArray()
        : [];
      const queue = db.eventSyncQueue ? await db.eventSyncQueue.toArray() : [];
      const syncEvents = queue.filter((r) => {
        const et =
          (r.envelope as { eventType?: string } | undefined)?.eventType ||
          String((r as { eventType?: string }).eventType || "");
        return et === "sales_return_posted" || et === "sales_credit_note_posted";
      });
      const receipts = (await db.orbixPostingReceipts?.toArray?.().catch(() => [])) ?? [];
      const adjustmentReceipts = receipts.filter(
        (r) =>
          r.operation === "post_sales_return" || r.operation === "post_sales_credit_note",
      );
      return {
        returns,
        creditNotes,
        stockIns,
        adjustmentState,
        syncEvents,
        adjustmentReceipts,
        companyId: E2E_SALES_COMPANY_ID,
      };
    },
    async getPurchaseAdjustmentSnapshot() {
      const db = getDB();
      const invoices = await db.invoices.toArray();
      const returns = invoices.filter((i) => i.type === "purchase-return");
      const debitNotes = invoices.filter((i) => i.type === "debit-note");
      const adjIds = new Set([...returns, ...debitNotes].map((i) => i.id));
      const stockMovements = await db.stockMovements.toArray();
      // Purchase returns move stock OUT (negative qty) of inventory.
      const stockOuts = stockMovements.filter(
        (m) =>
          Number(m.qty) < 0 &&
          (adjIds.has(String(m.referenceId || "")) ||
            String(m.referenceType || "").includes("purchase-return") ||
            String(m.referenceType || "").includes("return")),
      );
      const adjustmentState = db.purchaseInvoiceAdjustmentState
        ? await db.purchaseInvoiceAdjustmentState.toArray()
        : [];
      const queue = db.eventSyncQueue ? await db.eventSyncQueue.toArray() : [];
      const syncEvents = queue.filter((r) => {
        const et =
          (r.envelope as { eventType?: string } | undefined)?.eventType ||
          String((r as { eventType?: string }).eventType || "");
        return et === "purchase_return_posted" || et === "supplier_debit_note_posted";
      });
      const receipts = (await db.orbixPostingReceipts?.toArray?.().catch(() => [])) ?? [];
      const adjustmentReceipts = receipts.filter(
        (r) =>
          r.operation === "post_purchase_return" ||
          r.operation === "post_supplier_debit_note",
      );
      return {
        returns,
        debitNotes,
        stockOuts,
        adjustmentState,
        syncEvents,
        adjustmentReceipts,
        companyId: E2E_COMPANY_ID,
      };
    },
    async postE2EPurchase(opts = {}) {
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse postE2EPurchase outside E2E company");
      }
      const qty = opts.quantity ?? "1";
      const unitRate = opts.amount ?? "50000.00";
      const qtyNum = Number(qty);
      const amount = (Number(unitRate) * (Number.isFinite(qtyNum) ? qtyNum : 1)).toFixed(2);
      const paymentMethod = opts.paymentMethod ?? "cash";
      const idem =
        opts.idempotencyKey ?? `e2e-sync-purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await postPurchaseTransaction({
        commandId: `cmd-${idem}`,
        requestId: `req-${idem}`,
        draftId: `draft-sync-${idem}`,
        draftVersion: 1,
        previewVersion: 1,
        previewHash: `hash-${idem}`,
        idempotencyKey: idem,
        tenantId: "local",
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        purchase: {
          transactionDate: new Date().toISOString().slice(0, 10),
          supplierId:
            opts.supplierId ?? (paymentMethod === "credit" ? "acc-sundry-creditors" : null),
          supplierName:
            opts.supplierName ?? (paymentMethod === "credit" ? "Supplier E2E" : null),
          paymentMethod,
          paymentAccountId:
            paymentMethod === "cash" ? "acc-cash" : paymentMethod === "bank" ? "acc-bank" : null,
          invoiceNo: opts.invoiceNo || null,
          items: [
            {
              itemId: E2E_ITEM_ID,
              quantity: qty,
              unit: "pcs",
              rate: unitRate,
              amount,
            },
          ],
          subtotal: amount,
          grandTotal: amount,
          currency: "NPR",
          narration: "E2E sync purchase",
        },
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async postE2ESale(opts = {}) {
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse postE2ESale outside E2E company");
      }
      const qty = opts.quantity ?? "1";
      const unitRate = opts.amount ?? "60000.00";
      const qtyNum = Number(qty);
      const lineTotal = (Number(unitRate) * (Number.isFinite(qtyNum) ? qtyNum : 1)).toFixed(2);
      const paymentMethod = opts.paymentMethod ?? "cash";
      const idem =
        opts.idempotencyKey ?? `e2e-sync-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await postSalesTransaction({
        commandId: `cmd-${idem}`,
        requestId: `req-${idem}`,
        draftId: `draft-sync-sale-${idem}`,
        draftVersion: 1,
        previewVersion: 1,
        previewHash: `hash-${idem}`,
        idempotencyKey: idem,
        tenantId: "local",
        companyId: E2E_SALES_COMPANY_ID,
        userId: E2E_SALES_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        sale: {
          transactionDate: new Date().toISOString().slice(0, 10),
          customerId: paymentMethod === "credit" ? E2E_SALES_CUSTOMER_ID : null,
          customerName: paymentMethod === "credit" ? "Ram Traders E2E" : null,
          paymentMethod,
          paymentAccountId:
            paymentMethod === "cash" ? "acc-cash" : paymentMethod === "bank" ? "acc-bank" : null,
          warehouseId: "wh-main",
          invoiceNo: opts.invoiceNo || null,
          items: [
            {
              itemId: E2E_SALES_ITEM_ID,
              quantity: qty,
              unit: "pcs",
              rate: unitRate,
              lineAmount: lineTotal,
            },
          ],
          subtotal: lineTotal,
          grandTotal: lineTotal,
          currency: "NPR",
          narration: "E2E sync sale",
        },
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async postE2ESalesAdjustment(opts) {
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse postE2ESalesAdjustment outside E2E company");
      }
      const db = getDB();
      const original = await db.invoices.where("invoiceNo").equals(opts.originalInvoiceNo).first();
      if (!original || original.type !== "sales-invoice") {
        throw new Error(`Original sales invoice not found: ${opts.originalInvoiceNo}`);
      }
      const line = (original.lines || [])[0];
      if (!line) throw new Error("Original sale has no lines");
      const lineId = (line as { id?: string }).id || `line-${original.id}-0`;
      const qty = opts.quantity ?? 1;
      const adjustmentType = opts.adjustmentType ?? "inventory_sales_return";
      const settlementMethod = opts.settlementMethod ?? "reduce_receivable";
      const idem =
        opts.idempotencyKey ??
        `e2e-adj-${opts.originalInvoiceNo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const state = db.salesInvoiceAdjustmentState
        ? await db.salesInvoiceAdjustmentState.get(original.id)
        : null;
      const expectedVersion =
        state && typeof state.adjustmentVersion === "number" ? state.adjustmentVersion : 0;
      const result = await postSalesAdjustmentTransaction({
        commandId: `cmd-${idem}`,
        requestId: `req-${idem}`,
        draftId: `draft-adj-${idem}`,
        draftVersion: 1,
        previewVersion: 1,
        previewHash: `hash-${idem}`,
        idempotencyKey: idem,
        tenantId: "local",
        companyId: E2E_SALES_COMPANY_ID,
        userId: E2E_SALES_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        expectedAdjustmentVersion: expectedVersion,
        adjustment: {
          adjustmentType,
          originalInvoiceId: original.id,
          transactionDate: new Date().toISOString().slice(0, 10),
          settlementMethod,
          settlementAccountId:
            settlementMethod === "cash_refund"
              ? "acc-cash"
              : settlementMethod === "bank_refund"
                ? "acc-bank"
                : null,
          destinationWarehouseId: "wh-main",
          reasonCode: adjustmentType === "financial_credit_note" ? "pricing_error" : "defective",
          customerId: original.partyId || E2E_SALES_CUSTOMER_ID,
          narration: `E2E harness adjustment ${opts.originalInvoiceNo}`,
          lines:
            adjustmentType === "financial_credit_note"
              ? [
                  {
                    originalSalesLineId: lineId,
                    itemId: E2E_SALES_ITEM_ID,
                    financialAdjustment: opts.financialAmount ?? 5000,
                  },
                ]
              : [
                  {
                    originalSalesLineId: lineId,
                    itemId: E2E_SALES_ITEM_ID,
                    returnQuantity: qty,
                    stockCondition: "resalable" as const,
                  },
                ],
        },
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async postE2EPurchaseAdjustment(opts) {
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse postE2EPurchaseAdjustment outside E2E company");
      }
      const db = getDB();
      const original = await db.invoices.where("invoiceNo").equals(opts.originalInvoiceNo).first();
      if (!original || original.type !== "purchase-invoice") {
        throw new Error(`Original purchase invoice not found: ${opts.originalInvoiceNo}`);
      }
      const line = (original.lines || [])[0];
      if (!line) throw new Error("Original purchase has no lines");
      const lineId = (line as { id?: string }).id || `line-${original.id}-0`;
      const qty = opts.quantity ?? 1;
      const adjustmentType = opts.adjustmentType ?? "inventory_purchase_return";
      const settlementMethod = opts.settlementMethod ?? "reduce_payable";
      const idem =
        opts.idempotencyKey ??
        `e2e-padj-${opts.originalInvoiceNo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const state = db.purchaseInvoiceAdjustmentState
        ? await db.purchaseInvoiceAdjustmentState.get(original.id)
        : null;
      const expectedVersion =
        state && typeof state.adjustmentVersion === "number" ? state.adjustmentVersion : 0;
      const result = await postPurchaseAdjustmentTransaction({
        commandId: `cmd-${idem}`,
        requestId: `req-${idem}`,
        draftId: `draft-padj-${idem}`,
        draftVersion: 1,
        previewVersion: 1,
        previewHash: `hash-${idem}`,
        idempotencyKey: idem,
        tenantId: "local",
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        expectedAdjustmentVersion: expectedVersion,
        adjustment: {
          adjustmentType,
          originalInvoiceId: original.id,
          transactionDate: new Date().toISOString().slice(0, 10),
          settlementMethod,
          settlementAccountId:
            settlementMethod === "cash_refund_received"
              ? "acc-cash"
              : settlementMethod === "bank_refund_received"
                ? "acc-bank"
                : null,
          destinationWarehouseId: "wh-main",
          reasonCode:
            adjustmentType === "financial_supplier_debit_note" ? "pricing_error" : "defective",
          supplierId: original.partyId || null,
          narration: `E2E harness purchase adjustment ${opts.originalInvoiceNo}`,
          lines:
            adjustmentType === "financial_supplier_debit_note"
              ? [
                  {
                    originalPurchaseLineId: lineId,
                    itemId: E2E_ITEM_ID,
                    financialAdjustment: opts.financialAmount ?? 5000,
                  },
                ]
              : [
                  {
                    originalPurchaseLineId: lineId,
                    itemId: E2E_ITEM_ID,
                    returnQuantity: qty,
                    stockCondition: "resalable" as const,
                  },
                ],
        },
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async pushSyncPending() {
      return getEventSyncClient().pushPending();
    },
    async flushSyncQueue(opts = {}) {
      const maxRounds = opts.maxRounds ?? 12;
      const { releaseExpiredOrOwnedSyncClaims } = await import("@/platform/sync/syncQueue");
      let pushedTotal = 0;
      for (let round = 0; round < maxRounds; round++) {
        await releaseExpiredOrOwnedSyncClaims(undefined, { forceAllSyncing: true });
        const pushed = await getEventSyncClient().pushPending();
        pushedTotal += pushed;
        const db = getDB();
        if (!db.eventSyncQueue) return { pushed: pushedTotal, remaining: 0 };
        const remaining = (
          await db.eventSyncQueue
            .filter(
              (r) =>
                r.origin !== "remote_sync" &&
                (r.status === "pending" || r.status === "syncing" || r.status === "failed"),
            )
            .toArray()
        ).length;
        if (remaining === 0) return { pushed: pushedTotal, remaining: 0 };
        await new Promise((r) => setTimeout(r, 250));
      }
      const db = getDB();
      const remaining = db.eventSyncQueue
        ? (
            await db.eventSyncQueue
              .filter(
                (r) =>
                  r.origin !== "remote_sync" &&
                  (r.status === "pending" || r.status === "syncing" || r.status === "failed"),
              )
              .toArray()
          ).length
        : 0;
      return { pushed: pushedTotal, remaining };
    },
    async pullSyncRemote(companyId = E2E_COMPANY_ID) {
      try {
        return await getEventSyncClient().pullRemote(companyId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`pullSyncRemote failed: ${message}`);
      }
    },
    async getSyncQueueSnapshot() {
      const db = getDB();
      if (!db.eventSyncQueue) return [];
      return db.eventSyncQueue.toArray();
    },
    async reloadFromDexie() {
      const db = getDB();
      const [invoices, vouchers, stockMovements, accounts, items] = await Promise.all([
        db.invoices.toArray(),
        db.vouchers.toArray(),
        db.stockMovements.toArray(),
        db.accounts.toArray(),
        db.items.toArray(),
      ]);
      useStore.setState({
        invoices: invoices as never,
        vouchers: vouchers as never,
        stockMovements: stockMovements as never,
        accounts: accounts as never,
        items: items as never,
      });
    },
    setAccountant() {
      void applyE2EUserState("accountant");
      useEKhataStore.getState().setOrbixMode("accountant");
    },
    setRestrictedUser() {
      useStore.setState({
        currentUser: {
          id: E2E_USER_RESTRICTED,
          username: "e2e.viewer",
          name: "E2E Viewer",
          role: "viewer",
          isActive: true,
        },
      });
      useEKhataStore.getState().setOrbixMode("accountant");
    },
    mutatePendingPreview(patch) {
      const card = useEKhataStore.getState().pendingCard;
      if (!card) return;
      useEKhataStore.setState({
        pendingCard: {
          ...card,
          ...(patch.amount != null ? { amount: patch.amount } : {}),
          ...(patch.preview_hash != null
            ? { preview_hash: patch.preview_hash }
            : { preview_hash: `stale-${Date.now()}` }),
        },
      });
    },
    async confirmWithInject(injectFailure) {
      const card = useEKhataStore.getState().pendingCard;
      if (!card) throw new Error("No pending card");
      const settings = useStore.getState().companySettings as
        | { companyId?: string; id?: string }
        | null;
      const result = await executeOrbixConfirm({
        requestId: `e2e-inject-${Date.now()}`,
        conversationId: useEKhataStore.getState().activeSessionId,
        draftId: card.draft_id ?? useEKhataStore.getState().activeDraftId,
        draftVersion: (card as { draft_version?: number }).draft_version ?? null,
        previewVersion: card.preview_version ?? 1,
        previewHash: card.preview_hash ?? null,
        companyId: String(settings?.companyId || settings?.id || E2E_COMPANY_ID),
        orbixMode: "accountant",
        idempotencyKey: card.idempotency_key || `e2e-inject-${card.draft_id}`,
        confirmation: true,
        card,
        userRole: useStore.getState().currentUser?.role,
        injectFailure,
      });
      useEKhataStore.setState({ lastPostingResult: result });
      return result as unknown as Record<string, unknown>;
    },
    async confirmAgain() {
      const card = useEKhataStore.getState().pendingCard;
      const last = useEKhataStore.getState().lastPostingResult as {
        payload?: { draft_id?: string; idempotent_replay?: boolean };
      } | null;
      if (!card) return { error: "no_pending_card", last };
      return window.__orbixE2E!.replayConfirm(card as unknown as Record<string, unknown>);
    },
    async replayConfirm(card) {
      const settings = useStore.getState().companySettings as
        | { companyId?: string; id?: string }
        | null;
      const c = card as {
        draft_id?: string;
        draft_version?: number;
        preview_version?: number;
        preview_hash?: string;
        idempotency_key?: string;
      };
      const sessionId = useEKhataStore.getState().activeSessionId;
      const result = await executeOrbixConfirm({
        requestId: `e2e-replay-${Date.now()}`,
        conversationId: sessionId,
        draftId: c.draft_id ?? null,
        draftVersion: c.draft_version ?? null,
        previewVersion: c.preview_version ?? 1,
        previewHash: c.preview_hash ?? null,
        companyId: String(settings?.companyId || settings?.id || E2E_COMPANY_ID),
        orbixMode: "accountant",
        idempotencyKey:
          c.idempotency_key ||
          buildIdempotencyKey({
            draftId: c.draft_id,
            previewHash: c.preview_hash,
            sessionId,
          }),
        confirmation: true,
        card: card as never,
        userRole: useStore.getState().currentUser?.role || "accountant",
      });
      useEKhataStore.setState({ lastPostingResult: result });
      return result as unknown as Record<string, unknown>;
    },
    async staleConfirm(card) {
      const settings = useStore.getState().companySettings as
        | { companyId?: string; id?: string }
        | null;
      const c = card as {
        draft_id?: string;
        draft_version?: number;
        preview_version?: number;
        preview_hash?: string;
      };
      const result = await executeOrbixConfirm({
        requestId: `e2e-stale-${Date.now()}`,
        conversationId: useEKhataStore.getState().activeSessionId,
        draftId: c.draft_id ?? null,
        draftVersion: c.draft_version ?? null,
        previewVersion: c.preview_version ?? 1,
        previewHash: "stale-hash-does-not-match",
        companyId: String(settings?.companyId || settings?.id || E2E_COMPANY_ID),
        orbixMode: "accountant",
        idempotencyKey: `stale-${Date.now()}`,
        confirmation: true,
        card: card as never,
        userRole: useStore.getState().currentUser?.role || "accountant",
      });
      return result as unknown as Record<string, unknown>;
    },
    async getSnapshot() {
      const db = getDB();
      const [
        invoices,
        vouchers,
        stockMovements,
        auditLogs,
        syncOutbox,
        receipts,
        accounts,
        items,
      ] = await Promise.all([
        db.invoices.toArray(),
        db.vouchers.toArray(),
        db.stockMovements.toArray(),
        db.auditLogs.toArray(),
        db.syncOutbox.toArray(),
        db.orbixPostingReceipts.toArray(),
        db.accounts.toArray(),
        db.items.toArray(),
      ]);
      const accountBalances: Record<string, number> = {};
      for (const a of accounts) accountBalances[a.id] = Number(a.balance || 0);
      const itemBike =
        items.find((i) => i.id === E2E_ITEM_ID || i.name === "E2E Test Bike") || null;
      return {
        invoices,
        vouchers,
        stockMovements,
        auditLogs,
        syncOutbox,
        receipts,
        accountBalances,
        companyId: E2E_COMPANY_ID,
        itemBike,
      };
    },
  };

  setStep("bootstrap complete");
}
