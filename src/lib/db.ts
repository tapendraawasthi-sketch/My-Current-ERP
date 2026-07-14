// @ts-nocheck
import Dexie, { Table } from "dexie";
import { generateSerialNumber } from "./accounting";

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
  defaultTdsNatureId?: string;
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
  personType?: "individual" | "entity";
  residency?: "resident" | "non-resident";
  defaultTdsNatureId?: string;
  subjectToTds?: boolean;
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
  /** Runtime on-hand projection (updated by stock movements / seeding). */
  currentStock?: number;
  openingQty?: number;
  openingStock?: number;
  openingStockRate?: number;
  reorderLevel?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  isTaxable?: boolean;
  vatRate?: number;
  vatClassificationId?: string;
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
  /** Phase 7 — link return/credit line back to original sales line */
  originalSalesLineId?: string;
  unitCost?: number;
  costAmount?: number;
  taxRuleVersion?: string;
  valuationMethod?: string;
  costAllocationId?: string;
  stockCondition?: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
import type { CbmsStatus } from "./cbmsTypes";

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
  cbmsStatus?: CbmsStatus;
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
  /** Phase 7 — original sales invoice for returns / credit notes */
  originalInvoiceId?: string;
  taxRuleVersion?: string;
  inventoryAccounting?: string;
  valuationMethod?: string;
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

/** Wave 1 (FI-021): fiscal period lock rows — authoritative store for posting enforcement. */
export interface DBPeriodLock {
  id: string;
  companyId?: string;
  fiscalYear?: string;
  periodKey: string;
  lockedMonth?: string;
  lockedAt: string;
  lockedBy?: string;
  lockedByName?: string;
  lockReason?: string;
  isUnlocked?: boolean;
  unlockedBy?: string;
  unlockedAt?: string;
  unlockReason?: string;
  requiresPin?: boolean;
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
  /** Phase 5: explicit sync policy — local_only | sync_enabled | sync_required */
  syncPolicy?: "local_only" | "sync_enabled" | "sync_required";
  companyId?: string;
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
  type: string;
  nature?: string;
  calculationType?: "fixed" | "percentage";
  rate?: number;
  accountId?: string;
  accountHeadId?: string;
  accountName?: string;
  isActive?: boolean;
  affectCostInSale?: boolean;
  affectCostInPurchase?: boolean;
  accountingInSale?: string;
  accountingInPurchase?: string;
  affectAccountingInStockTransfer?: boolean;
  gstApplicable?: boolean;
  taxCategoryId?: string;
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
  narration?: string; // made optional
  text?: string;
  category?: string;
  voucherTypes?: string[];
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
  name: string;
  code?: string;
  category: string; // e.g. "Furniture", "Vehicle", "Computer", "Machinery"
  purchaseDate: string; // ISO date
  purchaseCost: number; // original cost
  residualValue: number; // scrap value at end of life
  usefulLifeYears: number; // expected useful life
  depreciationMethod: "slm" | "wdv"; // Straight Line or Written Down Value
  wdvRate?: number; // % rate for WDV (Nepal IT Act rates)
  assetAccountId?: string; // linked GL account
  depreciationAccountId?: string;
  accumulatedDepAccountId?: string;
  location?: string;
  serialNo?: string;
  supplier?: string;
  isActive: boolean;
  disposalDate?: string;
  disposalAmount?: number;
  disposalReason?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields (not stored, calculated on read)
  openingGrossBlock?: number;
  additions?: number;
  disposals?: number;
  closingGrossBlock?: number;
  openingAccumDepr?: number;
  depreciationForYear?: number;
  closingAccumDepr?: number;
  netBookValue?: number;
}

