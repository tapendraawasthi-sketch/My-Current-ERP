import { migrateWorkflowFields } from "../lib/workflowMigration";
import { createWorkflowActions } from "./workflowActions";

// src/store/index.ts

import { getDB, DBSalesPerson, DBPriceList } from "../lib/db";
import { generateNextNumber } from "../lib/accounting";
import { startCbmsQueueWorker } from "../lib/cbmsService";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "accountant" | "viewer";

// ─── Validation Helpers ───────────────────────────────────────────────────────
const round2 = (value: number | string | null | undefined) =>
  Math.round((Number(value) || 0) * 100) / 100;

export const validateVoucherBalance = (lines: any[]) => {
  const totalDebit = round2(
    (lines ?? []).reduce((sum, line) => sum + Number(line.debit || 0), 0)
  );
  const totalCredit = round2(
    (lines ?? []).reduce((sum, line) => sum + Number(line.credit || 0), 0)
  );

  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error(
      `Unbalanced voucher: Debit ${totalDebit} does not equal Credit ${totalCredit}.`
    );
  }

  if (totalDebit <= 0) {
    throw new Error("Voucher amount must be greater than zero.");
  }

  return { totalDebit, totalCredit };
};

export const assertDateInFiscalYear = (
  date: string,
  fiscalYear: FiscalYear | null | undefined
) => {
  if (!fiscalYear) {
    throw new Error("No active fiscal year selected.");
  }
  if (date < fiscalYear.startDate || date > fiscalYear.endDate) {
    throw new Error(
      `Date ${date} is outside the current fiscal year (${fiscalYear.name}).`
    );
  }
};

export interface StoreUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  passwordHash?: string;
  password?: string;
}

export interface CompanySettings {
  id?: string;
  name: string;
  companyNameEn?: string;
  companyNameNe?: string;
  nameNepali?: string;
  address?: string;
  phone?: string;
  email?: string;
  panNumber?: string;
  vatNumber?: string;
  currencySymbol?: string;
  defaultCurrency?: string;
  enableCostCenter?: boolean;
  enableBillWiseTracking?: boolean;
  enableBillWise?: boolean;
  enableBatchTracking?: boolean;
  enableMultiCurrency?: boolean;
  tdsEnabled?: boolean;
  enableBankReconciliation?: boolean;
  enablePayroll?: boolean;
  enableEInvoice?: boolean;
  enableEPayment?: boolean;
  enableChequePrinting?: boolean;
  enablePDC?: boolean;
  enableDepositSlips?: boolean;
  defaultSalesAccount?: string;
  defaultPurchaseAccount?: string;
  defaultCashAccount?: string;
  defaultBankAccount?: string;
  defaultCostCenter?: string;
  
  // Nepal e-Invoicing / CBMS
  cbmsEnabled?: boolean;
  cbmsApiUrl?: string;
  cbmsApiKey?: string;
  simplifiedInvoiceThreshold?: number;
  stockValuationMethod?: string;
  dateFormat?: string;
  fiscalYearStartMonth?: number;
  printBankDetails?: boolean;
  termsConditions?: string;
  invoiceFooter?: string;
  signatoryName?: string;
  logo?: string;
  voucherSeries?: Record<string, any>;
  [key: string]: any;
}

export interface FiscalYear {
  id: string;
  name: string;
  fiscalYearBS?: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean;
}

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  timestamp: string;
  type?: string;
}

export interface ReportFilters {
  selectedReport?: string;
  fromDate?: string;
  toDate?: string;
  accountId?: string;
  partyId?: string;
  [key: string]: any;
}

