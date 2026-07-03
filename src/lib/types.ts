// src/lib/types.ts

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
  JOURNAL_VOUCHER = "journal-voucher",
  PRODUCTION = "production",
  UNASSEMBLE = "unassemble",
  MATERIAL_ISSUED = "material-issued",
  MATERIAL_RECEIVED = "material-received",
  PHYSICAL_STOCK = "physical-stock",
  DELIVERY_NOTE = "delivery-note",
  RECEIPT_NOTE = "receipt-note",
  REJECTION_IN = "rejection-in",
  REJECTION_OUT = "rejection-out",
  MATERIAL_IN = "material-in",
  MATERIAL_OUT = "material-out",
  SALES_ORDER = "sales-order",
  PURCHASE_ORDER = "purchase-order",
  JOB_WORK_OUT_ORDER = "job-work-out-order",
  JOB_WORK_IN_ORDER = "job-work-in-order",
  PAYROLL = "payroll",
  ATTENDANCE = "attendance",
  MEMORANDUM = "memorandum",
  REVERSING_JOURNAL = "reversing-journal",
}

export enum VoucherStatus {
  DRAFT = "draft",
  POSTED = "posted",
  CANCELLED = "cancelled",
  HELD = "held",
}

export enum VoucherMode {
  SINGLE_ENTRY = "single-entry",
  DOUBLE_ENTRY = "double-entry",
  ITEM_INVOICE = "item-invoice",
  ACCOUNTING_INVOICE = "accounting-invoice",
  AS_VOUCHER = "as-voucher",
  POS_INVOICE = "pos-invoice",
  VOUCHER_CLASS = "voucher-class",
}

export enum VoucherGroup {
  ACCOUNTING = "accounting",
  INVENTORY = "inventory",
  ORDER = "order",
  PAYROLL = "payroll",
  OTHER = "other",
}

export enum VoucherState {
  REGULAR = "regular",
  OPTIONAL = "optional",
  POST_DATED = "post-dated",
  CANCELLED = "cancelled",
  DELETED = "deleted",
  ALTERED = "altered",
  LOCKED = "locked",
  PENDING_APPROVAL = "pending-approval",
  APPROVED = "approved",
}

export enum NumberingMethod {
  AUTOMATIC = "automatic",
  MANUAL = "manual",
  MULTI_USER_AUTOMATIC = "multi-user-automatic",
  NONE = "none",
}

export enum RestartPeriod {
  NEVER = "never",
  DAILY = "daily",
  MONTHLY = "monthly",
  YEARLY = "yearly",
  FINANCIAL_YEAR = "financial-year",
}

export interface VoucherTypeMasterRecord {
  id: string;
  name: string;
  alias?: string;
  abbreviation?: string;
  parentVoucherType: string;
  voucherGroup: string;
  isPredefined: boolean;
  isActive: boolean;
  numberingMethod: string;
  prefix?: string;
  suffix?: string;
  startingNumber: number;
  restartPeriod: string;
  preventDuplicateNumber: boolean;
  allowManualOverride: boolean;
  warnOnDuplicate: boolean;
  useEffectiveDate: boolean;
  allowZeroValue: boolean;
  optionalByDefault: boolean;
  allowCommonNarration: boolean;
  allowLedgerNarration: boolean;
  printAfterSaving: boolean;
  useForPOS: boolean;
  defaultPrintTitle?: string;
  defaultBankLedgerId?: string;
  defaultJurisdiction?: string;
  declarationText?: string;
  enableDefaultAllocations: boolean;
  voucherClassList?: string[];
  whatsAppAfterSaving: boolean;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
}

export interface VoucherBillAllocation {
  id: string;
  billRefNo: string;
  billRefType: "new-ref" | "against-ref" | "advance" | "on-account";
  amount: number;
  dueDate?: string;
  creditDays?: number;
}

