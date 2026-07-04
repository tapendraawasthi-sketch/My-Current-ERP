// src/lib/busyTypes.ts
// Complete BUSY Accounting System Types — All Features

// ============================================================
// ENUMS
// ============================================================

export enum VoucherCategory {
  DUAL = "dual", // Accounting + Inventory
  ACCOUNTING = "accounting", // Accounting only
  INVENTORY = "inventory", // Inventory only
}

export enum GSTNature {
  NOT_APPLICABLE = "not_applicable",
  REGISTERED_EXPENSE_B2B = "registered_expense_b2b",
  TAX_PAID_EXPENSE_B2C = "tax_paid_expense_b2c",
  RCM_UNREG_EXPENSE = "rcm_unreg_expense",
  EXEMPT_EXPENSE = "exempt_expense",
  GST_TAX_ADJUSTMENT = "gst_tax_adjustment",
  DEBIT_NOTE_AGAINST_SALE = "debit_note_against_sale",
  CREDIT_NOTE_AGAINST_SALE = "credit_note_against_sale",
  DEBIT_NOTE_AGAINST_PURCHASE = "debit_note_against_purchase",
  CREDIT_NOTE_AGAINST_PURCHASE = "credit_note_against_purchase",
  IMPORT_OF_SERVICE = "import_of_service",
  SEZ_SUPPLY = "sez_supply",
}

export enum GSTNatureLabel {
  not_applicable = "Not Applicable / Non-GST",
  registered_expense_b2b = "Registered Expense (B2B)",
  tax_paid_expense_b2c = "Tax Paid Expense (B2C)",
  rcm_unreg_expense = "RCM / Unreg. Expense",
  exempt_expense = "Exempt Expense",
  gst_tax_adjustment = "GST Tax Adjustment",
  debit_note_against_sale = "Debit Note Against Sale",
  credit_note_against_sale = "Credit Note Against Sale",
  debit_note_against_purchase = "Debit Note Against Purchase",
  credit_note_against_purchase = "Credit Note Against Purchase",
  import_of_service = "Import of Service",
  sez_supply = "SEZ Supply",
}

export enum PurchaseType {
  LOCAL_GST_5 = "L/GST-5%",
  LOCAL_GST_12 = "L/GST-12%",
  LOCAL_GST_18 = "L/GST-18%",
  LOCAL_GST_28 = "L/GST-28%",
  CENTRAL_GST_5 = "C/GST-5%",
  CENTRAL_GST_12 = "C/GST-12%",
  CENTRAL_GST_18 = "C/GST-18%",
  CENTRAL_GST_28 = "C/GST-28%",
  EXPORT = "Export",
  ITEMWISE = "Itemwise",
  MULTIRATE = "Multirate",
  SINGLE_RATE = "Single Rate",
  RCM_UNREG = "L/GST-Unreg(RCM)",
  NIL_RATED = "Nil Rated",
  EXEMPT = "Exempt",
  NON_GST = "Non-GST",
}

export enum SaleType {
  LOCAL_GST_5 = "L/GST-5%",
  LOCAL_GST_12 = "L/GST-12%",
  LOCAL_GST_18 = "L/GST-18%",
  LOCAL_GST_28 = "L/GST-28%",
  CENTRAL_GST_5 = "C/GST-5%",
  CENTRAL_GST_12 = "C/GST-12%",
  CENTRAL_GST_18 = "C/GST-18%",
  CENTRAL_GST_28 = "C/GST-28%",
  EXPORT = "Export",
  ITEMWISE = "Itemwise",
  MULTIRATE = "Multirate",
  SINGLE_RATE = "Single Rate",
  NIL_RATED = "Nil Rated",
  EXEMPT = "Exempt",
  NON_GST = "Non-GST",
  CONSUMER = "Consumer (B2C)",
}

export enum PaymentMode {
  CASH = "cash",
  BANK = "bank",
  CHEQUE = "cheque",
  CARD = "card",
  ONLINE = "online",
  UPI = "upi",
}

export enum VoucherStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  DRAFT = "draft",
  POSTED = "posted",
}

export enum BillSundryType {
  ADDITIVE = "additive",
  DEDUCTIVE = "deductive",
}

export enum BillSundryNature {
  OTHER = "other",
  DISCOUNT = "discount",
  TAX = "tax",
  ADDITIONAL_TAX = "additional_tax",
  FREIGHT = "freight",
  PACKING = "packing",
  ROUND_OFF = "round_off",
}