export interface DBDepreciationEntry {
  id: string;
  assetId: string;
  assetName: string;
  date: string;
  fiscalYear: string;
  method: "slm" | "wdv";
  openingNBV: number; // net book value at start of period
  depreciationAmount: number;
  closingNBV: number;
  voucherId?: string; // linked journal voucher if auto-posted
  createdAt: string;
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
  bonusEligible?: boolean;
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

// ─── Sync outbox (offline-first) ──────────────────────────────────────────────
export interface DBSyncOutboxRecord {
  id: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update";
  payload: Record<string, unknown>;
  createdAt: string;
  syncedAt: string | null;
  syncAttempts: number;
  lastError?: string;
  status?: "pending" | "sync_failed";
}

/** Dexie-scoped Orbix / purchase posting idempotency receipt (v27+) */
export interface DBOrbixPostingReceiptRow {
  id: string;
  idempotencyKey: string;
  scopedKey: string;
  tenantId: string;
  companyId: string;
  userId: string;
  operation: string;
  draftId: string | null;
  draftVersion: number | null;
  previewVersion: string | null;
  previewHash: string | null;
  status: "processing" | "completed" | "failed";
  postingId: string;
  voucherId: string | null;
  invoiceId: string | null;
  journalId: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
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
  periodLocks!: Table<DBPeriodLock>;
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
  depreciationLedger!: Table<DBDepreciationEntry>;
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
  voucherSeriesConfig!: Table<any>;
  voucherAuditLogs!: Table<any>;
  costCategories!: Table<any>;
  costCentreClasses!: Table<any>;
  reorderLevels!: Table<any>;
  priceLevels!: Table<any>;
  hsCodes!: Table<any>;
  batches!: Table<DBBatch>;
  serialNumbers!: Table<DBSerialNumber>;
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
  pdcRegister!: Table<DBPDCEntry>;
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
  salespersons!: Table<any>;
  loginHistory!: Table<any>;
  salaryStructures!: Table<any>;
  payrollRuns!: Table<any>;
  fxGainLossEntries!: Table<DBFXGainLossEntry>;
  costCentres!: Table<DBCostCentre>;
  costCentreAllocations!: Table<DBCostCentreAllocation>;
  approvalPolicies!: Table<DBApprovalPolicy>;
  approvalRequests!: Table<DBApprovalRequest>;
  approvalActions!: Table<DBApprovalAction>;
  recurringTemplates!: Table<DBRecurringTemplate>;
  recurringPostings!: Table<DBRecurringPosting>;
  syncOutbox!: Table<DBSyncOutboxRecord>;
  domainEvents!: Table<any>;
  eventSnapshots!: Table<any>;
  eventStoreCursors!: Table<any>;
  eventDedupKeys!: Table<any>;
  projectionMeta!: Table<any>;
  projectionCheckpoints!: Table<any>;
  projectionGlobalCursor!: Table<any>;
  projectionAccountBalances!: Table<any>;
  projectionGeneralLedger!: Table<any>;
  projectionTrialBalance!: Table<any>;
  projectionVouchers!: Table<any>;
  projectionInvoices!: Table<any>;
  projectionParties!: Table<any>;
  projectionInventory!: Table<any>;
  projectionStockLedger!: Table<any>;
  projectionStockBalances!: Table<any>;
  projectionTax!: Table<any>;
  projectionAudit!: Table<any>;
  projectionNotifications!: Table<any>;
  projectionCompany!: Table<any>;
  projectionFiscalYear!: Table<any>;
  projectionNumberSeries!: Table<any>;
  projectionSyncCursor!: Table<any>;
  projectionParityResults!: Table<any>;
  eventSyncQueue!: Table<any>;
  eventSyncCursors!: Table<any>;
  eventSyncDeadLetter!: Table<any>;
  eventSyncConflicts!: Table<any>;
  orbixPostingReceipts!: Table<DBOrbixPostingReceiptRow>;
  /** Phase 5 — company-scoped local sync sequence + hash chain tip */
  syncLocalSequences!: Table<any>;
  /** Phase 6.5 — persisted sales line cost allocations */
  salesCostAllocations!: Table<any>;
  /** Phase 7 — optimistic concurrency for sales returns / credit notes */
  salesInvoiceAdjustmentState!: Table<any>;
  /** Phase 8 — optimistic concurrency for purchase returns / debit notes */
  purchaseInvoiceAdjustmentState!: Table<any>;
  /** Phase 9 — settlement allocations + document/advance state */
  settlementAllocations!: Table<any>;
  documentSettlementState!: Table<any>;
  partyAdvances!: Table<any>;
  partyAdvanceApplications!: Table<any>;
  unappliedBalances!: Table<any>;
  /** Phase 10 — treasury / bank reconciliation */
  bankAccounts!: Table<any>;
  bankStatementBatches!: Table<any>;
  bankStatementLines!: Table<any>;
  bankReconciliationLinks!: Table<any>;
  bankReconciliationSessions!: Table<any>;
  chequeInstruments!: Table<any>;
  treasuryForecastItems!: Table<any>;