export interface VoucherBankAllocation {
  id: string;
  instrumentType: "cheque" | "dd" | "neft" | "rtgs" | "imps" | "upi" | "card" | "cash-deposit";
  instrumentNo?: string;
  instrumentDate?: string;
  bankName?: string;
  amount: number;
}

export interface VoucherCostCentreAllocation {
  id: string;
  costCentreId: string;
  amount: number;
}

export interface VoucherLineFull {
  id: string;
  lineNumber: number;
  ledgerId?: string;
  stockItemId?: string;
  debitAmount: number;
  creditAmount: number;
  quantity?: number;
  unitId?: string;
  rate?: number;
  discount?: number;
  amount: number;
  taxableAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  godownId?: string;
  batchId?: string;
  costCentreAllocations?: VoucherCostCentreAllocation[];
  billAllocations?: VoucherBillAllocation[];
  bankAllocations?: VoucherBankAllocation[];
  orderReferenceId?: string;
  trackingNumber?: string;
  narration?: string;
  hsnSac?: string;
}

export interface VoucherHeaderFull {
  id: string;
  companyId?: string;
  voucherTypeId?: string;
  voucherTypeName: string;
  voucherGroup: string;
  voucherNumber: string;
  voucherDate: string;
  effectiveDate?: string;
  referenceNumber?: string;
  referenceDate?: string;
  partyLedgerId?: string;
  partyName?: string;
  status: string;
  voucherState: string;
  mode: string;
  isOptional: boolean;
  isPostDated: boolean;
  isCancelled: boolean;
  isDeleted: boolean;
  narration?: string;
  totalDebit: number;
  totalCredit: number;
  totalAmount: number;
  taxAmount?: number;
  roundOffAmount?: number;
  lines: VoucherLineFull[];
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  cancellationReason?: string;
  sourceScreen?: string;
}

export interface VoucherAuditLog {
  id: string;
  companyId?: string;
  voucherId: string;
  voucherTypeId?: string;
  voucherNumber: string;
  voucherDate: string;
  actionName: string;
  shortcutUsed?: string;
  userId?: string;
  userRole?: string;
  timestamp: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedFields?: string[];
  status: "success" | "failed" | "cancelled";
  failureReason?: string;
}

export enum PaymentMode {
  CASH = "cash",
  BANK_TRANSFER = "bank-transfer",
  CREDIT = "credit",
  CHEQUE = "cheque",
  ONLINE = "online",
}

export enum PaymentStatus {
  PAID = "paid",
  UNPAID = "unpaid",
  PARTIAL = "partial",
  CANCELLED = "cancelled",
  OVERDUE = "overdue",
}

export enum ItemType {
  PRODUCT = "product",
  SERVICE = "service",
}

export enum TdsType {
  NONE = "none",
  SERVICE_CONTRACT = "service_contract",
  HOUSE_RENT = "house_rent",
  CONSULTANCY = "consultancy",
  RENT = "rent",
  SALARY = "salary",
  DIVIDEND = "dividend",
  COMMISSION = "commission",
  CONTRACTOR = "contractor",
  OTHER = "other",
}

export enum PartyType {
  CUSTOMER = "customer",
  SUPPLIER = "supplier",
  BOTH = "both",
}

export enum MovementType {
  PURCHASE = "purchase",
  SALES = "sales",
  TRANSFER = "transfer",
  ADJUSTMENT = "adjustment",
  OPENING = "opening",
  PRODUCTION = "production",
  RETURN = "return",
}

export enum ChallanStatus {
  DRAFT = "draft",
  DISPATCHED = "dispatched",
  RECEIVED = "received",
  INVOICED = "invoiced",
  CANCELLED = "cancelled",
}

export enum InvoiceStatus {
  DRAFT = "draft",
  POSTED = "posted",
  CANCELLED = "cancelled",
}

export enum StockValuationMethod {
  FIFO = "fifo",
  LIFO = "lifo",
  WEIGHTED_AVERAGE = "weighted_average",
}

export enum DateFormat {
  BS = "BS",
  AD = "AD",
}

// Interfaces

