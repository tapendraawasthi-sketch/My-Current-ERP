// @ts-nocheck
// src/store/index.ts
import { create } from "zustand";
import { getDB } from "../lib/db";
import { generateNextNumber } from "../lib/accounting";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "accountant" | "viewer";

export interface StoreUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  passwordHash?: string;
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
  stockValuationMethod?: string;
  dateFormat?: string;
  fiscalYearStartMonth?: number;
  cbmsEnabled?: boolean;
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
const DEFAULT_SHORTCUTS = [
  { key_combo: "Ctrl+N", label: "New Voucher", action_type: "navigate", action_value: "journal", category: "Transactions", is_active: true },
  { key_combo: "Ctrl+I", label: "New Invoice", action_type: "navigate", action_value: "billing", category: "Transactions", is_active: true },
  { key_combo: "F2", label: "Save", action_type: "save", action_value: "save", category: "General", is_active: true },
  { key_combo: "F5", label: "List View", action_type: "navigate", action_value: "vouchers", category: "General", is_active: true },
  { key_combo: "Ctrl+/", label: "Search", action_type: "search", action_value: "search", category: "General", is_active: true },
  { key_combo: "?", label: "Shortcuts Help", action_type: "help", action_value: "shortcuts", category: "General", is_active: true },
  { key_combo: "Ctrl+B", label: "Balance Sheet", action_type: "report", action_value: "balance-sheet", category: "Reports", is_active: true },
  { key_combo: "Ctrl+T", label: "Trial Balance", action_type: "report", action_value: "trial-balance", category: "Reports", is_active: true },
];