export enum ITCEligibility {
  INPUT_GOODS = "input_goods",
  INPUT_SERVICES = "input_services",
  CAPITAL_GOODS = "capital_goods",
  NONE = "none",
  INELIGIBLE = "ineligible",
}

export enum DealerType {
  REGISTERED = "registered",
  UNREGISTERED = "unregistered",
  COMPOSITION = "composition",
  SEZ = "sez",
  EXPORT = "export",
  CONSUMER = "consumer",
}

export enum NumberingType {
  AUTOMATIC = "automatic",
  MANUAL = "manual",
}

export enum RenumberingFrequency {
  NEVER = "never",
  DAILY = "daily",
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export enum RoundOffMode {
  AUTOMATIC = "automatic",
  ALWAYS_UPPER = "always_upper",
  ALWAYS_LOWER = "always_lower",
}

// ============================================================
// CORE INTERFACES
// ============================================================

export interface BillSundryMaster {
  id: string;
  name: string;
  type: BillSundryType;
  nature: BillSundryNature;
  affectCostInSale: boolean;
  affectCostInPurchase: boolean;
  accountingInSale?: string; // Account ID
  accountingInPurchase?: string; // Account ID
  affectAccountingInStockTransfer: boolean;
  gstApplicable: boolean;
  taxCategoryId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxCategoryMaster {
  id: string;
  name: string;
  taxRate: number;
  type: "local" | "central" | "igst";
  changeTaxRateOnBasisOfPrice: boolean;
  hsnSacCode?: string;
  itcEligibility: ITCEligibility;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleTypeMaster {
  id: string;
  name: string;
  saleType: SaleType;
  defaultTaxRate?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseTypeMaster {
  id: string;
  name: string;
  purchaseType: PurchaseType;
  defaultTaxRate?: number;
  rcmApplicable: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StandardNarration {
  id: string;
  text: string;
  category?: string;
  voucherTypes?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherSeriesConfig {
  id: string;
  voucherType: string;
  seriesName: string;
  description?: string;
  numberingType: NumberingType;
  renumberingFrequency: RenumberingFrequency;
  embedYearInVchNo: "no" | "prefix" | "suffix";
  prefix: string;
  suffix: string;
  startingNumber: number;
  currentNumber: number;
  fiscalYear?: string;
  // Features
  enableSettlement: boolean;
  settlementConfig?: SettlementConfig;
  autoRoundOff: boolean;
  roundOffConfig?: RoundOffConfig;
  itemwiseDescription: boolean;
  itemwiseDescriptionLines: number;
  itemwiseDiscount: boolean;
  itemwiseMarkup: boolean;
  separateBillingShipping: boolean;
  billSundryNarration: boolean;
  enableAdvancedPOS: boolean;
  pickItemFromBarcode: boolean;
  consolidateItemsOnSave: boolean;
  optionalFields: OptionalField[];
  sendSMSEmail: boolean;
  sendBNSNotification: boolean;
  generateEInvoice: boolean;
  showStockDuringEntry: boolean;
  allowPurchaseReturnInPurchase: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementConfig {
  enableCash: boolean;
  enableCheque: boolean;
  enableCard: boolean;
  enableBankTransfer: boolean;
  enableUPI: boolean;
  cashAccountId?: string;
  bankAccountId?: string;
  postWithPartyData: boolean;
}

export interface RoundOffConfig {
  mode: RoundOffMode;
  roundToNearest: number;
  roundOffPlusBillSundryId?: string;
  roundOffMinusBillSundryId?: string;
}

export interface OptionalField {
  name: string;
  type: "text" | "date" | "numeric" | "list";
  decimalPlaces?: number;
  maintainMasterDB: boolean;
  listValues?: string[];
}

// ============================================================
// VOUCHER INTERFACES
// ============================================================

export interface VoucherLine {
  id: string;
  itemId?: string;
  itemName?: string;
  itemCode?: string;
  hsnCode?: string;
  description?: string;
  quantity: number;
  altQuantity?: number;
  unit?: string;
  altUnit?: string;
  rate: number;
  amount: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableValue: number;
  gstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  totalAmount: number;
  accountId?: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  narration?: string;
  costCenterId?: string;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
  mrp?: number;
}

export interface BillSundryLine {
  id: string;
  billSundryId: string;
  billSundryName: string;
  type: BillSundryType;
  amount: number;
  narration?: string;
  accountId?: string;
  accountName?: string;
  gstApplicable?: boolean;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}

export interface SettlementEntry {
  mode: PaymentMode;
  amount: number;
  accountId?: string;
  accountName?: string;
  chequeNo?: string;
  chequeDate?: string;
  bankName?: string;
  referenceNo?: string;
  cardType?: string;
  last4Digits?: string;
}

export interface BillAdjustment {
  billId: string;
  billNo: string;
  billDate: string;
  originalAmount: number;
  balanceAmount: number;
  adjustedAmount: number;
}

export interface GSTTaxDetails {
  supplierGSTIN?: string;
  invoiceNo: string;
  invoiceDate: string;
  taxableValue: number;
  taxRate: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  placeOfSupply?: string;
  itcEligibility?: ITCEligibility;
}

export interface OriginalVoucherRef {
  voucherNo: string;
  voucherDate: string;
  voucherId?: string;
}

export interface BusyVoucher {
  id: string;
  voucherType: string;
  voucherCategory: VoucherCategory;
  seriesId?: string;
  seriesName?: string;
  voucherNo: string;
  date: string;
  dateNepali?: string;
  dueDate?: string;
  partyId?: string;
  partyName?: string;
  partyGSTIN?: string;
  partyPAN?: string;
  materialCentreId?: string;
  materialCentreName?: string;
  // GST
  gstNature?: GSTNature;
  purchaseType?: PurchaseType;
  saleType?: SaleType;
  placeOfSupply?: string;
  // Billing/Shipping
  billingName?: string;
  billingAddress?: string;
  billingState?: string;
  shippingName?: string;
  shippingAddress?: string;
  shippingState?: string;
  // Grids
  lines: VoucherLine[];
  billSundryLines: BillSundryLine[];
  // Amounts
  grossAmount: number;
  itemDiscountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  billSundryCharges: number;
  billSundryDeductions: number;
  roundOff: number;
  netAmount: number;
  // Settlement
  settlements?: SettlementEntry[];
  cashSettlement?: number;
  bankSettlement?: number;
  // Bill Adjustments
  billAdjustments?: BillAdjustment[];
  // GST Details (for accounting vouchers)
  gstTaxDetails?: GSTTaxDetails;
  // Returns
  originalVoucherRef?: OriginalVoucherRef;
  // References
  supplierBillNo?: string;
  supplierBillDate?: string;
  saleOrderRef?: string;
  purchaseOrderRef?: string;
  challanRef?: string;
  // Other
  narration?: string;
  status: VoucherStatus;
  optionalFields?: Record<string, any>;
  // Accounting
  totalDebit: number;
  totalCredit: number;
  // Meta
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // EInvoice
  eInvoiceIRN?: string;
  eInvoiceAckNo?: string;
  eInvoiceAckDate?: string;
  eInvoiceQR?: string;
  eWayBillNo?: string;
  eWayBillDate?: string;
  eWayBillExpiry?: string;
  // RCM
  rcmApplicable?: boolean;
  rcmPosted?: boolean;
}

// ============================================================
// ACCOUNT MASTER ENHANCEMENTS
// ============================================================

export interface AccountAlias {
  aliasName: string;
  gstin?: string;
  address1?: string;
  address2?: string;
  state?: string;
  city?: string;
  pinCode?: string;
}

export interface EnhancedAccount {
  id: string;
  code: string;
  name: string;
  printName?: string;
  group: string;
  groupId?: string;
  type: string;
  level: string;
  isGroup: boolean;
  isActive: boolean;
  isSystemAccount?: boolean;
  balance: number;
  // GST
  gstin?: string;
  gstType?: "applicable" | "not_applicable" | "non_gst";
  dealerType?: DealerType;
  taxCategoryId?: string;
  itcEligibility?: ITCEligibility;
  reverseCharge?: string;
  hsnSacCode?: string;
  // Address
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  state?: string;
  city?: string;
  pinCode?: string;
  country?: string;
  // Party
  pan?: string;
  phone?: string;
  email?: string;
  website?: string;
  // Financial
  creditLimit?: number;
  creditPeriod?: number;
  openingBalance?: number;
  openingBalanceDr?: number;
  openingBalanceCr?: number;
  openingBalanceDate?: string;
  // Features
  billByBill?: boolean;
  enableCostCenter?: boolean;
  defaultSaleType?: string;
  defaultPurchaseType?: string;
  // Aliases
  aliases?: AccountAlias[];
  // Bank
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  swiftCode?: string;
  bankAccountType?: string;
  // Misc
  tdsApplicable?: boolean;
  tdsSection?: string;
  tdsRate?: number;
  parentId?: string;
  nameNepali?: string;
  alias?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================
// ITEM MASTER ENHANCEMENTS
// ============================================================

export interface PriceListEntry {
  priceListId: string;
  priceListName: string;
  rate: number;
  discountPercent?: number;
}

export interface ItemPriceStructure {
  partyId?: string;
  partyName?: string;
  purchaseRate?: number;
  saleRate?: number;
  discountPercent?: number;
}

export interface EnhancedItem {
  id: string;
  code?: string;
  name: string;
  nameNepali?: string;
  aliasName?: string;
  barcode?: string;
  groupId?: string;
  groupName?: string;
  unit?: string;
  altUnit?: string;
  altUnitConversionFactor?: number;
  // Tax
  taxCategoryId?: string;
  taxCategoryName?: string;
  gstRate?: number;
  hsnCode?: string;
  itcEligibility?: ITCEligibility;
  // Accounts
  purchaseAccountId?: string;
  purchaseAccountName?: string;
  saleAccountId?: string;
  saleAccountName?: string;
  // Rates
  purchaseRate?: number;
  saleRate?: number;
  mrp?: number;
  markup?: number;
  // Stock controls
  minStock?: number;
  maxStock?: number;
  reorderLevel?: number;
  reorderQty?: number;
  // Type
  isCapitalItem?: boolean;
  isTaxable?: boolean;
  trackBatch?: boolean;
  trackSerial?: boolean;
  // Pricing
  priceLists?: PriceListEntry[];
  partyPriceStructures?: ItemPriceStructure[];
  // Status
  isActive: boolean;
  isBlocked?: boolean;
  openingStock?: number;
  openingStockRate?: number;
  openingStockValue?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================
// MATERIAL CENTRE (WAREHOUSE/LOCATION)
// ============================================================

export interface MaterialCentre {
  id: string;
  code?: string;
  name: string;
  address?: string;
  groupId?: string;
  groupName?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// BILL OF MATERIAL
// ============================================================

export interface BOMComponent {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  wastePercent?: number;
  byProduct?: boolean;
}

export interface BillOfMaterial {
  id: string;
  name: string;
  finishedItemId: string;
  finishedItemName: string;
  finishedQty: number;
  finishedUnit: string;
  components: BOMComponent[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// PRICE LIST
// ============================================================

export interface PriceList {
  id: string;
  name: string;
  category: "A" | "B" | "C" | string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// COST CENTRE
// ============================================================

export interface CostCentre {
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  groupId?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// JOB WORK
// ============================================================

export interface JobWorkEntry {
  id: string;
  jobId: string;
  partyId: string;
  partyName: string;
  issueDate: string;
  receiveDate?: string;
  items: VoucherLine[];
  status: "issued" | "partial" | "completed";
  narration?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// FEATURES / OPTIONS CONFIG
// ============================================================

export interface FeaturesOptions {
  // General
  singleEntryMode: boolean;
  multipleAccountAliases: boolean;
  differentAddressWithAlias: boolean;
  multiCurrency: boolean;
  // Accounts
  enableCostCentre: boolean;
  billByBillAdjustment: boolean;
  maintainBillWiseDetails: boolean;
  // Inventory
  enableManufacturing: boolean;
  enableAlternativeUnit: boolean;
  inputConversionFactorInVoucher: boolean;
  itemPricingMode: "multiple_price_list" | "party_item_price" | "simple_markup";
  allowPurchaseReturnInPurchase: boolean;
  accountingInPureInventory: boolean;
  enableQuotationOrderChallan: boolean;
  maintainJobId: boolean;
  enableBarcodeScanning: boolean;
  zeroValidation: boolean;
  negativeStockWarningAlarm: boolean;
  minMaxReorderAlarms: boolean;
  // GST
  gstEnabled: boolean;
  eInvoiceEnabled: boolean;
  eWayBillEnabled: boolean;
  additionalTaxEnabled: boolean;
  // Payroll
  enablePayroll: boolean;
  // Branch
  enableBranch: boolean;
  dataSynchronization: boolean;
}

// ============================================================
// RCM UTILITY
// ============================================================

export interface RCMEntry {
  id: string;
  voucherId: string;
  voucherNo: string;
  voucherDate: string;
  partyId?: string;
  partyName?: string;
  taxableValue: number;
  taxRate: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  isPosted: boolean;
  postedDate?: string;
  postedVoucherId?: string;
}

// ============================================================
// OUTSTANDING / AGING
// ============================================================

export interface OutstandingBill {
  billId: string;
  billNo: string;
  billDate: string;
  dueDate?: string;
  partyId: string;
  partyName: string;
  originalAmount: number;
  adjustedAmount: number;
  balanceAmount: number;
  daysOverdue: number;
  agingBucket: "current" | "0-30" | "31-60" | "61-90" | "91-180" | "181-365" | "365+";
  voucherType: string;
}

// ============================================================
// E-INVOICE
// ============================================================

export interface EInvoiceData {
  irn: string;
  ackNo: string;
  ackDate: string;
  signedQRCode: string;
  signedInvoice: string;
  status: "pending" | "generated" | "cancelled";
  cancelDate?: string;
  cancelRemark?: string;
}

// ============================================================
// E-WAY BILL
// ============================================================

export interface EWayBillData {
  ewbNo: string;
  ewbDate: string;
  expiryDate: string;
  vehicleNo?: string;
  transporter?: string;
  distance?: number;
  status: "active" | "cancelled" | "expired";
}

// ============================================================
// GLOBAL SHORTCUT
// ============================================================

export interface GlobalShortcut {
  key: string;
  action: string;
  page?: string;
  description: string;
  category: string;
}

export const GLOBAL_SHORTCUTS: GlobalShortcut[] = [
  {
    key: "Ctrl+F1",
    action: "add_account",
    page: "accounts",
    description: "Add Account Master",
    category: "Masters",
  },
  {
    key: "Ctrl+F2",
    action: "add_item",
    page: "items",
    description: "Add Item Master",
    category: "Masters",
  },
  {
    key: "Ctrl+F5",
    action: "add_payment",
    page: "payment",
    description: "Add Payment Voucher",
    category: "Vouchers",
  },
  {
    key: "Ctrl+F6",
    action: "add_receipt",
    page: "receipt",
    description: "Add Receipt Voucher",
    category: "Vouchers",
  },
  {
    key: "Ctrl+F7",
    action: "add_journal",
    page: "journal",
    description: "Add Journal Voucher",
    category: "Vouchers",
  },
  {
    key: "Ctrl+F8",
    action: "add_sales",
    page: "sales",
    description: "Add Sales Voucher",
    category: "Vouchers",
  },
  {
    key: "Ctrl+F9",
    action: "add_purchase",
    page: "purchase",
    description: "Add Purchase Voucher",
    category: "Vouchers",
  },
  {
    key: "Ctrl+B",
    action: "balance_sheet",
    page: "balance-sheet",
    description: "Balance Sheet",
    category: "Reports",
  },
  {
    key: "Ctrl+T",
    action: "trial_balance",
    page: "trial-balance",
    description: "Trial Balance",
    category: "Reports",
  },
  {
    key: "Ctrl+S",
    action: "stock_status",
    page: "stock-summary",
    description: "Stock Status",
    category: "Reports",
  },
  {
    key: "Ctrl+A",
    action: "account_summary",
    page: "ledger",
    description: "Account Summary",
    category: "Reports",
  },
  {
    key: "Ctrl+L",
    action: "ledger",
    page: "ledger",
    description: "Account Ledger",
    category: "Reports",
  },
  {
    key: "Ctrl+G",
    action: "gst_summary",
    page: "vat-reports",
    description: "GST Summary",
    category: "Reports",
  },
  {
    key: "Ctrl+U",
    action: "switch_user",
    page: "users",
    description: "Switch User",
    category: "System",
  },
  { key: "F10", action: "calculator", description: "Calculator", category: "Tools" },
];

// ============================================================
// GST REPORT TYPES
// ============================================================

export interface GSTR1Row {
  partyGSTIN: string;
  partyName: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: boolean;
  invoiceType: string;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

export interface GSTR2Row {
  supplierGSTIN: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: boolean;
  invoiceType: string;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  itcEligibility: ITCEligibility;
}

// ============================================================
// VOUCHER REPLICATION
// ============================================================

export interface VoucherTemplate {
  id: string;
  name: string;
  voucherType: string;
  templateData: Partial<BusyVoucher>;
  createdAt: string;
}

export interface VoucherReplicationConfig {
  templateId: string;
  basis: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

// ============================================================
// ALERT / NOTIFICATION TYPES
// ============================================================

export type AlarmType =
  | "negative_stock"
  | "credit_limit_exceeded"
  | "min_stock"
  | "max_stock"
  | "reorder_level"
  | "due_date"
  | "eway_bill_expiry"
  | "rcm_pending";

export interface WarningAlarm {
  type: AlarmType;
  enabled: boolean;
  threshold?: number;
  message: string;
}