  constructor() {
    super("SutraERPDatabase");

    // ── Handle another tab blocking a DB version upgrade ──────────────────
    // Without this, the DB open hangs forever when another tab holds an older
    // version open and refuses to close (the classic "Loading…" forever bug).
    this.on("versionchange", () => {
      console.warn("[SutraERP] DB version change detected — closing connection.");
      this.close();
      // DO NOT call window.location.reload() here. Combined with the
      // 'blocked' event it creates an infinite reload loop. Closing
      // the connection is enough to let the upgrading tab proceed.
    });

    this.on("blocked", () => {
      console.warn("[SutraERP] DB upgrade blocked — letting openDB() timeout handle recovery.");
      // DO NOT reload here. Reloading when blocked just reloads into
      // the same blocked state, causing an infinite loop.
      // openDB()'s 8-second DB_OPEN_TIMEOUT will delete and recreate the DB.
    });

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
      fixedAssets: "id, name, category, purchaseDate, isActive",
      depreciationLedger: "++id, assetId, date, fiscalYear",
      batches: "++id, itemId, batchNo, expiryDate, isActive",
      serialNumbers: "++id, itemId, serialNo, status, soldToPartyId",
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
      pdcRegister: "++id, type, partyId, chequeDate, status",
      ePaymentBatches: "id, batchNo, bankAccountId, date, status, createdAt",
      paymentAdvices: "id, adviceNo, partyId, date, status, createdAt",
      employees: "id, employeeCode, name, department, designation, isActive",
      salaryStructures: "++id, employeeId, effectiveFrom",
      payrollRuns: "++id, month, year, status",
      payrollEntries: "id, payrollRunId, employeeId, month, year",
      currencies: "++id, code, isActive",
      exchangeRates: "++id, currencyCode, date",
      fxGainLossEntries: "++id, date, currencyCode, voucherId",
      costCentres: "++id, code, type, parentId, isActive",
      costCentreAllocations: "++id, voucherId, costCentreId, date",
      approvalPolicies: "++id, voucherType, isActive",
      approvalRequests: "++id, voucherId, voucherType, status, createdAt",
      approvalActions: "++id, requestId, level, actionAt",
      recurringTemplates: "++id, name, frequency, isActive, nextDueDate",
      recurringPostings: "++id, templateId, postedDate, voucherId",
      // ── Tables declared on the class but previously missing from schema ──
      branches: "++id, name, isActive, createdAt",
      cbmsQueue: "++id, invoiceId, status, createdAt",
      chequeBounceLogs: "++id, chequeId, date, createdAt",
      followUpNotes: "++id, partyId, date, createdAt",
      jobWorkOrders: "++id, orderNo, date, status, createdAt",
      priceFloorPolicies: "++id, itemId, isActive, createdAt",
      voucherSeriesConfig: "++id, voucherType, seriesName",
      reportSchedules: "++id, name, isActive, createdAt",
      salespersons: "++id, name, isActive, createdAt",
      voucherAuditLogs: "++id, voucherId, action, createdAt",
    });