// ─── Default seeds ─────────────────────────────────────────────────────────────
export const DEFAULT_SHORTCUTS = [
  { key_combo: "Ctrl+N", label: "New Voucher", action_type: "navigate", action_value: "journal", category: "Transactions", is_active: true },
  { key_combo: "Ctrl+I", label: "New Invoice", action_type: "navigate", action_value: "billing", category: "Transactions", is_active: true },
  { key_combo: "F2", label: "Save", action_type: "save", action_value: "save", category: "General", is_active: true },
  { key_combo: "F5", label: "List View", action_type: "navigate", action_value: "vouchers", category: "General", is_active: true },
  { key_combo: "Ctrl+/", label: "Search", action_type: "search", action_value: "search", category: "General", is_active: true },
  { key_combo: "?", label: "Shortcuts Help", action_type: "help", action_value: "shortcuts", category: "General", is_active: true },
  { key_combo: "Ctrl+B", label: "Balance Sheet", action_type: "report", action_value: "balance-sheet", category: "Reports", is_active: true },
  { key_combo: "Ctrl+T", label: "Trial Balance", action_type: "report", action_value: "trial-balance", category: "Reports", is_active: true },
];

export const DEFAULT_ACCOUNTS = [
  // Assets
  { id: "grp-assets", code: "1000", name: "Assets", type: "asset", level: "group", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "grp-current-assets", code: "1100", name: "Current Assets", type: "asset", level: "subgroup", parentId: "grp-assets", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "grp-bank-accounts", code: "1101", name: "Bank Accounts", type: "asset", level: "subgroup", parentId: "grp-current-assets", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "grp-sundry-debtors", code: "1200", name: "Sundry Debtors", type: "asset", level: "subgroup", parentId: "grp-current-assets", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "acc-cash", code: "1101", name: "Cash in Hand", type: "asset", level: "ledger", parentId: "grp-current-assets", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true, group: "Current Assets" },
  { id: "acc-sundry-debtors", code: "1201", name: "Sundry Debtors", type: "asset", level: "ledger", parentId: "grp-sundry-debtors", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  // Liabilities
  { id: "grp-liabilities", code: "2000", name: "Liabilities", type: "liability", level: "group", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "grp-current-liabilities", code: "2100", name: "Current Liabilities", type: "liability", level: "subgroup", parentId: "grp-liabilities", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "grp-sundry-creditors", code: "2101", name: "Sundry Creditors", type: "liability", level: "subgroup", parentId: "grp-current-liabilities", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "acc-sundry-creditors", code: "2101", name: "Sundry Creditors", type: "liability", level: "ledger", parentId: "grp-sundry-creditors", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-vat-payable", code: "2201", name: "VAT Payable", type: "liability", level: "ledger", parentId: "grp-current-liabilities", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-tds-payable", code: "2202", name: "TDS Payable", type: "liability", level: "ledger", parentId: "grp-current-liabilities", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  // Equity
  { id: "grp-equity", code: "3000", name: "Equity", type: "equity", level: "group", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-capital", code: "3001", name: "Capital Account", type: "equity", level: "ledger", parentId: "grp-equity", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-retained", code: "3002", name: "Retained Earnings", type: "equity", level: "ledger", parentId: "grp-equity", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  // Income
  { id: "grp-income", code: "4000", name: "Income", type: "income", level: "group", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "grp-sales", code: "4100", name: "Sales Accounts", type: "income", level: "subgroup", parentId: "grp-income", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "acc-sales", code: "4101", name: "Sales", type: "income", level: "ledger", parentId: "grp-sales", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-sales-return", code: "4102", name: "Sales Return", type: "income", level: "ledger", parentId: "grp-sales", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  // Expenses
  { id: "grp-expenses", code: "5000", name: "Expenses", type: "expense", level: "group", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "grp-purchase", code: "5100", name: "Purchase Accounts", type: "expense", level: "subgroup", parentId: "grp-expenses", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
  { id: "acc-purchase", code: "5101", name: "Purchases", type: "expense", level: "ledger", parentId: "grp-purchase", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-purchase-return", code: "5102", name: "Purchase Return", type: "expense", level: "ledger", parentId: "grp-purchase", isGroup: false, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0, isSystemAccount: true },
  { id: "acc-indirect-expenses", code: "5200", name: "Indirect Expenses", type: "expense", level: "subgroup", parentId: "grp-expenses", isGroup: true, isActive: true, balance: 0, openingBalance: 0, openingBalanceDr: 0, openingBalanceCr: 0 },
];

export const DEFAULT_WAREHOUSES = [
  { id: "wh-main", code: "MAIN", name: "Main Warehouse", isDefault: true, isActive: true },
];

export const DEFAULT_UNITS = [
  { id: "unit-pcs", code: "PCS", name: "Pieces", symbol: "pcs", decimalPlaces: 0, isActive: true },
  { id: "unit-box", code: "BOX", name: "Box", symbol: "box", decimalPlaces: 0, isActive: true },
  { id: "unit-kg", code: "KG", name: "Kilogram", symbol: "kg", decimalPlaces: 3, isActive: true },
  { id: "unit-ltr", code: "LTR", name: "Litre", symbol: "ltr", decimalPlaces: 3, isActive: true },
  { id: "unit-mtr", code: "MTR", name: "Metre", symbol: "mtr", decimalPlaces: 2, isActive: true },
];

export const DEFAULT_FISCAL_YEAR: FiscalYear = {
  id: "fy-2083-84",
  name: "2083/84",
  fiscalYearBS: "2083/84",
  startDate: "2026-04-14",
  endDate: "2027-04-13",
  isCurrent: true,
  isClosed: false,
};

export const DEFAULT_CURRENCY = {
  id: "curr-npr",
  code: "NPR",
  name: "Nepali Rupee",
  symbol: "Rs.",
  exchangeRate: 1,
  isBase: true,
  isActive: true,
};

// ─── Store interface ───────────────────────────────────────────────────────────
import type {
  DBWarehouse,
  DBStockMovement,
  DBStockTransferVoucher,
} from "../lib/db";

const transferNo = (n: number) => `TRF-${String(n).padStart(4, "0")}`;

export interface MultiGodownStoreSlice {
  warehouses: DBWarehouse[];
  stockMovements: DBStockMovement[];
  stockTransfers: DBStockTransferVoucher[];

  loadWarehouses: () => Promise<void>;
  addWarehouse: (warehouse: Omit<DBWarehouse, "id">) => Promise<DBWarehouse>;
  updateWarehouse: (id: string, updates: Partial<DBWarehouse>) => Promise<void>;

  getNextTransferNo: () => Promise<string>;
  saveStockTransfer: (
    transfer: Omit<
      DBStockTransferVoucher,
      "id" | "transferNo" | "createdAt" | "updatedAt" | "status"
    >
  ) => Promise<DBStockTransferVoucher>;
}
export interface AppState extends MultiGodownStoreSlice {
  // DB
  isDbReady: boolean;
  auditLogs?: any[];
  isInitializing?: boolean;
  // Auth
  isAuthenticated: boolean;
  currentUser: StoreUser | null;
  // Data
  accounts: any[];
  parties: any[];
  items: any[];
  vouchers: any[];
  invoices: any[];
  stockMovements: any[];
  warehouses: any[];
  units: any[];
  costCenters: any[];
  fiscalYears: FiscalYear[];
  currentFiscalYear: FiscalYear | null;
  deliveryChallans: any[];
  goodsReceiptNotes: any[];
  salesOrders: any[];
  purchaseOrders: any[];
  users: StoreUser[];
  notifications: Notification[];
  budgets: any[];
  recurringVouchers: any[];
  customFieldDefs: any[];
  currencies: any[];
  // Payroll module state
  employees: any[];
  // TDS module state
  tdsChallans: any[];
  // Masters Module v8
  stockCategories: any[];
  voucherTypeMasters: any[];
  voucherAuditLogs: any[];
  scenarios: any[];
  costCategories: any[];
  costCentreClasses: any[];
  reorderLevels: any[];
  priceLevels: any[];
  // ─── Sales Persons ────────────────────────────────────────────────────────────
  salesPersons: DBSalesPerson[];
  loadSalesPersons: () => Promise<void>;
  addSalesPerson: (data: Omit<DBSalesPerson, "id">) => Promise<void>;
  updateSalesPerson: (data: DBSalesPerson) => Promise<void>;
  deleteSalesPerson: (id: string) => Promise<void>;

  // ─── Price Lists ──────────────────────────────────────────────────────────────
  priceLists: DBPriceList[];
  loadPriceLists: () => Promise<void>;
  addPriceList: (data: Omit<DBPriceList, "id">) => Promise<void>;
  updatePriceList: (data: DBPriceList) => Promise<void>;
  deletePriceList: (id: string) => Promise<void>;
  hsCodes: any[];
  batches: any[];
  vatClassifications: any[];
  tdsNatureOfPayment: any[];
  employeeGroups: any[];
  payHeads: any[];
  salaryDetails: any[];
  payrollUnits: any[];
  attendanceTypes: any[];
  ledgerExtensions: any[];

  // Bank Reconciliation state
  bankStatements: any[];
  journalEntries: any[]; // alias over vouchers for BankReconciliation compatibility
  // TDS module state
  tdsEntries: any[];
  tdsRates: any[];
  // New transaction types
  stockJournals: any[];
  productions: any[];
  unassembles: any[];
  materialIssued: any[];
  materialReceived: any[];
  physicalStocks: any[];

  // Banking Module State
  chequeBooks: any[];
  cheques: any[];
  depositSlips: any[];
  pdCheques: any[];
  ePaymentBatches: any[];
  paymentAdvices: any[];

  addStockJournal: (entry: any) => Promise<void>;
  addProduction: (entry: any) => Promise<void>;
  addUnassemble: (entry: any) => Promise<void>;
  addMaterialIssued: (entry: any) => Promise<void>;
  addMaterialReceived: (entry: any) => Promise<void>;
  addPhysicalStock: (entry: any) => Promise<void>;
  addTdsEntry: (entry: Partial<any>) => Promise<any>;
  updateTdsEntry: (id: string, updates: Partial<any>) => Promise<void>;
  // Administration module state
  unitConversions: any[];
  standardNarrations: any[];
  billSundryMasters: any[];
  saleTypes: any[];
  purchaseTypes: any[];
  taxCategories: any[];
  discountStructures: any[];
  itemGroups: any[];
  holidays: any[];
  // Settings
  companySettings: CompanySettings | null;
  // UI
  currentPage: string;
  activeVoucherDate: string;
  setActiveVoucherDate: (date: string) => void;
  reportFilters: ReportFilters;
  showHelp?: boolean;
  // Actions
  initializeApp: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  createCompanyAndAdmin: (data: { company: Partial<CompanySettings>; adminUser: Partial<StoreUser> }) => Promise<void>;
  setCurrentPage: (page: string) => void;
  setReportFilters: (filters: ReportFilters) => void;
  // Accounts
  addAccount: (account: Partial<any>) => Promise<any>;
  updateAccount: (id: string, updates: Partial<any>) => Promise<void>;
  deleteAccount: (id: string) => Promise<boolean>;
  // Parties
  addParty: (party: Partial<any>) => Promise<any>;
  updateParty: (id: string, updates: Partial<any>) => Promise<void>;
  // Items
  addItem: (item: Partial<any>) => Promise<any>;
  updateItem: (item: any) => Promise<void>;
  // Vouchers
  addVoucher: (voucher: Partial<any>) => Promise<any>;
  updateVoucher: (id: string, updates: Partial<any>) => Promise<void>;
  cancelVoucher: (id: string, reason: string) => Promise<void>;
  // Invoices
  addInvoice: (invoice: Partial<any>) => Promise<any>;
  updateInvoice: (id: string, updates: Partial<any>) => Promise<void>;
  cancelInvoice: (id: string, reason: string) => Promise<void>;
  // Delivery / GRN
  addDeliveryChallan: (challan: Partial<any>) => Promise<any>;
  addGoodsReceiptNote: (grn: Partial<any>) => Promise<any>;
  // Company
  updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
  // Users
  addUser: (user: Partial<StoreUser>) => Promise<any>;
  updateUser: (id: string, updates: Partial<StoreUser>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  checkPermission: (permission: string) => boolean;
  // Recurring Vouchers
  addRecurringVoucher: (data: Partial<any>) => Promise<any>;
  updateRecurringVoucher: (id: string, data: Partial<any>) => Promise<void>;
  deleteRecurringVoucher: (id: string) => Promise<void>;
  runRecurringVoucher: (id: string) => Promise<void>;
  // Bank Reconciliation
  importBankStatements: (bankAccountId: string, rows: any[]) => Promise<void>;
  updateBankStatements: (updates: Partial<any>[]) => Promise<void>;
  // Notifications
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  addNotification: (message: string, type?: string) => void;
  // Fiscal year
  setCurrentFiscalYear: (fy: FiscalYear) => void;
  // Reset
  resetAllData: () => Promise<void>;
  // Currency
  getBaseCurrency: () => any;
  // Administration CRUD actions
  addUnitConversion: (data: Partial<any>) => Promise<any>;
  updateUnitConversion: (id: string, data: Partial<any>) => Promise<void>;
  deleteUnitConversion: (id: string) => Promise<void>;
  addStandardNarration: (data: Partial<any>) => Promise<any>;
  updateStandardNarration: (id: string, data: Partial<any>) => Promise<void>;
  deleteStandardNarration: (id: string) => Promise<void>;
  addBillSundryMaster: (data: Partial<any>) => Promise<any>;
  updateBillSundryMaster: (id: string, data: Partial<any>) => Promise<void>;
  deleteBillSundryMaster: (id: string) => Promise<void>;
  addSaleType: (data: Partial<any>) => Promise<any>;
  updateSaleType: (id: string, data: Partial<any>) => Promise<void>;
  deleteSaleType: (id: string) => Promise<void>;
  addPurchaseType: (data: Partial<any>) => Promise<any>;
  updatePurchaseType: (id: string, data: Partial<any>) => Promise<void>;
  deletePurchaseType: (id: string) => Promise<void>;
  addTaxCategory: (data: Partial<any>) => Promise<any>;
  updateTaxCategory: (id: string, data: Partial<any>) => Promise<void>;
  deleteTaxCategory: (id: string) => Promise<void>;
  addDiscountStructure: (data: Partial<any>) => Promise<any>;
  updateDiscountStructure: (id: string, data: Partial<any>) => Promise<void>;
  deleteDiscountStructure: (id: string) => Promise<void>;
  addItemGroup: (data: Partial<any>) => Promise<any>;
  updateItemGroup: (id: string, data: Partial<any>) => Promise<void>;
  deleteItemGroup: (id: string) => Promise<void>;
  addHoliday: (data: Partial<any>) => Promise<any>;
  updateHoliday: (id: string, data: Partial<any>) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  // Employees
  addEmployee: (data: Partial<any>) => Promise<any>;
  updateEmployee: (id: string, data: Partial<any>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  // Stock Category
  addStockCategory: (data: Partial<any>) => Promise<any>;
  updateStockCategory: (id: string, data: Partial<any>) => Promise<void>;
  deleteStockCategory: (id: string) => Promise<void>;
  // Voucher Type Master
  loadVoucherTypeMasters: () => Promise<void>;
  addVoucherTypeMaster: (data: Partial<any>) => Promise<any>;
  updateVoucherTypeMaster: (id: string, data: Partial<any>) => Promise<void>;
  deleteVoucherTypeMaster: (id: string) => Promise<void>;
  addVoucherAuditLog: (log: Omit<any, "id">) => Promise<void>;
  loadVoucherAuditLogs: (voucherId?: string) => Promise<void>;
  // Scenario
  addScenario: (data: Partial<any>) => Promise<any>;
  updateScenario: (id: string, data: Partial<any>) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
  // Cost Category
  addCostCategory: (data: Partial<any>) => Promise<any>;
  updateCostCategory: (id: string, data: Partial<any>) => Promise<void>;
  deleteCostCategory: (id: string) => Promise<void>;
  // Cost Centre Class
  addCostCentreClass: (data: Partial<any>) => Promise<any>;
  updateCostCentreClass: (id: string, data: Partial<any>) => Promise<void>;
  deleteCostCentreClass: (id: string) => Promise<void>;
  // Reorder Level
  addReorderLevel: (data: Partial<any>) => Promise<any>;
  updateReorderLevel: (id: string, data: Partial<any>) => Promise<void>;
  deleteReorderLevel: (id: string) => Promise<void>;
  // Price Level
  addPriceLevel: (data: Partial<any>) => Promise<any>;
  updatePriceLevel: (id: string, data: Partial<any>) => Promise<void>;
  deletePriceLevel: (id: string) => Promise<void>;

  // HS Code
  addHSCode: (data: Partial<any>) => Promise<any>;
  updateHSCode: (id: string, data: Partial<any>) => Promise<void>;
  deleteHSCode: (id: string) => Promise<void>;
  // Batch
  addBatch: (data: Partial<any>) => Promise<any>;
  updateBatch: (id: string, data: Partial<any>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  // VAT Classification
  addVATClassification: (data: Partial<any>) => Promise<any>;
  updateVATClassification: (id: string, data: Partial<any>) => Promise<void>;
  deleteVATClassification: (id: string) => Promise<void>;
  // TDS Nature of Payment
  addTDSNatureOfPayment: (data: Partial<any>) => Promise<any>;
  updateTDSNatureOfPayment: (id: string, data: Partial<any>) => Promise<void>;
  deleteTDSNatureOfPayment: (id: string) => Promise<void>;
  // Employee Group
  addEmployeeGroup: (data: Partial<any>) => Promise<any>;
  updateEmployeeGroup: (id: string, data: Partial<any>) => Promise<void>;
  deleteEmployeeGroup: (id: string) => Promise<void>;
  // Pay Head
  addPayHead: (data: Partial<any>) => Promise<any>;
  updatePayHead: (id: string, data: Partial<any>) => Promise<void>;
  deletePayHead: (id: string) => Promise<void>;
  // Salary Detail
  addSalaryDetail: (data: Partial<any>) => Promise<any>;
  updateSalaryDetail: (id: string, data: Partial<any>) => Promise<void>;
  deleteSalaryDetail: (id: string) => Promise<void>;
  // Payroll Unit
  addPayrollUnit: (data: Partial<any>) => Promise<any>;
  updatePayrollUnit: (id: string, data: Partial<any>) => Promise<void>;
  deletePayrollUnit: (id: string) => Promise<void>;
  // Attendance Type
  addAttendanceType: (data: Partial<any>) => Promise<any>;
  updateAttendanceType: (id: string, data: Partial<any>) => Promise<void>;
  deleteAttendanceType: (id: string) => Promise<void>;
  // Ledger Extension
  upsertLedgerExtension: (id: string, data: Partial<any>) => Promise<void>;
  getLedgerExtension: (id: string) => Promise<any>;

  // Banking Module Actions
  loadBankingData: () => Promise<void>;
  saveChequeBook: (data: Partial<any>) => Promise<string>;
  updateChequeBook: (id: string, data: Partial<any>) => Promise<void>;
  saveCheque: (data: Partial<any>) => Promise<string>;
  updateCheque: (id: string, data: Partial<any>) => Promise<void>;
  markChequePrinted: (chequeIds: string[], userId?: string) => Promise<void>;
  saveDepositSlip: (data: Partial<any>) => Promise<string>;
  updateDepositSlip: (id: string, data: Partial<any>) => Promise<void>;
  markDepositConfirmed: (slipId: string) => Promise<void>;
  savePDCheque: (data: Partial<any>) => Promise<string>;
  updatePDCheque: (id: string, data: Partial<any>) => Promise<void>;
  convertPDCToBank: (pdcId: string, journalData: any) => Promise<void>;
  saveEPaymentBatch: (data: Partial<any>) => Promise<string>;
  addAuditLog: (params: { action: string; resourceType: string; resourceId?: string; before?: unknown; after?: unknown; }) => Promise<void>;
  updateEPaymentBatch: (id: string, data: Partial<any>) => Promise<void>;
  savePaymentAdvice: (data: Partial<any>) => Promise<string>;
  updatePaymentAdvice: (id: string, data: Partial<any>) => Promise<void>;

  // NEW FEATURE TABLES FROM VERSION 13
  branches: any[];
  salespersons: any[];
  exchangeRates: any[];
  followUpNotes: any[];
  jobWorkOrders: any[];
  reportSchedules: any[];
  priceFloorPolicies: any[];
  chequeBounceLogs: any[];

  addBranch: (data: Partial<any>) => Promise<any>;
  updateBranch: (id: string, data: Partial<any>) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  addSalesperson: (data: Partial<any>) => Promise<any>;
  updateSalesperson: (id: string, data: Partial<any>) => Promise<void>;
  deleteSalesperson: (id: string) => Promise<void>;
  addExchangeRate: (data: Partial<any>) => Promise<any>;
  updateExchangeRate: (id: string, data: Partial<any>) => Promise<void>;
  deleteExchangeRate: (id: string) => Promise<void>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function generateId(): string {
  return crypto.randomUUID();
}

export async function hashPassword(password: string): Promise<string> {
  if (!crypto || !crypto.subtle) {
    console.warn("crypto.subtle is not available (likely non-HTTPS environment). Using fallback hash.");
    return `fallback_${password}`;
  }
  const enc = new TextEncoder();
  const salt = enc.encode("sutra-erp-salt-v1");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Hard fallback: no hash stored at all → only the default admin password is accepted
  if (!hash) return password === "admin123";
  // Handle fallback_ prefix stored when crypto.subtle was unavailable (HTTP env)
  if (hash.startsWith("fallback_")) {
    return hash === `fallback_${password}`;
  }
  // Handle plain-text stored hash (legacy / dev seeds)
  if (hash === password) return true;
  // PBKDF2 path
  const computed = await hashPassword(password);
  return computed === hash;
}

// Nepal TDS rates per Income Tax Act 2058
export const DEFAULT_TDS_RATES = [
  { id: "tds-1", section: "87", natureOfPayment: "Contractor", rate: 1.5, threshold: 50000 },
  { id: "tds-2", section: "88", natureOfPayment: "Service", rate: 15, threshold: 0 },
  { id: "tds-3", section: "88", natureOfPayment: "Rent", rate: 10, threshold: 0 },
  { id: "tds-4", section: "88", natureOfPayment: "Commission", rate: 10, threshold: 0 },
  { id: "tds-5", section: "87", natureOfPayment: "Salary", rate: 15, threshold: 0 },
  { id: "tds-6", section: "88", natureOfPayment: "Dividend", rate: 5, threshold: 0 },
  { id: "tds-7", section: "88", natureOfPayment: "Interest", rate: 15, threshold: 0 },
  { id: "tds-8", section: "88", natureOfPayment: "Royalty", rate: 15, threshold: 0 },
  { id: "tds-9", section: "88", natureOfPayment: "Other", rate: 1.5, threshold: 0 },
];

// ─── Store ────────────────────────────────────────────────────────────────────