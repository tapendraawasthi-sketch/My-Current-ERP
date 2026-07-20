// ─── Auth Stage Machine ────────────────────────────────────────────────────────
export type AuthStage =
  | "checking" // initializeApp() is running — show spinner
  | "error" // Fatal init failure — show InitErrorScreen (FI-022)
  | "no-company" // Dexie has zero companySettings — show SignUpWizard
  | "gateway" // Company exists, no valid session — show GatewayScreen
  | "company-login" // User picked a company, not yet logged in — show CompanyLoginScreen
  | "authenticated"; // Valid credentials entered — show full app shell

export interface InitErrorState {
  message: string;
  code?: string;
  occurredAt: string;
}

/** Application initialization lifecycle (single source of truth). */
export type InitLifecycleState =
  | "initializing"
  | "loading"
  | "ready"
  | "recoverable-error"
  | "fatal-error";

// Types-only file — no runtime imports here.
import type {
  DBSalesPerson,
  DBPriceList,
  DBFixedAsset,
  DBDepreciationEntry,
  DBSerialNumber,
  DBPDCEntry,
  DBSalaryStructure,
  DBPayrollRun,
  DBPayrollEntry,
  DBCostCentre,
  DBCostCentreAllocation,
  DBApprovalPolicy,
  DBApprovalRequest,
  DBApprovalAction,
  DBRecurringTemplate,
  DBRecurringPosting,
  DBFXGainLossEntry,
  DBAuditLog,
} from "../lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "accountant" | "viewer";

// ─── Validation Helpers ───────────────────────────────────────────────────────
const round2 = (value: number | string | null | undefined) =>
  Math.round((Number(value) || 0) * 100) / 100;

export const validateVoucherBalance = (lines: any[], isDraft = false) => {
  const totalDebit = round2((lines ?? []).reduce((sum, line) => sum + Number(line.debit || 0), 0));
  const totalCredit = round2(
    (lines ?? []).reduce((sum, line) => sum + Number(line.credit || 0), 0),
  );

  // Draft vouchers skip amount/balance checks — they are works-in-progress.
  if (!isDraft) {
    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new Error(
        `Unbalanced voucher: Debit ${totalDebit} does not equal Credit ${totalCredit}.`,
      );
    }
    if (totalDebit <= 0) {
      throw new Error("Voucher amount must be greater than zero.");
    }
  }

  return { totalDebit, totalCredit };
};