    // Version 21 — adds 9 tables that were declared on the class but
    // were never included in any schema, causing _loadAllData to crash.
    this.version(21).stores({
      branches: "++id, name, isActive, createdAt",
      cbmsQueue: "++id, invoiceId, status, createdAt",
      chequeBounceLogs: "++id, chequeId, date, createdAt",
      followUpNotes: "++id, partyId, date, createdAt",
      jobWorkOrders: "++id, orderNo, date, status, createdAt",
      priceFloorPolicies: "++id, itemId, isActive, createdAt",
      stockCategories: "++id, name, parentId",
      voucherTypeMasters: "++id, name, parentId, type",
      voucherSeriesConfig: "++id, voucherType, seriesName",
      voucherAuditLogs: "++id, voucherId, action, createdAt",
    });

    // Version 22 — offline-first sync outbox
    this.version(22).stores({
      syncOutbox: "id, entityType, entityId, operation, syncedAt, syncAttempts, createdAt, status",
    });

    // Version 23 — append-only domain event store (F4)
    this.version(23).stores({
      domainEvents:
        "id, tenantId, companyId, aggregateType, aggregateId, sequence, globalSequence, eventType, correlationId, causationId, commandId, [aggregateType+aggregateId+sequence], [causationId+eventType], [tenantId+globalSequence], occurredAt",
      eventSnapshots: "aggregateKey, sequence, createdAt",
      eventStoreCursors: "id, tenantId",
      eventDedupKeys: "id, causationId, eventType",
    });

    // Version 24 — disposable CQRS projection caches (F6)
    this.version(24).stores({
      projectionMeta: "id, projectionName, status, lastGlobalSequence, updatedAt",
      projectionCheckpoints: "id, projectionName, globalSequence, updatedAt",
      projectionGlobalCursor: "id, lastGlobalSequence, status, updatedAt",
      projectionAccountBalances: "id, accountId, globalSequence, updatedAt",
      projectionGeneralLedger: "id, accountId, voucherId, date, globalSequence",
      projectionTrialBalance: "id, accountId, snapshotSequence, updatedAt",
      projectionVouchers: "id, aggregateId, globalSequence, updatedAt",
      projectionInvoices: "id, aggregateId, globalSequence, updatedAt",
      projectionParties: "id, aggregateId, globalSequence, updatedAt",
      projectionInventory: "id, itemId, globalSequence, updatedAt",
      projectionStockLedger: "id, itemId, date, globalSequence",
      projectionStockBalances: "id, itemId, globalSequence, updatedAt",
      projectionTax: "id, entryId, globalSequence, updatedAt",
      projectionAudit: "id, entryId, globalSequence, updatedAt",
      projectionNotifications: "id, notificationId, globalSequence, updatedAt",
      projectionCompany: "id, globalSequence, updatedAt",
      projectionFiscalYear: "id, globalSequence, updatedAt",
      projectionNumberSeries: "id, seriesKey, globalSequence, updatedAt",
      projectionSyncCursor: "id, lastGlobalSequence, updatedAt",
      projectionParityResults: "id, projectionName, metric, recordedAt",
    });

    // Version 25 — event-carried sync pipeline (F8)
    this.version(25).stores({
      eventSyncQueue: "id, eventId, globalSequence, tenantId, status, createdAt, syncedAt",
      eventSyncCursors: "id, deviceId, tenantId, lastGlobalSequence, updatedAt",
      eventSyncDeadLetter: "id, eventId, createdAt",
      eventSyncConflicts: "id, eventId, classification, createdAt",
    });

    // Version 26 — Wave 1 FI-021: authoritative periodLocks table + legacy localStorage import
    this.version(26)
      .stores({
        periodLocks: "id, companyId, periodKey, fiscalYear, lockedAt, isUnlocked",
      })
      .upgrade(async (trans) => {
        try {
          const { importLegacyPeriodLocksIntoDexie } = await import("./periodLock");
          await importLegacyPeriodLocksIntoDexie(trans, { clearLocalStorageAfterImport: true });
        } catch (err) {
          console.warn("[SutraERP] periodLocks v26 legacy import failed (non-fatal):", err);
        }
        try {
          const { notePeriodLockDbUpgrade } = await import("./ledger/periodLockService");
          notePeriodLockDbUpgrade();
        } catch {
          /* non-fatal */
        }
      });