export interface Account {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: AccountType;
  level: AccountLevel;
  parentId?: string;
  isGroup: boolean;
  isActive: boolean;
  isSystemAccount?: boolean;
  balance: number;
  openingBalance: number;
  openingBalanceDr: number;
  openingBalanceCr: number;
  openingBalanceDate?: string;
  costCenterId?: string;
  group?: string;
  accountId?: string;
  billByBill?: boolean;
  alias?: string;
  bankDetails?: {
    bankName?: string;
    branch?: string;
    accountNo?: string;
    ifscSwift?: string;
    accountType?: "Current" | "Savings" | "Overdraft" | "CashCredit";
  };
  creditLimit?: number;
  creditPeriod?: number;
}

export interface Party {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: PartyType;
  pan?: string;
  vatNo?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  address?: string;
  addressNepali?: string;
  city?: string;
  province?: string;
  district?: string;
  wardNo?: string;
  country?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankBranch?: string;
  creditLimit?: number;
  creditDays?: number;
  openingBalance?: number;
  openingBalanceType?: "Dr" | "Cr";
  openingBalanceDate?: string;
  subjectToTds?: boolean;
  tdsType?: TdsType;
  tdsRate?: number;
  defaultTdsNatureId?: string;
  personType?: "individual" | "entity";
  residency?: "resident" | "non-resident";
  isActive?: boolean;
  balance?: number;
  status?: string;
  accountId?: string;
  isBoth?: boolean;
  partyType?: PartyType;
  alias?: string;
  gstin?: string;
  state?: string;
  pincode?: string;
  contacts?: Array<{
    name: string;
    phone: string;
    email: string;
    designation: string;
  }>;
  bankAccounts?: Array<{
    bankName: string;
    accountNo: string;
    ifsc: string;
    branch: string;
    accountType: string;
  }>;
  creditPeriod?: number;
  ledgerId?: string;
  salesPersonId?: string;
  priceListId?: string;
  tdsApplicable?: boolean;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: ItemType;
  unit: string;
  alternateUnit?: string;
  conversionFactor?: number;
  hsnCode?: string;
  barcode?: string;
  description?: string;
  category?: string;
  purchaseRate: number;
  salesRate: number;
  mrp?: number;
  isTaxable: boolean;
  vatRate?: number;
  openingStock?: number;
  openingStockRate?: number;
  minimumStock?: number;
  maximumStock?: number;
  reorderLevel?: number;
  purchaseAccountId?: string;
  salesAccountId?: string;
  stockAccountId?: string;
  warehouseId?: string;
  isActive: boolean;
  baseUnit?: string;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  date: string;
  dateNepali: string;
  type: VoucherType | string;
  narration: string;
  referenceNo?: string;
  lines: VoucherLine[];
  status: VoucherStatus | string;
  totalDebit: number;
  totalCredit: number;
  grandTotal?: number;
  cancellationReason?: string;
}

export interface VoucherLine {
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  subledgerId?: string;
  costCenterId?: string;
  billRefNo?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  dateNepali: string;
  dueDate?: string;
  type: VoucherType | string;
  partyId: string;
  partyName: string;
  partyPan?: string;
  partyVat?: string;
  billTo?: string;
  lines: InvoiceLine[];
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
  paymentMode: PaymentMode | string;
  paymentStatus: PaymentStatus | string;
  paidAmount?: number;
  bankAccountId?: string;
  chequeNo?: string;
  chequeDate?: string;
  narration?: string;
  narrationNe?: string;
  referenceNo?: string;
  orderRef?: string;
  challanRef?: string;
  originalInvoiceId?: string;
  originalInvoiceNo?: string;
  billSundries?: BillSundry[];
  attachments?: string[];
  status: VoucherStatus | string;
  cancellationReason?: string;
  cbmsSubmitted?: boolean;
  cbmsIrn?: string;
  cbmsSubmittedAt?: string;
}

