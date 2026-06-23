export enum AccountType {
  ASSET = "asset",
  LIABILITY = "liability",
  EQUITY = "equity",
  INCOME = "income",
  EXPENSE = "expense",
}

export enum AccountLevel {
  GROUP = "group",
  SUBGROUP = "subgroup",
  LEDGER = "ledger",
  SUBLEDGER = "subledger",
}

export enum VoucherStatus {
  DRAFT = "draft",
  POSTED = "posted",
  CANCELLED = "cancelled",
}

export enum VoucherType {
  JOURNAL = "journal",
  PAYMENT = "payment",
  RECEIPT = "receipt",
  CONTRA = "contra",
  SALES_INVOICE = "sales-invoice",
  PURCHASE_INVOICE = "purchase-invoice",
  SALES_RETURN = "sales-return",
  PURCHASE_RETURN = "purchase-return",
  DEBIT_NOTE = "debit-note",
  CREDIT_NOTE = "credit-note",
  STOCK_JOURNAL = "stock-journal",
  OPENING_BALANCE = "opening-balance",
}

export enum PartyType {
  CUSTOMER = "customer",
  SUPPLIER = "supplier",
  BOTH = "both",
}

export enum ItemType {
  PRODUCT = "product",
  SERVICE = "service",
}

export enum PaymentMode {
  CASH = "cash",
  BANK = "bank",
  BANK_TRANSFER = "bank",
  CREDIT = "credit",
}

export enum PaymentStatus {
  PAID = "paid",
  UNPAID = "unpaid",
  PARTIAL = "partial",
}

export enum UserRole {
  ADMIN = "admin",
  ACCOUNTANT = "accountant",
  VIEWER = "viewer",
  MANAGER = "manager",
}

export enum DateFormat {
  BS = "BS",
  AD = "AD",
}

export enum StockValuationMethod {
  FIFO = "fifo",
  WEIGHTED_AVERAGE = "weighted-average",
  LIFO = "lifo",
}

export enum TdsType {
  CONTRACTOR = "contractor",
  SERVICE_CONTRACT = "contractor",
  CONSULTANCY = "consultancy",
  RENT = "rent",
  HOUSE_RENT = "rent",
  SALARY = "salary",
  DIVIDEND = "dividend",
  COMMISSION = "commission",
  OTHER = "other",
  NONE = "none",
}

export enum OrderStatus {
  DRAFT = "draft",
  APPROVED = "approved",
  FULFILLED = "fulfilled",
  PARTIAL = "partial",
  CANCELLED = "cancelled",
}

export enum ChallanStatus {
  DRAFT = "draft",
  DISPATCHED = "dispatched",
  RECEIVED = "received",
  CANCELLED = "cancelled",
}

export enum ReconciliationStatus {
  UNRECONCILED = "unreconciled",
  RECONCILED = "reconciled",
  CLEARED = "cleared",
}

export enum BudgetPeriod {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
}

export enum CostCenterLevel {
  GROUP = "group",
  CENTER = "center",
}

export enum FiscalYearStatus {
  ACTIVE = "active",
  CLOSED = "closed",
  FUTURE = "future",
}

export enum MovementType {
  PURCHASE = "purchase",
  SALES = "sales",
  SALES_RETURN = "sales-return",
  PURCHASE_RETURN = "purchase-return",
  TRANSFER_IN = "transfer-in",
  TRANSFER_OUT = "transfer-out",
  OPENING = "opening",
  ADJUSTMENT = "adjustment",
}

export enum ReportPeriodPreset {
  TODAY = "today",
  WEEK = "week",
  MONTH = "month",
  QUARTER = "quarter",
  FY = "fy",
  CUSTOM = "custom",
}

export enum RecurringFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
}

export interface Account {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: AccountType;
  level: AccountLevel;
  group?: string;
  parentId?: string;
  subLedgerOf?: string;
  isSystemAccount?: boolean;
  isActive: boolean;
  isGroup: boolean;
  openingBalance?: number;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
  openingBalanceDate?: string;
  balance: number;
  costCenterId?: string;
}

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  subledgerId?: string;
  costCenterId?: string;
  billRefNo?: string;
  billDate?: string;
  isNew?: boolean;
  currencyCode?: string;
  exchangeRate?: number;
  foreignAmount?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  dateNepali: string;
  voucherNo: string;
  referenceNo?: string;
  narration: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  status: VoucherStatus;
  type: VoucherType;
  partyId?: string;
  partyName?: string;
  partyPan?: string;
  grandTotal?: number;
  createdBy?: string;
  createdAt?: string;
  postedBy?: string;
  postedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  attachments?: string[];
  isBillWise?: boolean;
  paymentModeUI?: "cash" | "bank" | "cheque";
  bankLedgerId?: string;
  chequeNo?: string;
  chequeDate?: string;
}