    // Version 27 — Orbix / purchase posting idempotency receipts (Model B)
    this.version(27).stores({
      orbixPostingReceipts:
        "id, scopedKey, idempotencyKey, companyId, draftId, status, postingId, invoiceId, createdAt",
    });

    // Version 28 — Phase 5 durable accounting sync (local sequence + queue indexes)
    this.version(28).stores({
      syncLocalSequences: "id, companyId, tenantId, lastSequence, updatedAt",
      eventSyncQueue:
        "id, eventId, globalSequence, tenantId, companyId, status, createdAt, syncedAt, nextAttemptAt",
    });

    // Version 29 — Phase 6.5 sales cost allocations (exact unit/total cost at posting)
    this.version(29).stores({
      salesCostAllocations:
        "id, posting_id, invoice_id, item_id, company_id, sales_line_id, valued_at",
    });

    // Version 30 — Phase 7 sales return / credit note adjustment state
    this.version(30).stores({
      salesInvoiceAdjustmentState: "id, companyId, adjustmentVersion, updatedAt",
    });

    // Version 31 — Phase 8 purchase return / debit note adjustment state
    this.version(31).stores({
      purchaseInvoiceAdjustmentState: "id, companyId, adjustmentVersion, updatedAt",
    });

    // Version 32 — Phase 9 settlement allocations / advances / unapplied balances
    this.version(32).stores({
      settlementAllocations:
        "id, companyId, voucherId, targetDocumentId, partyId, component, status, createdAt",
      documentSettlementState: "id, companyId, settlementVersion, updatedAt",
      partyAdvances: "id, companyId, partyId, side, advanceVersion, status, updatedAt",
      partyAdvanceApplications: "id, companyId, advanceId, documentId, allocationId, createdAt",
      unappliedBalances: "id, companyId, partyId, classification, status, sourceVoucherId, createdAt",
    });

