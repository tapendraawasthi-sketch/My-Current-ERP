// src/lib/db.ts
import Dexie, { type Table } from "dexie";

export interface DBAccount {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: string;
  level: string;
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
  [key: string]: any;
}

export interface DBAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  recordId: string;
  recordNo: string;
  description: string;
  beforeData: string | null;
  afterData: string | null;
  ipAddress: string;
  deviceInfo: string;
  fiscalYear: string;
  companyId: string;
}

export interface DBPeriodLock {
  id: string;
  companyId: string;
  fiscalYear: string;
  lockedMonth: string;
  lockedBy: string;
  lockedAt: string;
  lockReason: string;
  isUnlocked: boolean;
  unlockedBy?: string;
  unlockedAt?: string;
  unlockReason?: string;
}

export interface DBParty {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: string;
  pan?: string;
  vatNo?: string;
  phone?: string;
  email?: string;
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
  openingBalanceType?: string;
  openingBalanceDate?: string;
  subjectToTds?: boolean;
  tdsSection?: string;
  tdsType?: string;
  tdsRate?: number;
  personType?: "individual" | "entity";
  residency?: "resident" | "non-resident";
  isActive?: boolean;
  balance?: number;
  status?: string;
  accountId?: string;
  website?: string;
  contactPerson?: string;
  isBoth?: boolean;
  [key: string]: any;
}

export interface DBItem {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: string;
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
  isActive: boolean;
  baseUnit?: string;
  [key: string]: any;
}

export interface DBVoucher {
  id: string;
  voucherNo: string;
  date: string;
  dateNepali: string;
  type: string;
  narration: string;
  referenceNo?: string;
  lines: any[];
  status: string;
  totalDebit: number;
  totalCredit: number;
  cancellationReason?: string;
  grandTotal?: number;
  tdsSection?: string;
  tdsRate?: number;
  tdsAmount?: number;
  tdsDeductedFrom?: string;
  grossAmount?: number;
  netPayable?: number;
  tdsChallanNo?: string;
  tdsChallanDateBS?: string;
  [key: string]: any;
}

export interface CBMSQueueItem {
  id?: string;
  invoiceId: string;
  action: "submit" | "cancel";
  payload?: any;
  reason?: string;
  attempts: number;
  lastError?: string;
  status: "pending" | "processing" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface DBInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  dateNepali: string;
  type: string;
  partyId: string;
  partyName: string;
  partyPan?: string;
  lines: any[];
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: string;
  paymentStatus: string;
  status: string;
  narration?: string;
  cancellationReason?: string;
  dueDate?: string;
  tdsAmount?: number;
  tdsRate?: number;
  tdsType?: string;
  billSundries?: any[];
  attachments?: string[];
  cbmsSubmitted?: boolean;
  cbmsIrn?: string;
  cbmsQrString?: string;
  cbmsQrCode?: string;
  cbmsSubmittedAt?: string;
  cbmsStatus?: "success" | "failed" | "pending" | "submitted" | "cancelled";
  tdsSection?: string;
  tdsDeductedFrom?: string;
  grossAmount?: number;
  netPayable?: number;
  cbmsError?: string;
  cbmsCancelledAt?: string;
  cbmsCancelReason?: string;
  isCancelled?: boolean;
  isAmended?: boolean;
  isExport?: boolean;
  isZeroRated?: boolean;
  [key: string]: any;
}

export interface DBStockMovement {
  id: string;
  date: string; // AD
  dateNepali: string; // BS
  type:
    | "opening"
    | "purchase"
    | "purchase-return"
    | "sales"
    | "sales-return"
    | "stock-transfer-out"
    | "stock-transfer-in"
    | "stock-journal-in"
    | "stock-journal-out"
    | "production-in"
    | "production-out"
    | "physical-stock";

  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;

  qty: number; // positive qty
  rate: number;
  amount: number;

  referenceId?: string;
  referenceType?: string;
  referenceNo?: string;

  batchNo?: string;
  branchId?: string;
  branchName?: string;
}

export interface DBWarehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;

  // Multi-branch / godown additions
  branchId?: string;
  branchName?: string;
  branchCompanyCode?: string;
  isMainBranch?: boolean;
  allowNegativeStock?: boolean;
  costCenterId?: string;

  // Godown hierarchy
  parentId?: string;
  level?: "main" | "sub";
}

