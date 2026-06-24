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