    // Version 33 — Phase 10 treasury / bank reconciliation
    this.version(33).stores({
      bankAccounts: "id, companyId, ledgerAccountId, currency, isActive, updatedAt",
      bankStatementBatches:
        "id, companyId, bankAccountId, sourceHash, status, importedAt, periodStart, periodEnd",
      bankStatementLines:
        "id, batchId, bankAccountId, companyId, transactionDate, status, reconciliationVersion, rawHash, lineNumber",
      bankReconciliationLinks: "id, companyId, bankAccountId, sessionId, status, version, confirmedAt",
      bankReconciliationSessions:
        "id, companyId, bankAccountId, status, version, periodStart, periodEnd, closedAt",
      chequeInstruments:
        "id, companyId, bankAccountId, partyId, instrumentNumber, status, instrumentVersion, amountPaisa, chequeDate",
      treasuryForecastItems: "id, companyId, date, side, amountPaisa, confidence, status",
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

export async function resetDB(): Promise<SutraERPDatabase> {
  if (_db) {
    try {
      _db.close();
    } catch (_) {}
    _db = null;
  }
  _db = new SutraERPDatabase();
  return _db;
}

/**
 * Opens the DB and ensures it is actually reachable before returning.
 * When MIGRATION_SAFE_OPEN_DB or MIGRATION_EVENT_STORE is enabled, uses
 * non-destructive safe-open (never deletes the database).
 */
export async function openDB() {
  const { isSafeOpenEnabled, safeOpenDatabase, SafeOpenError } = await import(
    "@/platform/event-store/safeOpen"
  );

  const db = getDB();

  if (isSafeOpenEnabled()) {
    const result = await safeOpenDatabase(db);
    if (!result.ok) {
      throw new SafeOpenError(result);
    }
    return result.db;
  }

  try {
    await Promise.race([
      db.open(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB_OPEN_TIMEOUT")), 8000)),
    ]);
  } catch (err: any) {
    if (
      err?.message === "DB_OPEN_TIMEOUT" ||
      err?.name === "VersionError" ||
      err?.name === "UpgradeError" ||
      (err?.message || "").toLowerCase().includes("primary key")
    ) {
      console.error("[SutraERP] DB open failed — deleting and recreating.", err);
      try {
        db.close();
        await Dexie.delete("SutraERPDatabase");
      } catch {}
      // Reset singleton
      const newDb = await resetDB();
      await Promise.race([
        newDb.open(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("DB_RECOVERY_TIMEOUT")), 5000),
        ),
      ]);
      return newDb;
    }
    throw err;
  }
  return db;
}

// Named alias used by some pages — includes accounting helpers for legacy call sites
export { generateSerialNumber };

export const db = Object.assign(getDB(), { generateSerialNumber });

export default getDB;

/** Read a Dexie row when the table may not exist in the schema (e.g. inventoryConfig). */
export async function safeTableGet(tableName: string, key: string | number): Promise<any> {
  try {
    const database = getDB();
    if (!database.tables.some((t) => t.name === tableName)) return null;
    return await database.table(tableName).get(key);
  } catch {
    return null;
  }
}

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

// ─── Batch & Serial Tracking ──────────────────────────────────────────────────
export interface DBBatch {
  id: string;
  itemId: string;
  itemName: string;
  batchNo: string;
  manufacturingDate?: string;
  expiryDate?: string;
  purchaseDate: string;
  purchaseRate: number;
  openingQty: number;
  currentQty: number;
  warehouseId?: string;
  supplierId?: string;
  supplierBatchNo?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBSerialNumber {
  id: string;
  itemId: string;
  itemName: string;
  serialNo: string;
  status: "available" | "sold" | "returned" | "damaged" | "reserved";
  purchaseDate?: string;
  purchaseRate?: number;
  soldDate?: string;
  soldToPartyId?: string;
  soldToPartyName?: string;
  invoiceId?: string;
  invoiceNo?: string;
  warehouseId?: string;
  warrantyExpiry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── PDC (Post-Dated Cheques) ─────────────────────────────────────────────────
export interface DBPDCEntry {
  id: string;
  type: "received" | "issued"; // received from customer / issued to supplier
  partyId: string;
  partyName: string;
  partyPan?: string;
  bankName: string;
  branchName?: string;
  chequeNo: string;
  chequeDate: string; // future date on the cheque
  amount: number;
  currency?: string;
  status: "pending" | "deposited" | "dishonoured" | "cancelled" | "returned";
  depositDate?: string; // when actually deposited to bank
  dishonourDate?: string;
  dishonourReason?: string;
  bankAccountId?: string; // our bank account to deposit into
  linkedInvoiceId?: string;
  linkedInvoiceNo?: string;
  narration?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface DBApprovalRequest {
  id?: number;
  voucherId?: number;
  voucherType: string;
  voucherDate: string;
  voucherAmount: number;
  voucherNarration: string;
  currentLevel: number;
  totalLevels: number;
  status: ApprovalStatus;
  makerUserId: string;
  makerName: string;
  policyId: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBApprovalAction {
  id?: number;
  requestId: number;
  level: number;
  action: "approved" | "rejected" | "returned";
  actionByUserId: string;
  actionByName: string;
  comments: string;
  actionAt: string;
  createdAt: string;
}

export type RecurringFrequency =
  "daily" | "weekly" | "fortnightly" | "monthly" | "quarterly" | "half-yearly" | "yearly";

export interface DBRecurringLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  costCentreId?: number;
  narration: string;
}

export interface DBRecurringTemplate {
  id?: number;
  name: string;
  description: string;
  voucherType: string; // "journal", "payment", "receipt", etc.
  frequency: RecurringFrequency;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string; // optional end date
  nextDueDate: string; // computed next posting date
  lines: DBRecurringLine[]; // JSON-serialised
  totalAmount: number;
  isActive: boolean;
  autoPost: boolean; // if true, posts automatically without review
  reminderDaysBefore: number; // days before due date to show reminder
  lastPostedDate?: string;
  postingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBRecurringPosting {
  id?: number;
  templateId: number;
  templateName: string;
  postedDate: string;
  voucherId?: number; // ID of the created voucher
  status: "posted" | "skipped" | "failed";
  notes: string;
  createdAt: string;
}

// @ts-nocheck
export interface DBEmployee {
  id?: number;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  panNumber: string;
  bankAccount: string;
  bankName: string;
  joiningDate: string;
  isActive: boolean;
  gender: "male" | "female" | "other";
  maritalStatus: "single" | "married";
  epfApplicable: boolean;
  citApplicable: boolean;
  ssfApplicable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DBSalaryStructure {
  id?: number;
  employeeId: number;
  effectiveFrom: string;
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  epfRate: number; // default 10% employee, 10% employer
  citRate: number; // default 10%
  ssfRate: number; // default 1% employee, 3.33% employer (SSF mode)
  createdAt: string;
  updatedAt: string;
}

export interface DBPayrollRun {
  id?: number;
  month: number; // 1–12
  year: number; // Gregorian or BS year
  fiscalYear: string;
  status: "draft" | "processed" | "approved" | "paid";
  totalGross: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerContribution: number;
  processedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBPayrollEntry {
  id?: number;
  payrollRunId: number;
  employeeId: number;
  employeeName: string;
  department: string;
  month: number;
  year: number;
  // Earnings
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  overtimePay: number;
  grossSalary: number;
  // Deductions
  epfEmployee: number; // 10% of basic
  citEmployee: number; // 10% of basic (if opted)
  ssfEmployee: number; // 1% of gross (if SSF mode)
  tdsAmount: number; // progressive slab
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  // Employer contributions
  epfEmployer: number; // 10% of basic
  ssfEmployer: number; // 3.33% of gross
  // Annualised tax workings
  annualisedGross: number;
  taxableIncome: number;
  annualTax: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBCurrency {
  id?: number;
  code: string; // e.g. "USD", "EUR", "INR"
  name: string; // e.g. "US Dollar"
  symbol: string; // e.g. "$"
  decimalPlaces: number; // usually 2
  isActive: boolean;
  isBase: boolean; // true for the company's home currency (NPR)
  createdAt: string;
  updatedAt: string;
}

export interface DBExchangeRate {
  id?: number;
  currencyCode: string; // foreign currency code
  date: string; // "YYYY-MM-DD" – rate effective from this date
  buyRate: number; // bank buy rate (foreign → base)
  sellRate: number; // bank sell rate (base → foreign)
  midRate: number; // mid/official rate used for accounting
  source: string; // "manual" | "NRB" | "IRD"
  createdAt: string;
  updatedAt: string;
}

export interface DBFXGainLossEntry {
  id?: number;
  date: string;
  currencyCode: string;
  foreignAmount: number;
  rateAtTransaction: number;
  rateAtSettlement: number; // for realized; 0 for unrealized
  rateAtRevaluation: number; // for unrealized period-end
  baseAmountAtTransaction: number;
  baseAmountAtSettlement: number;
  gainLossAmount: number; // positive = gain, negative = loss
  type: "realized" | "unrealized";
  voucherId?: number;
  relatedAccountId: string;
  narration: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBCostCentre {
  id?: number;
  code: string;
  name: string;
  type: "cost" | "profit" | "investment";
  parentId?: number; // for hierarchy (department → sub-department)
  description: string;
  managerId?: string;
  budgetAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DBCostCentreAllocation {
  id?: number;
  voucherId: number;
  voucherDate: string;
  voucherType: string;
  costCentreId: number;
  costCentreName: string;
  accountId: string;
  accountName: string;
  amount: number;
  allocationPercent: number; // if split across multiple centres
  narration: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBApprovalLevel {
  level: number; // 1 = first checker, 2 = second, etc.
  approverRole: string; // e.g. "accountant", "manager", "director"
  approverUserId?: string; // optional: lock to specific user
  isRequired: boolean;
}

export interface DBApprovalPolicy {
  id?: number;
  voucherType: string; // "payment", "receipt", "journal", "purchase", "sales", "*"
  minimumAmount: number; // apply only if voucher amount ≥ this
  levels: DBApprovalLevel[]; // JSON-serialised array
  isActive: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}