export interface Party {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: PartyType;
  pan?: string;
  vatNo?: string;
  phone: string;
  email?: string;
  contactPerson?: string;
  accountId: string;
  creditLimit?: number;
  creditDays?: number;
  openingBalance?: number;
  openingBalanceType?: "Dr" | "Cr";
  openingBalanceDate?: string;
  address?: string;
  addressNepali?: string;
  city?: string;
  province?: string;
  wardNo?: string;
  country?: string;
  isActive: boolean;
  tdsRate?: number;
  tdsType?: TdsType;
  subjectToTds?: boolean;
  balance?: number;
  status?: string;
  website?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankBranch?: string;
  customFields?: Record<string, string | number | boolean>;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: ItemType;
  unit?: string;
  alternateUnit?: string;
  conversionFactor?: number;
  purchaseRate: number;
  salesRate: number;
  mrp?: number;
  hsnCode?: string;
  isTaxable: boolean;
  vatRate?: number;
  minimumStock?: number;
  maximumStock?: number;
  reorderLevel?: number;
  accountId?: string;
  purchaseAccountId?: string;
  salesAccountId?: string;
  stockAccountId?: string;
  isActive: boolean;
  openingStock?: number;
  openingStockRate?: number;
  currentStock?: number;
  description?: string;
  barcode?: string;
  customFields?: Record<string, string | number | boolean>;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface InvoiceLine {
  id?: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  unit?: string;
  qty: number;
  rate: number;
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
  isTaxable?: boolean;
  vatRate?: number;
  netAmount: number;
  taxAmount?: number;
  totalAmount?: number;
  batchNo?: string;
  serialNo?: string;
  warehouseId?: string;
  warehouseFrom?: string;
  warehouseTo?: string;
  // Compatibility fields for controllers
  discount?: number;
  taxableAmount?: number;
  exemptAmount?: number;
  vatAmount?: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  type: VoucherType;
  partyId: string;
  partyName: string;
  partyPan?: string;
  partyVat?: string;
  date: string;
  dateNepali: string;
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  taxAmount: number;
  tdsAmount?: number;
  tdsRate?: number;
  tdsType?: TdsType;
  roundOff?: number;
  grandTotal: number;
  lines: InvoiceLine[];
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  bankAccountId?: string;
  chequeNo?: string;
  chequeDate?: string;
  narration: string;
  referenceNo?: string;
  status: VoucherStatus;
  journalEntryId?: string;
  additionalCharges?: any[];
  orderRef?: string;
  challanRef?: string;
  billTo?: string;
  salesmanId?: string;
  salesmanName?: string;
  createdBy?: string;
  createdAt?: string;
  cbmsRefNo?: string;
  cbmsStatus?: "pending" | "submitted" | "failed";
  dueDate?: string;
  currencyCode?: string;
  exchangeRate?: number;
  foreignAmount?: number;
  attachments?: string[];
  customFields?: Record<string, string | number | boolean>;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  date: string;
  dateNepali: string;
  partyId: string;
  partyName: string;
  expectedDeliveryDate?: string;
  lines: InvoiceLine[];
  subTotal: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  status: OrderStatus;
  narration?: string;
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  fulfilledInvoiceIds?: string[];
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  date: string;
  dateNepali: string;
  partyId: string;
  partyName: string;
  expectedDeliveryDate?: string;
  lines: InvoiceLine[];
  subTotal: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  status: OrderStatus;
  narration?: string;
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  fulfilledInvoiceIds?: string[];
}

export interface DeliveryChallan {
  id: string;
  challanNo: string;
  date: string;
  dateNepali: string;
  salesOrderId?: string;
  partyId: string;
  partyName: string;
  lines: InvoiceLine[];
  totalQty: number;
  narration?: string;
  vehicleNo?: string;
  driverName?: string;
  status: ChallanStatus;
  createdBy?: string;
  createdAt?: string;
  invoiceRef?: string;
  inventoryPosted?: boolean;
}

export interface GoodsReceiptNote {
  id: string;
  grnNo: string;
  date: string;
  dateNepali: string;
  purchaseOrderId?: string;
  partyId: string;
  partyName: string;
  lines: InvoiceLine[];
  totalQty: number;
  narration?: string;
  vehicleNo?: string;
  inspectedBy?: string;
  status: ChallanStatus;
  createdBy?: string;
  createdAt?: string;
  invoiceRef?: string;
  inventoryPosted?: boolean;
}

export interface StockMovement {
  id: string;
  date: string;
  dateNepali: string;
  type: MovementType;
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  rate: number;
  amount: number;
  referenceId?: string;
  referenceNo?: string;
  referenceType?: string;
  batchNo?: string;
  narration?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface StockJournal {
  id: string;
  journalNo: string;
  date: string;
  dateNepali: string;
  narration: string;
  lines: StockJournalLine[];
  status: VoucherStatus;
  createdBy?: string;
  createdAt?: string;
}

export interface StockJournalLine {
  id?: string;
  itemId: string;
  itemName: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  qty: number;
  rate: number;
  fromWarehouseName?: string;
  toWarehouseName?: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  level: CostCenterLevel;
  isActive: boolean;
  budget?: number;
}

export interface BankAccount {
  id: string;
  accountId: string;
  bankName: string;
  accountNo: string;
  branch: string;
  ifscCode?: string;
  swiftCode?: string;
  openingBalance: number;
  isActive: boolean;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  reconciled: boolean;
  reconciledVoucherId?: string;
  reconciledDate?: string;
  matchedVoucherId?: string;
}

export interface Budget {
  id: string;
  name: string;
  fiscalYearId: string;
  period: BudgetPeriod;
  lines: BudgetLine[];
  createdBy?: string;
  createdAt?: string;
}

export interface BudgetLine {
  accountId: string;
  accountName: string;
  annualAmount: number;
  monthlyBreakdown: Record<string, number>; // "2081-04" -> amount
}

export interface TdsEntry {
  id: string;
  voucherId: string;
  partyId: string;
  partyName: string;
  partyPan?: string;
  tdsType: TdsType;
  tdsRate: number;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  date: string;
  dateNepali: string;
  deposited?: boolean;
  depositDate?: string;
  depositChallanNo?: string;
  section?: string;
}

export interface SmtpConfig {
  host: string; // e.g. "smtp.gmail.com"
  port: number; // 587 for TLS, 465 for SSL, 25 for plain
  secure: boolean; // true for port 465, false for 587/25
  authUser: string; // sender email address e.g. "yourcompany@gmail.com"
  authPass: string; // Gmail App Password (16-char) or SMTP password
  fromName: string; // Display name e.g. "Sutra ERP"
  fromEmail: string; // From address, usually same as authUser
  isConfigured: boolean; // true once admin has saved valid SMTP settings
}

export interface CompanySettings {
  id?: string;
  name: string;
  nameNepali?: string;
  panNumber: string;
  address: string;
  phone: string;
  email?: string;
  vatNumber?: string;
  website?: string;
  logo?: string;
  defaultCurrency: string;
  currencySymbol: string;
  defaultDateFormat: DateFormat;
  fiscalYearStartMonth: number;
  stockValuationMethod: StockValuationMethod;
  enableCostCenter: boolean;
  enableMultiCurrency: boolean;
  enableBillWiseTracking: boolean;
  enableBatchTracking: boolean;
  printLogoOnInvoice?: boolean;
  printTermsOnInvoice?: boolean;
  termsAndConditions?: string;
  voucherSeries: Record<string, VoucherSeries>;
  tdsEnabled?: boolean;
  cbmsConfig?: { clientId: string; clientSecret: string; environment: "sandbox" | "production" };
  smtpConfig?: SmtpConfig;

