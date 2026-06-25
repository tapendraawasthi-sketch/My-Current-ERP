// ============================================================
// ZUSTAND STORE — Accounting Module
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  Account,
  AccountType,
  AccountLevel,
  JournalEntry,
  VoucherStatus,
  VoucherType,
  Invoice,
  InvoiceType,
  PaymentStatus,
  Party,
  PartyType,
  PaymentReceipt,
  RepeatingInvoice,
  PurchaseOrder,
  GoodsReceiptNote,
  BankReconciliation,
  PeriodLock,
  AuditLog,
  AuditAction,
  FiscalYear,
  VoucherSeries,
  BatchPayment,
  TaxRate,
} from "@/types";
import { today, generateVoucherNumber } from "@/utils/accounting";

// ── Seed Data ─────────────────────────────────────────────────
const SEED_FISCAL_YEAR: FiscalYear = {
  id: "fy-2024",
  name: "FY 2024-25",
  startDate: "2024-04-01",
  endDate: "2025-03-31",
  isActive: true,
  isClosed: false,
  createdAt: new Date().toISOString(),
};

const SEED_ACCOUNTS: Account[] = [
  // Assets
  { id: "acc-1001", name: "Cash in Hand", code: "1001", type: AccountType.ASSET, level: AccountLevel.LEDGER, isGroup: false, group: "Cash & Bank", balance: 50000, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-1002", name: "Bank Account - HDFC", code: "1002", type: AccountType.ASSET, level: AccountLevel.LEDGER, isGroup: false, group: "Cash & Bank", balance: 250000, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-1100", name: "Sundry Debtors", code: "1100", type: AccountType.ASSET, level: AccountLevel.LEDGER, isGroup: false, group: "Current Assets", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-1200", name: "Inventory", code: "1200", type: AccountType.ASSET, level: AccountLevel.LEDGER, isGroup: false, group: "Current Assets", balance: 100000, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-1500", name: "Equipment", code: "1500", type: AccountType.ASSET, level: AccountLevel.LEDGER, isGroup: false, group: "Fixed Assets", balance: 500000, isActive: true, createdAt: today(), updatedAt: today() },
  // Liabilities
  { id: "acc-2001", name: "Sundry Creditors", code: "2001", type: AccountType.LIABILITY, level: AccountLevel.LEDGER, isGroup: false, group: "Current Liabilities", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-2100", name: "Tax Payable - VAT", code: "2100", type: AccountType.LIABILITY, level: AccountLevel.LEDGER, isGroup: false, group: "Current Liabilities", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-2500", name: "Long Term Loan", code: "2500", type: AccountType.LIABILITY, level: AccountLevel.LEDGER, isGroup: false, group: "Long Term Loans", balance: 200000, isActive: true, createdAt: today(), updatedAt: today() },
  // Equity
  { id: "acc-3001", name: "Share Capital", code: "3001", type: AccountType.EQUITY, level: AccountLevel.LEDGER, isGroup: false, group: "Equity", balance: 700000, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-3100", name: "Retained Earnings", code: "3100", type: AccountType.EQUITY, level: AccountLevel.LEDGER, isGroup: false, group: "Equity", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  // Income
  { id: "acc-4001", name: "Sales Revenue", code: "4001", type: AccountType.INCOME, level: AccountLevel.LEDGER, isGroup: false, group: "Sales", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-4100", name: "Other Income", code: "4100", type: AccountType.INCOME, level: AccountLevel.LEDGER, isGroup: false, group: "Other Income", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  // Expenses
  { id: "acc-5001", name: "Cost of Goods Sold", code: "5001", type: AccountType.EXPENSE, level: AccountLevel.LEDGER, isGroup: false, group: "Cost of Goods", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-5100", name: "Salaries & Wages", code: "5100", type: AccountType.EXPENSE, level: AccountLevel.LEDGER, isGroup: false, group: "Operating Expenses", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-5200", name: "Office Expenses", code: "5200", type: AccountType.EXPENSE, level: AccountLevel.LEDGER, isGroup: false, group: "Admin Expenses", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-5300", name: "Bank Charges", code: "5300", type: AccountType.EXPENSE, level: AccountLevel.LEDGER, isGroup: false, group: "Finance Costs", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
  { id: "acc-5400", name: "Interest Expense", code: "5400", type: AccountType.EXPENSE, level: AccountLevel.LEDGER, isGroup: false, group: "Finance Costs", balance: 0, isActive: true, createdAt: today(), updatedAt: today() },
];

const SEED_PARTIES: Party[] = [
  { id: "party-001", name: "Acme Corp", type: PartyType.CUSTOMER, email: "accounts@acme.com", phone: "+1-555-0101", paymentTerms: 30, currency: "USD", isActive: true, createdAt: today() },
  { id: "party-002", name: "Global Supplies Ltd", type: PartyType.VENDOR, email: "billing@globalsupplies.com", phone: "+1-555-0202", paymentTerms: 45, currency: "USD", isActive: true, createdAt: today() },
  { id: "party-003", name: "TechPro Inc", type: PartyType.CUSTOMER, email: "finance@techpro.com", paymentTerms: 30, currency: "USD", isActive: true, createdAt: today() },
  { id: "party-004", name: "Office Mart", type: PartyType.VENDOR, email: "ar@officemart.com", paymentTerms: 30, currency: "USD", isActive: true, createdAt: today() },
];

const SEED_TAX_RATES: TaxRate[] = [
  { id: "tax-gst18", code: "GST18", name: "GST 18%", rate: 18, accountId: "acc-2100", isActive: true },
  { id: "tax-gst12", code: "GST12", name: "GST 12%", rate: 12, accountId: "acc-2100", isActive: true },
  { id: "tax-gst5", code: "GST5", name: "GST 5%", rate: 5, accountId: "acc-2100", isActive: true },
  { id: "tax-zero", code: "ZERO", name: "Zero Rated", rate: 0, isActive: true },
];

const SEED_VOUCHER_SERIES: VoucherSeries[] = [
  { id: "vs-jv", voucherType: VoucherType.JOURNAL, prefix: "JV", nextNumber: 1, fiscalYearId: "fy-2024" },
  { id: "vs-pv", voucherType: VoucherType.PAYMENT, prefix: "PV", nextNumber: 1, fiscalYearId: "fy-2024" },
  { id: "vs-rv", voucherType: VoucherType.RECEIPT, prefix: "RV", nextNumber: 1, fiscalYearId: "fy-2024" },
  { id: "vs-si", voucherType: VoucherType.SALES, prefix: "SI", nextNumber: 1, fiscalYearId: "fy-2024" },
  { id: "vs-pi", voucherType: VoucherType.PURCHASE, prefix: "PI", nextNumber: 1, fiscalYearId: "fy-2024" },
];

// ── Store Interface ───────────────────────────────────────────
interface AccountingState {
  // Data
  accounts: Account[];
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  parties: Party[];
  payments: PaymentReceipt[];
  repeatingInvoices: RepeatingInvoice[];
  purchaseOrders: PurchaseOrder[];
  goodsReceiptNotes: GoodsReceiptNote[];
  bankReconciliations: BankReconciliation[];
  periodLocks: PeriodLock[];
  auditLogs: AuditLog[];
  fiscalYears: FiscalYear[];
  voucherSeries: VoucherSeries[];
  batchPayments: BatchPayment[];
  taxRates: TaxRate[];
  currentUserId: string;
  currentUserName: string;

  // Actions — Accounts
  addAccount: (account: Omit<Account, "id" | "balance" | "createdAt" | "updatedAt">) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Actions — Journal Entries
  addJournalEntry: (entry: Omit<JournalEntry, "id" | "voucherNumber" | "createdAt" | "updatedAt" | "totalDebit" | "totalCredit" | "isBalanced">) => JournalEntry;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  postJournalEntry: (id: string) => void;
  voidJournalEntry: (id: string, reason: string) => void;

  // Actions — Invoices
  addInvoice: (invoice: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt">) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  postInvoice: (id: string) => void;
  voidInvoice: (id: string) => void;

  // Actions — Parties
  addParty: (party: Omit<Party, "id" | "createdAt">) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;

  // Actions — Payments
  addPayment: (payment: Omit<PaymentReceipt, "id" | "paymentNumber" | "createdAt">) => PaymentReceipt;
  postPayment: (id: string) => void;

  // Actions — Repeating Invoices
  addRepeatingInvoice: (ri: Omit<RepeatingInvoice, "id" | "createdAt">) => RepeatingInvoice;
  updateRepeatingInvoice: (id: string, updates: Partial<RepeatingInvoice>) => void;

  // Actions — Purchase Orders
  addPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "poNumber" | "createdAt">) => PurchaseOrder;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;

  // Actions — GRN
  addGoodsReceiptNote: (grn: Omit<GoodsReceiptNote, "id" | "grnNumber" | "createdAt">) => GoodsReceiptNote;

  // Actions — Bank Reconciliation
  addBankReconciliation: (br: Omit<BankReconciliation, "id" | "createdAt">) => BankReconciliation;
  updateBankReconciliation: (id: string, updates: Partial<BankReconciliation>) => void;

  // Actions — Period Lock
  setPeriodLock: (lock: Omit<PeriodLock, "id" | "updatedAt">) => void;

  // Actions — Batch Payments
  addBatchPayment: (bp: Omit<BatchPayment, "id" | "createdAt">) => BatchPayment;
  postBatchPayment: (id: string) => void;

  // Helpers
  getNextVoucherNumber: (type: VoucherType) => string;
  addAuditLog: (log: Omit<AuditLog, "id" | "timestamp">) => void;
}

// ── Store ─────────────────────────────────────────────────────
export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => ({
      accounts: SEED_ACCOUNTS,
      journalEntries: [],
      invoices: [],
      parties: SEED_PARTIES,
      payments: [],
      repeatingInvoices: [],
      purchaseOrders: [],
      goodsReceiptNotes: [],
      bankReconciliations: [],
      periodLocks: [],
      auditLogs: [],
      fiscalYears: [SEED_FISCAL_YEAR],
      voucherSeries: SEED_VOUCHER_SERIES,
      batchPayments: [],
      taxRates: SEED_TAX_RATES,
      currentUserId: "user-001",
      currentUserName: "Admin User",

      // ── Voucher Number ──────────────────────────────────────
      getNextVoucherNumber: (type: VoucherType) => {
        const series = get().voucherSeries.find((s) => s.voucherType === type);
        if (!series) return `${type}-${Date.now()}`;
        const num = generateVoucherNumber(series.prefix, series.nextNumber);
        set((state) => ({
          voucherSeries: state.voucherSeries.map((s) =>
            s.id === series.id ? { ...s, nextNumber: s.nextNumber + 1 } : s
          ),
        }));
        return num;
      },

      // ── Audit Log ───────────────────────────────────────────
      addAuditLog: (log) => {
        const entry: AuditLog = {
          ...log,
          id: uuidv4(),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({ auditLogs: [entry, ...state.auditLogs] }));
      },

      // ── Accounts ────────────────────────────────────────────
      addAccount: (account) => {
        const newAcc: Account = {
          ...account,
          id: uuidv4(),
          balance: 0,
          createdAt: today(),
          updatedAt: today(),
        };
        set((state) => ({ accounts: [...state.accounts, newAcc] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "Account", entityId: newAcc.id, entityDescription: newAcc.name });
        return newAcc;
      },

      updateAccount: (id, updates) => {
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: today() } : a
          ),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.UPDATE, entityType: "Account", entityId: id, afterState: updates as Record<string, unknown> });
      },

      deleteAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        }));
      },

      // ── Journal Entries ─────────────────────────────────────
      addJournalEntry: (entry) => {
        const totalDebit = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = entry.lines.reduce((s, l) => s + (l.credit || 0), 0);
        const newEntry: JournalEntry = {
          ...entry,
          id: uuidv4(),
          voucherNumber: get().getNextVoucherNumber(entry.voucherType),
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ journalEntries: [newEntry, ...state.journalEntries] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "JournalEntry", entityId: newEntry.id, entityDescription: newEntry.voucherNumber });
        return newEntry;
      },

      updateJournalEntry: (id, updates) => {
        const before = get().journalEntries.find((j) => j.id === id);
        set((state) => ({
          journalEntries: state.journalEntries.map((j) =>
            j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j
          ),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.UPDATE, entityType: "JournalEntry", entityId: id, beforeState: before as unknown as Record<string, unknown>, afterState: updates as Record<string, unknown> });
      },

      postJournalEntry: (id) => {
        set((state) => ({
          journalEntries: state.journalEntries.map((j) =>
            j.id === id
              ? { ...j, status: VoucherStatus.POSTED, postingTimestamp: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : j
          ),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.POST, entityType: "JournalEntry", entityId: id });
      },

      voidJournalEntry: (id, reason) => {
        const entry = get().journalEntries.find((j) => j.id === id);
        if (!entry) return;
        // Create reversal entry
        const reversalId = uuidv4();
        const reversal: JournalEntry = {
          ...entry,
          id: reversalId,
          voucherNumber: get().getNextVoucherNumber(entry.voucherType),
          narration: `VOID: ${reason} (Reversal of ${entry.voucherNumber})`,
          status: VoucherStatus.POSTED,
          lines: entry.lines.map((l) => ({
            ...l,
            id: uuidv4(),
            debit: l.credit,
            credit: l.debit,
          })),
          postingTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          journalEntries: state.journalEntries.map((j) =>
            j.id === id ? { ...j, status: VoucherStatus.VOID, updatedAt: new Date().toISOString() } : j
          ).concat([reversal]),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.VOID, entityType: "JournalEntry", entityId: id, afterState: { reason } });
      },

      // ── Invoices ─────────────────────────────────────────────
      addInvoice: (invoice) => {
        const voucherType = invoice.invoiceType === InvoiceType.SALES
          ? VoucherType.SALES
          : VoucherType.PURCHASE;
        const newInvoice: Invoice = {
          ...invoice,
          id: uuidv4(),
          invoiceNumber: get().getNextVoucherNumber(voucherType),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ invoices: [newInvoice, ...state.invoices] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "Invoice", entityId: newInvoice.id, entityDescription: newInvoice.invoiceNumber });
        return newInvoice;
      },

      updateInvoice: (id, updates) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === id ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
          ),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.UPDATE, entityType: "Invoice", entityId: id, afterState: updates as Record<string, unknown> });
      },

      postInvoice: (id) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === id
              ? { ...inv, voucherStatus: VoucherStatus.POSTED, updatedAt: new Date().toISOString() }
              : inv
          ),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.POST, entityType: "Invoice", entityId: id });
      },

      voidInvoice: (id) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === id
              ? { ...inv, voucherStatus: VoucherStatus.VOID, status: PaymentStatus.VOID, updatedAt: new Date().toISOString() }
              : inv
          ),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.VOID, entityType: "Invoice", entityId: id });
      },

      // ── Parties ──────────────────────────────────────────────
      addParty: (party) => {
        const newParty: Party = {
          ...party,
          id: uuidv4(),
          createdAt: today(),
        };
        set((state) => ({ parties: [...state.parties, newParty] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "Party", entityId: newParty.id, entityDescription: newParty.name });
        return newParty;
      },

      updateParty: (id, updates) => {
        set((state) => ({
          parties: state.parties.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      // ── Payments ─────────────────────────────────────────────
      addPayment: (payment) => {
        const newPayment: PaymentReceipt = {
          ...payment,
          id: uuidv4(),
          paymentNumber: get().getNextVoucherNumber(
            payment.partyType === PartyType.CUSTOMER
              ? VoucherType.RECEIPT
              : VoucherType.PAYMENT
          ),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ payments: [newPayment, ...state.payments] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "Payment", entityId: newPayment.id, entityDescription: newPayment.paymentNumber });
        return newPayment;
      },

      postPayment: (id) => {
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id ? { ...p, status: VoucherStatus.POSTED } : p
          ),
        }));
      },

      // ── Repeating Invoices ───────────────────────────────────
      addRepeatingInvoice: (ri) => {
        const newRI: RepeatingInvoice = {
          ...ri,
          id: uuidv4(),
          createdAt: today(),
        };
        set((state) => ({ repeatingInvoices: [...state.repeatingInvoices, newRI] }));
        return newRI;
      },

      updateRepeatingInvoice: (id, updates) => {
        set((state) => ({
          repeatingInvoices: state.repeatingInvoices.map((ri) =>
            ri.id === id ? { ...ri, ...updates } : ri
          ),
        }));
      },

      // ── Purchase Orders ──────────────────────────────────────
      addPurchaseOrder: (po) => {
        const newPO: PurchaseOrder = {
          ...po,
          id: uuidv4(),
          poNumber: `PO-${String(get().purchaseOrders.length + 1).padStart(5, "0")}`,
          createdAt: today(),
        };
        set((state) => ({ purchaseOrders: [...state.purchaseOrders, newPO] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "PurchaseOrder", entityId: newPO.id, entityDescription: newPO.poNumber });
        return newPO;
      },

      updatePurchaseOrder: (id, updates) => {
        set((state) => ({
          purchaseOrders: state.purchaseOrders.map((po) =>
            po.id === id ? { ...po, ...updates } : po
          ),
        }));
      },

      // ── GRN ──────────────────────────────────────────────────
      addGoodsReceiptNote: (grn) => {
        const newGRN: GoodsReceiptNote = {
          ...grn,
          id: uuidv4(),
          grnNumber: `GRN-${String(get().goodsReceiptNotes.length + 1).padStart(5, "0")}`,
          createdAt: today(),
        };
        set((state) => ({ goodsReceiptNotes: [...state.goodsReceiptNotes, newGRN] }));
        return newGRN;
      },

      // ── Bank Reconciliation ──────────────────────────────────
      addBankReconciliation: (br) => {
        const newBR: BankReconciliation = { ...br, id: uuidv4(), createdAt: today() };
        set((state) => ({ bankReconciliations: [...state.bankReconciliations, newBR] }));
        return newBR;
      },

      updateBankReconciliation: (id, updates) => {
        set((state) => ({
          bankReconciliations: state.bankReconciliations.map((br) =>
            br.id === id ? { ...br, ...updates } : br
          ),
        }));
      },

      // ── Period Lock ──────────────────────────────────────────
      setPeriodLock: (lock) => {
        const newLock: PeriodLock = { ...lock, id: uuidv4(), updatedAt: today() };
        set((state) => ({
          periodLocks: state.periodLocks
            .filter((pl) => pl.fiscalYearId !== lock.fiscalYearId)
            .concat([newLock]),
        }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.LOCK, entityType: "PeriodLock", entityId: newLock.id, afterState: { hardLockDate: lock.hardLockDate, softLockDate: lock.softLockDate } });
      },

      // ── Batch Payments ───────────────────────────────────────
      addBatchPayment: (bp) => {
        const newBP: BatchPayment = { ...bp, id: uuidv4(), createdAt: today() };
        set((state) => ({ batchPayments: [...state.batchPayments, newBP] }));
        get().addAuditLog({ userId: get().currentUserId, userName: get().currentUserName, action: AuditAction.CREATE, entityType: "BatchPayment", entityId: newBP.id });
        return newBP;
      },

      postBatchPayment: (id) => {
        set((state) => ({
          batchPayments: state.batchPayments.map((bp) =>
            bp.id === id ? { ...bp, status: VoucherStatus.POSTED } : bp
          ),
        }));
      },
    }),
    {
      name: "sutra-erp-accounting",
      partialize: (state) => ({
        accounts: state.accounts,
        journalEntries: state.journalEntries,
        invoices: state.invoices,
        parties: state.parties,
        payments: state.payments,
        repeatingInvoices: state.repeatingInvoices,
        purchaseOrders: state.purchaseOrders,
        goodsReceiptNotes: state.goodsReceiptNotes,
        bankReconciliations: state.bankReconciliations,
        periodLocks: state.periodLocks,
        auditLogs: state.auditLogs,
        fiscalYears: state.fiscalYears,
        voucherSeries: state.voucherSeries,
        batchPayments: state.batchPayments,
        taxRates: state.taxRates,
      }),
    }
  )
);
