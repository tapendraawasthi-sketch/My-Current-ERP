// ============================================================
// CORE ACCOUNTING TYPES — Sutra ERP
// Based on Accounting Transaction Menu Blueprint
// ============================================================

// ── Account ──────────────────────────────────────────────────
export enum AccountType {
  ASSET = "ASSET",
  LIABILITY = "LIABILITY",
  EQUITY = "EQUITY",
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export enum AccountLevel {
  GROUP = "GROUP",
  SUBGROUP = "SUBGROUP",
  LEDGER = "LEDGER",
}

export interface Account {
  id: string;
  name: string;
  code?: string;
  type: AccountType;
  level: AccountLevel;
  isGroup: boolean;
  parentId?: string;
  group?: string;
  balance: number;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
  currency?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Voucher / Journal Entry ──────────────────────────────────
export enum VoucherStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  POSTED = "POSTED",
  VOID = "VOID",
}

export enum VoucherType {
  JOURNAL = "JOURNAL",
  PAYMENT = "PAYMENT",
  RECEIPT = "RECEIPT",
  CONTRA = "CONTRA",
  SALES = "SALES",
  PURCHASE = "PURCHASE",
  DEBIT_NOTE = "DEBIT_NOTE",
  CREDIT_NOTE = "CREDIT_NOTE",
}

export interface VoucherLine {
  id: string;
  accountId: string;
  accountName?: string;
  description?: string;
  debit: number;
  credit: number;
  taxCode?: string;
  taxAmount?: number;
  costCenter?: string;
  projectCode?: string;
}

export interface JournalEntry {
  id: string;
  voucherNumber: string;
  voucherType: VoucherType;
  date: string;
  postingTimestamp?: string;
  referenceNumber?: string;
  narration: string;
  status: VoucherStatus;
  lines: VoucherLine[];
  attachments?: string[];
  createdBy: string;
  approvedBy?: string;
  fiscalYearId?: string;
  currency?: string;
  exchangeRate?: number;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  periodLocked?: boolean;
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Party (Customer / Vendor) ────────────────────────────────
export enum PartyType {
  CUSTOMER = "CUSTOMER",
  VENDOR = "VENDOR",
  BOTH = "BOTH",
}

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  currency?: string;
  creditLimit?: number;
  paymentTerms?: number; // days
  accountId?: string;
  isActive: boolean;
  createdAt: string;
}

// ── Invoice (AR / AP) ────────────────────────────────────────
export enum InvoiceType {
  SALES = "SALES",
  PURCHASE = "PURCHASE",
  CREDIT_NOTE = "CREDIT_NOTE",
  DEBIT_NOTE = "DEBIT_NOTE",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
  VOID = "VOID",
}

export interface InvoiceLine {
  id: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxCode?: string;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;          // after discount, before tax
  lineTotalWithTax: number;   // after tax
  accountId?: string;
  purchaseOrderLineId?: string;
  costCenter?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  partyId: string;
  partyName?: string;
  date: string;
  dueDate: string;
  accountingDate?: string;
  status: PaymentStatus;
  voucherStatus: VoucherStatus;
  lines: InvoiceLine[];
  salesOrderRef?: string;
  purchaseOrderRef?: string;
  billReference?: string;       // vendor bill ref (AP)
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  currency?: string;
  exchangeRate?: number;
  narration?: string;
  attachments?: string[];
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Repeating Invoice ────────────────────────────────────────
export enum RepeatFrequency {
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  ANNUALLY = "ANNUALLY",
}

export enum DueDateType {
  DAYS_AFTER_INVOICE = "DAYS_AFTER_INVOICE",
  DAYS_AFTER_MONTH_END = "DAYS_AFTER_MONTH_END",
}

export interface RepeatingInvoice {
  id: string;
  templateInvoiceId: string;
  partyId: string;
  partyName?: string;
  frequency: RepeatFrequency;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  dueDateType: DueDateType;
  dueDateDays: number;
  autoApprove: boolean;
  autoEmail: boolean;
  isActive: boolean;
  createdAt: string;
}

// ── Payment / Receipt ────────────────────────────────────────
export interface PaymentAllocationLine {
  invoiceId: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceDueDate?: string;
  invoiceTotal?: number;
  invoiceOutstanding?: number;
  allocatedAmount: number;
}

export interface PaymentReceipt {
  id: string;
  paymentNumber: string;
  partyId: string;
  partyName?: string;
  partyType: PartyType;
  date: string;
  amount: number;
  reference?: string;
  bankAccountId: string;
  bankAccountName?: string;
  allocations: PaymentAllocationLine[];
  unallocatedAmount: number;
  narration?: string;
  journalEntryId?: string;
  status: VoucherStatus;
  createdBy: string;
  createdAt: string;
}

// ── Purchase Order ───────────────────────────────────────────
export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  APPROVED = "APPROVED",
  RECEIVED = "RECEIVED",
  BILLED = "BILLED",
  CLOSED = "CLOSED",
}

export interface PurchaseOrderLine {
  id: string;
  itemCode?: string;
  description: string;
  quantity: number;
  receivedQuantity: number;
  billedQuantity: number;
  unitPrice: number;
  taxCode?: string;
  taxPercent: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  date: string;
  expectedDeliveryDate?: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  totalAmount: number;
  narration?: string;
  createdBy: string;
  createdAt: string;
}

// ── Goods Receipt Note ───────────────────────────────────────
export interface GoodsReceiptLine {
  id: string;
  purchaseOrderLineId: string;
  itemCode?: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  variance: number;
}

export interface GoodsReceiptNote {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  date: string;
  lines: GoodsReceiptLine[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

// ── Three-Way Match ──────────────────────────────────────────
export enum MatchStatus {
  MATCHED = "MATCHED",
  QUANTITY_VARIANCE = "QUANTITY_VARIANCE",
  PRICE_VARIANCE = "PRICE_VARIANCE",
  UNMATCHED = "UNMATCHED",
}

export interface ThreeWayMatchResult {
  purchaseOrderId: string;
  grnId: string;
  vendorBillId: string;
  lines: {
    itemDescription: string;
    poQuantity: number;
    grnQuantity: number;
    billQuantity: number;
    poUnitPrice: number;
    billUnitPrice: number;
    quantityVariance: number;
    priceVariance: number;
    matchStatus: MatchStatus;
  }[];
  overallStatus: MatchStatus;
  canApprove: boolean;
}

// ── Bank Reconciliation ──────────────────────────────────────
export enum ReconcileStatus {
  UNMATCHED = "UNMATCHED",
  MATCHED = "MATCHED",
  EXCLUDED = "EXCLUDED",
}

export interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;  // positive = credit to bank (deposit), negative = debit (payment)
  balance?: number;
  reconcileStatus: ReconcileStatus;
  matchedLedgerLineIds?: string[];
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  bankAccountName?: string;
  statementDate: string;
  statementEndBalance: number;
  systemLedgerBalance: number;
  reconciledBalance: number;
  outstandingDeposits: number;
  outstandingPayments: number;
  isReconciled: boolean;
  statementLines: BankStatementLine[];
  createdBy: string;
  createdAt: string;
}

// ── Period Lock ──────────────────────────────────────────────
export interface PeriodLock {
  id: string;
  hardLockDate?: string;   // all entries before rejected
  softLockDate?: string;   // requires override password
  softLockPassword?: string;
  fiscalYearId: string;
  createdBy: string;
  updatedAt: string;
}

// ── Audit Log ────────────────────────────────────────────────
export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  VOID = "VOID",
  POST = "POST",
  APPROVE = "APPROVE",
  LOCK = "LOCK",
  UNLOCK = "UNLOCK",
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityDescription?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  sessionId?: string;
}

// ── Fiscal Year ──────────────────────────────────────────────
export interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: string;
}

