/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create, StoreApi } from "zustand";
import toast from "react-hot-toast";
import { getDB, generateId } from "../lib/db";
import { createAuthSlice } from "./slices/authSlice";
import { createUiSlice } from "./slices/uiSlice";
import {
  Account,
  JournalEntry,
  Invoice,
  Party,
  Item,
  Warehouse,
  Unit,
  StockMovement,
  StockJournal,
  SalesOrder,
  PurchaseOrder,
  DeliveryChallan,
  GoodsReceiptNote,
  CostCenter,
  TdsEntry,
  Employee,
  PayrollRun,
  BankAccount,
  BankStatement,
  AuditLog,
  CompanySettings,
  FiscalYear,
  User,
  ReportFilters,
  AppNotification,
  BillAllocation,
  Currency,
  ExchangeRate,
  AccountType,
  AccountLevel,
  VoucherStatus,
  VoucherType,
  UserRole,
  TdsType,
  BillSundry,
  StandardNarration,
  OrderStatus,
  ChallanStatus,
  MovementType,
  ReportPeriodPreset,
  PaymentMode,
  PaymentStatus,
  FiscalYearStatus,
  PartyType,
  ItemType,
  DateFormat,
  StockValuationMethod,
  RecurringVoucher,
  RecurringFrequency,
  CustomFieldDef,
} from "../lib/types";
import {
  recalculateAccountBalances,
  generateVoucherNo,
  generateInvoiceNo,
  calculateNextDueDate,
  validateDoubleEntry,
  getStockBalance,
} from "../lib/accounting";
import {
  createSaleMovement,
  createPurchaseMovement,
  createReturnMovement,
  createTransferMovement,
} from "../lib/stockUtils";
import { sha256Fallback, roundTo2 } from "../lib/utils";
import { submitToCBMS } from "../lib/cbmsApi";

