// @ts-nocheck
import Dexie, { Table } from "dexie";

export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Account ──────────────────────────────────────────────────────────────────
export interface DBAccount {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  alias?: string;
  type: string;
  level: string;
  parentId?: string;
  costCenterId?: string;
  group?: string;
  isGroup: boolean;
  isActive: boolean;
  isSystemAccount?: boolean;
  balance: number;
  openingBalance?: number;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
  openingBalanceDate?: string;
  billByBill?: boolean;
  bankDetails?: {
    bankName?: string;
    branch?: string;
    accountNo?: string;
    ifscSwift?: string;
    accountType?: string;
  };
  creditLimit?: number;
  creditPeriod?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Party ────────────────────────────────────────────────────────────────────
export interface DBParty {
  id: string;
  code?: string;
  name: string;
  nameNepali?: string;
  type: "customer" | "supplier" | "both";
  pan?: string;
  vatNo?: string;
  phone?: string;
  email?: string;
  address?: string;
  province?: string;
  district?: string;
  city?: string;
  wardNo?: string;
  country?: string;
  openingBalance?: number;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
  balance?: number;
  creditLimit?: number;
  creditPeriod?: number;
  isActive: boolean;
  accountId?: string;
  salesPersonId?: string;
  priceListId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Item ─────────────────────────────────────────────────────────────────────
export interface DBItem {
  id: string;
  code?: string;
  sku?: string;
  barcode?: string;
  name: string;
  nameNepali?: string;
  description?: string;
  type?: string;
  category?: string;
  group?: string;
  unit?: string;
  alternateUnit?: string;
  conversionFactor?: number;
  salesRate?: number;
  purchaseRate?: number;
  mrp?: number;
  sellingPrice?: number;
  salePrice?: number;
  rate?: number;
  price?: number;
  costPrice?: number;
  openingStock?: number;
  openingStockRate?: number;
  reorderLevel?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  isTaxable?: boolean;
  vatRate?: number;
  hsnCode?: string;
  isActive: boolean;
  warehouseId?: string;
  accountId?: string;
  purchaseAccountId?: string;
  salesAccountId?: string;
  enableBatchTracking?: boolean;
  enableSerialTracking?: boolean;
  imageUrl?: string;
  weight?: number;
  weightUnit?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Voucher Line ─────────────────────────────────────────────────────────────
export interface DBVoucherLine {
  id?: string;
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  costCenterId?: string;
  costCenterName?: string;
  partyId?: string;
  partyName?: string;
  billRefNo?: string;
  billRefType?: string;
  billRefAmount?: number;
  chequeNo?: string;
  chequeDate?: string;
  bankName?: string;
  tdsApplicable?: boolean;
  tdsSection?: string;
  tdsRate?: number;
  tdsAmount?: number;
}

// ─── Voucher ──────────────────────────────────────────────────────────────────
export interface DBVoucher {
  id: string;
  voucherNo: string;
  date: string;
  dateNepali?: string;
  type: string;
  status: string;
  narration?: string;
  totalDebit: number;
  totalCredit: number;
  grandTotal: number;
  lines: DBVoucherLine[];
  partyId?: string;
  partyName?: string;
  partyPan?: string;
  chequeNo?: string;
  chequeDate?: string;
  bankName?: string;
  paymentMode?: string;
  referenceNo?: string;
  referenceDate?: string;
  costCenterId?: string;
  projectId?: string;
  linkedPoIds?: string[];
  linkedGrnIds?: string[];
  linkedSoIds?: string[];
  linkedDcIds?: string[];
  linkedDocuments?: WorkflowDocRef[];
  workflowStatus?: WorkflowStatus;
  pdc?: boolean;
  pdcDate?: string;
  amount?: number;
  isTds?: boolean;
  tdsSection?: string;
  tdsRate?: number;
  tdsAmount?: number;
  tdsNatureOfPayment?: string;
  deducteeType?: string;
  attachments?: string[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  reversalVoucherId?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkflowStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "posted"
  | "cancelled"
  | "partial"
  | "closed";

export interface WorkflowDocRef {
  id: string;
  type: string;
  no: string;
  date?: string;
  amount?: number;
  workflowStatus?: WorkflowStatus;
}

// ─── Invoice Line ─────────────────────────────────────────────────────────────
export interface DBInvoiceLine {
  id?: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unit?: string;
  rate: number;
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
  netAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  totalAmount?: number;
  lineTotal?: number;
  isTaxable?: boolean;
  hsnCode?: string;
  warehouseId?: string;
  batchNo?: string;
  serialNo?: string;
  costPrice?: number;
  profit?: number;
  accountId?: string;
  costCenterId?: string;
  taxableAmount?: number;
  exemptAmount?: number;
  hsCode?: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export interface DBInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  dateNepali?: string;
  type: string;
  status: string;
  partyId?: string;
  partyName?: string;
  partyPan?: string;
  partyAddress?: string;
  warehouseId?: string;
  warehouseName?: string;
  paymentMode?: string;
  paymentStatus?: string;
  paidAmount?: number;
  dueDate?: string;
  subTotal?: number;
  discountAmount?: number;
  discountPercent?: number;
  taxableAmount?: number;
  exemptAmount?: number;
  vatAmount?: number;
  taxAmount?: number;
  grandTotal?: number;
  total?: number;
  roundOff?: number;
  shippingCharge?: number;
  otherCharge?: number;
  tdsAmount?: number;
  tdsRate?: number;
  tdsType?: string;
  tdsSection?: string;
  tdsNatureOfPayment?: string;
  grossAmount?: number;
  vatApplicable?: boolean;
  lines: DBInvoiceLine[];
  narration?: string;
  terms?: string;
  referenceNo?: string;
  referenceDate?: string;
  linkedPoId?: string;
  linkedGrnId?: string;
  linkedSoId?: string;
  linkedDcId?: string;
  linkedDocuments?: WorkflowDocRef[];
  workflowStatus?: WorkflowStatus;
  cbmsStatus?: "pending" | "failed" | "success" | "submitted" | "cancelled";
  cbmsIrn?: string;
  cbmsQrCode?: string;
  cbmsQrString?: string;
  cbmsSubmitted?: boolean;
  cbmsSubmittedAt?: string;
  cbmsError?: string;
  attachments?: string[];
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  accountingVoucherId?: string;
  costCenterId?: string;
  salesPersonId?: string;
  priceListId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  payments?: {
    cash?: number;
    card?: number;
    wallet?: number;
    bank?: number;
    credit?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

// ─── Stock Movement ───────────────────────────────────────────────────────────
export interface DBStockMovement {
  id: string;
  date: string;
  dateNepali?: string;
  type: string;
  movementType?: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  warehouseId?: string;
  warehouseName?: string;
  qty: number;
  quantity?: number;
  rate?: number;
  costRate?: number;
  amount?: number;
  unit?: string;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
  referenceId?: string;
  referenceType?: string;
  referenceNo?: string;
  narration?: string;
  branchId?: string;
  branchName?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Warehouse ────────────────────────────────────────────────────────────────
export interface DBWarehouse {
  id: string;
  code?: string;
  name: string;
  nameNepali?: string;
  type?: string;
  address?: string;
  province?: string;
  district?: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  isDefault?: boolean;
  notes?: string;
  branchName?: string;
  allowNegativeStock?: boolean;
  parentId?: string;
  branchId?: string;
  branchCompanyCode?: string;
  isMainBranch?: boolean;
  costCenterId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Stock Transfer ───────────────────────────────────────────────────────────
export interface DBStockTransferLine {
  id?: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  qty: number;
  rate: number;
  amount: number;
  unit?: string;
  fromBatch?: string;
  toBatch?: string;
}

export interface DBStockTransferVoucher {
  id: string;
  transferNo: string;
  date: string;
  dateNepali?: string;
  fromWarehouseId: string;
  fromWarehouseName?: string;
  toWarehouseId: string;
  toWarehouseName?: string;
  fromBranchId?: string;
  fromBranchName?: string;
  toBranchId?: string;
  toBranchName?: string;
  isInterBranch?: boolean;
  lines: DBStockTransferLine[];
  totalAmount: number;
  status: string;
  narration?: string;
  accountingVoucherId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Unit ─────────────────────────────────────────────────────────────────────
export interface DBUnit {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Unit Conversion ──────────────────────────────────────────────────────────
export interface DBUnitConversion {
  id: string;
  fromUnitId?: string;
  fromUnitName?: string;
  toUnitId?: string;
  toUnitName?: string;
  conversionFactor: number;
  itemId?: string;
  itemName?: string;
  isActive: boolean;
  mainUnit?: string;
  subUnit?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Cost Center ──────────────────────────────────────────────────────────────
export interface DBCostCenter {
  id: string;
  code?: string;
  name: string;
  nameNepali?: string;
  type?: string;
  parentId?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Fiscal Year ──────────────────────────────────────────────────────────────
export interface DBFiscalYear {
  id: string;
  name: string;
  label?: string;
  startDate: string;
  endDate: string;
  startDateNepali?: string;
  endDateNepali?: string;
  fiscalYearBS?: string;
  status: "open" | "closed" | "locked";
  isDefault?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Company Settings ─────────────────────────────────────────────────────────
export interface DBCompanySettings {
  id: string;
  name?: string;
  companyName?: string;
  companyNameEn?: string;
  companyNameNp?: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  pan?: string;
  panNumber?: string;
  vatNumber?: string;
  vatNo?: string;
  province?: string;
  district?: string;
  city?: string;
  country?: string;
  currencyCode?: string;
  currencySymbol?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  logo?: string;
  invoicePrefix?: string;
  purchasePrefix?: string;
  journalPrefix?: string;
  receiptPrefix?: string;
  paymentPrefix?: string;
  vatRate?: number;
  enableCostCenter?: boolean;
  enableBillWise?: boolean;
  enableBillWiseTracking?: boolean;
  enableBatchTracking?: boolean;
  enableSerialTracking?: boolean;
  enableMultiCurrency?: boolean;
  tdsEnabled?: boolean;
  cbmsEnabled?: boolean;
  cbmsVatNo?: string;
  cbmsApiKey?: string;
  cbmsApiUrl?: string;
  defaultWarehouseId?: string;
  dateFormat?: string;
  decimalPlaces?: number;
  language?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginBy?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface DBUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  warehouseId?: string;
  companyId?: string;
  passwordHash?: string;
  lastLoginAt?: string;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface DBNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  severity?: string;
  link?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Shortcut ─────────────────────────────────────────────────────────────────
export interface DBShortcut {
  id?: number;
  key_combo: string;
  label: string;
  action_type: string;
  action_value: string;
  category: string;
  is_active: boolean;
  sort_order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── POS Session ──────────────────────────────────────────────────────────────
export interface DBPosSession {
  id: string;
  date: string;
  dateNepali?: string;
  userId: string;
  userName?: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  variance?: number;
  status: "open" | "closed";
  totalSales?: number;
  totalTransactions?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── POS Hold ─────────────────────────────────────────────────────────────────
export interface DBPosHold {
  id: string;
  name: string;
  heldAt: string;
  userId?: string;
  partyId?: string;
  partyName?: string;
  cart: any[];
  total: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Price List ───────────────────────────────────────────────────────────────
export interface DBPriceListLine {
  itemId: string;
  itemName?: string;
  rate: number;
  minQty?: number;
  maxQty?: number;
  discountPercent?: number;
  unit?: string;
}

export interface DBPriceList {
  id: string;
  name: string;
  description?: string;
  type?: "sales" | "purchase";
  currency?: string;
  validFrom?: string;
  validTo?: string;
  isActive: boolean;
  lines: DBPriceListLine[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── Bill Sundry ──────────────────────────────────────────────────────────────
export interface DBBillSundry {
  id: string;
  code?: string;
  name: string;
  alias?: string;
  type: "addition" | "deduction" | "additive";
  nature?: string;
  calculationType?: "fixed" | "percentage";
  rate?: number;
  accountId?: string;
  accountHeadId?: string;
  accountName?: string;
  defaultValue?: number;
  isActive: boolean;
  isTaxable?: boolean;
  applyOn?: string;
  affectsCostInSale?: boolean;
  affectsCostInPurchase?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Standard Narration ───────────────────────────────────────────────────────
export interface DBStandardNarration {
  id: string;
  code?: string;
  narration: string;
  voucherType?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Sales Person ─────────────────────────────────────────────────────────────
export interface DBSalesPerson {
  id: string;
  code?: string;
  name: string;
  nameNepali?: string;
  phone?: string;
  email?: string;
  address?: string;
  commissionRate?: number;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────
export interface DBPurchaseOrderLine {
  itemId: string;
  itemName?: string;
  qty: number;
  receivedQty?: number;
  rate: number;
  amount: number;
  unit?: string;
  warehouseId?: string;
}

export interface DBPurchaseOrder {
  id: string;
  poNo: string;
  date: string;
  dateNepali?: string;
  expectedDate?: string;
  partyId?: string;
  partyName?: string;
  warehouseId?: string;
  status: string;
  workflowStatus?: WorkflowStatus;
  linkedDocuments?: WorkflowDocRef[];
  lines: DBPurchaseOrderLine[];
  subTotal?: number;
  vatAmount?: number;
  grandTotal?: number;
  narration?: string;
  terms?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Sales Order ──────────────────────────────────────────────────────────────
export interface DBSalesOrderLine {
  itemId: string;
  itemName?: string;
  qty: number;
  deliveredQty?: number;
  rate: number;
  amount: number;
  unit?: string;
  warehouseId?: string;
}

export interface DBSalesOrder {
  id: string;
  soNo: string;
  date: string;
  dateNepali?: string;
  expectedDate?: string;
  partyId?: string;
  partyName?: string;
  warehouseId?: string;
  status: string;
  workflowStatus?: WorkflowStatus;
  linkedDocuments?: WorkflowDocRef[];
  lines: DBSalesOrderLine[];
  subTotal?: number;
  vatAmount?: number;
  grandTotal?: number;
  narration?: string;
  terms?: string;
  salesPersonId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Quotation ────────────────────────────────────────────────────────────────
export interface DBQuotationLine {
  itemId: string;
  itemName?: string;
  qty: number;
  rate: number;
  amount: number;
  unit?: string;
  discountPercent?: number;
}

export interface DBQuotation {
  id: string;
  quotationNo: string;
  date: string;
  dateNepali?: string;
  validUntil?: string;
  partyId?: string;
  partyName?: string;
  status: string;
  lines: DBQuotationLine[];
  subTotal?: number;
  vatAmount?: number;
  grandTotal?: number;
  narration?: string;
  terms?: string;
  salesPersonId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Delivery Challan ─────────────────────────────────────────────────────────
export interface DBDeliveryChallanLine {
  itemId: string;
  itemName?: string;
  qty: number;
  unit?: string;
  warehouseId?: string;
  batchNo?: string;
  serialNo?: string;
  rate?: number;
  amount?: number;
}

export interface DBDeliveryChallan {
  id: string;
  dcNo: string;
  date: string;
  dateNepali?: string;
  partyId?: string;
  partyName?: string;
  partyAddress?: string;
  warehouseId?: string;
  status: string;
  workflowStatus?: WorkflowStatus;
  linkedDocuments?: WorkflowDocRef[];
  lines: DBDeliveryChallanLine[];
  linkedSoId?: string;
  linkedInvoiceId?: string;
  narration?: string;
  vehicleNo?: string;
  driverName?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Goods Receipt Note ───────────────────────────────────────────────────────
export interface DBGoodsReceiptNoteLine {
  itemId: string;
  itemName?: string;
  orderedQty?: number;
  receivedQty: number;
  acceptedQty?: number;
  rejectedQty?: number;
  unit?: string;
  warehouseId?: string;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
  rate?: number;
  amount?: number;
}

export interface DBGoodsReceiptNote {
  id: string;
  grnNo: string;
  date: string;
  dateNepali?: string;
  partyId?: string;
  partyName?: string;
  warehouseId?: string;
  status: string;
  workflowStatus?: WorkflowStatus;
  linkedDocuments?: WorkflowDocRef[];
  lines: DBGoodsReceiptNoteLine[];
  linkedPoId?: string;
  linkedInvoiceId?: string;
  narration?: string;
  vehicleNo?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Physical Stock ───────────────────────────────────────────────────────────
export interface DBPhysicalStockLine {
  itemId: string;
  itemName?: string;
  itemCode?: string;
  unit?: string;
  warehouseId?: string;
  systemQty?: number;
  physicalQty: number;
  difference?: number;
  rate?: number;
  batchNo?: string;
}

export interface DBPhysicalStock {
  id: string;
  stockNo?: string;
  date: string;
  dateNepali?: string;
  warehouseId?: string;
  status: string;
  lines: DBPhysicalStockLine[];
  narration?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Budget ───────────────────────────────────────────────────────────────────
export interface DBBudgetLine {
  accountId: string;
  accountName?: string;
  amount: number;
  period?: string;
}

export interface DBBudget {
  id: string;
  name: string;
  fiscalYearId?: string;
  type?: string;
  status?: string;
  lines: DBBudgetLine[];
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Fixed Asset ──────────────────────────────────────────────────────────────
export interface DBFixedAsset {
  id: string;
  code?: string;
  name: string;
  category?: string;
  purchaseDate?: string;
  purchaseDateNepali?: string;
  originalCost: number;
  salvageValue?: number;
  usefulLife?: number;
  depreciationMethod?: string;
  depreciationRate?: number;
  currentBookValue?: number;
  accumulatedDepreciation?: number;
  assetAccountId?: string;
  depreciationAccountId?: string;
  location?: string;
  status?: string;
  disposalDate?: string;
  disposalValue?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Bank Reconciliation ──────────────────────────────────────────────────────
export interface DBBankReconciliation {
  id: string;
  bankAccountId: string;
  bankAccountName?: string;
  statementDate: string;
  statementDateNepali?: string;
  statementBalance: number;
  bookBalance?: number;
  difference?: number;
  status?: string;
  reconciledEntries?: string[];
  unreconciledEntries?: string[];
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Employee ─────────────────────────────────────────────────────────────────
export interface DBEmployee {
  id: string;
  code?: string;
  name: string;
  nameNepali?: string;
  designation?: string;
  department?: string;
  pan?: string;
  phone?: string;
  email?: string;
  address?: string;
  joinDate?: string;
  joinDateNepali?: string;
  salaryType?: string;
  basicSalary?: number;
  bankAccountNo?: string;
  bankName?: string;
  pfNo?: string;
  citizenshipNo?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Payroll Entry ────────────────────────────────────────────────────────────
export interface DBPayrollEntry {
  id: string;
  month: string;
  year: string;
  fiscalYearId?: string;
  employeeId: string;
  employeeName?: string;
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
  pfEmployee?: number;
  pfEmployer?: number;
  tax?: number;
  netSalary: number;
  status?: string;
  paidDate?: string;
  voucherId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export interface DBAuditLog {
  id?: string | number;
  timestamp: string;
  timestampNepali?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  oldValue?: string;
  newValue?: string;
  changeDescription?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  ipAddress?: string;
  sessionId?: string;
  companyId?: string;
  fiscalYearId?: string;
  checksum?: string;
  // Banking module fields
  module?: string;
  recordId?: string;
  recordType?: string;
  // Generic extensible fields
  [key: string]: any;
}

// ─── Database Class ───────────────────────────────────────────────────────────

// SCHEMA_VERSION retired — version blocks are now explicit in the constructor
// const SCHEMA_VERSION = 18;

export class SutraERPDatabase extends Dexie {
  accounts!: Table<DBAccount>;
  parties!: Table<DBParty>;
  items!: Table<DBItem>;
  vouchers!: Table<DBVoucher>;
  invoices!: Table<DBInvoice>;
  stockMovements!: Table<DBStockMovement>;
  warehouses!: Table<DBWarehouse>;
  stockTransfers!: Table<DBStockTransferVoucher>;
  units!: Table<DBUnit>;
  unitConversions!: Table<DBUnitConversion>;
  costCenters!: Table<DBCostCenter>;
  fiscalYears!: Table<DBFiscalYear>;
  companySettings!: Table<DBCompanySettings>;
  users!: Table<DBUser>;
  notifications!: Table<DBNotification>;
  shortcuts!: Table<DBShortcut>;
  posSessions!: Table<DBPosSession>;
  posHolds!: Table<DBPosHold>;
  priceLists!: Table<DBPriceList>;
  billSundries!: Table<DBBillSundry>;
  standardNarrations!: Table<DBStandardNarration>;
  salesPersons!: Table<DBSalesPerson>;
  purchaseOrders!: Table<DBPurchaseOrder>;
  salesOrders!: Table<DBSalesOrder>;
  quotations!: Table<DBQuotation>;
  deliveryChallans!: Table<DBDeliveryChallan>;
  goodsReceiptNotes!: Table<DBGoodsReceiptNote>;
  physicalStocks!: Table<DBPhysicalStock>;
  budgets!: Table<DBBudget>;
  fixedAssets!: Table<DBFixedAsset>;
  bankReconciliations!: Table<DBBankReconciliation>;
  employees!: Table<DBEmployee>;
  payrollEntries!: Table<DBPayrollEntry>;
  auditLogs!: Table<DBAuditLog>;

  // ─── Extended / Feature Tables (declared as Table<any> for flexibility) ───
  currencies!: Table<any>;
  recurringVouchers!: Table<any>;
  customFieldDefs!: Table<any>;
  billSundryMasters!: Table<any>;
  saleTypes!: Table<any>;
  purchaseTypes!: Table<any>;
  taxCategories!: Table<any>;
  discountStructures!: Table<any>;
  itemGroups!: Table<any>;
  holidays!: Table<any>;
  bankStatements!: Table<any>;
  tdsEntries!: Table<any>;
  tdsChallans!: Table<any>;
  stockJournals!: Table<any>;
  productions!: Table<any>;
  unassembles!: Table<any>;
  materialIssued!: Table<any>;
  materialReceived!: Table<any>;
  stockCategories!: Table<any>;
  voucherTypeMasters!: Table<any>;
  scenarios!: Table<any>;
  costCategories!: Table<any>;
  costCentreClasses!: Table<any>;
  reorderLevels!: Table<any>;
  priceLevels!: Table<any>;
  hsCodes!: Table<any>;
  batches!: Table<any>;
  vatClassifications!: Table<any>;
  tdsNatureOfPayment!: Table<any>;
  employeeGroups!: Table<any>;
  payHeads!: Table<any>;
  salaryDetails!: Table<any>;
  payrollUnits!: Table<any>;
  attendanceTypes!: Table<any>;
  ledgerExtensions!: Table<any>;
  chequeBooks!: Table<any>;
  cheques!: Table<any>;
  depositSlips!: Table<any>;
  pdCheques!: Table<any>;
  ePaymentBatches!: Table<any>;
  paymentAdvices!: Table<any>;
  branches!: Table<any>;
  exchangeRates!: Table<any>;
  followUpNotes!: Table<any>;
  jobWorkOrders!: Table<any>;
  reportSchedules!: Table<any>;
  priceFloorPolicies!: Table<any>;
  chequeBounceLogs!: Table<any>;
  cbmsQueue!: Table<any>;
  voucherAuditLogs!: Table<any>;
  salespersons!: Table<any>;
  loginHistory!: Table<any>;

  constructor() {
    super("SutraERPDatabase");

    // Version 18 — original schema (must stay for Dexie migration chain)
    this.version(18).stores({
      accounts: "id, code, name, type, level, parentId, isGroup, isActive, createdAt",
      parties: "id, code, name, type, pan, isActive, createdAt",
      items: "id, code, sku, barcode, name, category, group, unit, isActive, createdAt",
      vouchers: "id, voucherNo, date, type, status, partyId, createdAt",
      invoices: "id, invoiceNo, date, type, status, partyId, paymentStatus, cbmsStatus, createdAt",
      stockMovements: "id, date, type, itemId, warehouseId, referenceId, referenceType, createdAt",
      warehouses: "id, code, name, isActive, createdAt",
      stockTransfers: "id, transferNo, date, fromWarehouseId, toWarehouseId, status, createdAt",
      units: "id, code, name, isActive, createdAt",
      unitConversions: "id, fromUnitId, toUnitId, itemId, isActive, createdAt",
      costCenters: "id, code, name, type, parentId, isActive, createdAt",
      fiscalYears: "id, name, startDate, endDate, status, isDefault, createdAt",
      companySettings: "id",
      users: "id, username, name, role, isActive, createdAt",
      notifications: "id, type, read, userId, createdAt",
      shortcuts: "++id, key_combo, category, is_active",
      posSessions: "id, date, userId, status, openedAt, createdAt",
      posHolds: "id, name, userId, createdAt",
      priceLists: "id, name, type, isActive, validFrom, validTo, createdAt",
      billSundries: "id, code, name, type, isActive, createdAt",
      standardNarrations: "id, narration, voucherType, isActive, sortOrder, createdAt",
      salesPersons: "id, code, name, isActive, createdAt",
      purchaseOrders: "id, poNo, date, partyId, status, createdAt",
      salesOrders: "id, soNo, date, partyId, status, createdAt",
      quotations: "id, quotationNo, date, partyId, status, createdAt",
      deliveryChallans: "id, dcNo, date, partyId, status, linkedSoId, createdAt",
      goodsReceiptNotes: "id, grnNo, date, partyId, status, linkedPoId, createdAt",
      physicalStocks: "id, stockNo, date, warehouseId, status, createdAt",
      budgets: "id, name, fiscalYearId, type, status, createdAt",
      fixedAssets: "id, code, name, category, status, purchaseDate, createdAt",
      bankReconciliations: "id, bankAccountId, statementDate, status, createdAt",
      employees: "id, code, name, department, isActive, createdAt",
      payrollEntries: "id, month, year, employeeId, status, createdAt",
      auditLogs: "++id, timestamp, userId, action, entityType, entityId",
    });

    // Version 19 — adds loginHistory audit table (no data migration needed)
    this.version(19).stores({
      loginHistory: "++id, companyId, userId, loginAt, success",
    });

    this.version(20).stores({
      currencies: "id, code, name, isActive",
      recurringVouchers: "id, type, status, nextDueDate, createdAt",
      customFieldDefs: "id, entityType, fieldName, isActive, createdAt",
      billSundryMasters: "id, code, name, type, isActive, createdAt",
      saleTypes: "id, name, isActive, createdAt",
      purchaseTypes: "id, name, isActive, createdAt",
      taxCategories: "id, name, rate, isActive, createdAt",
      discountStructures: "id, name, type, isActive, createdAt",
      itemGroups: "id, name, parentId, isActive, createdAt",
      holidays: "id, name, date, createdAt",
      bankStatements: "id, bankAccountId, date, createdAt",
      tdsEntries: "id, date, partyId, section, createdAt",
      tdsChallans: "id, challanNo, date, quarter, createdAt",
      stockJournals: "id, journalNo, date, status, createdAt",
      productions: "id, productionNo, date, status, createdAt",
      unassembles: "id, unassembleNo, date, status, createdAt",
      materialIssued: "id, issueNo, date, status, createdAt",
      materialReceived: "id, receiveNo, date, status, createdAt",
      stockCategories: "id, name, parentId, isActive, createdAt",
      voucherTypeMasters: "id, name, type, isActive, createdAt",
      scenarios: "id, name, isActive, createdAt",
      costCategories: "id, name, isActive, createdAt",
      costCentreClasses: "id, name, isActive, createdAt",
      reorderLevels: "id, itemId, warehouseId, reorderQty, createdAt",
      priceLevels: "id, name, isActive, createdAt",
      hsCodes: "id, code, description, createdAt",
      batches: "id, batchNo, itemId, expiryDate, createdAt",
      vatClassifications: "id, name, rate, isActive, createdAt",
      tdsNatureOfPayment: "id, name, section, rate, isActive, createdAt",
      employeeGroups: "id, name, isActive, createdAt",
      payHeads: "id, name, type, isActive, createdAt",
      salaryDetails: "id, employeeId, effectiveDate, createdAt",
      payrollUnits: "id, name, type, createdAt",
      attendanceTypes: "id, name, code, isActive, createdAt",
      ledgerExtensions: "id, accountId, createdAt",
      chequeBooks: "id, bankAccountId, startLeaf, endLeaf, status, createdAt",
      cheques: "id, chequeBookId, chequeNo, status, createdAt",
      depositSlips: "id, slipNo, bankAccountId, date, status, createdAt",
      pdCheques: "id, chequeNo, partyId, dueDate, status, createdAt",
      ePaymentBatches: "id, batchNo, bankAccountId, date, status, createdAt",
      paymentAdvices: "id, adviceNo, partyId, date, status, createdAt",
    });
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

let _db: SutraERPDatabase | null = null;

export function getDB(): SutraERPDatabase {
  if (!_db) {
    _db = new SutraERPDatabase();
  }
  return _db;
}

// Named alias used by some pages
export const db = getDB();

export default getDB;

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

export async function seedPredefinedVoucherTypes(): Promise<void> {
  const database = getDB();
  const existing = await database.voucherTypeMasters.count();
  if (existing > 0) return; // already seeded

  const predefined = [
    {
      id: "vt-sales-invoice",
      name: "Sales Invoice",
      type: "sales-invoice",
      isPredefined: true,
      isActive: true,
      prefix: "SI",
      numbering: "auto",
    },
    {
      id: "vt-purchase-invoice",
      name: "Purchase Invoice",
      type: "purchase-invoice",
      isPredefined: true,
      isActive: true,
      prefix: "PI",
      numbering: "auto",
    },
    {
      id: "vt-sales-return",
      name: "Sales Return",
      type: "sales-return",
      isPredefined: true,
      isActive: true,
      prefix: "SR",
      numbering: "auto",
    },
    {
      id: "vt-purchase-return",
      name: "Purchase Return",
      type: "purchase-return",
      isPredefined: true,
      isActive: true,
      prefix: "PR",
      numbering: "auto",
    },
    {
      id: "vt-receipt",
      name: "Receipt",
      type: "receipt",
      isPredefined: true,
      isActive: true,
      prefix: "RC",
      numbering: "auto",
    },
    {
      id: "vt-payment",
      name: "Payment",
      type: "payment",
      isPredefined: true,
      isActive: true,
      prefix: "PV",
      numbering: "auto",
    },
    {
      id: "vt-journal",
      name: "Journal",
      type: "journal",
      isPredefined: true,
      isActive: true,
      prefix: "JV",
      numbering: "auto",
    },
    {
      id: "vt-contra",
      name: "Contra",
      type: "contra",
      isPredefined: true,
      isActive: true,
      prefix: "CV",
      numbering: "auto",
    },
    {
      id: "vt-debit-note",
      name: "Debit Note",
      type: "debit-note",
      isPredefined: true,
      isActive: true,
      prefix: "DN",
      numbering: "auto",
    },
    {
      id: "vt-credit-note",
      name: "Credit Note",
      type: "credit-note",
      isPredefined: true,
      isActive: true,
      prefix: "CN",
      numbering: "auto",
    },
  ];

  await database.voucherTypeMasters.bulkPut(predefined as any[]);
}