// ── Voucher Series ───────────────────────────────────────────
export interface VoucherSeries {
  id: string;
  voucherType: VoucherType;
  prefix: string;
  nextNumber: number;
  fiscalYearId: string;
}

// ── Ledger Entry (for ledger report) ────────────────────────
export interface LedgerEntry {
  id: string;
  date: string;
  voucherNumber: string;
  voucherType: VoucherType;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: "Dr" | "Cr";
  partyName?: string;
  reference?: string;
}

// ── Party Aging ──────────────────────────────────────────────
export interface PartyAging {
  partyId: string;
  partyName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
  total: number;
}

// ── Trial Balance Row ────────────────────────────────────────
export interface TrialBalanceRow {
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType: AccountType;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
  level: number;
  isGroup: boolean;
}

// ── Profit & Loss Row ────────────────────────────────────────
export interface ProfitLossRow {
  accountId: string;
  accountName: string;
  amount: number;
  section: string;
}

// ── Balance Sheet Row ────────────────────────────────────────
export interface BalanceSheetRow {
  label: string;
  amount: number;
  isSection: boolean;
  isTotal: boolean;
}

// ── Day Book Entry ───────────────────────────────────────────
export interface DayBookEntry {
  date: string;
  voucherNumber: string;
  voucherType: VoucherType;
  narration: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  status: VoucherStatus;
}

// ── Recurring Voucher ────────────────────────────────────────
export interface RecurringVoucher {
  id: string;
  templateJournalId: string;
  frequency: RepeatFrequency;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

// ── Tax Configuration ────────────────────────────────────────
export interface TaxRate {
  id: string;
  code: string;
  name: string;
  rate: number;
  accountId?: string;
  isActive: boolean;
}

// ── Batch Payment ────────────────────────────────────────────
export interface BatchPaymentItem {
  vendorBillId: string;
  vendorName?: string;
  billNumber?: string;
  billDate?: string;
  dueDate?: string;
  totalAmount: number;
  amountDue: number;
  selectedAmount: number;
  selected: boolean;
}

export interface BatchPayment {
  id: string;
  paymentDate: string;
  bankAccountId: string;
  bankAccountName?: string;
  items: BatchPaymentItem[];
  totalAmount: number;
  narration?: string;
  fileFormat?: "NACHA" | "SEPA" | "CSV";
  status: VoucherStatus;
  createdBy: string;
  createdAt: string;
}
