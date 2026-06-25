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
  tdsType?: string;
  tdsRate?: number;
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
  [key: string]: any;
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
  cbmsSubmittedAt?: string;
  [key: string]: any;
}

export interface DBStockMovement {
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
  [key: string]: any;
}

export interface DBWarehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isDefault?: boolean;
  isActive: boolean;
  [key: string]: any;
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

class SutraDB extends Dexie {
  accounts!: Table<DBAccount>;
  parties!: Table<DBParty>;
  items!: Table<DBItem>;
  vouchers!: Table<DBVoucher>;
  invoices!: Table<DBInvoice>;
  stockMovements!: Table<DBStockMovement>;
  warehouses!: Table<DBWarehouse>;
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
  }
}

let dbInstance: SutraDB | null = null;

export function getDB(): SutraDB {
  if (!dbInstance) {
    dbInstance = new SutraDB();
  }
  return dbInstance;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export default getDB;