export type StockValuationMethod = "fifo" | "weighted-average" | "lifo";

export interface DBStockTransferLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  fromBatch?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface DBStockTransferVoucher {
  id: string;
  transferNo: string;
  date: string; // AD
  dateNepali: string; // BS

  fromWarehouseId: string;
  fromWarehouseName: string;
  fromBranchId?: string;
  fromBranchName?: string;

  toWarehouseId: string;
  toWarehouseName: string;
  toBranchId?: string;
  toBranchName?: string;

  isInterBranch: boolean;
  lines: DBStockTransferLine[];

  totalQty: number;
  totalAmount: number;

  narration?: string;
  authorizedBy?: string;
  status: "draft" | "posted" | "cancelled";

  accountingVoucherId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface DBUnit {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces?: number;
  isActive: boolean;
  [key: string]: any;
}

export interface DBCostCenter {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  level?: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBFiscalYear {
  id: string;
  name: string;
  fiscalYearBS?: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean;
  [key: string]: any;
}

export interface DBDeliveryChallan {
  id: string;
  challanNo: string;
  date: string;
  dateNepali: string;
  partyId: string;
  partyName: string;
  lines: any[];
  totalQty: number;
  status: string;
  vehicleNo?: string;
  driverName?: string;
  salesOrderId?: string;
  inventoryPosted?: boolean;
  [key: string]: any;
}

export interface DBGoodsReceiptNote {
  id: string;
  grnNo: string;
  date: string;
  dateNepali: string;
  partyId: string;
  partyName: string;
  lines: any[];
  totalQty: number;
  status: string;
  vehicleNo?: string;
  inspectedBy?: string;
  purchaseOrderId?: string;
  inventoryPosted?: boolean;
  [key: string]: any;
}

export interface DBSalesOrder {
  id: string;
  orderNo: string;
  date: string;
  partyId: string;
  partyName: string;
  lines: any[];
  grandTotal: number;
  status: string;
  [key: string]: any;
}

export interface DBPurchaseOrder {
  id: string;
  orderNo: string;
  date: string;
  partyId: string;
  partyName: string;
  lines: any[];
  grandTotal: number;
  status: string;
  [key: string]: any;
}

export interface DBCompanySettings {
  id: string;
  name: string;
  [key: string]: any;
}

export interface DBUser {
  id: string;
  username: string;
  name: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBShortcut {
  id: number;
  key_combo: string;
  label: string;
  action_type: string;
  action_value: string;
  category: string;
  is_active: boolean;
  [key: string]: any;
}

export interface DBNotification {
  id: string;
  message: string;
  read: boolean;
  timestamp: string;
  type?: string;
  [key: string]: any;
}

export interface DBBudget {
  id: string;
  name: string;
  fiscalYearId: string;
  lines: any[];
  [key: string]: any;
}

export interface DBRecurringVoucher {
  id: string;
  name: string;
  voucherType: string;
  frequency: string;
  nextDate: string;
  isActive: boolean;
  template: any;
  [key: string]: any;
}

export interface DBCustomFieldDef {
  id: string;
  entity: string;
  label: string;
  fieldType: string;
  required: boolean;
  isActive: boolean;
  sortOrder: number;
  options?: string[];
  [key: string]: any;
}

export interface DBCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isBase: boolean;
  isActive: boolean;
  [key: string]: any;
}

export interface DBVoucherTypeMaster {
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
  whatsAppAfterSaving: boolean;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
  [key: string]: any;
}

export interface DBVoucherAuditLog {
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
  oldValues?: string;
  newValues?: string;
  changedFields?: string;
  status: string;
  failureReason?: string;
  [key: string]: any;
}

// ─── NEW: Administration Module Tables ────────────────────────────────────────

export interface DBUnitConversion {
  id: string;
  mainUnit: string;        // Main unit code/name (e.g. "Box")
  subUnit: string;         // Sub unit code/name  (e.g. "Pcs")
  conversionFactor: number; // No. of sub units per main unit (e.g. 12)
  isActive: boolean;
  [key: string]: any;
}

export interface DBStandardNarration {
  id: string;
  voucherType: string;     // "Purchase"|"Sales Return"|"Purchase Return"|"Stock Transfer"|"all"
  narration: string;       // Pre-defined narration text
  isActive: boolean;
  [key: string]: any;
}

export interface DBBillSundryMaster {
  id: string;
  name: string;
  alias?: string;
  type: "additive" | "subtractive";  // addition charge or deduction
  nature: "percentage" | "fixed" | "per_unit";
  accountHeadId?: string;  // Ledger account to post to
  defaultValue: number;
  affectsCostInSale: boolean;
  affectsCostInPurchase: boolean;
  adjustInPartyAmount: boolean;
  applicableOn: "nett_bill" | "basic_amount" | "taxable_amount" | "previous_sundry";
  isActive: boolean;
  [key: string]: any;
}

export interface DBSaleType {
  id: string;
  name: string;            // e.g. "VAT/13%", "VAT/Exempt", "Services"
  salesAccountId?: string;
  region: "local" | "export";
  taxationType: "taxable_voucherwise" | "taxable_itemwise" | "exempt" | "tax_free" | "nil_rated";
  taxRate: number;         // e.g. 13
  surcharge: number;
  addlCess: number;
  invoiceHeading?: string;
  invoiceDescription?: string;
  freezeTax: boolean;
  skipVatReports: boolean;
  isActive: boolean;
  [key: string]: any;
}

export interface DBPurchaseType {
  id: string;
  name: string;            // e.g. "VAT/13%", "VAT/13% (CP)"
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
  [key: string]: any;
}

export interface DBTaxCategory {
  id: string;
  name: string;            // e.g. "13%", "Exempt", "Services 14%"
  localTaxRate: number;    // e.g. 13
  exportTaxRate: number;
  taxOnMrp: boolean;
  stockAccountId?: string;
  zeroTaxType?: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBDiscountStructure {
  id: string;
  name: string;
  discountType: "simple" | "compound_same" | "compound_different";
  amountType: "percentage" | "absolute" | "per_main_qty" | "per_pkg_qty";
  percentageOn: "item_price" | "item_amount" | "item_mrp" | "item_list_price";
  caption: string;         // Custom label for discount (default "Discount")
  noOfDiscounts: number;   // For compound: max 5
  isActive: boolean;
  [key: string]: any;
}

export interface DBItemGroup {
  id: string;
  name: string;
  alias?: string;
  isPrimary: boolean;
  underGroupId?: string;   // parent group id
  stockAccountId?: string;
  salesAccountId?: string;
  purchaseAccountId?: string;
  hsnCode?: string;
  taxCategoryId?: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBHoliday {
  id: string;
  date: string;            // ISO date string
  name: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBEmployee {
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
  ssfContributorNumber?: string;
  basicSalary: number;
  gradePayPercent?: number;
  allowances: string; // JSON-stringified { houseRent, transport, medical, dashain }
  taxDeclarations?: string; // JSON-stringified
  employmentType: string;
  status: string;
}

export interface DBBankStatement {
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

// --- NEW BANKING MODULE INTERFACES ---
export interface DBChequeBook {
  id: string;
  bankAccountId: string;      // Links to accounts table
  bankName: string;
  branchName: string;
  accountNumber: string;
  chequeBookNo: string;       // Cheque book series identifier e.g. "CB-2024-001"
  fromChequeNo: string;       // Starting cheque number in this book
  toChequeNo: string;         // Ending cheque number in this book
  currentChequeNo: string;    // Next cheque number to be used (auto-incremented)
  isActive: boolean;
  createdAt: string;
  // Layout configuration for printing (stored as JSON-stringified object)
  printLayout?: string;
}

export interface DBCheque {
  id: string;
  voucherId: string;           // Links to vouchers table (payment voucher)
  voucherNo: string;
  bankAccountId: string;
  chequeNo: string;
  chequeDate: string;          // Date written on the cheque (AD, YYYY-MM-DD)
  chequeDateNepali?: string;
  payeeName: string;
  amount: number;
  amountInWords: string;
  status: "issued" | "presented" | "cleared" | "bounced" | "cancelled" | "stale";
  isPrinted: boolean;
  printedAt?: string;
  printedBy?: string;
  clearedDate?: string;        // Date it appeared on bank statement
  bouncedDate?: string;
  bouncedReason?: string;
  narration?: string;
  createdAt: string;
}

export interface DBDepositSlip {
  id: string;
  slipNo: string;
  bankAccountId: string;
  depositDate: string;         // AD
  depositDateNepali?: string;
  instruments: string;         // JSON: array of { voucherId, voucherNo, instrumentNo, drawerName, drawerBankName, drawerBankBranch, instrumentDate, amount }
  totalAmount: number;
  cashAmount: number;
  chequeAmount: number;
  status: "draft" | "deposited" | "reversed";
  printedAt?: string;
  depositedAt?: string;
  narration?: string;
  createdAt: string;
}

export interface DBPDCheque {
  id: string;
  type: "issued" | "received";    // issued = we gave PDC to supplier; received = customer gave us PDC
  chequeNo: string;
  chequeDate: string;             // The future date written on the cheque (AD)
  chequeDateNepali?: string;
  partyId: string;
  partyName: string;
  bankName: string;               // Bank of the cheque issuer
  bankBranch: string;
  amount: number;
  bankAccountId: string;          // Our bank account (the account it will eventually affect)
  voucherId?: string;             // The original voucher this PDC relates to
  voucherNo?: string;
  holdingAccountId?: string;      // PDC Receivable / PDC Payable ledger used as holding
  status: "pending" | "due" | "overdue" | "presented" | "cleared" | "bounced" | "cancelled";
  convertedAt?: string;           // When it was converted to a regular bank entry
  convertedVoucherId?: string;    // The journal entry created on conversion
  narration?: string;
  createdAt: string;
}

export interface DBEPaymentBatch {
  id: string;
  batchNo: string;
  bankAccountId: string;
  paymentDate: string;
  paymentDateNepali?: string;
  entries: string;           // JSON: array of { voucherId, voucherNo, partyId, partyName, amount, accountNo, ifscCode, bankName, paymentType: "NEFT"|"RTGS"|"IMPS", status: "pending"|"success"|"failed" }
  totalAmount: number;
  entryCount: number;
  fileFormat: string;        // "csv" | "text" | "xml"
  generatedFileContent?: string;  // The actual file content generated
  status: "draft" | "generated" | "uploaded" | "processed";
  uploadedAt?: string;
  processedAt?: string;
  narration?: string;
  createdAt: string;
  createdBy?: string;
}

export interface DBPaymentAdvice {
  id: string;
  voucherId: string;
  voucherNo: string;
  partyId: string;
  partyName: string;
  partyEmail?: string;
  partyAddress?: string;
  paymentDate: string;
  paymentMode: string;
  chequeNo?: string;
  chequeDate?: string;
  bankName?: string;
  totalAmount: number;
  billDetails: string;   // JSON: array of { billRef, billDate, billAmount, adjustedAmount, creditNoteRef?, debitNoteRef? }
  status: "draft" | "sent" | "emailed";
  sentAt?: string;
  emailedAt?: string;
  createdAt: string;
}
// --- END NEW BANKING MODULE INTERFACES ---

export interface DBBranch {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBSalesPerson {
  id: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  commissionRate?: number; // percentage
  isActive: boolean;
}

export interface DBPriceList {
  id: string;
  name: string;
  type: "wholesale" | "retail" | "distributor";
  isActive: boolean;
  [key: string]: any;
}

export interface DBExchangeRate {
  id: string;
  currency: string;
  rate: number;
  effectiveDate: string;
  source: string;
  [key: string]: any;
}

export interface DBFollowUpNote {
  id: string;
  partyId: string;
  invoiceId?: string;
  followUpDate: string;
  note: string;
  createdBy: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  [key: string]: any;
}

export interface DBJobWorkOrder {
  id: string;
  orderNo: string;
  date: string;
  dateNepali: string;
  jobWorkerId: string;
  status: "open" | "in-progress" | "completed" | "cancelled";
  type: "outgoing" | "incoming";
  lines: any[];
  subTotal: number;
  taxAmount?: number;
  grandTotal: number;
  narration?: string;
  [key: string]: any;
}

export interface DBReportSchedule {
  id: string;
  reportType: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  isActive: boolean;
  nextRunDate: string;
  lastRunDate?: string;
  recipients: string[];
  parameters?: any;
  [key: string]: any;
}

export interface DBPriceFloorPolicy {
  id: string;
  itemId: string;
  minSellingPrice: number;
  maxDiscountPct: number;
  effectiveDate: string;
  expiryDate?: string;
  isActive: boolean;
  [key: string]: any;
}

export interface DBChequeBounceLog {
  id: string;
  chequeId: string;
  bounceDate: string;
  bounceReason: string;
  bounceCharges: number;
  status: "logged" | "resolved";
  resolvedDate?: string;
  resolvedBy?: string;
  [key: string]: any;
}

class SutraDB extends Dexie {
  cbmsQueue!: Table<CBMSQueueItem, string>;
  accounts!: Table<DBAccount>;
  parties!: Table<DBParty>;
  items!: Table<DBItem>;
  vouchers!: Table<DBVoucher>;
  invoices!: Table<DBInvoice>;
  stockMovements!: Table<DBStockMovement>;
  warehouses!: Table<DBWarehouse>;
  stockTransfers!: Table<DBStockTransferVoucher>;
  units!: Table<DBUnit>;
  costCenters!: Table<DBCostCenter>;
  fiscalYears!: Table<DBFiscalYear>;
  deliveryChallans!: Table<DBDeliveryChallan>;
  goodsReceiptNotes!: Table<DBGoodsReceiptNote>;
  salesOrders!: Table<DBSalesOrder>;
  purchaseOrders!: Table<DBPurchaseOrder>;
  companySettings!: Table<DBCompanySettings>;
  users!: Table<DBUser>;
  shortcuts!: Table<DBShortcut>;
  notifications!: Table<DBNotification>;
  budgets!: Table<DBBudget>;
  recurringVouchers!: Table<DBRecurringVoucher>;
  customFieldDefs!: Table<DBCustomFieldDef>;
  currencies!: Table<DBCurrency>;

  // --- NEW BANKING MODULE TABLES ---
  chequeBooks!: Table<DBChequeBook>;
  cheques!: Table<DBCheque>;
  depositSlips!: Table<DBDepositSlip>;
  pdCheques!: Table<DBPDCheque>;
  ePaymentBatches!: Table<DBEPaymentBatch>;
  paymentAdvices!: Table<DBPaymentAdvice>;
  // --- END NEW BANKING MODULE TABLES ---

  // Administration module tables
  unitConversions!: Table<DBUnitConversion>;
  standardNarrations!: Table<DBStandardNarration>;
  billSundryMasters!: Table<DBBillSundryMaster>;
  saleTypes!: Table<DBSaleType>;
  purchaseTypes!: Table<DBPurchaseType>;
  taxCategories!: Table<DBTaxCategory>;
  discountStructures!: Table<DBDiscountStructure>;
  itemGroups!: Table<DBItemGroup>;
  holidays!: Table<DBHoliday>;
  employees!: Table<DBEmployee>;
  bankStatements!: Table<DBBankStatement>;
  tdsEntries!: Table<any>;
  tdsChallans!: Table<any>;
  auditLogs!: Table<any>;
  stockJournals!: Table<any>;
  productions!: Table<any>;
  unassembles!: Table<any>;
  materialIssued!: Table<any>;
  materialReceived!: Table<any>;
  physicalStocks!: Table<any>;
  stockCategories!: Table<any>;
  voucherTypeMasters!: Table<DBVoucherTypeMaster>;
  voucherAuditLogs!: Table<DBVoucherAuditLog>;
  scenarios!: Table<any>;
  costCategories!: Table<any>;
  costCentreClasses!: Table<any>;
  reorderLevels!: Table<any>;
  priceLevels!: Table<any>;
  priceLists!: Table<DBPriceList>;
  salesPersons!: Table<DBSalesPerson>;
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

  auditLog!: Table<DBAuditLog>;
  periodLocks!: Table<DBPeriodLock>;

  // - NEW FEATURE TABLES FROM VERSION 13 -
  branches!: Table<DBBranch>;
  exchangeRates!: Table<DBExchangeRate>;
  followUpNotes!: Table<DBFollowUpNote>;
  jobWorkOrders!: Table<DBJobWorkOrder>;
  reportSchedules!: Table<DBReportSchedule>;
  priceFloorPolicies!: Table<DBPriceFloorPolicy>;
  chequeBounceLogs!: Table<DBChequeBounceLog>;

  constructor() {
    super("SutraERP");

    this.version(1).stores({
      accounts: "id, code, name, type, level, parentId, isActive, isGroup",
      parties: "id, code, name, type, pan, isActive",
      items: "id, code, name, type, unit, isActive",
      vouchers: "id, voucherNo, date, type, status",
      invoices: "id, invoiceNo, date, type, partyId, status, paymentStatus",
      stockMovements: "id, date, type, itemId, warehouseId, referenceId",
      warehouses: "id, code, name, isActive",
      units: "id, code, name, isActive",
      costCenters: "id, code, name, parentId, isActive",
      fiscalYears: "id, name, isCurrent, isClosed",
      deliveryChallans: "id, challanNo, date, partyId, status",
      goodsReceiptNotes: "id, grnNo, date, partyId, status",
      salesOrders: "id, orderNo, date, partyId, status",
      purchaseOrders: "id, orderNo, date, partyId, status",
      companySettings: "id",
      users: "id, username, role, isActive",
      shortcuts: "++id, key_combo, category, is_active",
      notifications: "id, read, timestamp",
      budgets: "id, name, fiscalYearId",
      recurringVouchers: "id, name, isActive, nextDate",
      customFieldDefs: "id, entity, isActive",
      currencies: "id, code, isBase, isActive",
    });

    // Version 2 — Administration Module tables
    this.version(2).stores({
      unitConversions: "id, mainUnit, subUnit, isActive",
      standardNarrations: "id, voucherType, isActive",
      billSundryMasters: "id, name, type, isActive",
      saleTypes: "id, name, isActive",
      purchaseTypes: "id, name, isActive",
      taxCategories: "id, name, isActive",
      discountStructures: "id, name, discountType, isActive",
      itemGroups: "id, name, isPrimary, underGroupId, isActive",
      holidays: "id, date, isActive",
    });

    // Version 3 — Payroll Module
    this.version(3).stores({
      employees: "id, name, department, status, employmentType",
    });

    // Version 4 — Bank Reconciliation
    this.version(4).stores({
      bankStatements: "id, bankAccountId, date, reconciled",
    });

    // Version 5 — TDS module
    this.version(5).stores({
      tdsEntries: "id, date, partyId, section, status, fiscalYearBS",
    });

    // Version 6 — Audit Logs
    this.version(6).stores({
      auditLogs: "id, timestamp, userId, action, module, recordId, recordType",
    });

    // Version 7 — New Transaction Modules
    this.version(7).stores({
      stockJournals: 'id, date, status',
      productions: 'id, date, status',
      unassembles: 'id, date, status',
      materialIssued: 'id, date, status',
      materialReceived: 'id, date, status',
      physicalStocks: 'id, date, status',
    });

    // Version 8 — New Master Modules
    this.version(8).stores({
      stockCategories: 'id, name, isActive',
      voucherTypeMasters: 'id, name, parentVoucherType, isActive',
      voucherAuditLogs: 'id, voucherId, actionName, timestamp, userId',
      scenarios: 'id, name, isActive',
      costCategories: 'id, name, isActive',
      costCentreClasses: 'id, name, isActive',
      reorderLevels: 'id, itemId, isActive',
      priceLevels: 'id, name, isActive',
      priceLists: 'id, name, isActive',
      hsCodes: 'id, code, description, isActive',
      batches: 'id, batchNo, itemId, isActive',
      vatClassifications: 'id, name, type, isActive',
      tdsNatureOfPayment: 'id, name, section, isActive',
      employeeGroups: 'id, name, isActive',
      payHeads: 'id, name, type, isActive',
      salaryDetails: 'id, employeeId, isActive',
      payrollUnits: 'id, name, symbol, isActive',
      attendanceTypes: 'id, name, type, isActive',
      ledgerExtensions: 'id, ledgerId',
    });

    // Version 9 — Banking Module
    this.version(9).stores({
      chequeBooks: "id, bankAccountId, isActive",
      cheques: "id, voucherId, bankAccountId, chequeNo, chequeDate, status, isPrinted",
      depositSlips: "id, slipNo, bankAccountId, depositDate, status",
      pdCheques: "id, type, chequeDate, partyId, bankAccountId, status",
      ePaymentBatches: "id, batchNo, bankAccountId, paymentDate, status",
      paymentAdvices: "id, voucherId, partyId, status",
    });

    // Version 10 — CBMS Queue
    this.version(10).stores({
      cbmsQueue: "++id, invoiceId, action, status, createdAt, updatedAt",
      invoices: "id, invoiceNo, date, type, partyId, status, paymentStatus, cbmsSubmitted, cbmsIrn, cbmsSubmittedAt, cbmsStatus",
    });

    // Version 11 — TDS Challans
    this.version(11).stores({
      tdsChallans: "id, challanNo, dateBS, fiscalYearBS, fromBS, toBS",
    });

    // Version 12 - Add Audit Log and Period Lock tables
    this.version(12).stores({
      auditLog: "id, timestamp, module, action, userId, recordId, companyId",
      periodLocks: "id, companyId, fiscalYear, lockedMonth"
    });

    // Version 13 — New Feature Tables (Branches, Salespersons, NRB Rates, Follow-up, Job Work, Price Floor, Cheque Bounce, Report Scheduler)
    this.version(13).stores({
      branches: "id, code, name, isActive",
      salespersons: "id, code, name, branchId, employeeId, isActive",
      exchangeRates: "id, currency, effectiveDate, source",
      followUpNotes: "id, partyId, invoiceId, followUpDate, createdBy, isResolved",
      jobWorkOrders: "id, orderNo, date, jobWorkerId, status, type",
      reportSchedules: "id, reportType, frequency, isActive, nextRunDate",
      priceFloorPolicies: "id, itemId, minSellingPrice, maxDiscountPct, isActive",
      chequeBounceLogs: "id, chequeId, bounceDate, bounceCharges, status",
    });

    // Version 14 — Phase 4 masters (Sales Persons & Price Lists)
    this.version(14).stores({
      salesPersons: "id, code, name, isActive",
      priceLists:   "id, code, name, isActive",
    });
  }
}

let dbInstance: SutraDB | null = null;

export function getDB(): SutraDB {
  if (!dbInstance) {
    dbInstance = new SutraDB();
  }
  return dbInstance;
}

export const db = getDB();

export function generateId(): string {
  return crypto.randomUUID();
}

export async function seedPredefinedVoucherTypes(): Promise<void> {
  const db = await getDB();
  
  // Check if predefined voucher types already exist
  const existingCount = await db.voucherTypeMasters.where({ isPredefined: true }).count();
  
  if (existingCount > 0) {
    return; // Already seeded
  }

  const predefinedTypes = [
    // Accounting group
    {
      id: "predefined-contra",
      name: "Contra",
      abbreviation: "Contra",
      parentVoucherType: "contra",
      voucherGroup: "accounting",
      prefix: "CV-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-pmnt",
      name: "Payment",
      abbreviation: "Pmnt",
      parentVoucherType: "payment",
      voucherGroup: "accounting",
      prefix: "PV-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-rcpt",
      name: "Receipt",
      abbreviation: "Rcpt",
      parentVoucherType: "receipt",
      voucherGroup: "accounting",
      prefix: "RV-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-jrnl",
      name: "Journal",
      abbreviation: "Jrnl",
      parentVoucherType: "journal",
      voucherGroup: "accounting",
      prefix: "JV-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-sales",
      name: "Sales",
      abbreviation: "Sales",
      parentVoucherType: "sales-invoice",
      voucherGroup: "accounting",
      prefix: "SI-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-purch",
      name: "Purchase",
      abbreviation: "Purch",
      parentVoucherType: "purchase-invoice",
      voucherGroup: "accounting",
      prefix: "PI-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-crnt",
      name: "Credit Note",
      abbreviation: "CrNt",
      parentVoucherType: "credit-note",
      voucherGroup: "accounting",
      prefix: "CN-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-drnt",
      name: "Debit Note",
      abbreviation: "DrNt",
      parentVoucherType: "debit-note",
      voucherGroup: "accounting",
      prefix: "DN-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    // Inventory group
    {
      id: "predefined-stjn",
      name: "Stock Journal",
      abbreviation: "StJn",
      parentVoucherType: "stock-journal",
      voucherGroup: "inventory",
      prefix: "SJ-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-phst",
      name: "Physical Stock",
      abbreviation: "PhSt",
      parentVoucherType: "physical-stock",
      voucherGroup: "inventory",
      prefix: "PS-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-dlnt",
      name: "Delivery Note",
      abbreviation: "DlNt",
      parentVoucherType: "delivery-note",
      voucherGroup: "inventory",
      prefix: "DN-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-rcnt",
      name: "Receipt Note",
      abbreviation: "RcNt",
      parentVoucherType: "receipt-note",
      voucherGroup: "inventory",
      prefix: "RN-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-rjin",
      name: "Rejection In",
      abbreviation: "RjIn",
      parentVoucherType: "rejection-in",
      voucherGroup: "inventory",
      prefix: "RI-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-rjot",
      name: "Rejection Out",
      abbreviation: "RjOt",
      parentVoucherType: "rejection-out",
      voucherGroup: "inventory",
      prefix: "RO-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-mtin",
      name: "Material In",
      abbreviation: "MtIn",
      parentVoucherType: "material-in",
      voucherGroup: "inventory",
      prefix: "MI-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-mtot",
      name: "Material Out",
      abbreviation: "MtOt",
      parentVoucherType: "material-out",
      voucherGroup: "inventory",
      prefix: "MO-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    // Order group
    {
      id: "predefined-saor",
      name: "Sales Order",
      abbreviation: "SaOr",
      parentVoucherType: "sales-order",
      voucherGroup: "order",
      prefix: "SO-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-puor",
      name: "Purchase Order",
      abbreviation: "PuOr",
      parentVoucherType: "purchase-order",
      voucherGroup: "order",
      prefix: "PO-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-jwot",
      name: "Job Work Out Order",
      abbreviation: "JWOt",
      parentVoucherType: "job-work-out-order",
      voucherGroup: "order",
      prefix: "JO-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-jwin",
      name: "Job Work In Order",
      abbreviation: "JWIn",
      parentVoucherType: "job-work-in-order",
      voucherGroup: "order",
      prefix: "JI-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    // Payroll group
    {
      id: "predefined-pyrl",
      name: "Payroll",
      abbreviation: "Pyrl",
      parentVoucherType: "payroll",
      voucherGroup: "payroll",
      prefix: "PR-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-attn",
      name: "Attendance",
      abbreviation: "Attn",
      parentVoucherType: "attendance",
      voucherGroup: "payroll",
      prefix: "AT-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    // Other group
    {
      id: "predefined-memo",
      name: "Memorandum",
      abbreviation: "Memo",
      parentVoucherType: "memorandum",
      voucherGroup: "other",
      prefix: "MV-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    },
    {
      id: "predefined-rvjn",
      name: "Reversing Journal",
      abbreviation: "RvJn",
      parentVoucherType: "reversing-journal",
      voucherGroup: "other",
      prefix: "RJ-",
      startingNumber: 1,
      isPredefined: true,
      isActive: true,
      numberingMethod: "automatic",
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    }
  ];

  await db.voucherTypeMasters.bulkAdd(predefinedTypes);
}

export async function generateVoucherNumber(voucherTypeId: string): Promise<string> {
  const db = await getDB();
  
  try {
    const voucherType = await db.voucherTypeMasters.get(voucherTypeId);
    
    if (!voucherType) {
      // Fallback if voucher type not found
      return `VCH-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }
    
    const existingVouchersCount = await db.vouchers.where({ voucherTypeId }).count();
    const nextNumber = voucherType.startingNumber + existingVouchersCount;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    
    return `${voucherType.prefix}${paddedNumber}`;
  } catch (error) {
    // Fallback on error
    return `VCH-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }
}

export default getDB;