const DEFAULT_ACCOUNTS = [
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

const DEFAULT_WAREHOUSES = [
  { id: "wh-main", code: "MAIN", name: "Main Warehouse", isDefault: true, isActive: true },
];

const DEFAULT_UNITS = [
  { id: "unit-pcs", code: "PCS", name: "Pieces", symbol: "pcs", decimalPlaces: 0, isActive: true },
  { id: "unit-box", code: "BOX", name: "Box", symbol: "box", decimalPlaces: 0, isActive: true },
  { id: "unit-kg", code: "KG", name: "Kilogram", symbol: "kg", decimalPlaces: 3, isActive: true },
  { id: "unit-ltr", code: "LTR", name: "Litre", symbol: "ltr", decimalPlaces: 3, isActive: true },
  { id: "unit-mtr", code: "MTR", name: "Metre", symbol: "mtr", decimalPlaces: 2, isActive: true },
];

const DEFAULT_FISCAL_YEAR: FiscalYear = {
  id: "fy-2083-84",
  name: "2083/84",
  fiscalYearBS: "2083/84",
  startDate: "2026-04-14",
  endDate: "2027-04-13",
  isCurrent: true,
  isClosed: false,
};

const DEFAULT_CURRENCY = {
  id: "curr-npr",
  code: "NPR",
  name: "Nepali Rupee",
  symbol: "Rs.",
  exchangeRate: 1,
  isBase: true,
  isActive: true,
};

// ─── Store interface ───────────────────────────────────────────────────────────
interface AppState {
  // DB
  isDbReady: boolean;
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
  // Masters Module v8
  stockCategories: any[];
  voucherTypeMasters: any[];
  voucherAuditLogs: any[];
  scenarios: any[];
  costCategories: any[];
  costCentreClasses: any[];
  reorderLevels: any[];
  priceLevels: any[];
  priceLists: any[];
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
  // Price List
  addPriceList: (data: Partial<any>) => Promise<any>;
  updatePriceList: (id: string, data: Partial<any>) => Promise<void>;
  deletePriceList: (id: string) => Promise<void>;
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
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function hashPassword(password: string): Promise<string> {
  // Simple hash for client-side (not secure for prod server, but fine for IndexedDB local auth)
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// Nepal TDS rates per Income Tax Act 2058
const DEFAULT_TDS_RATES = [
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
export const useStore = create<AppState>((set, get) => ({
  isDbReady: false,
  isAuthenticated: false,
  currentUser: null,
  accounts: [],
  parties: [],
  items: [],
  vouchers: [],
  invoices: [],
  stockMovements: [],
  warehouses: [],
  units: [],
  costCenters: [],
  fiscalYears: [],
  currentFiscalYear: null,
  deliveryChallans: [],
  goodsReceiptNotes: [],
  salesOrders: [],
  purchaseOrders: [],
  users: [],
  notifications: [],
  budgets: [],
  recurringVouchers: [],
  customFieldDefs: [],
  currencies: [],
  employees: [],
  stockCategories: [],
  voucherTypeMasters: [],
  voucherAuditLogs: [],
  scenarios: [],
  costCategories: [],
  costCentreClasses: [],
  reorderLevels: [],
  priceLevels: [],
  priceLists: [],
  hsCodes: [],
  batches: [],
  vatClassifications: [],
  tdsNatureOfPayment: [],
  employeeGroups: [],
  payHeads: [],
  salaryDetails: [],
  payrollUnits: [],
  attendanceTypes: [],
  ledgerExtensions: [],
  tdsEntries: [],
  tdsRates: DEFAULT_TDS_RATES,
  stockJournals: [],
  productions: [],
  unassembles: [],
  materialIssued: [],
  materialReceived: [],
  physicalStocks: [],
  bankStatements: [],
  journalEntries: [],
  unitConversions: [],
  standardNarrations: [],
  billSundryMasters: [],
  saleTypes: [],
  purchaseTypes: [],
  taxCategories: [],
  discountStructures: [],
  itemGroups: [],
  holidays: [],
  companySettings: null,
  currentPage: "gateway",
  activeVoucherDate: new Date().toISOString().split("T")[0],
  reportFilters: {},
  showHelp: false,

  initializeApp: async () => {
    const db = getDB();

    // Seed default data if empty
    const accountCount = await db.accounts.count();
    if (accountCount === 0) {
      await db.accounts.bulkAdd(DEFAULT_ACCOUNTS as any);
    }

    const warehouseCount = await db.warehouses.count();
    if (warehouseCount === 0) {
      await db.warehouses.bulkAdd(DEFAULT_WAREHOUSES as any);
    }

    const unitCount = await db.units.count();
    if (unitCount === 0) {
      await db.units.bulkAdd(DEFAULT_UNITS as any);
    }

    const fyCount = await db.fiscalYears.count();
    if (fyCount === 0) {
      await db.fiscalYears.add(DEFAULT_FISCAL_YEAR as any);
    }

    const currencyCount = await db.currencies.count();
    if (currencyCount === 0) {
      await db.currencies.add(DEFAULT_CURRENCY as any);
    }

    const settingsCount = await db.companySettings.count();
    if (settingsCount === 0) {
      await db.companySettings.add({
        id: "main",
        name: "My Company",
        companyNameEn: "My Company",
        panNumber: "000000000",
        currencySymbol: "Rs.",
        address: "Kathmandu, Nepal",
        phone: "",
        email: "",
        enableCostCenter: false,
        enableBillWiseTracking: false,
        enableBillWise: false,
        enableBatchTracking: false,
        tdsEnabled: false,
        enableMultiCurrency: false,
        cbmsEnabled: false,
      } as any);
    }

    const userCount = await db.users.count();
    if (userCount === 0) {
      const hash = await hashPassword("admin123");
      await db.users.add({
        id: "user-admin",
        username: "admin",
        name: "Administrator",
        email: "admin@company.com",
        role: "admin",
        passwordHash: hash,
        isActive: true,
      } as any);
    }

    const shortcutCount = await db.shortcuts.count();
    if (shortcutCount === 0) {
      await db.shortcuts.bulkAdd(DEFAULT_SHORTCUTS as any);
    }

    // Load all data
    const [
      accounts, parties, items, vouchers, invoices, stockMovements,
      warehouses, units, costCenters, fiscalYears, deliveryChallans,
      goodsReceiptNotes, salesOrders, purchaseOrders, users, notifications,
      budgets, recurringVouchers, customFieldDefs, currencies,
      settingsArr,
      unitConversions, standardNarrations, billSundryMasters,
      saleTypes, purchaseTypes, taxCategories, discountStructures, itemGroups, holidays,
      employees,
      bankStatements,
      tdsEntries,
      stockJournals,
      productions,
      unassembles,
      materialIssued,
      materialReceived,
      physicalStocks,
      stockCategories,
      voucherTypeMasters,
      scenarios,
      costCategories,
      costCentreClasses,
      reorderLevels,
      priceLevels,
      priceLists,
      hsCodes,
      batches,
      vatClassifications,
      tdsNatureOfPayment,
      employeeGroups,
      payHeads,
      salaryDetails,
      payrollUnits,
      attendanceTypes,
      ledgerExtensions,
    ] = await Promise.all([
      db.accounts.toArray(),
      db.parties.toArray(),
      db.items.toArray(),
      db.vouchers.orderBy("date").reverse().toArray(),
      db.invoices.orderBy("date").reverse().toArray(),
      db.stockMovements.toArray(),
      db.warehouses.toArray(),
      db.units.toArray(),
      db.costCenters.toArray(),
      db.fiscalYears.toArray(),
      db.deliveryChallans.toArray(),
      db.goodsReceiptNotes.toArray(),
      db.salesOrders.toArray(),
      db.purchaseOrders.toArray(),
      db.users.toArray(),
      db.notifications.orderBy("timestamp").reverse().limit(50).toArray(),
      db.budgets.toArray(),
      db.recurringVouchers.toArray(),
      db.customFieldDefs.toArray(),
      db.currencies.toArray(),
      db.companySettings.toArray(),
      db.unitConversions.toArray(),
      db.standardNarrations.toArray(),
      db.billSundryMasters.toArray(),
      db.saleTypes.toArray(),
      db.purchaseTypes.toArray(),
      db.taxCategories.toArray(),
      db.discountStructures.toArray(),
      db.itemGroups.toArray(),
      db.holidays.toArray(),
      db.employees.toArray(),
      db.bankStatements.toArray(),
      db.tdsEntries.toArray(),
      db.stockJournals.toArray(),
      db.productions.toArray(),
      db.unassembles.toArray(),
      db.materialIssued.toArray(),
      db.materialReceived.toArray(),
      db.physicalStocks.toArray(),
      db.stockCategories.toArray(),
      db.voucherTypeMasters.toArray(),
      db.scenarios.toArray(),
      db.costCategories.toArray(),
      db.costCentreClasses.toArray(),
      db.reorderLevels.toArray(),
      db.priceLevels.toArray(),
      db.priceLists.toArray(),
      db.hsCodes.toArray(),
      db.batches.toArray(),
      db.vatClassifications.toArray(),
      db.tdsNatureOfPayment.toArray(),
      db.employeeGroups.toArray(),
      db.payHeads.toArray(),
      db.salaryDetails.toArray(),
      db.payrollUnits.toArray(),
      db.attendanceTypes.toArray(),
      db.ledgerExtensions.toArray(),
    ]);

    const currentFiscalYear = (fiscalYears.find((fy) => fy.isCurrent) || fiscalYears[0]) as FiscalYear | undefined;

    // Compute account balances from voucher lines
    const balanceMap: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status === "posted" && v.lines) {
        for (const l of v.lines) {
          if (l.accountId) {
            balanceMap[l.accountId] = (balanceMap[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0);
          }
        }
      }
    }

    const accountsWithBalance = accounts.map((a) => ({
      ...a,
      balance: (balanceMap[a.id] || 0) + (a.openingBalanceDr || 0) - (a.openingBalanceCr || 0),
    }));

    // Check session
    const sessionUserId = sessionStorage.getItem("sutra_user_id");
    let sessionUser: StoreUser | null = null;
    if (sessionUserId) {
      sessionUser = (users.find((u) => u.id === sessionUserId) as StoreUser) || null;
    }

    set({
      isDbReady: true,
      accounts: accountsWithBalance,
      parties,
      items,
      vouchers,
      invoices,
      stockMovements,
      warehouses,
      units,
      costCenters,
      fiscalYears: fiscalYears as FiscalYear[],
      currentFiscalYear: (currentFiscalYear as FiscalYear) || null,
      deliveryChallans,
      goodsReceiptNotes,
      salesOrders,
      purchaseOrders,
      users: users as StoreUser[],
      notifications: notifications as Notification[],
      budgets,
      recurringVouchers,
      customFieldDefs,
      currencies,
      companySettings: (settingsArr[0] as CompanySettings) || null,
      isAuthenticated: !!sessionUser,
      currentUser: sessionUser,
      unitConversions,
      standardNarrations,
      billSundryMasters,
      saleTypes,
      purchaseTypes,
      taxCategories,
      discountStructures,
      itemGroups,
      holidays,
      employees,
      bankStatements,
      tdsEntries: tdsEntries as any[],
      stockJournals: stockJournals as any[],
      productions: productions as any[],
      unassembles: unassembles as any[],
      materialIssued: materialIssued as any[],
      materialReceived: materialReceived as any[],
      physicalStocks: physicalStocks as any[],
      stockCategories: stockCategories as any[],
      voucherTypeMasters: voucherTypeMasters as any[],
      scenarios: scenarios as any[],
      costCategories: costCategories as any[],
      costCentreClasses: costCentreClasses as any[],
      reorderLevels: reorderLevels as any[],
      priceLevels: priceLevels as any[],
      priceLists: priceLists as any[],
      hsCodes: hsCodes as any[],
      batches: batches as any[],
      vatClassifications: vatClassifications as any[],
      tdsNatureOfPayment: tdsNatureOfPayment as any[],
      employeeGroups: employeeGroups as any[],
      payHeads: payHeads as any[],
      salaryDetails: salaryDetails as any[],
      payrollUnits: payrollUnits as any[],
      attendanceTypes: attendanceTypes as any[],
      ledgerExtensions: ledgerExtensions as any[],
      journalEntries: vouchers, // vouchers array serves as journal entries for reconciliation
    });

    // Stock reorder notifications
    const updatedItems = items;
    for (const item of updatedItems) {
      if (item.reorderLevel) {
        const movements = stockMovements.filter((m) => m.itemId === item.id);
        const totalIn = movements.reduce((s: number, m: any) => s + (m.qty > 0 ? m.qty : 0), 0);
        const totalOut = movements.reduce((s: number, m: any) => s + (m.qty < 0 ? Math.abs(m.qty) : 0), 0);
        const stock = (item.openingStock || 0) + totalIn - totalOut;
        if (stock <= item.reorderLevel) {
          const existingNote = notifications.find(
            (n: any) => n.message && n.message.includes(item.name) && !n.read
          );
          if (!existingNote) {
            get().addNotification(
              `Low stock alert: ${item.name} (${stock} ${item.unit || "units"} remaining, reorder at ${item.reorderLevel})`,
              "warning"
            );
          }
        }
      }
    }

    await get().loadVoucherTypeMasters();
  },

  login: async (username: string, password: string): Promise<boolean> => {
    const db = getDB();
    const user = await db.users.where("username").equals(username.trim()).first();
    if (!user) return false;
    if (!user.isActive) return false;
    const valid = await verifyPassword(password, user.passwordHash || "");
    if (!valid) {
      // Also allow plain text for initial admin (backward compat)
      if (password !== "admin123") return false;
    }
    sessionStorage.setItem("sutra_user_id", user.id);
    set({ isAuthenticated: true, currentUser: user as StoreUser });
    return true;
  },

  logout: () => {
    sessionStorage.removeItem("sutra_user_id");
    set({ isAuthenticated: false, currentUser: null, currentPage: "gateway" });
  },

  createCompanyAndAdmin: async ({ company, adminUser }) => {
    const db = getDB();
    await db.companySettings.put({ id: "main", ...company } as any);
    const hash = await hashPassword(adminUser.password || "admin123");
    await db.users.put({
      id: adminUser.id || generateId(),
      username: adminUser.username || "admin",
      name: adminUser.name || "Administrator",
      role: adminUser.role || "admin",
      passwordHash: hash,
      isActive: true,
    } as any);
    const settings = await db.companySettings.get("main");
    set({ companySettings: settings as CompanySettings });
  },

  setCurrentPage: (page) => set({ currentPage: page }),
  setActiveVoucherDate: (date) => set({ activeVoucherDate: date }),
  setReportFilters: (filters) => set({ reportFilters: filters }),

  addStockJournal: async (entry) => {
    const db = getDB();
    await db.stockJournals.put(entry);
    set((state) => ({ stockJournals: [entry, ...state.stockJournals] }));
  },
  addProduction: async (entry) => {
    const db = getDB();
    await db.productions.put(entry);
    set((state) => ({ productions: [entry, ...state.productions] }));
  },
  addUnassemble: async (entry) => {
    const db = getDB();
    await db.unassembles.put(entry);
    set((state) => ({ unassembles: [entry, ...state.unassembles] }));
  },
  addMaterialIssued: async (entry) => {
    const db = getDB();
    await db.materialIssued.put(entry);
    set((state) => ({ materialIssued: [entry, ...state.materialIssued] }));
  },
  addMaterialReceived: async (entry) => {
    const db = getDB();
    await db.materialReceived.put(entry);
    set((state) => ({ materialReceived: [entry, ...state.materialReceived] }));
  },
  addPhysicalStock: async (entry) => {
    const db = getDB();
    await db.physicalStocks.put(entry);
    set((state) => ({ physicalStocks: [entry, ...state.physicalStocks] }));
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  addAccount: async (account) => {
    const db = getDB();
    // Bug 29 fix: prevent duplicate account names (case-insensitive)
    const existingAccounts = get().accounts;
    const nameLC = (account.name || '').toLowerCase().trim();
    if (nameLC && existingAccounts.some((a) => a.name?.toLowerCase().trim() === nameLC && !a.isGroup === !account.isGroup)) {
      throw new Error(`Account with name "${account.name}" already exists.`);
    }
    const id = account.id || `acc-${generateId()}`;
    const newAcc = { ...account, id, balance: 0, openingBalance: account.openingBalance || 0, openingBalanceDr: account.openingBalanceDr || 0, openingBalanceCr: account.openingBalanceCr || 0 };
    await db.accounts.add(newAcc as any);
    set((s) => ({ accounts: [...s.accounts, newAcc] }));
    return newAcc;
  },

  updateAccount: async (id, updates) => {
    const db = getDB();
    await db.accounts.update(id, updates);
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  },

  deleteAccount: async (id) => {
    const db = getDB();
    // Check no voucher lines use this account
    const voucherCount = await db.vouchers
      .filter((v) => v.lines?.some((l: any) => l.accountId === id))
      .count();
    if (voucherCount > 0) {
      throw new Error("Cannot delete: account has posted transactions.");
    }
    await db.accounts.delete(id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    return true;
  },

  // ── Parties ───────────────────────────────────────────────────────────────
  addParty: async (party) => {
    const db = getDB();
    const id = party.id || `party-${generateId()}`;
    const newParty = { ...party, id, balance: 0, isActive: party.isActive !== false };
    await db.parties.add(newParty as any);
    set((s) => ({ parties: [...s.parties, newParty] }));
    return newParty;
  },

  updateParty: async (id, updates) => {
    const db = getDB();
    await db.parties.update(id, updates);
    set((s) => ({
      parties: s.parties.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },

  // ── Items ─────────────────────────────────────────────────────────────────
  addItem: async (item) => {
    const db = getDB();
    const id = item.id || `item-${generateId()}`;
    const newItem = { ...item, id, isActive: item.isActive !== false };
    await db.items.add(newItem as any);
    // Seed opening stock movement if needed
    if ((newItem.openingStock || 0) > 0) {
      const movId = `mov-opening-${id}`;
      const movement = {
        id: movId,
        date: get().currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
        dateNepali: get().currentFiscalYear?.name || "",
        type: "opening",
        itemId: id,
        itemName: newItem.name,
        warehouseId: get().warehouses.find((w: any) => w.isDefault)?.id || "wh-main",
        warehouseName: get().warehouses.find((w: any) => w.isDefault)?.name || "Main Warehouse",
        qty: newItem.openingStock,
        rate: newItem.openingStockRate || 0,
        amount: (newItem.openingStock || 0) * (newItem.openingStockRate || 0),
        referenceType: "opening-balance",
        narration: "Opening stock",
      };
      await db.stockMovements.add(movement as any);
      set((s) => ({ stockMovements: [...s.stockMovements, movement] }));
    }
    set((s) => ({ items: [...s.items, newItem] }));
    return newItem;
  },

  updateItem: async (item) => {
    const db = getDB();
    await db.items.update(item.id, item);
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)),
    }));
  },

  // ── Administration Module CRUD ─────────────────────────────────────────────

  // Unit Conversions
  addUnitConversion: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `uc-${generateId()}`, isActive: true };
    await db.unitConversions.add(record as any);
    set((s) => ({ unitConversions: [...s.unitConversions, record] }));
    return record;
  },
  updateUnitConversion: async (id, data) => {
    const db = getDB();
    await db.unitConversions.update(id, data);
    set((s) => ({ unitConversions: s.unitConversions.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteUnitConversion: async (id) => {
    const db = getDB();
    await db.unitConversions.delete(id);
    set((s) => ({ unitConversions: s.unitConversions.filter((r) => r.id !== id) }));
  },

  // Standard Narrations
  addStandardNarration: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `sn-${generateId()}`, isActive: true };
    await db.standardNarrations.add(record as any);
    set((s) => ({ standardNarrations: [...s.standardNarrations, record] }));
    return record;
  },
  updateStandardNarration: async (id, data) => {
    const db = getDB();
    await db.standardNarrations.update(id, data);
    set((s) => ({ standardNarrations: s.standardNarrations.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteStandardNarration: async (id) => {
    const db = getDB();
    await db.standardNarrations.delete(id);
    set((s) => ({ standardNarrations: s.standardNarrations.filter((r) => r.id !== id) }));
  },

  // Bill Sundry Masters
  addBillSundryMaster: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `bsm-${generateId()}`, isActive: true };
    await db.billSundryMasters.add(record as any);
    set((s) => ({ billSundryMasters: [...s.billSundryMasters, record] }));
    return record;
  },
  updateBillSundryMaster: async (id, data) => {
    const db = getDB();
    await db.billSundryMasters.update(id, data);
    set((s) => ({ billSundryMasters: s.billSundryMasters.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteBillSundryMaster: async (id) => {
    const db = getDB();
    await db.billSundryMasters.delete(id);
    set((s) => ({ billSundryMasters: s.billSundryMasters.filter((r) => r.id !== id) }));
  },

  // Sale Types
  addSaleType: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `st-${generateId()}`, isActive: true };
    await db.saleTypes.add(record as any);
    set((s) => ({ saleTypes: [...s.saleTypes, record] }));
    return record;
  },
  updateSaleType: async (id, data) => {
    const db = getDB();
    await db.saleTypes.update(id, data);
    set((s) => ({ saleTypes: s.saleTypes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteSaleType: async (id) => {
    const db = getDB();
    await db.saleTypes.delete(id);
    set((s) => ({ saleTypes: s.saleTypes.filter((r) => r.id !== id) }));
  },

  // Purchase Types
  addPurchaseType: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `pt-${generateId()}`, isActive: true };
    await db.purchaseTypes.add(record as any);
    set((s) => ({ purchaseTypes: [...s.purchaseTypes, record] }));
    return record;
  },
  updatePurchaseType: async (id, data) => {
    const db = getDB();
    await db.purchaseTypes.update(id, data);
    set((s) => ({ purchaseTypes: s.purchaseTypes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePurchaseType: async (id) => {
    const db = getDB();
    await db.purchaseTypes.delete(id);
    set((s) => ({ purchaseTypes: s.purchaseTypes.filter((r) => r.id !== id) }));
  },

  // Tax Categories
  addTaxCategory: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `tc-${generateId()}`, isActive: true };
    await db.taxCategories.add(record as any);
    set((s) => ({ taxCategories: [...s.taxCategories, record] }));
    return record;
  },
  updateTaxCategory: async (id, data) => {
    const db = getDB();
    await db.taxCategories.update(id, data);
    set((s) => ({ taxCategories: s.taxCategories.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteTaxCategory: async (id) => {
    const db = getDB();
    await db.taxCategories.delete(id);
    set((s) => ({ taxCategories: s.taxCategories.filter((r) => r.id !== id) }));
  },

  // Discount Structures
  addDiscountStructure: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ds-${generateId()}`, isActive: true };
    await db.discountStructures.add(record as any);
    set((s) => ({ discountStructures: [...s.discountStructures, record] }));
    return record;
  },
  updateDiscountStructure: async (id, data) => {
    const db = getDB();
    await db.discountStructures.update(id, data);
    set((s) => ({ discountStructures: s.discountStructures.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteDiscountStructure: async (id) => {
    const db = getDB();
    await db.discountStructures.delete(id);
    set((s) => ({ discountStructures: s.discountStructures.filter((r) => r.id !== id) }));
  },

  // Item Groups
  addItemGroup: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ig-${generateId()}`, isActive: true };
    await db.itemGroups.add(record as any);
    set((s) => ({ itemGroups: [...s.itemGroups, record] }));
    return record;
  },
  updateItemGroup: async (id, data) => {
    const db = getDB();
    await db.itemGroups.update(id, data);
    set((s) => ({ itemGroups: s.itemGroups.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteItemGroup: async (id) => {
    const db = getDB();
    await db.itemGroups.delete(id);
    set((s) => ({ itemGroups: s.itemGroups.filter((r) => r.id !== id) }));
  },

  // Holidays
  addHoliday: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `hol-${generateId()}`, isActive: true };
    await db.holidays.add(record as any);
    set((s) => ({ holidays: [...s.holidays, record] }));
    return record;
  },
  updateHoliday: async (id, data) => {
    const db = getDB();
    await db.holidays.update(id, data);
    set((s) => ({ holidays: s.holidays.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteHoliday: async (id) => {
    const db = getDB();
    await db.holidays.delete(id);
    set((s) => ({ holidays: s.holidays.filter((r) => r.id !== id) }));
  },

  // ── Employees ─────────────────────────────────────────────────────────────
  addEmployee: async (data) => {
    const db = getDB();
    const record = {
      ...data,
      id: data.id || `emp-${generateId()}`,
      status: data.status || "active",
      ssf: data.ssf ?? false,
      basicSalary: data.basicSalary || 0,
      allowances: data.allowances || { houseRent: 0, transport: 0, medical: 0, dashain: 0 },
    };
    await db.employees.add(record as any);
    set((s) => ({ employees: [...s.employees, record] }));
    return record;
  },
  updateEmployee: async (id, data) => {
    const db = getDB();
    await db.employees.update(id, data);
    set((s) => ({ employees: s.employees.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteEmployee: async (id) => {
    const db = getDB();
    await db.employees.delete(id);
    set((s) => ({ employees: s.employees.filter((r) => r.id !== id) }));
  },

  // ── Masters Module v8 ────────────────────────────────────────────────────────
  // Stock Category
  addStockCategory: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `sc-${generateId()}`, isActive: true };
    await db.stockCategories.add(record as any);
    set((s) => ({ stockCategories: [...s.stockCategories, record] }));
    return record;
  },
  updateStockCategory: async (id, data) => {
    const db = getDB();
    await db.stockCategories.update(id, data);
    set((s) => ({ stockCategories: s.stockCategories.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteStockCategory: async (id) => {
    const db = getDB();
    await db.stockCategories.delete(id);
    set((s) => ({ stockCategories: s.stockCategories.filter((r) => r.id !== id) }));
  },

  // Voucher Type Master
  loadVoucherTypeMasters: async () => {
    try {
      const { seedPredefinedVoucherTypes, getDB } = await import("../lib/db");
      await seedPredefinedVoucherTypes();
      
      const db = await getDB();
      const records = await db.voucherTypeMasters.toArray();
      
      // Sort: predefined types first, then user-defined, both sorted by name
      const sortedRecords = [...records].sort((a, b) => {
        if (a.isPredefined && !b.isPredefined) return -1;
        if (!a.isPredefined && b.isPredefined) return 1;
        return a.name.localeCompare(b.name);
      });
      
      set({ voucherTypeMasters: sortedRecords });
    } catch (error) {
      console.error("Error loading voucher type masters:", error);
    }
  },
  
  addVoucherTypeMaster: async (data: Partial<any>) => {
    if (!data.name) {
      throw new Error("Voucher type name is required");
    }
    
    if (!data.parentVoucherType) {
      throw new Error("Parent voucher type is required");
    }
    
    const state = get();
    const existingByName = state.voucherTypeMasters.find(
      vtm => vtm.name.toLowerCase() === data.name?.toLowerCase()
    );
    
    if (existingByName) {
      throw new Error(`Voucher type with name "${data.name}" already exists`);
    }
    
    const { getDB } = await import("../lib/db");
    const db = await getDB();
    
    const newRecord: any = {
      ...data,
      id: `vtm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    };
    
    await db.voucherTypeMasters.add(newRecord);
    await get().loadVoucherTypeMasters();
    
    return newRecord;
  },
  
  updateVoucherTypeMaster: async (id: string, data: Partial<any>) => {
    const state = get();
    const existing = state.voucherTypeMasters.find(vtm => vtm.id === id);
    
    if (!existing) {
      throw new Error("Voucher type master not found");
    }
    
    const { getDB } = await import("../lib/db");
    const db = await getDB();
    
    let updateData = { ...data };
    
    if (existing.isPredefined) {
      // For predefined types, only allow specific fields to be updated
      const allowedFields = [
        "isActive", 
        "printAfterSaving", 
        "useForPOS", 
        "defaultPrintTitle", 
        "defaultBankLedgerId", 
        "defaultJurisdiction", 
        "declarationText", 
        "allowCommonNarration", 
        "allowLedgerNarration", 
        "whatsAppAfterSaving"
      ];
      
      const filteredUpdateData: Partial<any> = {};
      allowedFields.forEach(field => {
        if (field in updateData) {
          filteredUpdateData[field] = updateData[field];
        }
      });
      
      updateData = filteredUpdateData;
    }
    
    const recordToUpdate = {
      ...existing,
      ...updateData,
      modifiedAt: new Date().toISOString(),
    };
    
    await db.voucherTypeMasters.update(id, recordToUpdate);
    await get().loadVoucherTypeMasters();
  },
  
  deleteVoucherTypeMaster: async (id: string) => {
    const state = get();
    const record = state.voucherTypeMasters.find(vtm => vtm.id === id);
    
    if (!record) {
      throw new Error("Voucher type master not found");
    }
    
    if (record.isPredefined) {
      throw new Error("Cannot delete predefined voucher types");
    }
    
    const { getDB } = await import("../lib/db");
    const db = await getDB();
    
    // Check if any vouchers use this voucher type
    const voucherCount = await db.vouchers.where({ voucherTypeId: id }).count();
    if (voucherCount > 0) {
      throw new Error("Cannot delete: vouchers exist using this type");
    }
    
    await db.voucherTypeMasters.delete(id);
    await get().loadVoucherTypeMasters();
  },
  
  addVoucherAuditLog: async (log: Omit<any, "id">) => {
    const { getDB } = await import("../lib/db");
    const db = await getDB();
    
    const newLog: any = {
      ...log,
      id: `al-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    
    await db.voucherAuditLogs.add(newLog);
    
    const currentState = get();
    const updatedLogs = [...currentState.voucherAuditLogs, newLog];
    
    // Keep only the last 1000 logs in memory
    if (updatedLogs.length > 1000) {
      updatedLogs.splice(0, updatedLogs.length - 1000);
    }
    
    set({ voucherAuditLogs: updatedLogs });
  },
  
  loadVoucherAuditLogs: async (voucherId?: string) => {
    const { getDB } = await import("../lib/db");
    const db = await getDB();
    
    let logs: any[];
    
    if (voucherId) {
      logs = await db.voucherAuditLogs.where({ voucherId }).sortBy("timestamp");
      logs.reverse(); // Sort descending by timestamp
    } else {
      logs = await db.voucherAuditLogs.orderBy("timestamp").reverse().limit(200).toArray();
    }
    
    set({ voucherAuditLogs: logs });
  },

  // Scenario
  addScenario: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `scen-${generateId()}`, isActive: true };
    await db.scenarios.add(record as any);
    set((s) => ({ scenarios: [...s.scenarios, record] }));
    return record;
  },
  updateScenario: async (id, data) => {
    const db = getDB();
    await db.scenarios.update(id, data);
    set((s) => ({ scenarios: s.scenarios.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteScenario: async (id) => {
    const db = getDB();
    await db.scenarios.delete(id);
    set((s) => ({ scenarios: s.scenarios.filter((r) => r.id !== id) }));
  },

  // Cost Category
  addCostCategory: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `cc-${generateId()}`, isActive: true };
    await db.costCategories.add(record as any);
    set((s) => ({ costCategories: [...s.costCategories, record] }));
    return record;
  },
  updateCostCategory: async (id, data) => {
    const db = getDB();
    await db.costCategories.update(id, data);
    set((s) => ({ costCategories: s.costCategories.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteCostCategory: async (id) => {
    const db = getDB();
    await db.costCategories.delete(id);
    set((s) => ({ costCategories: s.costCategories.filter((r) => r.id !== id) }));
  },

  // Cost Centre Class
  addCostCentreClass: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ccc-${generateId()}`, isActive: true };
    await db.costCentreClasses.add(record as any);
    set((s) => ({ costCentreClasses: [...s.costCentreClasses, record] }));
    return record;
  },
  updateCostCentreClass: async (id, data) => {
    const db = getDB();
    await db.costCentreClasses.update(id, data);
    set((s) => ({ costCentreClasses: s.costCentreClasses.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteCostCentreClass: async (id) => {
    const db = getDB();
    await db.costCentreClasses.delete(id);
    set((s) => ({ costCentreClasses: s.costCentreClasses.filter((r) => r.id !== id) }));
  },

  // Reorder Level
  addReorderLevel: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `rl-${generateId()}`, isActive: true };
    await db.reorderLevels.add(record as any);
    set((s) => ({ reorderLevels: [...s.reorderLevels, record] }));
    return record;
  },
  updateReorderLevel: async (id, data) => {
    const db = getDB();
    await db.reorderLevels.update(id, data);
    set((s) => ({ reorderLevels: s.reorderLevels.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteReorderLevel: async (id) => {
    const db = getDB();
    await db.reorderLevels.delete(id);
    set((s) => ({ reorderLevels: s.reorderLevels.filter((r) => r.id !== id) }));
  },

  // Price Level
  addPriceLevel: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `pl-${generateId()}`, isActive: true };
    await db.priceLevels.add(record as any);
    set((s) => ({ priceLevels: [...s.priceLevels, record] }));
    return record;
  },
  updatePriceLevel: async (id, data) => {
    const db = getDB();
    await db.priceLevels.update(id, data);
    set((s) => ({ priceLevels: s.priceLevels.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePriceLevel: async (id) => {
    const db = getDB();
    await db.priceLevels.delete(id);
    set((s) => ({ priceLevels: s.priceLevels.filter((r) => r.id !== id) }));
  },

  // Price List
  addPriceList: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `plist-${generateId()}`, isActive: true };
    await db.priceLists.add(record as any);
    set((s) => ({ priceLists: [...s.priceLists, record] }));
    return record;
  },
  updatePriceList: async (id, data) => {
    const db = getDB();
    await db.priceLists.update(id, data);
    set((s) => ({ priceLists: s.priceLists.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePriceList: async (id) => {
    const db = getDB();
    await db.priceLists.delete(id);
    set((s) => ({ priceLists: s.priceLists.filter((r) => r.id !== id) }));
  },

  // HS Code
  addHSCode: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `hsc-${generateId()}`, isActive: true };
    await db.hsCodes.add(record as any);
    set((s) => ({ hsCodes: [...s.hsCodes, record] }));
    return record;
  },
  updateHSCode: async (id, data) => {
    const db = getDB();
    await db.hsCodes.update(id, data);
    set((s) => ({ hsCodes: s.hsCodes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteHSCode: async (id) => {
    const db = getDB();
    await db.hsCodes.delete(id);
    set((s) => ({ hsCodes: s.hsCodes.filter((r) => r.id !== id) }));
  },

  // Batch
  addBatch: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `bat-${generateId()}`, isActive: true };
    await db.batches.add(record as any);
    set((s) => ({ batches: [...s.batches, record] }));
    return record;
  },
  updateBatch: async (id, data) => {
    const db = getDB();
    await db.batches.update(id, data);
    set((s) => ({ batches: s.batches.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteBatch: async (id) => {
    const db = getDB();
    await db.batches.delete(id);
    set((s) => ({ batches: s.batches.filter((r) => r.id !== id) }));
  },

  // VAT Classification
  addVATClassification: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `vc-${generateId()}`, isActive: true };
    await db.vatClassifications.add(record as any);
    set((s) => ({ vatClassifications: [...s.vatClassifications, record] }));
    return record;
  },
  updateVATClassification: async (id, data) => {
    const db = getDB();
    await db.vatClassifications.update(id, data);
    set((s) => ({ vatClassifications: s.vatClassifications.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteVATClassification: async (id) => {
    const db = getDB();
    await db.vatClassifications.delete(id);
    set((s) => ({ vatClassifications: s.vatClassifications.filter((r) => r.id !== id) }));
  },

  // TDS Nature of Payment
  addTDSNatureOfPayment: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `tds-${generateId()}`, isActive: true };
    await db.tdsNatureOfPayment.add(record as any);
    set((s) => ({ tdsNatureOfPayment: [...s.tdsNatureOfPayment, record] }));
    return record;
  },
  updateTDSNatureOfPayment: async (id, data) => {
    const db = getDB();
    await db.tdsNatureOfPayment.update(id, data);
    set((s) => ({ tdsNatureOfPayment: s.tdsNatureOfPayment.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteTDSNatureOfPayment: async (id) => {
    const db = getDB();
    await db.tdsNatureOfPayment.delete(id);
    set((s) => ({ tdsNatureOfPayment: s.tdsNatureOfPayment.filter((r) => r.id !== id) }));
  },

  // Employee Group
  addEmployeeGroup: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `eg-${generateId()}`, isActive: true };
    await db.employeeGroups.add(record as any);
    set((s) => ({ employeeGroups: [...s.employeeGroups, record] }));
    return record;
  },
  updateEmployeeGroup: async (id, data) => {
    const db = getDB();
    await db.employeeGroups.update(id, data);
    set((s) => ({ employeeGroups: s.employeeGroups.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteEmployeeGroup: async (id) => {
    const db = getDB();
    await db.employeeGroups.delete(id);
    set((s) => ({ employeeGroups: s.employeeGroups.filter((r) => r.id !== id) }));
  },

  // Pay Head
  addPayHead: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ph-${generateId()}`, isActive: true };
    await db.payHeads.add(record as any);
    set((s) => ({ payHeads: [...s.payHeads, record] }));
    return record;
  },
  updatePayHead: async (id, data) => {
    const db = getDB();
    await db.payHeads.update(id, data);
    set((s) => ({ payHeads: s.payHeads.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePayHead: async (id) => {
    const db = getDB();
    await db.payHeads.delete(id);
    set((s) => ({ payHeads: s.payHeads.filter((r) => r.id !== id) }));
  },

  // Salary Detail
  addSalaryDetail: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `sd-${generateId()}`, isActive: true };
    await db.salaryDetails.add(record as any);
    set((s) => ({ salaryDetails: [...s.salaryDetails, record] }));
    return record;
  },
  updateSalaryDetail: async (id, data) => {
    const db = getDB();
    await db.salaryDetails.update(id, data);
    set((s) => ({ salaryDetails: s.salaryDetails.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteSalaryDetail: async (id) => {
    const db = getDB();
    await db.salaryDetails.delete(id);
    set((s) => ({ salaryDetails: s.salaryDetails.filter((r) => r.id !== id) }));
  },

  // Payroll Unit
  addPayrollUnit: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `pu-${generateId()}`, isActive: true };
    await db.payrollUnits.add(record as any);
    set((s) => ({ payrollUnits: [...s.payrollUnits, record] }));
    return record;
  },
  updatePayrollUnit: async (id, data) => {
    const db = getDB();
    await db.payrollUnits.update(id, data);
    set((s) => ({ payrollUnits: s.payrollUnits.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePayrollUnit: async (id) => {
    const db = getDB();
    await db.payrollUnits.delete(id);
    set((s) => ({ payrollUnits: s.payrollUnits.filter((r) => r.id !== id) }));
  },

  // Attendance Type
  addAttendanceType: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `at-${generateId()}`, isActive: true };
    await db.attendanceTypes.add(record as any);
    set((s) => ({ attendanceTypes: [...s.attendanceTypes, record] }));
    return record;
  },
  updateAttendanceType: async (id, data) => {
    const db = getDB();
    await db.attendanceTypes.update(id, data);
    set((s) => ({ attendanceTypes: s.attendanceTypes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteAttendanceType: async (id) => {
    const db = getDB();
    await db.attendanceTypes.delete(id);
    set((s) => ({ attendanceTypes: s.attendanceTypes.filter((r) => r.id !== id) }));
  },

  // Ledger Extension
  upsertLedgerExtension: async (id, data) => {
    const db = getDB();
    const existing = await db.ledgerExtensions.get(id);
    if (existing) {
      await db.ledgerExtensions.update(id, data);
    } else {
      await db.ledgerExtensions.add({ id, ...data } as any);
    }
    set((s) => {
      const exists = s.ledgerExtensions.find((e: any) => e.id === id);
      if (exists) {
        return { ledgerExtensions: s.ledgerExtensions.map((e: any) => e.id === id ? { ...e, ...data } : e) };
      }
      return { ledgerExtensions: [...s.ledgerExtensions, { id, ...data }] };
    });
  },
  getLedgerExtension: async (id) => {
    const db = getDB();
    return await db.ledgerExtensions.get(id);
  },

  // ── TDS ──────────────────────────────────────────────────────────────────────
  addTdsEntry: async (entry) => {
    const db = getDB();
    const id = entry.id || generateId();
    const record = { ...entry, id };
    await db.tdsEntries.add(record as any);
    set((s) => ({ tdsEntries: [record, ...s.tdsEntries] }));
    return record;
  },

  updateTdsEntry: async (id, updates) => {
    const db = getDB();
    await db.tdsEntries.update(id, updates);
    set((s) => ({
      tdsEntries: s.tdsEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  // ── Vouchers ─────────────────────────────────────────────────────────────
  addVoucher: async (voucher) => {
    const db = getDB();
    const id = generateId();
    const voucherNo = await generateNextVoucherNo(voucher.type || "journal", db);
    const totalDebit = (voucher.lines || []).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
    const totalCredit = (voucher.lines || []).reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
    // Bug 26 fix: Validate double-entry balance before saving
    const difference = Math.abs(totalDebit - totalCredit);
    if (difference > 0.01 && voucher.status === "posted") {
      throw new Error(
        `Voucher is unbalanced: Debit (${totalDebit.toFixed(2)}) ≠ Credit (${totalCredit.toFixed(2)}). Difference: ${difference.toFixed(2)}`
      );
    }
    const newVoucher = {
      ...voucher,
      id,
      voucherNo,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      grandTotal: Math.round(totalDebit * 100) / 100,
    };
    await db.vouchers.add(newVoucher as any);
    // Update account balances if posted
    if (newVoucher.status === "posted" && newVoucher.lines) {
      for (const line of newVoucher.lines) {
        if (line.accountId) {
          await db.accounts.where("id").equals(line.accountId).modify((acc) => {
            acc.balance = (acc.balance || 0) + (line.debit || 0) - (line.credit || 0);
          });
        }
      }
      await reloadAccounts(db, set);
    }
    set((s) => ({ vouchers: [newVoucher, ...s.vouchers] }));
    return newVoucher;
  },

  updateVoucher: async (id, updates) => {
    const db = getDB();
    await db.vouchers.update(id, updates);
    set((s) => ({
      vouchers: s.vouchers.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    }));
  },

  cancelVoucher: async (id, reason) => {
    const db = getDB();
    const voucher = await db.vouchers.get(id);
    if (!voucher) throw new Error("Voucher not found");
    await db.vouchers.update(id, { status: "cancelled", cancellationReason: reason });
    // Reverse account balances
    if (voucher.lines && voucher.status === "posted") {
      for (const line of voucher.lines) {
        if (line.accountId) {
          await db.accounts.where("id").equals(line.accountId).modify((acc) => {
            acc.balance = (acc.balance || 0) - (line.debit || 0) + (line.credit || 0);
          });
        }
      }
      await reloadAccounts(db, set);
    }
    set((s) => ({
      vouchers: s.vouchers.map((v) =>
        v.id === id ? { ...v, status: "cancelled", cancellationReason: reason } : v
      ),
    }));
  },

  // ── Invoices ─────────────────────────────────────────────────────────────
  addInvoice: async (invoice) => {
    const db = getDB();
    const id = generateId();
    const invoiceNo = await generateNextInvoiceNo(invoice.type || "sales-invoice", db);
    const newInvoice = { ...invoice, id, invoiceNo };
    await db.invoices.add(newInvoice as any);
    // Auto-post journal if posted
    if (newInvoice.status === "posted") {
      await postInvoiceJournal(newInvoice, db, get, set);
      // Stock movements for inventory items
      await postInvoiceStock(newInvoice, db, get, set);
    }
    set((s) => ({ invoices: [newInvoice, ...s.invoices] }));
    return newInvoice;
  },

  updateInvoice: async (id, updates) => {
    const db = getDB();
    await db.invoices.update(id, updates);
    set((s) => ({
      invoices: s.invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)),
    }));
  },

  cancelInvoice: async (id, reason) => {
    const db = getDB();
    const invoice = await db.invoices.get(id);
    if (!invoice) throw new Error("Invoice not found");
    await db.invoices.update(id, {
      status: "cancelled",
      cancellationReason: reason,
      paymentStatus: "cancelled",
    });
    // Reverse stock movements
    const movements = await db.stockMovements.where("referenceId").equals(id).toArray();
    for (const mov of movements) {
      await db.stockMovements.update(mov.id, { qty: -mov.qty, amount: -mov.amount });
    }
    const updatedMovements = await db.stockMovements.toArray();
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id
          ? { ...inv, status: "cancelled", cancellationReason: reason, paymentStatus: "cancelled" }
          : inv
      ),
      stockMovements: updatedMovements,
    }));
  },

  // ── Delivery / GRN ────────────────────────────────────────────────────────
  addDeliveryChallan: async (challan) => {
    const db = getDB();
    const id = generateId();
    const count = await db.deliveryChallans.count();
    const challanNo = `DC-${String(count + 1).padStart(4, "0")}`;
    const newChallan = { ...challan, id, challanNo };
    await db.deliveryChallans.add(newChallan as any);
    set((s) => ({ deliveryChallans: [...s.deliveryChallans, newChallan] }));
    return newChallan;
  },

  addGoodsReceiptNote: async (grn) => {
    const db = getDB();
    const id = generateId();
    const count = await db.goodsReceiptNotes.count();
    const grnNo = `GRN-${String(count + 1).padStart(4, "0")}`;
    const newGrn = { ...grn, id, grnNo };
    await db.goodsReceiptNotes.add(newGrn as any);
    set((s) => ({ goodsReceiptNotes: [...s.goodsReceiptNotes, newGrn] }));
    return newGrn;
  },

  // ── Company ───────────────────────────────────────────────────────────────
  updateCompanySettings: async (settings) => {
    const db = getDB();
    const existing = await db.companySettings.get("main");
    const updated = { ...(existing || {}), ...settings, id: "main" };
    await db.companySettings.put(updated as any);
    set({ companySettings: updated as CompanySettings });
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  addUser: async (user) => {
    const db = getDB();
    const id = user.id || generateId();
    const hash = await hashPassword((user as any).password || "changeme");
    const newUser = { ...user, id, passwordHash: hash, isActive: true };
    await db.users.add(newUser as any);
    set((s) => ({ users: [...s.users, newUser as StoreUser] }));
    return newUser;
  },

  updateUser: async (id, updates) => {
    const db = getDB();
    if ((updates as any).password) {
      (updates as any).passwordHash = await hashPassword((updates as any).password);
      delete (updates as any).password;
    }
    await db.users.update(id, updates);
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }));
  },

  deleteUser: async (id) => {
    const db = getDB();
    await db.users.delete(id);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
  },

  checkPermission: (permission) => {
    const { currentUser } = get();
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    const perms: string[] = (currentUser as any).permissions || [];
    return perms.includes(permission);
  },

  // ── Recurring Vouchers ─────────────────────────────────────────────────────
  addRecurringVoucher: async (data) => {
    const db = getDB();
    const record = {
      ...data,
      id: data.id || `rv-${generateId()}`,
      completedOccurrences: 0,
      generatedVoucherIds: [],
      isActive: true,
    };
    await db.recurringVouchers.add(record as any);
    set((s) => ({ recurringVouchers: [...s.recurringVouchers, record] }));
    return record;
  },

  updateRecurringVoucher: async (id, data) => {
    const db = getDB();
    await db.recurringVouchers.update(id, data);
    set((s) => ({
      recurringVouchers: s.recurringVouchers.map((r) => (r.id === id ? { ...r, ...data } : r)),
    }));
  },

  deleteRecurringVoucher: async (id) => {
    const db = getDB();
    await db.recurringVouchers.delete(id);
    set((s) => ({ recurringVouchers: s.recurringVouchers.filter((r) => r.id !== id) }));
  },

  runRecurringVoucher: async (id) => {
    const { recurringVouchers, addVoucher } = get();
    const rv = recurringVouchers.find((r) => r.id === id);
    if (!rv || !rv.isActive) return;

    // Clone the template voucher
    const db = getDB();
    const template = await db.vouchers.get(rv.templateVoucherId);
    if (!template) {
      console.warn("[RecurringVoucher] Template not found:", rv.templateVoucherId);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const newVoucher = await addVoucher({
      ...template,
      id: undefined,
      voucherNo: undefined,
      date: today,
      status: rv.autoPost ? "posted" : "draft",
      narration: `[Auto] ${template.narration || rv.name}`,
    } as any);

    await get().updateRecurringVoucher(id, {
      lastGeneratedDate: today,
      completedOccurrences: (rv.completedOccurrences || 0) + 1,
      generatedVoucherIds: [...(rv.generatedVoucherIds || []), newVoucher?.id].filter(Boolean),
    });
  },

  // ── Bank Reconciliation ────────────────────────────────────────────────────
  importBankStatements: async (bankAccountId, rows) => {
    const db = getDB();
    const records = rows.map((row: any) => ({
      id: row.id || `bs-${generateId()}`,
      bankAccountId,
      date: row.date || "",
      description: row.description || "",
      debit: row.debit || 0,
      credit: row.credit || 0,
      balance: row.balance || 0,
      reference: row.reference,
      reconciled: false,
    }));
    await db.bankStatements.bulkAdd(records as any);
    set((s) => ({ bankStatements: [...s.bankStatements, ...records] }));
  },

  updateBankStatements: async (updates) => {
    const db = getDB();
    for (const upd of updates) {
      if (upd.id) {
        await db.bankStatements.update(upd.id, upd);
      }
    }
    set((s) => ({
      bankStatements: s.bankStatements.map((bs) => {
        const upd = updates.find((u: any) => u.id === bs.id);
        return upd ? { ...bs, ...upd } : bs;
      }),
    }));
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  markNotificationRead: (id) => {
    const db = getDB();
    db.notifications.update(id, { read: true }).catch(() => {});
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  clearNotifications: () => {
    const db = getDB();
    db.notifications.clear().catch(() => {});
    set({ notifications: [] });
  },

  addNotification: (message, type = "info") => {
    const db = getDB();
    const id = generateId();
    const notification: Notification = {
      id,
      message,
      read: false,
      timestamp: new Date().toISOString(),
      type,
    };
    db.notifications.add(notification as any).catch(() => {});
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
    }));
  },

  setCurrentFiscalYear: (fy) => set({ currentFiscalYear: fy }),

  resetAllData: async () => {
    const db = getDB();
    await Promise.all([
      db.accounts.clear(),
      db.parties.clear(),
      db.items.clear(),
      db.vouchers.clear(),
      db.invoices.clear(),
      db.stockMovements.clear(),
      db.warehouses.clear(),
      db.units.clear(),
      db.costCenters.clear(),
      db.fiscalYears.clear(),
      db.deliveryChallans.clear(),
      db.goodsReceiptNotes.clear(),
      db.salesOrders.clear(),
      db.purchaseOrders.clear(),
      db.notifications.clear(),
      db.budgets.clear(),
      db.recurringVouchers.clear(),
      db.companySettings.clear(),
    ]);
    set({
      accounts: [], parties: [], items: [], vouchers: [], invoices: [],
      stockMovements: [], warehouses: [], units: [], costCenters: [],
      fiscalYears: [], currentFiscalYear: null, deliveryChallans: [],
      goodsReceiptNotes: [], salesOrders: [], purchaseOrders: [],
      notifications: [], budgets: [], recurringVouchers: [],
      companySettings: null, isDbReady: false,
    });
    await get().initializeApp();
  },

  getBaseCurrency: () => {
    const { currencies } = get();
    return currencies.find((c) => c.isBase) || currencies[0] || DEFAULT_CURRENCY;
  },
}));

// ─── Private helpers (not on store) ───────────────────────────────────────────
async function generateNextVoucherNo(type: string, db: ReturnType<typeof getDB>): Promise<string> {
  const prefixes: Record<string, string> = {
    journal: "JV", payment: "PV", receipt: "RV", contra: "CV",
    "sales-invoice": "SI", "purchase-invoice": "PI",
    "sales-return": "SR", "purchase-return": "PR",
  };
  const prefix = prefixes[type] || "VCH";
  const count = await db.vouchers.where("type").equals(type).count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function generateNextInvoiceNo(type: string, db: ReturnType<typeof getDB>): Promise<string> {
  const prefixes: Record<string, string> = {
    "sales-invoice": "SI", "purchase-invoice": "PI",
    "sales-return": "SR", "purchase-return": "PR",
  };
  const prefix = prefixes[type] || "INV";
  const count = await db.invoices.where("type").equals(type).count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function reloadAccounts(db: ReturnType<typeof getDB>, set: any) {
  const accounts = await db.accounts.toArray();
  set({ accounts });
}

async function postInvoiceJournal(invoice: any, db: ReturnType<typeof getDB>, get: any, set: any) {
  // Build journal lines for the invoice
  const lines: any[] = [];
  const partyAccountId = invoice.type === "sales-invoice" || invoice.type === "sales-return"
    ? "acc-sundry-debtors"
    : "acc-sundry-creditors";

  if (invoice.type === "sales-invoice") {
    lines.push({ accountId: partyAccountId, accountName: invoice.partyName, debit: invoice.grandTotal, credit: 0 });
    if ((invoice.taxableAmount || 0) > 0) lines.push({ accountId: "acc-sales", accountName: "Sales", debit: 0, credit: invoice.taxableAmount });
    if ((invoice.exemptAmount || 0) > 0) lines.push({ accountId: "acc-sales", accountName: "Sales (Exempt)", debit: 0, credit: invoice.exemptAmount });
    if ((invoice.vatAmount || 0) > 0) lines.push({ accountId: "acc-vat-payable", accountName: "VAT Payable", debit: 0, credit: invoice.vatAmount });
  } else if (invoice.type === "purchase-invoice") {
    if ((invoice.taxableAmount || 0) > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchases", debit: invoice.taxableAmount, credit: 0 });
    if ((invoice.vatAmount || 0) > 0) lines.push({ accountId: "acc-vat-payable", accountName: "VAT Receivable", debit: invoice.vatAmount, credit: 0 });
    lines.push({ accountId: partyAccountId, accountName: invoice.partyName, debit: 0, credit: invoice.grandTotal });
  }

  if (lines.length === 0) return;

  const id = `jnl-${invoice.id}`;
  const voucherNo = `AUTO-${invoice.invoiceNo}`;
  await db.vouchers.add({
    id,
    voucherNo,
    date: invoice.date,
    dateNepali: invoice.dateNepali,
    type: "journal",
    narration: `Auto-journal for ${invoice.invoiceNo}`,
    lines,
    status: "posted",
    totalDebit: lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
  } as any);

  // Update account balances
  for (const line of lines) {
    await db.accounts.where("id").equals(line.accountId).modify((acc) => {
      acc.balance = (acc.balance || 0) + (line.debit || 0) - (line.credit || 0);
    });
  }
  await reloadAccounts(db, set);
}

async function postInvoiceStock(invoice: any, db: ReturnType<typeof getDB>, get: any, set: any) {
  const lines = invoice.lines || [];
  const warehouseId = get().warehouses.find((w: any) => w.isDefault)?.id || "wh-main";
  const warehouseName = get().warehouses.find((w: any) => w.isDefault)?.name || "Main Warehouse";

  for (const line of lines) {
    if (!line.itemId) continue;
    const item = get().items.find((i: any) => i.id === line.itemId);
    if (!item || item.type === "service") continue;

    const qty = invoice.type === "sales-invoice" || invoice.type === "purchase-return"
      ? -(line.qty || 0)
      : (line.qty || 0);

    const movId = `mov-${invoice.id}-${line.itemId}`;
    const movement = {
      id: movId,
      date: invoice.date,
      dateNepali: invoice.dateNepali || "",
      type: invoice.type,
      itemId: line.itemId,
      itemName: line.itemName || item.name,
      warehouseId: line.warehouseId || warehouseId,
      warehouseName,
      qty,
      rate: line.rate || 0,
      amount: (line.qty || 0) * (line.rate || 0),
      referenceId: invoice.id,
      referenceNo: invoice.invoiceNo,
      referenceType: invoice.type,
      narration: `Stock movement for ${invoice.invoiceNo}`,
    };
    await db.stockMovements.put(movement as any);
  }
  const updatedMovements = await db.stockMovements.toArray();
  set({ stockMovements: updatedMovements });
}