export const assertDateInFiscalYear = (date: string, fiscalYear: FiscalYear | null | undefined) => {
  if (!fiscalYear) {
    throw new Error("No active fiscal year selected.");
  }
  // Parse to Date objects to ensure reliable comparison regardless of format.
  const d = new Date(date);
  const start = new Date(fiscalYear.startDate);
  const end = new Date(fiscalYear.endDate);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  if (d < start || d > end) {
    throw new Error(`Date ${date} is outside the current fiscal year (${fiscalYear.name}).`);
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
  /** Legal entity (Sole Prop, Pvt. Ltd., …). */
  businessType?: string;
  /** Industry nature id — drives module visibility (see lib/businessNature). */
  businessNature?: string;
  enableCostCenter?: boolean;
  enableBillWiseTracking?: boolean;
  enableBillWise?: boolean;
  enableBatchTracking?: boolean;
  enableMultiCurrency?: boolean;
  /** Nature-driven: show inventory module. */
  enableInventory?: boolean;
  /** Nature-driven: show POS counter. */
  enablePOS?: boolean;
  /** Nature-driven: manufacturing / recipe production. */
  enableProduction?: boolean;
  /** Nature-driven: job-work registers. */
  enableJobWork?: boolean;
  /** Nature-driven: budget surfaces. */
  enableBudget?: boolean;
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
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  termsConditions?: string;
  invoiceFooter?: string;
  signatoryName?: string;
  logo?: string;
  systemConfiguration?: import("../lib/systemConfiguration").SystemConfiguration;
  voucherSeries?: Record<string, any>;
  lastLoginBy?: string;
  lastLoginAt?: string;
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
  {
    key_combo: "Ctrl+N",
    label: "New Voucher",
    action_type: "navigate",
    action_value: "journal",
    category: "Transactions",
    is_active: true,
  },
  {
    key_combo: "Ctrl+I",
    label: "New Invoice",
    action_type: "navigate",
    action_value: "billing",
    category: "Transactions",
    is_active: true,
  },
  {
    key_combo: "F2",
    label: "Save",
    action_type: "save",
    action_value: "save",
    category: "General",
    is_active: true,
  },
  {
    key_combo: "F5",
    label: "List View",
    action_type: "navigate",
    action_value: "vouchers",
    category: "General",
    is_active: true,
  },
  {
    key_combo: "Ctrl+/",
    label: "Search",
    action_type: "search",
    action_value: "search",
    category: "General",
    is_active: true,
  },
  {
    key_combo: "?",
    label: "Shortcuts Help",
    action_type: "help",
    action_value: "shortcuts",
    category: "General",
    is_active: true,
  },
  {
    key_combo: "Ctrl+B",
    label: "Balance Sheet",
    action_type: "report",
    action_value: "balance-sheet",
    category: "Reports",
    is_active: true,
  },
  {
    key_combo: "Ctrl+T",
    label: "Trial Balance",
    action_type: "report",
    action_value: "trial-balance",
    category: "Reports",
    is_active: true,
  },
];

export const DEFAULT_ACCOUNTS = [
  // Assets
  {
    id: "grp-assets",
    code: "1000",
    name: "Assets",
    type: "asset",
    level: "group",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "grp-current-assets",
    code: "1100",
    name: "Current Assets",
    type: "asset",
    level: "subgroup",
    parentId: "grp-assets",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "grp-bank-accounts",
    code: "1100",
    name: "Bank Accounts",
    type: "asset",
    level: "subgroup",
    parentId: "grp-current-assets",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "grp-sundry-debtors",
    code: "1200",
    name: "Sundry Debtors",
    type: "asset",
    level: "subgroup",
    parentId: "grp-current-assets",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "acc-cash",
    code: "1101",
    name: "Cash in Hand",
    type: "asset",
    level: "ledger",
    parentId: "grp-current-assets",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
    group: "Current Assets",
  },
  {
    id: "acc-sundry-debtors",
    code: "1201",
    name: "Sundry Debtors",
    type: "asset",
    level: "ledger",
    parentId: "grp-sundry-debtors",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  // Liabilities
  {
    id: "grp-liabilities",
    code: "2000",
    name: "Liabilities",
    type: "liability",
    level: "group",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "grp-current-liabilities",
    code: "2100",
    name: "Current Liabilities",
    type: "liability",
    level: "subgroup",
    parentId: "grp-liabilities",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "grp-sundry-creditors",
    code: "2100",
    name: "Sundry Creditors",
    type: "liability",
    level: "subgroup",
    parentId: "grp-current-liabilities",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "acc-sundry-creditors",
    code: "2101",
    name: "Sundry Creditors",
    type: "liability",
    level: "ledger",
    parentId: "grp-sundry-creditors",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-vat-payable",
    code: "2201",
    name: "VAT Payable",
    type: "liability",
    level: "ledger",
    parentId: "grp-current-liabilities",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-vat-receivable",
    code: "1301",
    name: "VAT Receivable (Input Tax)",
    type: "asset",
    level: "ledger",
    parentId: "grp-current-assets",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-tds-payable",
    code: "2202",
    name: "TDS Payable",
    type: "liability",
    level: "ledger",
    parentId: "grp-current-liabilities",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-tds-receivable",
    code: "1302",
    name: "TDS Receivable",
    type: "asset",
    level: "ledger",
    parentId: "grp-current-assets",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  // Equity
  {
    id: "grp-equity",
    code: "3000",
    name: "Equity",
    type: "equity",
    level: "group",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-capital",
    code: "3001",
    name: "Capital Account",
    type: "equity",
    level: "ledger",
    parentId: "grp-equity",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-retained",
    code: "3002",
    name: "Retained Earnings",
    type: "equity",
    level: "ledger",
    parentId: "grp-equity",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  // Income
  {
    id: "grp-income",
    code: "4000",
    name: "Income",
    type: "income",
    level: "group",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "grp-sales",
    code: "4100",
    name: "Sales Accounts",
    type: "income",
    level: "subgroup",
    parentId: "grp-income",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "acc-sales",
    code: "4101",
    name: "Sales",
    type: "income",
    level: "ledger",
    parentId: "grp-sales",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-sales-return",
    code: "4102",
    name: "Sales Return",
    type: "income",
    level: "ledger",
    parentId: "grp-sales",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  // Expenses
  {
    id: "grp-expenses",
    code: "5000",
    name: "Expenses",
    type: "expense",
    level: "group",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "grp-purchase",
    code: "5100",
    name: "Purchase Accounts",
    type: "expense",
    level: "subgroup",
    parentId: "grp-expenses",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
  {
    id: "acc-purchase",
    code: "5101",
    name: "Purchases",
    type: "expense",
    level: "ledger",
    parentId: "grp-purchase",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-purchase-return",
    code: "5102",
    name: "Purchase Return",
    type: "expense",
    level: "ledger",
    parentId: "grp-purchase",
    isGroup: false,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
    isSystemAccount: true,
  },
  {
    id: "acc-indirect-expenses",
    code: "5200",
    name: "Indirect Expenses",
    type: "expense",
    level: "subgroup",
    parentId: "grp-expenses",
    isGroup: true,
    isActive: true,
    balance: 0,
    openingBalance: 0,
    openingBalanceDr: 0,
    openingBalanceCr: 0,
  },
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
import type { DBWarehouse, DBStockMovement, DBStockTransferVoucher } from "../lib/db";

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
    >,
  ) => Promise<DBStockTransferVoucher>;
}
export interface AppState extends MultiGodownStoreSlice {
  pdcRegister: DBPDCEntry[];
  salaryStructures: DBSalaryStructure[];
  payrollRuns: DBPayrollRun[];
  payrollEntries: DBPayrollEntry[];
  fxGainLossEntries: DBFXGainLossEntry[];
  costCentres: DBCostCentre[];
  costCentreAllocations: DBCostCentreAllocation[];
  approvalPolicies: DBApprovalPolicy[];
  approvalRequests: DBApprovalRequest[];
  approvalActions: DBApprovalAction[];
  recurringPostings: DBRecurringPosting[];
  recurringTemplates: DBRecurringTemplate[];
  fixedAssets: DBFixedAsset[];
  depreciationLedger: DBDepreciationEntry[];
  serialNumbers: DBSerialNumber[];
  // DB
  isDbReady: boolean;
  auditLogs: DBAuditLog[];
  loadAuditLogs: () => Promise<void>;
  isInitializing: boolean;
  initLifecycle: InitLifecycleState;
  initError: InitErrorState | null;
  dataLoadWarning: string | null;
  // Auth Stage Machine
  authStage: AuthStage;
  selectedCompanyId: string | null;
  lastLoginInfo: { username: string; loginAt: string } | null;
  loginFailedAttempts: number;
  // Auth (legacy fields kept for backward compat)
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
  postStockJournal: (id: string) => Promise<void>;
  postProduction: (id: string) => Promise<void>;
  postUnassemble: (id: string) => Promise<void>;
  postMaterialIssued: (id: string) => Promise<void>;
  postMaterialReceived: (id: string) => Promise<void>;
  postPhysicalStock: (id: string) => Promise<void>;
  postRejectionStock: (voucherId: string) => Promise<void>;
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
  retryInitializeApp: () => Promise<void>;
  clearDatabaseAndRetryInit: () => Promise<void>;
  dismissDataLoadWarning: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  createCompanyAndAdmin: (data: {
    company: Partial<CompanySettings>;
    adminUser: Partial<StoreUser>;
  }) => Promise<void>;
  selectCompanyForLogin: (companyId: string) => void;
  backToGateway: () => void;
  setAuthStage: (stage: AuthStage) => void;
  _loadAllData: () => Promise<void>;
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
  updateItem: (item: any) => Promise<any>;
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
  addAuditLog: (params: {
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: unknown;
    after?: unknown;
  }) => Promise<void>;
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

// ─── Pure-JS SHA-256 (no dependency on crypto.subtle, works on HTTP) ──────────
// Used as a deterministic fallback when crypto.subtle is unavailable.
function _sha256Hex(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
  }
  function rotr(n: number, x: number): number {
    return (x >>> n) | (x << (32 - n));
  }

  // UTF-8 encode the message
  const msgBytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 0x80) {
      msgBytes.push(c);
    } else if (c < 0x800) {
      msgBytes.push((c >> 6) | 0xc0, (c & 0x3f) | 0x80);
    } else {
      msgBytes.push((c >> 12) | 0xe0, ((c >> 6) & 0x3f) | 0x80, (c & 0x3f) | 0x80);
    }
  }

  // SHA-256 padding
  const bitLen = msgBytes.length * 8;
  msgBytes.push(0x80);
  while (msgBytes.length % 64 !== 56) msgBytes.push(0);
  // Append big-endian 64-bit bit length
  for (let i = 7; i >= 0; i--) msgBytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  for (let i = 0; i < msgBytes.length; i += 64) {
    const w: number[] = new Array(64);
    for (let j = 0; j < 16; j++) {
      w[j] =
        ((msgBytes[i + j * 4] << 24) |
          (msgBytes[i + j * 4 + 1] << 16) |
          (msgBytes[i + j * 4 + 2] << 8) |
          msgBytes[i + j * 4 + 3]) >>>
        0;
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = safeAdd(safeAdd(w[j - 16], s0), safeAdd(w[j - 7], s1));
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = safeAdd(safeAdd(h, S1), safeAdd(ch, safeAdd(K[j], w[j])));
      const S0 = rotr(2, a) ^ rotr(9, a) ^ rotr(13, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = safeAdd(S0, maj);
      h = g;
      g = f;
      f = e;
      e = safeAdd(d, temp1);
      d = c;
      c = b;
      b = a;
      a = safeAdd(temp1, temp2);
    }
    h0 = safeAdd(h0, a);
    h1 = safeAdd(h1, b);
    h2 = safeAdd(h2, c);
    h3 = safeAdd(h3, d);
    h4 = safeAdd(h4, e);
    h5 = safeAdd(h5, f);
    h6 = safeAdd(h6, g);
    h7 = safeAdd(h7, h);
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => (v >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

// Salt constants — v1 is the legacy PBKDF2 salt, v2 is the new unified salt
const SALT_V1 = "sutra-erp-salt-v1"; // old PBKDF2 — kept for verifyPassword backwards compat
const SALT_V2 = "sutra-erp-salt-v2"; // new hashes (both PBKDF2 v2 and SHA-256 v1)

/**
 * Hash a password.
 * - On HTTPS / localhost (crypto.subtle available): PBKDF2-SHA256, prefix "pbkdf2v2_"
 * - On plain HTTP (crypto.subtle unavailable):      pure-JS SHA-256, prefix "sha256v1_"
 *
 * Both formats are stable and deterministic — the same password always produces
 * the same hash in the same environment, so login works correctly on any protocol.
 */
export async function hashPassword(password: string): Promise<string> {
  if (crypto && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
      );
      const hashBuffer = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(SALT_V2), iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        256,
      );
      return (
        "pbkdf2v2_" +
        Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      );
    } catch {
      // crypto.subtle threw (rare, e.g. iframe sandbox) — fall through to pure-JS
    }
  }
  // Pure-JS path — identical result every time regardless of HTTP/HTTPS
  return "sha256v1_" + _sha256Hex(SALT_V2 + ":" + password);
}

/**
 * Verify a password against a stored hash.
 * Handles all legacy formats transparently:
 *   - ""              (no hash)     → allow "admin123" only
 *   - "fallback_XXX"  (old HTTP)    → compare fallback_password
 *   - 64-char hex     (old PBKDF2 v1, HTTPS-only) → recompute with old salt
 *   - "pbkdf2v2_…"   (new PBKDF2)  → recompute with new salt
 *   - "sha256v1_…"   (new HTTP)    → pure-JS SHA-256 compare
 *   - plain text      (very old dev seeds) → direct compare
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // ── No hash stored ────────────────────────────────────────────────────────
  if (!hash) return password === "admin123";

  // ── Legacy fallback_ (HTTP first-boot, old format) ────────────────────────
  if (hash.startsWith("fallback_")) {
    return hash === `fallback_${password}`;
  }

  // ── New PBKDF2 v2 ─────────────────────────────────────────────────────────
  if (hash.startsWith("pbkdf2v2_")) {
    if (!crypto?.subtle) {
      // Can't recompute PBKDF2 without crypto.subtle.
      // Try the pure-JS path with the same password — if it matches a sha256v1_
      // hash this wouldn't apply, so we must allow the default password as
      // an emergency recovery mechanism for HTTP deployments.
      // (The hash will be replaced with a sha256v1_ hash on next login.)
      if (password === "admin123") return true;
      // For non-default passwords, try sha256v1 equivalent stored as pbkdf2v2
      // — this can't match, so return false. User must access via HTTPS.
      return false;
    }
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
      );
      const hashBuffer = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(SALT_V2), iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        256,
      );
      const computed =
        "pbkdf2v2_" +
        Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      return computed === hash;
    } catch {
      return false;
    }
  }

  // ── New SHA-256 v1 (HTTP-safe) ────────────────────────────────────────────
  if (hash.startsWith("sha256v1_")) {
    return hash === "sha256v1_" + _sha256Hex(SALT_V2 + ":" + password);
  }

  // ── Legacy PBKDF2 v1 (64-char hex, no prefix, created with old salt) ──────
  if (/^[0-9a-f]{64}$/.test(hash)) {
    if (!crypto?.subtle) {
      // Emergency fallback: allow default admin password on HTTP
      // so admin can log in and the hash gets upgraded on next HTTPS visit.
      if (password === "admin123") return true;
      return false;
    }
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
      );
      const hashBuffer = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(SALT_V1), iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        256,
      );
      const computed = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return computed === hash;
    } catch {
      return false;
    }
  }

  // ── Last resort: hash the password and compare ────────────────────────────
  // NOTE: Plain-text comparison removed — it was a security bypass.
  // If none of the known hash formats matched, deny access.
  return false;
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