export interface InvoiceLine {
  itemId: string;
  itemName: string;
  itemCode?: string;
  unit?: string;
  qty: number;
  rate: number;
  discountPercent?: number;
  discount?: number;
  discountAmount?: number;
  isTaxable: boolean;
  vatRate?: number;
  taxableAmount?: number;
  exemptAmount?: number;
  vatAmount?: number;
  netAmount?: number;
  totalAmount?: number;
  warehouseId?: string;
  hsnCode?: string;
  description?: string;
}

export interface BillSundry {
  id: string;
  name: string;
  type: "additive" | "subtractive";
  amount: number;
}

export interface StockMovement {
  id: string;
  date: string;
  dateNepali: string;
  type: string;
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
  narration?: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isDefault?: boolean;
  isActive: boolean;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces?: number;
  UQC_code?: string;
  isActive: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  level?: string;
  isActive: boolean;
}

export interface FiscalYear {
  id: string;
  name: string;
  fiscalYearBS?: string;
  bsYear?: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean;
}

export interface CustomFieldDef {
  id: string;
  entity: "party" | "item" | "invoice" | "voucher";
  label: string;
  fieldType: "text" | "number" | "date" | "select" | "checkbox";
  required: boolean;
  isActive: boolean;
  sortOrder: number;
  options?: string[];
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isBase: boolean;
  isActive: boolean;
}

// ─── Administration Module Types ───────────────────────────────────────────────

export interface UnitConversion {
  id: string;
  mainUnit: string;
  subUnit: string;
  conversionFactor: number;
  isActive: boolean;
}

export interface StandardNarration {
  id: string;
  voucherType: string;
  narration: string;
  isActive: boolean;
}

export interface BillSundryMaster {
  id: string;
  name: string;
  alias?: string;
  type: "additive" | "subtractive";
  nature: "percentage" | "fixed" | "per_unit";
  accountHeadId?: string;
  defaultValue: number;
  affectsCostInSale: boolean;
  affectsCostInPurchase: boolean;
  adjustInPartyAmount: boolean;
  applicableOn: "nett_bill" | "basic_amount" | "taxable_amount" | "previous_sundry";
  isActive: boolean;
}

export interface SaleType {
  id: string;
  name: string;
  salesAccountId?: string;
  region: "local" | "export";
  taxationType: "taxable_voucherwise" | "taxable_itemwise" | "exempt" | "tax_free" | "nil_rated";
  taxRate: number;
  surcharge: number;
  addlCess: number;
  invoiceHeading?: string;
  invoiceDescription?: string;
  freezeTax: boolean;
  skipVatReports: boolean;
  isActive: boolean;
}

export interface PurchaseType {
  id: string;
  name: string;
  purchaseAccountId?: string;
  region: "local" | "import";
  taxationType: "taxable_voucherwise" | "taxable_itemwise" | "exempt" | "tax_free" | "nil_rated";
  taxRate: number;
  surcharge: number;
  addlCess: number;
  isCapitalPurchase: boolean;
  freezeTax: boolean;
  skipVatReports: boolean;
  isActive: boolean;
}

export interface TaxCategory {
  id: string;
  name: string;
  localTaxRate: number;
  exportTaxRate: number;
  taxOnMrp: boolean;
  stockAccountId?: string;
  zeroTaxType?: string;
  isActive: boolean;
}

export interface DiscountStructure {
  id: string;
  name: string;
  discountType: "simple" | "compound_same" | "compound_different";
  amountType: "percentage" | "absolute" | "per_main_qty" | "per_pkg_qty";
  percentageOn: "item_price" | "item_amount" | "item_mrp" | "item_list_price";
  caption: string;
  noOfDiscounts: number;
  isActive: boolean;
}

export interface ItemGroup {
  id: string;
  name: string;
  alias?: string;
  isPrimary: boolean;
  underGroupId?: string;
  stockAccountId?: string;
  salesAccountId?: string;
  purchaseAccountId?: string;
  hsnCode?: string;
  taxCategoryId?: string;
  isActive: boolean;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  isActive: boolean;
}