  voucherStartingNumber?: number;
  allowVoucherEditAfterPosting?: boolean;
  requireVoucherNarration?: boolean;
  voucherWarningThreshold?: number;
  defaultPaymentTerms?: number;
  defaultTaxRate?: number;
  showHsnSac?: boolean;
  defaultInvoiceFooter?: string;
  letterheadBase64?: string;
  invoicePrintFormat?: string;
  voucherPrintFormat?: string;
  allowNegativeStock?: boolean;
  enableStock?: boolean;

  // Compatibility/local settings fields
  companyNameEn?: string;
  companyNameNe?: string;
  city?: string;
  businessType?: string;
  dateFormat?: string;
  enableBillWise?: boolean;
  showPaisa?: boolean;
  paperSize?: string;
  invoiceTemplate?: string;
  signatoryName?: string;
  termsConditions?: string;
  invoiceFooter?: string;
  printLogo?: boolean;
  printBankDetails?: boolean;
  exportFormat?: string;
}

export interface VoucherSeries {
  prefix: string;
  nextNumber: number;
  padding: number;
  start?: number;
}

export interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: FiscalYearStatus;
  closedBy?: string;
  closedAt?: string;
  openingEntryId?: string;
  voucherSeriesState?: Record<string, { prefix: string; nextNumber: number }>;
}

export interface User {
  id: string;
  name: string;
  nameNepali?: string;
  username: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  password?: string;
  permissions?: string[];
  lastLogin?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: "create" | "update" | "delete" | string;
  module: string;
  recordId: string;
  recordType: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

export interface AppNotification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface BillAllocation {
  id: string;
  voucherId: string; // the payment/receipt voucher id
  invoiceId: string; // the bill being settled
  invoiceNo: string;
  invoiceDate: string;
  partyId: string;
  originalAmount: number;
  allocatedAmount: number;
  balanceLeft: number;
  allocationDate: string;
}

export interface Currency {
  id: string;
  code: string; // USD, EUR, INR, GBP, NPR
  name: string; // US Dollar, Euro etc
  symbol: string; // $, €, ₹, £, रू
  isBase: boolean; // only one can be base (NPR)
  isActive: boolean;
}

export interface ExchangeRate {
  id: string;
  currencyCode: string;
  date: string;
  rateToBase: number; // 1 USD = X NPR
  source: string; // manual or auto
}

export interface RecurringVoucher {
  id: string;
  name: string; // "Monthly Office Rent"
  templateVoucherId: string; // source voucher to clone
  voucherType: VoucherType;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string; // null = no end
  dayOfMonth?: number; // for monthly: 1-28
  nextDueDate: string;
  lastGeneratedDate?: string;
  autoPost: boolean; // post directly or save as draft
  totalOccurrences?: number;
  completedOccurrences: number;
  isActive: boolean;
  generatedVoucherIds: string[]; // history of created voucher IDs
  createdBy?: string;
  createdAt?: string;
}

export interface LedgerEntry {
  date: string;
  dateNepali?: string;
  voucherNo: string;
  voucherType: VoucherType;
  narration: string;
  partyName?: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: "Dr" | "Cr";
  voucherId: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  level: AccountLevel;
  openingDr: number;
  openingCr: number;
  debit: number;
  credit: number;
  closingDr: number;
  closingCr: number;
  children?: TrialBalanceRow[];
}

export interface ProfitLossRow {
  accountId: string;
  accountName: string;
  amount: number;
  isGroup: boolean;
  level: number;
  children?: ProfitLossRow[];
}

export interface BalanceSheetRow {
  accountId: string;
  accountName: string;
  amount: number;
  isGroup: boolean;
  level: number;
  children?: BalanceSheetRow[];
}

export interface AgingBucket {
  label: string;
  days: [number, number | null];
  amount: number;
}

export interface PartyAging {
  partyId: string;
  partyName: string;
  partyPan?: string;
  current: number;
  bucket30: number;
  bucket60: number;
  bucket90: number;
  bucket90plus: number;
  total: number;
}

export interface StockSummaryRow {
  itemId: string;
  itemCode?: string;
  itemName: string;
  unit?: string;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  closingRate: number;
  closingValue: number;
}

export interface VatSummary {
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  grossAmount: number;
  type: "sales" | "purchase";
}

export interface DayBookEntry {
  date: string;
  dateNepali?: string;
  voucherNo: string;
  voucherType: VoucherType;
  partyName?: string;
  narration: string;
  debit: number;
  credit: number;
  voucherId: string;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  accountId?: string;
  partyId?: string;
  warehouseId?: string;
  itemId?: string;
  costCenterId?: string;
  preset: ReportPeriodPreset;
  showZeroBalance?: boolean;
  selectedReport?: string;
}

export interface NavigationState {
  currentPage: Page;
  editingVoucherId?: string;
  editingInvoiceId?: string;
  selectedPartyId?: string;
  selectedItemId?: string;
  breadcrumb: string[];
}

export type Page =
  | "dashboard"
  | "accounts"
  | "journal"
  | "payment"
  | "receipt"
  | "contra"
  | "sales-invoice"
  | "purchase-invoice"
  | "sales-return"
  | "purchase-return"
  | "debit-note"
  | "credit-note"
  | "sales-order"
  | "purchase-order"
  | "delivery-challan"
  | "grn"
  | "stock-journal"
  | "opening-balance"
  | "ledger"
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "cash-flow"
  | "day-book"
  | "cash-book"
  | "bank-book"
  | "sales-register"
  | "purchase-register"
  | "vouchers"
  | "parties"
  | "items"
  | "warehouses"
  | "units"
  | "cost-centers"
  | "bank-accounts"
  | "bank-reconciliation"
  | "vat-reports"
  | "tds-report"
  | "aging-report"
  | "party-statement"
  | "inventory-report"
  | "stock-summary"
  | "budget"
  | "settings"
  | "users"
  | "audit-log"
  | "backup";

// Price List Feature
export enum PriceListType {
  SALES = "sales",
  PURCHASE = "purchase",
}
export interface PriceListLine {
  itemId: string;
  itemName: string;
  rate: number;
  minQty?: number;
  discountPercent?: number;
}
export interface PriceList {
  id: string;
  name: string;
  type: PriceListType;
  isDefault: boolean;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  lines: PriceListLine[];
  applicablePartyIds?: string[];
  createdBy?: string;
  createdAt?: string;
}

// Salesman Feature
export interface Salesman {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  commissionRate?: number;
  isActive: boolean;
  createdAt?: string;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  designation: string;
  department?: string;
  panNo?: string;
  basicSalary: number;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  pfRate: number;
  citRate: number;
  bankAccountNo?: string;
  bankName?: string;
  joinDate: string;
  isActive: boolean;
  accountId: string;
}

export interface PayrollLine {
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  totalAllowances: number;
  grossSalary: number;
  pfEmployee: number;
  pfEmployer: number;
  citEmployee: number;
  citEmployer: number;
  tdsOnSalary: number;
  otherDeductions: number;
  netSalary: number;
}

export interface PayrollRun {
  id: string;
  month: string;
  fiscalYearId: string;
  employees: PayrollLine[];
  status: "draft" | "approved" | "paid";
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdBy?: string;
  createdAt?: string;
}

export type CustomFieldType = "text" | "number" | "date" | "select" | "checkbox";

export interface CustomFieldDef {
  id: string;
  entity: "party" | "item" | "invoice" | "voucher";
  label: string;
  fieldType: CustomFieldType;
  options?: string[]; // for 'select' type
  required: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type BillSundryType = 'additive' | 'subtractive';
export type BillSundryNature = 'freight' | 'discount' | 'tax' | 'other';
export type BillSundryCalculationBasis = 'total' | 'taxableAmount' | 'previousAmount' | 'fixed';
export type BillSundryRateType = 'percentage' | 'fixed';

export interface BillSundry {
  id: string;
  code: string;
  name: string;
  type: BillSundryType;
  nature: BillSundryNature;
  calculationBasis: BillSundryCalculationBasis;
  rateType: BillSundryRateType;
  defaultRate: number;
  accountId: string;
  affectsCostOfGoods: boolean;
  printOnInvoice: boolean;
  applyVAT: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
}

export interface StandardNarration {
  id: string;
  code: string;       // 3-6 char shortcode e.g. "RENT"
  text: string;       // up to 500 chars; supports {party}, {amount}, {date} tokens
  category: 'payment' | 'receipt' | 'journal' | 'sales' | 'purchase' | 'general';
  usageCount: number;
  isActive: boolean;
  createdAt?: string;
}

export interface BillWiseEntry {
  id: string;
  partyId: string;
  partyName: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherType;
  date: string;
  dateNepali: string;
  dueDate?: string;
  originalAmount: number;
  allocatedAmount: number;
  balanceAmount: number;
  side: 'Dr' | 'Cr';
  isSettled: boolean;
  referenceNo?: string;
  onAccount: boolean;
  createdAt?: string;
}

export interface InterestSlab {
  id: string;
  name: string;
  basisType: 'day' | 'amount';
  slabs: {
    fromDays?: number; toDays?: number;
    fromAmount?: number; toAmount?: number;
    ratePercent: number;
  }[];
  isDefault: boolean;
  isActive: boolean;
}

export interface InterestCalculationResult {
  entry: BillWiseEntry;
  daysOverdue: number;
  ratePercent: number;
  interestAmount: number;
  totalWithInterest: number;
}
