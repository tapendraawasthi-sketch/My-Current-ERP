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
}

export enum VoucherStatus {
  DRAFT = "draft",
  POSTED = "posted",
  CANCELLED = "cancelled",
  HELD = "held",
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
  isActive?: boolean;
  balance?: number;
  status?: string;
  accountId?: string;
  isBoth?: boolean;
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