// ─── User & Roles ────────────────────────────────────────────────────────────
export enum UserRole {
  ADMIN = "admin",
  MANAGER = "manager",
  ACCOUNTANT = "accountant",
  VIEWER = "viewer",
  CASHIER = "cashier",
  PAYROLL_OFFICER = "payroll_officer",
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole | string;
  isActive: boolean;
  passwordHash?: string;
  permissions?: string[];
}

// ─── Recurring Vouchers ───────────────────────────────────────────────────────
export enum RecurringFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  FORTNIGHTLY = "fortnightly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  HALF_YEARLY = "half_yearly",
  YEARLY = "yearly",
}

export interface RecurringVoucher {
  id: string;
  name: string;
  templateVoucherId: string;
  voucherType: string;
  frequency: RecurringFrequency | string;
  startDate: string;
  endDate?: string;
  dayOfMonth?: number;
  autoPost: boolean;
  totalOccurrences?: number;
  completedOccurrences: number;
  nextDueDate?: string;
  lastGeneratedDate?: string;
  generatedVoucherIds: string[];
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
}

// ─── Bank Reconciliation ──────────────────────────────────────────────────────
export interface BankStatement {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
  reconciled: boolean;
  reconciledVoucherId?: string;
  reconciledAt?: string;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  narration?: string;
  costCenterId?: string;
}

export interface JournalEntry {
  id: string;
  voucherNo: string;
  date: string;
  dateNepali?: string;
  type: string;
  narration?: string;
  partyName?: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  status: string;
  createdBy?: string;
  createdAt?: string;
}

export enum ReportPeriodPreset {
  TODAY = "today",
  THIS_WEEK = "this-week",
  THIS_MONTH = "this-month",
  THIS_QUARTER = "this-quarter",
  THIS_YEAR = "this-year",
  LAST_MONTH = "last-month",
  LAST_QUARTER = "last-quarter",
  LAST_YEAR = "last-year",
  CUSTOM = "custom",
}

export enum FiscalYearStatus {
  OPEN = "open",
  ACTIVE = "active",
  CLOSED = "closed",
  LOCKED = "locked",
  FUTURE = "future",
}

export enum CostCenterLevel {
  PRIMARY = "primary",
  SECONDARY = "secondary",
}

// ─── Employee (Payroll Module) ────────────────────────────────────────────────
export interface Employee {
  id: string;
  name: string;
  nameNe?: string;
  designation?: string;
  department?: string;
  dateOfJoining: string;
  dateOfJoiningBS?: string;
  pan?: string;
  citizenshipNumber?: string;
  bankAccount?: string;
  bankName?: string;
  ssf: boolean;
  ssfEnabled?: boolean;
  ssfContributorNumber?: string;
  ssfContributionType?: "employee" | "employer" | "both";
  pfEnabled?: boolean;
  pfRate?: number;
  citEnabled?: boolean;
  citRate?: number;
  basicSalary: number;
  gradePayPercent?: number;
  allowances: {
    houseRent: number;
    transport: number;
    medical: number;
    dashain: number;
  };
  rentAllowance?: number;
  medicalAllowance?: number;
  transportAllowance?: number;
  maritalStatus?: "single" | "married";
  deductions?: Array<{ name: string; amount: number }>;
  taxDeclarations?: {
    lifeInsurance?: number;
    healthInsurance?: number;
  };
  employmentType: "permanent" | "contract" | "daily";
  bonusEligible?: boolean;
  status: "active" | "inactive";
}
export interface VoucherSeries {
  id?: string;
  companyId: string;
  voucherType: string;
  prefix: string;
  currentNumber: number;
  nextNumber?: number;
  padding: number;
  fiscalYearBS: string;
  resetOnNewYear: boolean;
}

export type AccountGroup = string;

export interface StockJournalLine {
  itemId: string;
  itemName: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: number;
  rate: number;
}

export interface StockJournal {
  id: string;
  journalNo: string;
  date: string;
  dateNepali: string;
  narration?: string;
  lines: StockJournalLine[];
  status: VoucherStatus | string;
}