export interface StoreState {
  // Core Datasets
  accounts: Account[];
  vouchers: JournalEntry[];
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  warehouses: Warehouse[];
  units: Unit[];
  stockMovements: StockMovement[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  deliveryChallans: DeliveryChallan[];
  goodsReceiptNotes: GoodsReceiptNote[];
  costCenters: CostCenter[];
  tdsEntries: TdsEntry[];
  bankAccounts: BankAccount[];
  bankStatements: BankStatement[];
  auditLogs: AuditLog[];
  companySettings: CompanySettings;
  fiscalYears: FiscalYear[];
  currentFiscalYear: FiscalYear | null;
  stockJournals: StockJournal[];
  billAllocations: BillAllocation[];
  currencies: Currency[];
  exchangeRates: ExchangeRate[];
  recurringVouchers: RecurringVoucher[];
  employees: Employee[];
  payrollRuns: PayrollRun[];

  // Security & Authentication
  users: User[];
  currentUser: User | null;
  isAuthenticated: boolean;
  isDbReady: boolean;
  loginAttempts: number;
  lockedUntil: string | null;

  // UI & Paging Parameters
  currentPage: string;
  editingVoucherId: string | null;
  editingInvoiceId: string | null;
  reportFilters: ReportFilters;
  notifications: AppNotification[];

  // App initialization
  initializeApp: () => Promise<void>;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  createCompanyAndAdmin: (data: {
    company: Partial<CompanySettings>;
    adminUser: Omit<User, "id">;
  }) => Promise<boolean>;

  // Masters CRUD actions
  addAccount: (account: Omit<Account, "id" | "balance">) => Promise<Account>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<boolean>;

  addParty: (party: Omit<Party, "id">) => Promise<Party>;
  updateParty: (party: Party) => Promise<void>;
  deleteParty: (id: string) => Promise<void>;

  addItem: (item: Omit<Item, "id">) => Promise<Item>;
  updateItem: (item: Item) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  addWarehouse: (wh: Omit<Warehouse, "id">) => Promise<Warehouse>;
  updateWarehouse: (wh: Warehouse) => Promise<void>;
  deleteWarehouse: (id: string) => Promise<void>;

  addUnit: (unit: Omit<Unit, "id">) => Promise<Unit>;
  updateUnit: (unit: Unit) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;

  addCostCenter: (cc: Omit<CostCenter, "id">) => Promise<CostCenter>;
  updateCostCenter: (cc: CostCenter) => Promise<void>;
  deleteCostCenter: (id: string) => Promise<void>;

  addBankAccount: (ba: Omit<BankAccount, "id">) => Promise<BankAccount>;
  updateBankAccount: (ba: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  // Voucher operations
  addVoucher: (
    data: Omit<JournalEntry, "id" | "totalDebit" | "totalCredit"> & { voucherNo?: string },
  ) => Promise<JournalEntry>;
  updateVoucher: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteVoucher: (id: string) => Promise<boolean>;
  cancelVoucher: (id: string, reason: string) => Promise<void>;

  // Invoice operations
  addInvoice: (invoice: Omit<Invoice, "id" | "invoiceNo">) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  cancelInvoice: (id: string, reason: string) => Promise<void>;
  postInvoice: (id: string) => Promise<void>;

  // Order workflow operations
  addSalesOrder: (order: Omit<SalesOrder, "id" | "orderNo">) => Promise<SalesOrder>;
  approveSalesOrder: (id: string) => Promise<void>;
  cancelSalesOrder: (id: string, reason?: string) => Promise<void>;
  fulfillSalesOrder: (orderId: string, invoiceId: string) => Promise<void>;

  addPurchaseOrder: (order: Omit<PurchaseOrder, "id" | "orderNo">) => Promise<PurchaseOrder>;
  approvePurchaseOrder: (id: string) => Promise<void>;
  cancelPurchaseOrder: (id: string, reason?: string) => Promise<void>;
  fulfillPurchaseOrder: (orderId: string, invoiceId: string) => Promise<void>;

  // Delivery & Goods movements
  addDeliveryChallan: (dc: Omit<DeliveryChallan, "id">) => Promise<DeliveryChallan>;
  addGoodsReceiptNote: (grn: Omit<GoodsReceiptNote, "id">) => Promise<GoodsReceiptNote>;
  addStockJournal: (sj: Omit<StockJournal, "id">) => Promise<StockJournal>;
  postStockJournal: (id: string) => Promise<void>;

  // Settings & System Year Actions
  updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
  addFiscalYear: (fy: FiscalYear) => Promise<void>;
  setCurrentFiscalYear: (id: string) => Promise<void>;
  closeFiscalYear: (id: string, closedBy: string) => Promise<void>;

  // Recurring Vouchers
  addRecurringVoucher: (rv: Omit<RecurringVoucher, "id">) => Promise<void>;
  updateRecurringVoucher: (id: string, updates: Partial<RecurringVoucher>) => Promise<void>;
  deleteRecurringVoucher: (id: string) => Promise<void>;
  runRecurringVoucher: (id: string) => Promise<void>;

  // Users Management
  addUser: (user: Omit<User, "id">) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  changePassword: (userId: string, newPassword: string) => Promise<void>;

  // UI State mutators
  setCurrentPage: (page: string) => void;
  setEditingVoucherId: (id: string | null) => void;
  setEditingInvoiceId: (id: string | null) => void;
  setReportFilters: (filters: Partial<ReportFilters>) => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp">) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Bill Allocations
  addBillAllocation: (allocation: Omit<BillAllocation, "id">) => Promise<BillAllocation>;
  updateBillAllocation: (id: string, updates: Partial<BillAllocation>) => Promise<void>;
  getBillAllocationsForParty: (partyId: string) => BillAllocation[];
  getBillAllocationsForInvoice: (invoiceId: string) => BillAllocation[];

  // Currency & Exchange Rates
  addCurrency: (currency: Omit<Currency, "id">) => Promise<Currency>;
  updateCurrency: (id: string, updates: Partial<Currency>) => Promise<void>;
  addExchangeRate: (rate: Omit<ExchangeRate, "id">) => Promise<ExchangeRate>;
  getLatestExchangeRate: (currencyCode: string, date?: string) => ExchangeRate | null;
  getBaseCurrency: () => Currency | null;

  // Payroll Actions
  addEmployee: (emp: Omit<Employee, "id">) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addPayrollRun: (run: Omit<PayrollRun, "id">) => Promise<PayrollRun>;
  updatePayrollRun: (id: string, updates: Partial<PayrollRun>) => Promise<void>;

  // Bill Allocations
  resetAllData: () => Promise<void>;
  exportBackup: () => Promise<string>;
  importBackup: (jsonStr: string) => Promise<void>;
  importBankStatements: (bankAccountId: string, rows: any[]) => Promise<number>;

  // Custom Fields
  customFieldDefs: CustomFieldDef[];
  addCustomFieldDef: (def: Omit<CustomFieldDef, "id">) => Promise<void>;
  updateCustomFieldDef: (id: string, updates: Partial<CustomFieldDef>) => Promise<void>;
  deleteCustomFieldDef: (id: string) => Promise<void>;

  // Bill Sundries
  billSundries: BillSundry[];
  loadBillSundries: () => Promise<void>;
  addBillSundry: (bs: Omit<BillSundry, "id">) => Promise<BillSundry>;
  updateBillSundry: (id: string, updates: Partial<BillSundry>) => Promise<void>;
  deleteBillSundry: (id: string) => Promise<void>;
  getBillSundryById: (id: string) => BillSundry | undefined;

  // Standard Narrations
  standardNarrations: StandardNarration[];
  loadStandardNarrations: () => Promise<void>;
  addStandardNarration: (sn: Omit<StandardNarration, "id">) => Promise<StandardNarration>;
  updateStandardNarration: (id: string, updates: Partial<StandardNarration>) => Promise<void>;
  deleteStandardNarration: (id: string) => Promise<void>;
  incrementNarrationUsage: (id: string) => Promise<void>;

  // Bill-wise
  billWiseEntries: import("../lib/types").BillWiseEntry[];
  loadBillWiseEntries: () => Promise<void>;
  addBillWiseEntry: (entry: Omit<import("../lib/types").BillWiseEntry, "id">) => Promise<import("../lib/types").BillWiseEntry>;
  updateBillWiseEntry: (id: string, updates: Partial<import("../lib/types").BillWiseEntry>) => Promise<void>;
  getBillWiseEntriesByParty: (partyId: string) => import("../lib/types").BillWiseEntry[];
  getOpenBillsByParty: (partyId: string) => import("../lib/types").BillWiseEntry[];

  // Interest Slabs
  interestSlabs: import("../lib/types").InterestSlab[];
  loadInterestSlabs: () => Promise<void>;
  addInterestSlab: (slab: Omit<import("../lib/types").InterestSlab, "id">) => Promise<import("../lib/types").InterestSlab>;
  updateInterestSlab: (id: string, updates: Partial<import("../lib/types").InterestSlab>) => Promise<void>;
  deleteInterestSlab: (id: string) => Promise<void>;

  calculateInterestOnBills: (
    entries: import("../lib/types").BillWiseEntry[],
    asOnDate: string,
    slabId: string | null,
    fixedRate?: number
  ) => import("../lib/types").InterestCalculationResult[];
}

export type StoreSet = StoreApi<StoreState>["setState"];
export type StoreGet = StoreApi<StoreState>["getState"];

export const useStore = create<StoreState>()((...args) => {
  const [set, get] = args;
  const reloadAccountBalances = async () => {
    const db = getDB();
    const [accountsRaw, vouchersRaw] = await Promise.all([
      db.accounts.toArray(),
      db.vouchers.toArray(),
    ]);
    const recalculated = recalculateAccountBalances(accountsRaw, vouchersRaw);
    set({ accounts: recalculated });
  };

  return {
    ...createAuthSlice(set, get),
    ...createUiSlice(set, get),

    accounts: [],
    vouchers: [],
    invoices: [],
    parties: [],
    items: [],
    warehouses: [],
    units: [],
    stockMovements: [],
    salesOrders: [],
    purchaseOrders: [],
    deliveryChallans: [],
    goodsReceiptNotes: [],
    costCenters: [],
    tdsEntries: [],
    bankAccounts: [],
    bankStatements: [],
    auditLogs: [],
    stockJournals: [],
    billAllocations: [],
    currencies: [],
    exchangeRates: [],
    recurringVouchers: [],
    employees: [],
    payrollRuns: [],
    customFieldDefs: [],
    billSundries: [],
    standardNarrations: [],
    billWiseEntries: [],
    interestSlabs: [],
    companySettings: {
      id: "company-default",
      name: "Sutra ERP Pvt. Ltd.",
      panNumber: "000000000",
      address: "Nepal",
      phone: "0000000000",
      email: "info@sutraerp.com",
      defaultCurrency: "NPR",
      currencySymbol: "Rs.",
      defaultDateFormat: DateFormat.BS,
      fiscalYearStartMonth: 4,
      stockValuationMethod: StockValuationMethod.WEIGHTED_AVERAGE,
      enableCostCenter: true,
      enableMultiCurrency: false,
      enableBillWiseTracking: true,
      enableBatchTracking: false,
      voucherSeries: {},
      allowNegativeStock: false,
      enableStock: true,
      requireVoucherNarration: false,
      allowVoucherEditAfterPosting: false,
      voucherWarningThreshold: 0,
      defaultTaxRate: 13,
      showHsnSac: true,
    },
    fiscalYears: [],
    currentFiscalYear: null,

    addAccount: async (accountData) => {
      const db = getDB();
      const cleanId = generateId("acc");
      const fullAccount: Account = {
        ...accountData,
        id: cleanId,
        balance: 0,
      };

      await db.accounts.add(fullAccount);

      set((prev) => {
        const updatedAccounts = [...prev.accounts, fullAccount];
        return {
          accounts: recalculateAccountBalances(updatedAccounts, prev.vouchers),
        };
      });

      await db.auditLogs.add({
        id: generateId("audit"),
        timestamp: new Date().toISOString(),
        userId: get().currentUser?.id || "system",
        userName: get().currentUser?.name || "System",
        action: "create",
        module: "accounts",
        recordId: cleanId,
        recordType: "account",
        newValue: JSON.stringify(fullAccount),
      });

      toast.success("Account Ledger registered successfully.");
      return fullAccount;
    },

    updateAccount: async (id, updates) => {
      const db = getDB();
      await db.accounts.update(id, updates);
      set((prev) => {
        const updatedAccounts = prev.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a));
        return {
          accounts: recalculateAccountBalances(updatedAccounts, prev.vouchers),
        };
      });
      toast.success("Account Ledger updated.");
    },

    deleteAccount: async (id) => {
      const db = getDB();
      await db.accounts.delete(id);
      set((prev) => {
        const updatedAccounts = prev.accounts.filter((a) => a.id !== id);
        return {
          accounts: recalculateAccountBalances(updatedAccounts, prev.vouchers),
        };
      });
      return true;
    },

    addParty: async (partyDetails) => {
      const db = getDB();
      const cleanId = generateId("part");
      const fullParty: Party = {
        ...partyDetails,
        id: cleanId,
        balance: 0,
      };
      await db.parties.add(fullParty);
      set((prev) => ({ parties: [...prev.parties, fullParty] }));
      return fullParty;
    },

    updateParty: async (party) => {
      const db = getDB();
      await db.parties.update(party.id, party as any);
      set((prev) => ({ parties: prev.parties.map((p) => (p.id === party.id ? party : p)) }));
    },

    deleteParty: async (id) => {
      const db = getDB();
      await db.parties.delete(id);
      set((prev) => ({ parties: prev.parties.filter((p) => p.id !== id) }));
    },

    addItem: async (itemDetails) => {
      const db = getDB();
      const cleanId = generateId("item");
      const fullItem: Item = {
        ...itemDetails,
        id: cleanId,
        currentStock: itemDetails.openingStock || 0,
      };
      await db.items.add(fullItem);
      set((prev) => ({ items: [...prev.items, fullItem] }));
      return fullItem;
    },

    updateItem: async (item) => {
      const db = getDB();
      await db.items.update(item.id, item as any);
      set((prev) => ({ items: prev.items.map((i) => (i.id === item.id ? item : i)) }));
    },

    deleteItem: async (id) => {
      const db = getDB();
      await db.items.delete(id);
      set((prev) => ({ items: prev.items.filter((i) => i.id !== id) }));
    },

    addWarehouse: async (whData) => {
      const db = getDB();
      const cleanId = generateId("wh");
      const fullWh: Warehouse = { ...whData, id: cleanId };

      if (whData.isDefault) {
        const allActive = await db.warehouses.toArray();
        await db.transaction("rw", db.warehouses, async () => {
          for (const w of allActive) {
            await db.warehouses.update(w.id, { isDefault: false });
          }
          await db.warehouses.add(fullWh);
        });
      } else {
        await db.warehouses.add(fullWh);
      }

      const updated = await db.warehouses.toArray();
      set({ warehouses: updated });
      return fullWh;
    },

    updateWarehouse: async (wh) => {
      const db = getDB();
      if (wh.isDefault) {
        const allActive = await db.warehouses.toArray();
        await db.transaction("rw", db.warehouses, async () => {
          for (const w of allActive) {
            await db.warehouses.update(w.id, { isDefault: false });
          }
          await db.warehouses.update(wh.id, wh);
        });
      } else {
        await db.warehouses.update(wh.id, wh);
      }

      const updated = await db.warehouses.toArray();
      set({ warehouses: updated });
    },

    deleteWarehouse: async (id) => {
      const db = getDB();
      await db.warehouses.delete(id);
      const updated = await db.warehouses.toArray();
      set({ warehouses: updated });
    },

    addUnit: async (unitData) => {
      const db = getDB();
      const cleanId = generateId("u");
      const fullUnit: Unit = { ...unitData, id: cleanId };

      await db.units.add(fullUnit);
      set((prev) => ({ units: [...prev.units, fullUnit] }));
      return fullUnit;
    },

    updateUnit: async (unit) => {
      const db = getDB();
      await db.units.update(unit.id, unit);
      set((prev) => ({ units: prev.units.map((u) => (u.id === unit.id ? unit : u)) }));
    },

    deleteUnit: async (id) => {
      const db = getDB();
      await db.units.delete(id);
      set((prev) => ({ units: prev.units.filter((u) => u.id !== id) }));
    },

    addCostCenter: async (ccData) => {
      const db = getDB();
      const cleanId = generateId("cc");
      const fullCC: CostCenter = { ...ccData, id: cleanId };

      await db.costCenters.add(fullCC);
      set((prev) => ({ costCenters: [...prev.costCenters, fullCC] }));
      return fullCC;
    },

    updateCostCenter: async (cc) => {
      const db = getDB();
      await db.costCenters.update(cc.id, cc);
      set((prev) => ({ costCenters: prev.costCenters.map((c) => (c.id === cc.id ? cc : c)) }));
    },

    deleteCostCenter: async (id) => {
      const db = getDB();
      await db.costCenters.delete(id);
      set((prev) => ({ costCenters: prev.costCenters.filter((c) => c.id !== id) }));
    },

    addBankAccount: async (baData) => {
      const db = getDB();
      const cleanId = generateId("bk");
      const fullBA: BankAccount = { ...baData, id: cleanId };

      await db.bankAccounts.add(fullBA);
      set((prev) => ({ bankAccounts: [...prev.bankAccounts, fullBA] }));
      return fullBA;
    },

    updateBankAccount: async (ba) => {
      const db = getDB();
      await db.bankAccounts.update(ba.id, ba);
      set((prev) => ({ bankAccounts: prev.bankAccounts.map((b) => (b.id === ba.id ? ba : b)) }));
    },

    deleteBankAccount: async (id) => {
      const db = getDB();
      await db.bankAccounts.delete(id);
      set((prev) => ({ bankAccounts: prev.bankAccounts.filter((b) => b.id !== id) }));
    },

    addVoucher: async (voucherData) => {
      const db = getDB();
      const state = get();

      const validationResult = validateDoubleEntry(voucherData.lines);
      if (!validationResult.isValid) {
        toast.error(validationResult.message);
        return undefined as any;
      }

      const targetDate = voucherData.date;
      const entryFY = state.fiscalYears.find(
        (fy) => targetDate >= fy.startDate && targetDate <= fy.endDate,
      );
      if (entryFY && entryFY.status === FiscalYearStatus.CLOSED) {
        throw new Error(`Cannot post entries to closed fiscal year: ${entryFY.name}`);
      }

      if (state.currentFiscalYear) {
        if (
          targetDate < state.currentFiscalYear.startDate ||
          targetDate > state.currentFiscalYear.endDate
        ) {
          throw new Error(
            `Financial Rule: Date is outside bounds of the active fiscal year (${state.currentFiscalYear.name}).`,
          );
        }
      }

      const existingList = state.vouchers;
      const { voucherNo, updatedSeries } = generateVoucherNo(
        voucherData.type,
        state.companySettings.voucherSeries,
        existingList,
        state.currentFiscalYear,
      );

      const totalDr = roundTo2(voucherData.lines.reduce((s, l) => s + l.debit, 0));
      const totalCr = roundTo2(voucherData.lines.reduce((s, l) => s + l.credit, 0));

      if (Math.abs(totalDr - totalCr) > 0.01) {
        throw new Error(
          `Unbalanced Error: Debits (Rs. ${totalDr}) and Credits (Rs. ${totalCr}) must balance.`,
        );
      }

      const cleanVId = generateId("vc");
      const finalVoucher: JournalEntry = {
        ...voucherData,
        id: cleanVId,
        voucherNo: voucherData.voucherNo || voucherNo,
        totalDebit: totalDr,
        totalCredit: totalCr,
        createdBy: state.currentUser?.id || "system",
        createdAt: new Date().toISOString(),
      };

      const hasFY = !!state.currentFiscalYear;
      await db.transaction(
        "rw",
        [db.vouchers, db.companySettings, db.accounts, db.auditLogs, db.fiscalYears],
        async () => {
          await db.vouchers.add(finalVoucher);
          if (hasFY) {
            await db.fiscalYears.update(state.currentFiscalYear!.id, {
              voucherSeriesState: updatedSeries,
            });
          } else {
            await db.companySettings.update(state.companySettings.id!, {
              voucherSeries: updatedSeries,
            });
          }
        },
      );

      set((prev) => {
        const newVouchersList = [...prev.vouchers, finalVoucher];
        const newAccountsList = recalculateAccountBalances(prev.accounts, newVouchersList);
        if (hasFY) {
          const updatedFY = {
            ...prev.currentFiscalYear!,
            voucherSeriesState: updatedSeries,
          };
          return {
            vouchers: newVouchersList,
            accounts: newAccountsList,
            currentFiscalYear: updatedFY,
            fiscalYears: prev.fiscalYears.map((f) => (f.id === updatedFY.id ? updatedFY : f)),
          };
        }
        return {
          vouchers: newVouchersList,
          accounts: newAccountsList,
          companySettings: {
            ...prev.companySettings,
            voucherSeries: updatedSeries,
          },
        };
      });

      return finalVoucher;
    },

    updateVoucher: async (id, updates) => {
      if (updates.lines) {
        const validationResult = validateDoubleEntry(updates.lines);
        if (!validationResult.isValid) {
          toast.error(validationResult.message);
          return;
        }
      }
      const db = getDB();
      await db.vouchers.update(id, updates);
      await reloadAccountBalances();
    },

    deleteVoucher: async (id) => {
      const db = getDB();
      await db.vouchers.delete(id);
      await reloadAccountBalances();
      return true;
    },

    cancelVoucher: async (id, reason) => {
      const db = getDB();
      const oldVal = await db.vouchers.get(id);
      if (!oldVal) return;

      const updates = {
        status: VoucherStatus.CANCELLED,
        cancellationReason: reason,
        cancelledBy: get().currentUser?.id || "system",
        cancelledAt: new Date().toISOString(),
      };

      await db.vouchers.update(id, updates);
      await reloadAccountBalances();
    },

    addInvoice: async (invoiceData) => {
      const db = getDB();
      const state = get();

      // Negative stock validation
      const allowNegative = state.companySettings?.allowNegativeStock ?? false;
      const isOutgoing =
        invoiceData.type === "sales-invoice" || invoiceData.type === "purchase-return";
      if (isOutgoing && !allowNegative) {
        const movements = state.stockMovements;
        for (const line of invoiceData.lines || []) {
          if (!line.itemId) continue;
          const bal = getStockBalance(
            line.itemId,
            (invoiceData as any).warehouseId || null,
            movements,
          );
          if (bal.qty - line.qty < 0) {
            const item = state.items.find((it) => it.id === line.itemId);
            throw new Error(
              `Cannot save invoice: Stock for "${item?.name || line.itemId}" would become negative (${bal.qty - line.qty}).`,
            );
          }
        }
      }

      const invoiceNoComp = generateInvoiceNo(
        invoiceData.type as any,
        state.companySettings.voucherSeries,
        state.invoices,
      );
      const codeStr = invoiceNoComp.invoiceNo;
      const seriesUpdates = invoiceNoComp.updatedSeries;

      const cleanInvId = generateId("inv");
      const finalInvoice: Invoice = {
        ...invoiceData,
        id: cleanInvId,
        invoiceNo: codeStr,
        createdBy: state.currentUser?.id || "system",
        createdAt: new Date().toISOString(),
      } as any;

      const isSales =
        invoiceData.type === VoucherType.SALES_INVOICE ||
        invoiceData.type === VoucherType.SALES_RETURN;
      const isPurchase =
        invoiceData.type === VoucherType.PURCHASE_INVOICE ||
        invoiceData.type === VoucherType.PURCHASE_RETURN;
      const isRet =
        invoiceData.type === VoucherType.SALES_RETURN ||
        invoiceData.type === VoucherType.PURCHASE_RETURN;

      const partyLedId =
        state.parties.find((p) => p.id === invoiceData.partyId)?.accountId || "acc-sundry-debtors";
      const cashBankId =
        invoiceData.paymentMode === PaymentMode.CASH ? "acc-cash" : "acc-nabil-bank";
      const finalPartyLedger =
        invoiceData.paymentMode === PaymentMode.CREDIT ? partyLedId : cashBankId;

      const vLines: any[] = [];
      const amountVal = finalInvoice.grandTotal;

      if (isSales) {
        if (!isRet) {
          vLines.push({
            accountId: finalPartyLedger,
            debit: amountVal,
            credit: 0,
            narration: `Invoice Sales out # ${codeStr}`,
          });
          vLines.push({
            accountId: "acc-sales",
            debit: 0,
            credit: roundTo2(finalInvoice.taxableAmount + finalInvoice.exemptAmount),
            narration: `Turnover goods sales`,
          });
          if (finalInvoice.vatAmount > 0) {
            vLines.push({
              accountId: "acc-vat-13",
              debit: 0,
              credit: finalInvoice.vatAmount,
              narration: `VAT Payable Collected`,
            });
          }
        } else {
          vLines.push({
            accountId: finalPartyLedger,
            debit: 0,
            credit: amountVal,
            narration: `Sales goods return reverse # ${codeStr}`,
          });
          vLines.push({
            accountId: "acc-sales",
            debit: roundTo2(finalInvoice.taxableAmount + finalInvoice.exemptAmount),
            credit: 0,
            narration: `Sales return base re-entry`,
          });
          if (finalInvoice.vatAmount > 0) {
            vLines.push({
              accountId: "acc-vat-13",
              debit: finalInvoice.vatAmount,
              credit: 0,
              narration: `VAT output reverse`,
            });
          }
        }
      } else if (isPurchase) {
        if (!isRet) {
          vLines.push({
            accountId: "acc-purchase",
            debit: roundTo2(finalInvoice.taxableAmount + finalInvoice.exemptAmount),
            credit: 0,
            narration: `Purchasing direct base costs`,
          });
          if (finalInvoice.vatAmount > 0) {
            vLines.push({
              accountId: "acc-vat-13",
              debit: finalInvoice.vatAmount,
              credit: 0,
              narration: `VAT Input Receivable`,
            });
          }
          vLines.push({
            accountId: finalPartyLedger,
            debit: 0,
            credit: amountVal,
            narration: `Supplier invoices payment # ${codeStr}`,
          });
          if (finalInvoice.tdsAmount && finalInvoice.tdsAmount > 0) {
            vLines.push({
              accountId: "acc-tds-payable",
              debit: 0,
              credit: finalInvoice.tdsAmount,
              narration: `withholding TDS tax`,
            });
          }
        } else {
          vLines.push({
            accountId: finalPartyLedger,
            debit: amountVal,
            credit: 0,
            narration: `Purchase return reverse # ${codeStr}`,
          });
          vLines.push({
            accountId: "acc-purchase",
            debit: 0,
            credit: roundTo2(finalInvoice.taxableAmount + finalInvoice.exemptAmount),
            narration: `Goods return crediting purchase`,
          });
          if (finalInvoice.vatAmount > 0) {
            vLines.push({
              accountId: "acc-vat-13",
              debit: 0,
              credit: finalInvoice.vatAmount,
              narration: `VAT input return reverse`,
            });
          }
        }
      }

      const { voucherNo, updatedSeries } = generateVoucherNo(
        VoucherType.JOURNAL,
        seriesUpdates,
        state.vouchers,
      );
      const cleanJVId = generateId("vc");
      const linkedJV: JournalEntry = {
        id: cleanJVId,
        date: finalInvoice.date,
        dateNepali: finalInvoice.dateNepali,
        voucherNo,
        narration: `System ledger transaction generated for bill ${codeStr}. ${finalInvoice.narration}`,
        status:
          invoiceData.status === VoucherStatus.POSTED ? VoucherStatus.POSTED : VoucherStatus.DRAFT,
        type: VoucherType.JOURNAL,
        totalDebit: amountVal,
        totalCredit: amountVal,
        lines: vLines,
        createdBy: state.currentUser?.id || "system",
        createdAt: new Date().toISOString(),
      };

      finalInvoice.journalEntryId = linkedJV.id;

      let movementsToPost: StockMovement[] = [];
      if (finalInvoice.status === VoucherStatus.POSTED) {
        if (invoiceData.type === VoucherType.SALES_INVOICE) {
          movementsToPost = createSaleMovement(finalInvoice, state.warehouses);
        } else if (invoiceData.type === VoucherType.PURCHASE_INVOICE) {
          movementsToPost = createPurchaseMovement(finalInvoice, state.warehouses);
        } else if (invoiceData.type === VoucherType.SALES_RETURN) {
          movementsToPost = createReturnMovement(finalInvoice, "sales");
        } else if (invoiceData.type === VoucherType.PURCHASE_RETURN) {
          movementsToPost = createReturnMovement(finalInvoice, "purchase");
        }
      }

      await db.transaction(
        "rw",
        [db.invoices, db.vouchers, db.companySettings, db.stockMovements, db.tdsEntries],
        async () => {
          await db.invoices.add(finalInvoice);
          await db.vouchers.add(linkedJV);
          await db.companySettings.update(state.companySettings.id!, {
            voucherSeries: updatedSeries,
          });
          if (movementsToPost.length > 0) {
            for (const mov of movementsToPost) {
              await db.stockMovements.add(mov);
            }
          }

          if (
            finalInvoice.tdsAmount &&
            finalInvoice.tdsAmount > 0 &&
            finalInvoice.status === VoucherStatus.POSTED
          ) {
            await db.tdsEntries.add({
              id: generateId("tds"),
              voucherId: linkedJV.id,
              partyId: finalInvoice.partyId,
              partyName: finalInvoice.partyName,
              partyPan: finalInvoice.partyPan || "000000000",
              tdsType: finalInvoice.tdsType || TdsType.NONE,
              tdsRate: finalInvoice.tdsRate || 0,
              grossAmount: roundTo2(finalInvoice.taxableAmount + finalInvoice.exemptAmount),
              tdsAmount: finalInvoice.tdsAmount,
              netAmount: finalInvoice.grandTotal,
              date: finalInvoice.date,
              dateNepali: finalInvoice.dateNepali,
              deposited: false,
              section: "88",
            });
          }
        },
      );

      await get().initializeApp();

      if (finalInvoice.type === VoucherType.SALES_INVOICE && state.companySettings.cbmsConfig) {
        const cbmsPayload = {
          billNo: finalInvoice.invoiceNo,
          billDate: finalInvoice.date,
          partyName: finalInvoice.partyName,
          partyPAN: finalInvoice.partyPan,
          taxableAmount: finalInvoice.taxableAmount || 0,
          vatAmount: finalInvoice.vatAmount || 0,
          grandTotal: finalInvoice.grandTotal,
          items: finalInvoice.lines.map((l) => ({
            description: l.itemName,
            qty: l.qty,
            rate: l.rate,
            amount: l.totalAmount || 0,
          })),
        };

        const cbmsResult = await submitToCBMS(cbmsPayload, state.companySettings.cbmsConfig);
        if (cbmsResult.success) {
          toast.success("Invoice submitted to IRD CBMS");
          await db.invoices.update(finalInvoice.id, {
            cbmsRefNo: cbmsResult.referenceNo,
            cbmsStatus: "submitted",
          });
        } else {
          toast.error("CBMS submission failed — retry from Invoice Hub");
          await db.invoices.update(finalInvoice.id, {
            cbmsStatus: "failed",
          });
        }
        await get().initializeApp();
      }

      return finalInvoice;
    },

    updateInvoice: async (id, updates) => {
      const db = getDB();
      await db.invoices.update(id, updates);
      await get().initializeApp();
    },

    cancelInvoice: async (id, reason) => {
      const db = getDB();
      const oldVal = await db.invoices.get(id);
      if (!oldVal) return;

      await db.transaction("rw", [db.invoices, db.vouchers, db.stockMovements], async () => {
        await db.invoices.update(id, { status: VoucherStatus.CANCELLED });
        if (oldVal.journalEntryId) {
          await db.vouchers.update(oldVal.journalEntryId, {
            status: VoucherStatus.CANCELLED,
            cancellationReason: reason,
          });
        }
        const stockColl = await db.stockMovements.where("referenceId").equals(id).toArray();
        for (const item of stockColl) {
          await db.stockMovements.delete(item.id);
        }
      });

      await get().initializeApp();
    },

    postInvoice: async (id) => {
      const db = getDB();
      const oldVal = await db.invoices.get(id);
      if (!oldVal) return;

      const movementsToPost =
        oldVal.type === VoucherType.SALES_INVOICE
          ? createSaleMovement(oldVal, get().warehouses)
          : createPurchaseMovement(oldVal, get().warehouses);

      await db.transaction("rw", [db.invoices, db.vouchers, db.stockMovements], async () => {
        await db.invoices.update(id, { status: VoucherStatus.POSTED });
        if (oldVal.journalEntryId) {
          await db.vouchers.update(oldVal.journalEntryId, { status: VoucherStatus.POSTED });
        }
        for (const mov of movementsToPost) {
          await db.stockMovements.add(mov);
        }
      });

      await get().initializeApp();
    },

    addSalesOrder: async (order) => {
      const db = getDB();
      const cleanId = generateId("so");
      const orderNo = `SO-${Date.now().toString().slice(-6)}`;
      const fullOrder: SalesOrder = {
        ...order,
        id: cleanId,
        orderNo,
        status: OrderStatus.DRAFT,
        fulfilledInvoiceIds: [],
      };

      await db.salesOrders.add(fullOrder);
      set((prev) => ({ salesOrders: [...prev.salesOrders, fullOrder] }));
      return fullOrder;
    },

    approveSalesOrder: async (id) => {
      const db = getDB();
      await db.salesOrders.update(id, { status: OrderStatus.APPROVED });
      await get().initializeApp();
    },

    cancelSalesOrder: async (id, reason) => {
      const db = getDB();
      await db.salesOrders.update(id, { status: OrderStatus.CANCELLED, narration: reason });
      await get().initializeApp();
    },

    fulfillSalesOrder: async (orderId, invoiceId) => {
      const db = getDB();
      const order = await db.salesOrders.get(orderId);
      if (!order) return;

      const list = [...(order.fulfilledInvoiceIds || []), invoiceId];
      await db.salesOrders.update(orderId, {
        fulfilledInvoiceIds: list,
        status: OrderStatus.FULFILLED,
      });
      await get().initializeApp();
    },

    addPurchaseOrder: async (order) => {
      const db = getDB();
      const cleanId = generateId("po");
      const orderNo = `PO-${Date.now().toString().slice(-6)}`;
      const fullOrder: PurchaseOrder = {
        ...order,
        id: cleanId,
        orderNo,
        status: OrderStatus.DRAFT,
        fulfilledInvoiceIds: [],
      };

      await db.purchaseOrders.add(fullOrder);
      set((prev) => ({ purchaseOrders: [...prev.purchaseOrders, fullOrder] }));
      return fullOrder;
    },

    approvePurchaseOrder: async (id) => {
      const db = getDB();
      await db.purchaseOrders.update(id, { status: OrderStatus.APPROVED });
      await get().initializeApp();
    },

    cancelPurchaseOrder: async (id, reason) => {
      const db = getDB();
      await db.purchaseOrders.update(id, { status: OrderStatus.CANCELLED, narration: reason });
      await get().initializeApp();
    },

    fulfillPurchaseOrder: async (orderId, invoiceId) => {
      const db = getDB();
      const order = await db.purchaseOrders.get(orderId);
      if (!order) return;

      const list = [...(order.fulfilledInvoiceIds || []), invoiceId];
      await db.purchaseOrders.update(orderId, {
        fulfilledInvoiceIds: list,
        status: OrderStatus.FULFILLED,
      });
      await get().initializeApp();
    },

    addDeliveryChallan: async (dcData) => {
      const db = getDB();
      const cleanId = generateId("dc");
      const challanNo = `DC-${Date.now().toString().slice(-6)}`;

      const fullDC: DeliveryChallan = {
        ...dcData,
        id: cleanId,
        challanNo,
        status: ChallanStatus.DRAFT,
      } as any;

      await db.deliveryChallans.add(fullDC);
      await get().initializeApp();
      return fullDC;
    },

    addGoodsReceiptNote: async (grnData) => {
      const db = getDB();
      const cleanId = generateId("grn");
      const grnNo = `GRN-${Date.now().toString().slice(-6)}`;

      const fullGrn: GoodsReceiptNote = {
        ...grnData,
        id: cleanId,
        grnNo,
        status: ChallanStatus.DRAFT,
      } as any;

      await db.goodsReceiptNotes.add(fullGrn);
      await get().initializeApp();
      return fullGrn;
    },

    addStockJournal: async (sjData) => {
      const db = getDB();
      const state = get();

      // Negative stock validation
      const allowNegative = state.companySettings?.allowNegativeStock ?? false;
      if (!allowNegative) {
        const movements = state.stockMovements;
        for (const line of sjData.lines || []) {
          if (line.fromWarehouseId && line.itemId) {
            const bal = getStockBalance(line.itemId, line.fromWarehouseId, movements);
            if (bal.qty - line.qty < 0) {
              const item = state.items.find((it) => it.id === line.itemId);
              throw new Error(
                `Cannot save stock journal: Stock for "${item?.name || line.itemId}" would become negative (${bal.qty - line.qty}).`,
              );
            }
          }
        }
      }

      const cleanId = generateId("sj");
      const fullSj = {
        ...sjData,
        id: cleanId,
        status: VoucherStatus.DRAFT,
      } as any;

      await db.stockJournals.add(fullSj);
      await get().initializeApp();
      return fullSj;
    },

    postStockJournal: async (id) => {
      const db = getDB();
      const sj = await db.stockJournals.get(id);
      if (!sj) return;

      const movements = createTransferMovement(sj, get().warehouses);

      await db.transaction("rw", [db.stockJournals, db.stockMovements], async () => {
        await db.stockJournals.update(id, { status: VoucherStatus.POSTED });
        for (const m of movements) {
          await db.stockMovements.add(m);
        }
      });

      await get().initializeApp();
    },

    updateCompanySettings: async (settings) => {
      const db = getDB();
      const companyId = get().companySettings.id || "company-default";
      await db.companySettings.update(companyId, settings);
      await get().initializeApp();
    },

    addFiscalYear: async (fy) => {
      const db = getDB();
      const cleanId = generateId("fy");
      const newFY = { ...fy, id: cleanId };

      if (fy.isCurrent) {
        const allYears = await db.fiscalYears.toArray();
        await db.transaction("rw", db.fiscalYears, async () => {
          for (const f of allYears) {
            await db.fiscalYears.update(f.id, { isCurrent: false });
          }
          await db.fiscalYears.add(newFY);
        });
      } else {
        await db.fiscalYears.add(newFY);
      }

      await get().initializeApp();
    },

    setCurrentFiscalYear: async (id) => {
      const db = getDB();
      const allYears = await db.fiscalYears.toArray();
      await db.transaction("rw", db.fiscalYears, async () => {
        for (const f of allYears) {
          await db.fiscalYears.update(f.id, { isCurrent: f.id === id });
        }
      });

      await get().initializeApp();
    },

    closeFiscalYear: async (id, closedBy) => {
      const db = getDB();
      await db.fiscalYears.update(id, {
        status: FiscalYearStatus.CLOSED,
        closedBy,
        closedAt: new Date().toISOString(),
      });

      await get().initializeApp();
    },

    addBillAllocation: async (allocationData) => {
      const db = getDB();
      const cleanId = generateId("balloc");
      const fullAllocation: BillAllocation = {
        ...allocationData,
        id: cleanId,
      };

      await db.billAllocations.add(fullAllocation);

      // Update invoice paidAmount and paymentStatus
      const invoice = await db.invoices.get(allocationData.invoiceId);
      if (invoice) {
        const newPaidAmount = (invoice.paidAmount || 0) + allocationData.allocatedAmount;
        const newBalance = invoice.grandTotal - newPaidAmount;

        let newStatus = invoice.paymentStatus;
        if (Math.abs(newBalance) < 0.01) {
          newStatus = PaymentStatus.PAID;
        } else if (newPaidAmount > 0) {
          newStatus = PaymentStatus.PARTIAL;
        } else {
          newStatus = PaymentStatus.UNPAID;
        }

        await db.invoices.update(allocationData.invoiceId, {
          paidAmount: newPaidAmount,
          paymentStatus: newStatus,
        });
      }

      set((prev) => ({
        billAllocations: [...prev.billAllocations, fullAllocation],
      }));

      await get().initializeApp();
      return fullAllocation;
    },

    updateBillAllocation: async (id, updates) => {
      const db = getDB();
      await db.billAllocations.update(id, updates);
      await get().initializeApp();
    },

    getBillAllocationsForParty: (partyId) => {
      return get().billAllocations.filter((ba) => ba.partyId === partyId);
    },

    getBillAllocationsForInvoice: (invoiceId) => {
      return get().billAllocations.filter((ba) => ba.invoiceId === invoiceId);
    },

    addCurrency: async (currencyData) => {
      const db = getDB();
      const cleanId = generateId("cur");
      const fullCurrency: Currency = {
        ...currencyData,
        id: cleanId,
      };

      // If setting as base, unset all others
      if (currencyData.isBase) {
        const allCurrencies = await db.currencies.toArray();
        await db.transaction("rw", db.currencies, async () => {
          for (const c of allCurrencies) {
            await db.currencies.update(c.id, { isBase: false });
          }
          await db.currencies.add(fullCurrency);
        });
      } else {
        await db.currencies.add(fullCurrency);
      }

      await get().initializeApp();
      toast.success("Currency added successfully.");
      return fullCurrency;
    },

    updateCurrency: async (id, updates) => {
      const db = getDB();

      // If setting as base, unset all others
      if (updates.isBase) {
        const allCurrencies = await db.currencies.toArray();
        await db.transaction("rw", db.currencies, async () => {
          for (const c of allCurrencies) {
            if (c.id !== id) {
              await db.currencies.update(c.id, { isBase: false });
            }
          }
          await db.currencies.update(id, updates);
        });
      } else {
        await db.currencies.update(id, updates);
      }

      await get().initializeApp();
      toast.success("Currency updated.");
    },

    addExchangeRate: async (rateData) => {
      const db = getDB();
      const cleanId = generateId("exr");
      const fullRate: ExchangeRate = {
        ...rateData,
        id: cleanId,
      };

      await db.exchangeRates.add(fullRate);

      set((prev) => ({
        exchangeRates: [...prev.exchangeRates, fullRate],
      }));

      toast.success("Exchange rate added.");
      return fullRate;
    },

    getLatestExchangeRate: (currencyCode, date) => {
      const targetDate = date || new Date().toISOString().split("T")[0];
      const rates = get()
        .exchangeRates.filter((r) => r.currencyCode === currencyCode && r.date <= targetDate)
        .sort((a, b) => b.date.localeCompare(a.date));
      return rates[0] || null;
    },

    getBaseCurrency: () => {
      return get().currencies.find((c) => c.isBase) || null;
    },

    resetAllData: async () => {
      const { clearAllData } = await import("../lib/db");
      await clearAllData();
      await get().initializeApp();
      toast.success("Sutra ERP fully cleared.");
    },

    exportBackup: async () => {
      const { exportAllData } = await import("../lib/db");
      const data = await exportAllData();
      return JSON.stringify(data);
    },

    importBackup: async (jsonStr) => {
      const { importAllData } = await import("../lib/db");
      const parsed = JSON.parse(jsonStr);
      await importAllData(parsed);
      await get().initializeApp();
      toast.success("Sutra ERP restored from Backup file.");
    },

    addRecurringVoucher: async (rvData) => {
      const db = getDB();
      const cleanId = generateId("rrv");
      const fullRv = {
        ...rvData,
        id: cleanId,
        completedOccurrences: 0,
        generatedVoucherIds: [],
      };
      await db.recurringVouchers.add(fullRv as any);
      set((state) => ({
        recurringVouchers: [...state.recurringVouchers, fullRv as any],
      }));
    },

    updateRecurringVoucher: async (id, updates) => {
      const db = getDB();
      await db.recurringVouchers.update(id, updates);
      set((state) => ({
        recurringVouchers: state.recurringVouchers.map((r) =>
          r.id === id ? { ...r, ...updates } : r,
        ),
      }));
    },

    deleteRecurringVoucher: async (id) => {
      const db = getDB();
      await db.recurringVouchers.delete(id);
      set((state) => ({
        recurringVouchers: state.recurringVouchers.filter((r) => r.id !== id),
      }));
    },

    runRecurringVoucher: async (id) => {
      const db = getDB();
      const recurring = get().recurringVouchers.find((r) => r.id === id);
      if (!recurring) {
        toast.error("Recurring template not found");
        return;
      }

      const templateVoucher = get().vouchers.find((v) => v.id === recurring.templateVoucherId);
      if (!templateVoucher) {
        toast.error("Template voucher not found");
        return;
      }

      const newId = generateId("jv");
      const today = new Date().toISOString().split("T")[0];

      const newVoucher = {
        ...templateVoucher,
        id: newId,
        date: today,
        status: recurring.autoPost ? VoucherStatus.POSTED : VoucherStatus.DRAFT,
        narration: "[Auto] " + templateVoucher.narration,
        createdAt: new Date().toISOString(),
      };

      await db.vouchers.add(newVoucher);

      const nextDue = calculateNextDueDate(
        recurring.nextDueDate,
        recurring.frequency,
        recurring.dayOfMonth,
      );

      await db.recurringVouchers.update(id, {
        lastGeneratedDate: today,
        nextDueDate: nextDue,
        completedOccurrences: recurring.completedOccurrences + 1,
        generatedVoucherIds: [...recurring.generatedVoucherIds, newId],
      });

      await get().initializeApp();
      toast.success(`Generated voucher: ${newVoucher.voucherNo || newId}`);
    },

    importBankStatements: async (bankAccountId: string, rows: any[]) => {
      const db = getDB();
      let count = 0;
      for (const row of rows) {
        await db.bankStatements.add({
          ...row,
          id: generateId("bst"),
          bankAccountId,
          reconciled: false,
        });
        count++;
      }
      await get().initializeApp();
      toast.success(`${count} entries imported.`);
      return count;
    },

    addEmployee: async (emp) => {
      const db = getDB();
      const cleanId = generateId("emp");
      const fullEmp = { ...emp, id: cleanId } as Employee;
      await db.employees.add(fullEmp);
      await get().initializeApp();
      return fullEmp;
    },

    updateEmployee: async (id, updates) => {
      const db = getDB();
      await db.employees.update(id, updates);
      await get().initializeApp();
    },

    deleteEmployee: async (id) => {
      const db = getDB();
      await db.employees.delete(id);
      await get().initializeApp();
    },

    addPayrollRun: async (run) => {
      const db = getDB();
      const cleanId = generateId("payrun");
      const fullRun = { ...run, id: cleanId } as PayrollRun;
      await db.payrollRuns.add(fullRun);
      await get().initializeApp();
      return fullRun;
    },

    updatePayrollRun: async (id, updates) => {
      const db = getDB();
      await db.payrollRuns.update(id, updates);
      await get().initializeApp();
    },

    addCustomFieldDef: async (def) => {
      const db = getDB();
      const cleanId = generateId("cfd");
      await db.customFieldDefs.add({ ...def, id: cleanId });
      await get().initializeApp();
    },

    updateCustomFieldDef: async (id, updates) => {
      const db = getDB();
      await db.customFieldDefs.update(id, updates);
      await get().initializeApp();
    },

    deleteCustomFieldDef: async (id) => {
      const db = getDB();
      await db.customFieldDefs.delete(id);
      await get().initializeApp();
    },

    loadBillSundries: async () => {
      const db = getDB();
      const billSundries = await db.billSundries.toArray();
      set({ billSundries });
    },

    addBillSundry: async (bsData) => {
      const db = getDB();
      const cleanId = generateId("bs");
      const fullBS: BillSundry = { ...bsData, id: cleanId };
      await db.billSundries.add(fullBS);
      set((prev) => ({ billSundries: [...prev.billSundries, fullBS] }));
      return fullBS;
    },

    updateBillSundry: async (id, updates) => {
      const db = getDB();
      await db.billSundries.update(id, updates);
      set((prev) => ({
        billSundries: prev.billSundries.map((bs) => (bs.id === id ? { ...bs, ...updates } : bs)),
      }));
    },

    deleteBillSundry: async (id) => {
      const db = getDB();
      await db.billSundries.delete(id);
      set((prev) => ({
        billSundries: prev.billSundries.filter((bs) => bs.id !== id),
      }));
    },

    getBillSundryById: (id) => {
      return get().billSundries.find((bs) => bs.id === id);
    },

    loadStandardNarrations: async () => {
      const db = getDB();
      const standardNarrations = await db.standardNarrations.toArray();
      set({ standardNarrations });
    },

    addStandardNarration: async (snData) => {
      const db = getDB();
      const cleanId = generateId("sn");
      const fullSN: StandardNarration = { ...snData, id: cleanId };
      await db.standardNarrations.add(fullSN);
      set((prev) => ({ standardNarrations: [...prev.standardNarrations, fullSN] }));
      return fullSN;
    },

    updateStandardNarration: async (id, updates) => {
      const db = getDB();
      await db.standardNarrations.update(id, updates);
      set((prev) => ({
        standardNarrations: prev.standardNarrations.map((sn) =>
          sn.id === id ? { ...sn, ...updates } : sn
        ),
      }));
    },

    deleteStandardNarration: async (id) => {
      const db = getDB();
      await db.standardNarrations.delete(id);
      set((prev) => ({
        standardNarrations: prev.standardNarrations.filter((sn) => sn.id !== id),
      }));
    },

    incrementNarrationUsage: async (id) => {
      const db = getDB();
      const narration = await db.standardNarrations.get(id);
      if (narration) {
        const newCount = (narration.usageCount || 0) + 1;
        await db.standardNarrations.update(id, { usageCount: newCount });
        set((prev) => ({
          standardNarrations: prev.standardNarrations.map((sn) =>
            sn.id === id ? { ...sn, usageCount: newCount } : sn
          ),
        }));
      }
    },

    loadBillWiseEntries: async () => {
      const db = getDB();
      const billWiseEntries = await db.billWiseEntries.toArray();
      set({ billWiseEntries });
    },

    addBillWiseEntry: async (entryData) => {
      const db = getDB();
      const cleanId = generateId("bwe");
      const fullEntry = { ...entryData, id: cleanId };
      await db.billWiseEntries.add(fullEntry as any);
      set((prev) => ({ billWiseEntries: [...prev.billWiseEntries, fullEntry as any] }));
      return fullEntry as any;
    },

    updateBillWiseEntry: async (id, updates) => {
      const db = getDB();
      await db.billWiseEntries.update(id, updates);
      set((prev) => ({
        billWiseEntries: prev.billWiseEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }));
    },

    getBillWiseEntriesByParty: (partyId) => {
      return get().billWiseEntries.filter((e) => e.partyId === partyId);
    },

    getOpenBillsByParty: (partyId) => {
      return get().billWiseEntries.filter((e) => e.partyId === partyId && !e.isSettled);
    },

    loadInterestSlabs: async () => {
      const db = getDB();
      const interestSlabs = await db.interestSlabs.toArray();
      set({ interestSlabs });
    },

    addInterestSlab: async (slabData) => {
      const db = getDB();
      const cleanId = generateId("islab");
      const fullSlab = { ...slabData, id: cleanId };
      await db.interestSlabs.add(fullSlab as any);
      if (slabData.isDefault) {
        // Unset others if this is default
        const allSlabs = await db.interestSlabs.toArray();
        for (const s of allSlabs) {
          if (s.id !== cleanId && s.isDefault) {
            await db.interestSlabs.update(s.id, { isDefault: false });
          }
        }
      }
      const loaded = await db.interestSlabs.toArray();
      set({ interestSlabs: loaded as any });
      return fullSlab as any;
    },

    updateInterestSlab: async (id, updates) => {
      const db = getDB();
      if (updates.isDefault) {
        const allSlabs = await db.interestSlabs.toArray();
        for (const s of allSlabs) {
          if (s.id !== id && s.isDefault) {
            await db.interestSlabs.update(s.id, { isDefault: false });
          }
        }
      }
      await db.interestSlabs.update(id, updates);
      const loaded = await db.interestSlabs.toArray();
      set({ interestSlabs: loaded as any });
    },

    deleteInterestSlab: async (id) => {
      const db = getDB();
      await db.interestSlabs.delete(id);
      set((prev) => ({
        interestSlabs: prev.interestSlabs.filter((s) => s.id !== id),
      }));
    },

    calculateInterestOnBills: (entries, asOnDate, slabId, fixedRate) => {
      let slab = null;
      if (slabId) {
        slab = get().interestSlabs.find((s) => s.id === slabId);
      }

      return entries.map((entry) => {
        const baseDateStr = entry.dueDate || entry.date;
        const baseDate = new Date(baseDateStr);
        const asOn = new Date(asOnDate);
        let daysOverdue = 0;
        
        if (asOn > baseDate) {
           const diffTime = Math.abs(asOn.getTime() - baseDate.getTime());
           daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        let ratePercent = fixedRate || 0;
        if (slab && slab.basisType === "day") {
          const tier = slab.slabs.find((t) => {
            if (t.fromDays !== undefined && daysOverdue < t.fromDays) return false;
            if (t.toDays !== undefined && daysOverdue > t.toDays) return false;
            return true;
          });
          if (tier) ratePercent = tier.ratePercent;
        }

        const balance = entry.balanceAmount || 0;
        const interestAmount = (balance * ratePercent * daysOverdue) / 36500;

        return {
          entry,
          daysOverdue,
          ratePercent,
          interestAmount,
          totalWithInterest: balance + interestAmount,
        };
      });
    },
  };
});

export const useAccountingStore = useStore;