export interface Budget {
  id: string;
  accountId: string;
  costCenterId?: string;
  fiscalYearBS: string;
  month: number;
  budgetedAmount: number;
}

export interface DeliveryChallanLine {
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unit?: string;
  rate?: number;
  amount?: number;
  warehouseId?: string;
  batchNo?: string;
}

export interface DeliveryChallan {
  id: string;
  challanNo: string;
  date: string;
  dateNepali: string;
  partyId: string;
  partyName: string;
  salesOrderId?: string;
  lines: DeliveryChallanLine[];
  narration?: string;
  status: ChallanStatus | string;
  inventoryPosted?: boolean;
  invoiceId?: string;
}

export interface GoodsReceiptNoteLine {
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unit?: string;
  rate?: number;
  amount?: number;
  rejectedQty?: number;
  warehouseId?: string;
  batchNo?: string;
}

export interface GoodsReceiptNote {
  id: string;
  grnNo: string;
  date: string;
  dateNepali: string;
  partyId: string;
  partyName: string;
  purchaseOrderId?: string;
  lines: GoodsReceiptNoteLine[];
  narration?: string;
  status: ChallanStatus | string;
  inventoryPosted?: boolean;
  invoiceId?: string;
}

export enum OrderStatus {
  DRAFT = "draft",
  CONFIRMED = "confirmed",
  PARTIALLY_FULFILLED = "partially_fulfilled",
  FULFILLED = "fulfilled",
  CANCELLED = "cancelled",
}

export interface OrderLine {
  itemId: string;
  itemName: string;
  itemCode?: string;
  qty: number;
  unit?: string;
  rate: number;
  discount?: number;
  discountAmount?: number;
  isTaxable?: boolean;
  vatRate?: number;
  amount?: number;
}

export interface Order {
  id: string;
  orderNo: string;
  date: string;
  dateNepali?: string;
  expectedDate?: string;
  type: "sales" | "purchase";
  partyId: string;
  partyName: string;
  lines: OrderLine[];
  subTotal?: number;
  discountAmount?: number;
  taxableAmount?: number;
  vatAmount?: number;
  grandTotal?: number;
  narration?: string;
  status: OrderStatus | string;
  fulfilledPercent?: number;
  fulfilledInvoiceIds?: string[];
  approvedBy?: string;
  approvedAt?: string;
}

export interface StockJournalItem {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  rate: number;
  amount: number;
  fromGodown?: string;
  toGodown?: string;
}

export interface StockJournalEntry {
  id: string;
  date: string;
  refNo?: string;
  narration?: string;
  items: StockJournalItem[];
  status: "DRAFT" | "POSTED";
  createdAt: string;
}

export interface ProductionEntry {
  id: string;
  date: string;
  refNo?: string;
  narration?: string;
  finishedGoods: StockJournalItem[];
  rawMaterials: StockJournalItem[];
  status: "DRAFT" | "POSTED";
  createdAt: string;
}

export interface UnassembleEntry {
  id: string;
  date: string;
  refNo?: string;
  narration?: string;
  finishedGoods: StockJournalItem[];
  components: StockJournalItem[];
  status: "DRAFT" | "POSTED";
  createdAt: string;
}

export interface MaterialIssuedEntry {
  id: string;
  date: string;
  partyName: string;
  refNo?: string;
  narration?: string;
  items: StockJournalItem[];
  status: "DRAFT" | "POSTED";
  createdAt: string;
}

export interface MaterialReceivedEntry {
  id: string;
  date: string;
  partyName: string;
  refNo?: string;
  narration?: string;
  items: StockJournalItem[];
  status: "DRAFT" | "POSTED";
  createdAt: string;
}

export interface PhysicalStockEntry {
  id: string;
  date: string;
  refNo?: string;
  narration?: string;
  items: StockJournalItem[];
  status: "DRAFT" | "POSTED";
  createdAt: string;
}
