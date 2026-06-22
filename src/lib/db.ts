/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from "dexie";
import {
  Account,
  JournalEntry,
  Invoice,
  Party,
  Item,
  Unit,
  Warehouse,
  StockMovement,
  StockJournal,
  SalesOrder,
  PurchaseOrder,
  DeliveryChallan,
  GoodsReceiptNote,
  CostCenter,
  BankAccount,
  BankStatement,
  Budget,
  TdsEntry,
  AuditLog,
  Employee,
  PayrollRun,
  FiscalYear,
  User,
  CompanySettings,
  AppNotification,
  BillAllocation,
  Currency,
  ExchangeRate,
  RecurringVoucher,
  AccountType,
  AccountLevel,
  VoucherStatus,
  VoucherType,
  UserRole,
  DateFormat,
  StockValuationMethod,
  FiscalYearStatus,
  CustomFieldDef,
  SalarySlab,
} from "./types";

export class SutraDB extends Dexie {
  public accounts!: Table<Account & { id: string }>;
  public vouchers!: Table<JournalEntry & { id: string }>;
  public invoices!: Table<Invoice & { id: string }>;
  public parties!: Table<Party & { id: string }>;
  public items!: Table<Item & { id: string }>;
  public warehouses!: Table<Warehouse & { id: string }>;
  public units!: Table<Unit & { id: string }>;
  public stockMovements!: Table<StockMovement & { id: string }>;
  public stockJournals!: Table<StockJournal & { id: string }>;
  public salesOrders!: Table<SalesOrder & { id: string }>;
  public purchaseOrders!: Table<PurchaseOrder & { id: string }>;
  public deliveryChallans!: Table<DeliveryChallan & { id: string }>;
  public goodsReceiptNotes!: Table<GoodsReceiptNote & { id: string }>;
  public costCenters!: Table<CostCenter & { id: string }>;
  public bankAccounts!: Table<BankAccount & { id: string }>;
  public bankStatements!: Table<BankStatement & { id: string }>;
  public budgets!: Table<Budget & { id: string }>;
  public tdsEntries!: Table<TdsEntry & { id: string }>;
  public auditLogs!: Table<AuditLog & { id: string }>;
  public fiscalYears!: Table<FiscalYear & { id: string }>;
  public users!: Table<User & { id: string }>;
  public companySettings!: Table<CompanySettings & { id: string }>;
  public notifications!: Table<AppNotification & { id: string }>;

  public billAllocations!: Table<BillAllocation & { id: string }>;
  public currencies!: Table<Currency & { id: string }>;
  public exchangeRates!: Table<ExchangeRate & { id: string }>;
  public recurringVouchers!: Table<RecurringVoucher & { id: string }>;
  public employees!: Table<Employee & { id: string }>;
  public payrollRuns!: Table<PayrollRun & { id: string }>;
  public customFieldDefs!: Table<CustomFieldDef & { id: string }>;
  public salarySlabs!: Table<SalarySlab & { id: string }>;

  constructor() {
    super("sutra_erp_db");

    this.version(2).stores({
      accounts: "++id, code, type, level, parentId, group, isActive",
      vouchers: "++id, date, voucherNo, type, status, partyId",
      invoices: "++id, date, invoiceNo, type, partyId, status, paymentStatus",
      parties: "++id, code, name, type, pan, accountId, isActive",
      items: "++id, code, name, type, isActive, hsnCode",
      warehouses: "++id, code, name, isActive",
      units: "++id, code, name, isActive",
      stockMovements: "++id, date, type, itemId, warehouseId, referenceId",
      stockJournals: "++id, date, journalNo, status",
      salesOrders: "++id, date, orderNo, partyId, status",
      purchaseOrders: "++id, date, orderNo, partyId, status",
      deliveryChallans: "++id, date, challanNo, partyId, status",
      goodsReceiptNotes: "++id, date, grnNo, partyId, status",
      costCenters: "++id, code, name, parentId, isActive",
      bankAccounts: "++id, accountId, bankName, isActive",
      bankStatements: "++id, date, bankAccountId, reconciled",
      budgets: "++id, name, fiscalYearId",
      tdsEntries: "++id, date, partyId, voucherId, tdsType, deposited",
      auditLogs: "++id, timestamp, userId, module, action",
      fiscalYears: "++id, name, isCurrent, status",
      users: "++id, username, role, isActive",
      companySettings: "++id",
      billAllocations: "++id, voucherId, invoiceId, partyId, allocationDate",
      currencies: "++id, code, isBase, isActive",
      exchangeRates: "++id, currencyCode, date",
      recurringVouchers: "++id, name, voucherType, frequency, nextDueDate, isActive",
      notifications: "++id, timestamp, read",
      employees: "++id, code, name, isActive",
      payrollRuns: "++id, month, fiscalYearId, status",
    });

    this.version(3).stores({
      customFieldDefs: "++id, entity, isActive",
    });

    this.version(4).stores({
      customFieldDefs: "++id, entity, isActive",
      salarySlabs: "++id, maritalStatus",
    });
  }
}

let dbInstance: SutraDB | null = null;
export function getDB(): SutraDB {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("[SSR] SutraDB cannot be instantiated outside the browser. This call must be deferred to client-side only.");
  }
  if (!dbInstance) {
    dbInstance = new SutraDB();
  }
  return dbInstance;
}

export const isDBAvailable = typeof window !== "undefined" && typeof indexedDB !== "undefined";

export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

export async function getCurrentFiscalYear(): Promise<FiscalYear | null> {
  try {
    const db = getDB();
    const currentFY = await db.fiscalYears.filter((fy) => fy.isCurrent).first();
    return currentFY || null;
  } catch (error) {
    console.error("Error fetching current fiscal year:", error);
    return null;
  }
}

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const db = getDB();
    const settings = await db.companySettings.toCollection().first();
    if (!settings) {
      throw new Error("Company settings not found, DB might be uninitialized.");
    }
    return settings;
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return {
      name: "Sutra ERP Pvt. Ltd.",
      nameNepali: "सूत्र इआरपी प्रा. लि.",
      panNumber: "609876543",
      vatNumber: "609876543",
      address: "Anamnagar, Kathmandu, Nepal",
      phone: "+977-1-4771234",
      email: "contact@sutraerp.com.np",
      website: "www.sutraerp.com.np",
      defaultCurrency: "NPR",
      currencySymbol: "Rs.",
      defaultDateFormat: DateFormat.BS,
      fiscalYearStartMonth: 4,
      stockValuationMethod: StockValuationMethod.WEIGHTED_AVERAGE,
      enableCostCenter: true,
      enableMultiCurrency: false,
      enableBillWiseTracking: true,
      enableBatchTracking: false,
      printLogoOnInvoice: false,
      printTermsOnInvoice: true,
      termsAndConditions:
        "1. Goods once sold are non-returnable.\n2. Interest @ 18% p.a. will be charged for delayed payments.\n3. Dispute, if any, subject to Kathmandu Jurisdiction.",
      voucherSeries: {
        journal: { prefix: "JV-", nextNumber: 1, padding: 4 },
        payment: { prefix: "PV-", nextNumber: 1, padding: 4 },
        receipt: { prefix: "RV-", nextNumber: 1, padding: 4 },
        contra: { prefix: "CV-", nextNumber: 1, padding: 4 },
        "sales-invoice": { prefix: "SI-", nextNumber: 1, padding: 4 },
        "purchase-invoice": { prefix: "PI-", nextNumber: 1, padding: 4 },
        "sales-return": { prefix: "SR-", nextNumber: 1, padding: 4 },
        "purchase-return": { prefix: "PR-", nextNumber: 1, padding: 4 },
        "debit-note": { prefix: "DN-", nextNumber: 1, padding: 4 },
        "credit-note": { prefix: "CN-", nextNumber: 1, padding: 4 },
        "stock-journal": { prefix: "ST-", nextNumber: 1, padding: 4 },
        "opening-balance": { prefix: "OB-", nextNumber: 1, padding: 4 },
      },
      tdsEnabled: true,
    };
  }
}

let isSeedingActive = false;

export async function initializeDB(): Promise<void> {
  if (isSeedingActive) {
    console.log("Sutra ERP: Seeding already in progress, skipping concurrent initializeDB call.");
    return;
  }
  isSeedingActive = true;

  try {
    const db = getDB();
    if (!db.isOpen()) {
      await db.open();
    }

    await db.transaction("rw", db.tables, async () => {
      const userCount = await db.users.count();
      if (userCount > 0) {
        console.log("Sutra ERP: database is already initialized and seeded.");
        return;
      }

      console.log("Sutra ERP: Initializing and seeding brand new local database...");

      const adminUser: User & { id: string } = {
        id: "usr-admin",
        name: "Sutra Administrator",
        nameNepali: "प्रशासक",
        username: "admin",
        role: UserRole.ADMIN,
        isActive: true,
        password: "admin123",
        permissions: ["*"],
        createdAt: new Date().toISOString(),
      };
      await db.users.put(adminUser);

      const defaultFY: FiscalYear & { id: string } = {
        id: "fy-2083-84",
        name: "2083/84",
        startDate: "2026-07-16",
        endDate: "2027-07-15",
        isCurrent: true,
        status: FiscalYearStatus.ACTIVE,
        closedBy: undefined,
        closedAt: undefined,
        openingEntryId: undefined,
      };
      await db.fiscalYears.put(defaultFY);

      const defaultSettings: CompanySettings & { id: string } = {
        id: "company-default",
        name: "Sutra ERP Demo Inc.",
        nameNepali: "सूत्र इआरपी डेमो सं.",
        panNumber: "609876543",
        vatNumber: "609876543",
        address: "Anamnagar, Kathmandu, Nepal",
        phone: "+977-1-4771234",
        email: "contact@sutraerp.com.np",
        website: "www.sutraerp.com.np",
        defaultCurrency: "NPR",
        currencySymbol: "Rs.",
        defaultDateFormat: DateFormat.BS,
        fiscalYearStartMonth: 4,
        stockValuationMethod: StockValuationMethod.WEIGHTED_AVERAGE,
        enableCostCenter: true,
        enableMultiCurrency: false,
        enableBillWiseTracking: true,
        enableBatchTracking: false,
        printLogoOnInvoice: false,
        printTermsOnInvoice: true,
        termsAndConditions:
          "1. Goods once sold are non-returnable.\n2. Interest @ 18% p.a. will be charged for delayed payments.",
        tdsEnabled: true,
        voucherSeries: {
          journal: { prefix: "JV-", nextNumber: 1, padding: 4 },
          payment: { prefix: "PV-", nextNumber: 1, padding: 4 },
          receipt: { prefix: "RV-", nextNumber: 1, padding: 4 },
          contra: { prefix: "CV-", nextNumber: 1, padding: 4 },
          "sales-invoice": { prefix: "SI-", nextNumber: 1, padding: 4 },
          "purchase-invoice": { prefix: "PI-", nextNumber: 1, padding: 4 },
          "sales-return": { prefix: "SR-", nextNumber: 1, padding: 4 },
          "purchase-return": { prefix: "PR-", nextNumber: 1, padding: 4 },
          "debit-note": { prefix: "DN-", nextNumber: 1, padding: 4 },
          "credit-note": { prefix: "CN-", nextNumber: 1, padding: 4 },
          "stock-journal": { prefix: "ST-", nextNumber: 1, padding: 4 },
          "opening-balance": { prefix: "OB-", nextNumber: 1, padding: 4 },
        },
      };
      await db.companySettings.put(defaultSettings);

      const mainWarehouse: Warehouse & { id: string } = {
        id: "wh-main",
        code: "MAIN",
        name: "Main Store Godown",
        address: "Kathmandu Warehouse Area",
        isDefault: true,
        isActive: true,
      };
      await db.warehouses.put(mainWarehouse);

      const defaultUnits: (Unit & { id: string })[] = [
        { id: "u-pcs", code: "PCS", name: "Pieces", symbol: "Pcs", isActive: true },
        { id: "u-kg", code: "KG", name: "Kilograms", symbol: "Kg", isActive: true },
        { id: "u-box", code: "BOX", name: "Boxes", symbol: "Box", isActive: true },
        { id: "u-mtr", code: "MTR", name: "Meters", symbol: "Mtr", isActive: true },
      ];
      for (const unit of defaultUnits) {
        await db.units.put(unit);
      }

      const seedAccounts: (Account & { id: string })[] = [
        {
          id: "grp-fixed-assets",
          code: "1000",
          name: "Fixed Assets",
          type: AccountType.ASSET,
          level: AccountLevel.GROUP,
          group: "Capital",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-current-assets",
          code: "1100",
          name: "Current Assets",
          type: AccountType.ASSET,
          level: AccountLevel.GROUP,
          group: "Assets",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-bank-accounts",
          code: "1110",
          name: "Bank Accounts",
          type: AccountType.ASSET,
          level: AccountLevel.SUBGROUP,
          parentId: "grp-current-assets",
          group: "Assets",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-cash-in-hand",
          code: "1120",
          name: "Cash-in-Hand",
          type: AccountType.ASSET,
          level: AccountLevel.SUBGROUP,
          parentId: "grp-current-assets",
          group: "Assets",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-sundry-debtors",
          code: "1130",
          name: "Sundry Debtors",
          type: AccountType.ASSET,
          level: AccountLevel.SUBGROUP,
          parentId: "grp-current-assets",
          group: "Assets",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-stock-in-hand",
          code: "1140",
          name: "Stock-in-Hand",
          type: AccountType.ASSET,
          level: AccountLevel.SUBGROUP,
          parentId: "grp-current-assets",
          group: "Assets",
          isActive: true,
          isGroup: true,
          balance: 0,
        },

        {
          id: "grp-capital-account",
          code: "2000",
          name: "Capital Account",
          type: AccountType.EQUITY,
          level: AccountLevel.GROUP,
          group: "Capital",
          isActive: true,
          isGroup: true,
          balance: 0,
        },

        {
          id: "grp-current-liabilities",
          code: "3000",
          name: "Current Liabilities",
          type: AccountType.LIABILITY,
          level: AccountLevel.GROUP,
          group: "Liabilities",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-sundry-creditors",
          code: "3100",
          name: "Sundry Creditors",
          type: AccountType.LIABILITY,
          level: AccountLevel.SUBGROUP,
          parentId: "grp-current-liabilities",
          group: "Liabilities",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-duties-taxes",
          code: "3200",
          name: "Duties & Taxes",
          type: AccountType.LIABILITY,
          level: AccountLevel.SUBGROUP,
          parentId: "grp-current-liabilities",
          group: "Liabilities",
          isActive: true,
          isGroup: true,
          balance: 0,
        },

        {
          id: "grp-sales-accounts",
          code: "4000",
          name: "Sales Accounts",
          type: AccountType.INCOME,
          level: AccountLevel.GROUP,
          group: "Sales",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-purchase-accounts",
          code: "5000",
          name: "Purchase Accounts",
          type: AccountType.EXPENSE,
          level: AccountLevel.GROUP,
          group: "Purchases",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-direct-expenses",
          code: "5100",
          name: "Direct Expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.GROUP,
          group: "Expenses",
          isActive: true,
          isGroup: true,
          balance: 0,
        },
        {
          id: "grp-indirect-expenses",
          code: "5200",
          name: "Indirect Expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.GROUP,
          group: "Expenses",
          isActive: true,
          isGroup: true,
          balance: 0,
        },

        {
          id: "acc-share-capital",
          code: "2001",
          name: "Share Capital",
          parentId: "grp-capital-account",
          type: AccountType.EQUITY,
          level: AccountLevel.LEDGER,
          group: "Capital Account",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-cash",
          code: "1121",
          name: "Cash A/C",
          nameNepali: "नगद खाता",
          parentId: "grp-cash-in-hand",
          type: AccountType.ASSET,
          level: AccountLevel.LEDGER,
          group: "Cash-in-Hand",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-vat-13",
          code: "3201",
          name: "VAT 13% A/C",
          nameNepali: "भ्याट १३% खाता",
          parentId: "grp-duties-taxes",
          type: AccountType.LIABILITY,
          level: AccountLevel.LEDGER,
          group: "Duties & Taxes",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-tds-payable",
          code: "3202",
          name: "TDS Payable A/C",
          nameNepali: "टिडीएस कट्टी खाता",
          parentId: "grp-duties-taxes",
          type: AccountType.LIABILITY,
          level: AccountLevel.LEDGER,
          group: "Duties & Taxes",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-sales",
          code: "4001",
          name: "Sales Ledger",
          nameNepali: "बिक्री खाता",
          parentId: "grp-sales-accounts",
          type: AccountType.INCOME,
          level: AccountLevel.LEDGER,
          group: "Sales Accounts",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-purchase",
          code: "5001",
          name: "Purchase Ledger",
          nameNepali: "खरिद खाता",
          parentId: "grp-purchase-accounts",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Purchase Accounts",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-round-off",
          code: "5201",
          name: "Round Off Expenses",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-salary",
          code: "5202",
          name: "Salary A/C",
          nameNepali: "तलब खाता",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-office-rent",
          code: "5203",
          name: "Office Rent A/C",
          nameNepali: "कार्यालय भाडा",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-telecommunications",
          code: "5204",
          name: "Internet & Phone",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-electricity",
          code: "5205",
          name: "Electricity Expense",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-marketing",
          code: "5206",
          name: "Marketing & Advertisement",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-audit-fees",
          code: "5207",
          name: "Audit & Professional Fees",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isActive: true,
          isGroup: false,
          balance: 0,
        },
        {
          id: "acc-forex-gain-loss",
          code: "5208",
          name: "Foreign Exchange Gain/Loss",
          nameNepali: "विदेशी मुद्रा लाभ/हानि",
          parentId: "grp-indirect-expenses",
          type: AccountType.EXPENSE,
          level: AccountLevel.LEDGER,
          group: "Indirect Expenses",
          isSystemAccount: true,
          isActive: true,
          isGroup: false,
          balance: 0,
        },
      ];

      for (const acc of seedAccounts) {
        await db.accounts.put(acc);
      }

      const defaultBankLedger: Account & { id: string } = {
        id: "acc-nabil-bank",
        code: "1111",
        name: "Nabil Bank Ltd. A/C",
        nameNepali: "नबिल बैंक खाता",
        parentId: "grp-bank-accounts",
        type: AccountType.ASSET,
        level: AccountLevel.LEDGER,
        group: "Bank Accounts",
        isActive: true,
        isGroup: false,
        balance: 0,
      };
      await db.accounts.put(defaultBankLedger);

      const defaultBank: BankAccount & { id: string } = {
        id: "bk-nabil",
        accountId: "acc-nabil-bank",
        bankName: "Nabil Bank Ltd.",
        accountNo: "00100987654321",
        branch: "New Baneshwor, Kathmandu",
        ifscCode: "NABILNPA",
        swiftCode: "NABILNPKA",
        openingBalance: 0,
        isActive: true,
      };
      await db.bankAccounts.put(defaultBank);

      // Seed default currencies
      const defaultCurrencies: (Currency & { id: string })[] = [
        {
          id: "cur-npr",
          code: "NPR",
          name: "Nepali Rupee",
          symbol: "रू.",
          isBase: true,
          isActive: true,
        },
        {
          id: "cur-usd",
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          isBase: false,
          isActive: true,
        },
        { id: "cur-eur", code: "EUR", name: "Euro", symbol: "€", isBase: false, isActive: true },
        {
          id: "cur-inr",
          code: "INR",
          name: "Indian Rupee",
          symbol: "₹",
          isBase: false,
          isActive: true,
        },
        {
          id: "cur-gbp",
          code: "GBP",
          name: "British Pound",
          symbol: "£",
          isBase: false,
          isActive: true,
        },
        {
          id: "cur-cny",
          code: "CNY",
          name: "Chinese Yuan",
          symbol: "¥",
          isBase: false,
          isActive: true,
        },
      ];
      for (const currency of defaultCurrencies) {
        await db.currencies.put(currency);
      }

      // Seed initial exchange rates
      const today = new Date().toISOString().split("T")[0];
      const initialRates: (ExchangeRate & { id: string })[] = [
        {
          id: generateId("exr"),
          currencyCode: "USD",
          date: today,
          rateToBase: 133.5,
          source: "manual",
        },
        {
          id: generateId("exr"),
          currencyCode: "EUR",
          date: today,
          rateToBase: 145.2,
          source: "manual",
        },
        {
          id: generateId("exr"),
          currencyCode: "INR",
          date: today,
          rateToBase: 1.6,
          source: "manual",
        },
        {
          id: generateId("exr"),
          currencyCode: "GBP",
          date: today,
          rateToBase: 168.75,
          source: "manual",
        },
        {
          id: generateId("exr"),
          currencyCode: "CNY",
          date: today,
          rateToBase: 18.45,
          source: "manual",
        },
      ];
      for (const rate of initialRates) {
        await db.exchangeRates.put(rate);
      }

      // Seed progressive salary slabs (FY 2081-82 rules)
      const defaultSlabs: SalarySlab[] = [
        { id: "slab-s1", maritalStatus: "single", thresholdFrom: 0, thresholdTo: 500000, taxRate: 1 },
        { id: "slab-s2", maritalStatus: "single", thresholdFrom: 500001, thresholdTo: 700000, taxRate: 10 },
        { id: "slab-s3", maritalStatus: "single", thresholdFrom: 700001, thresholdTo: 1000000, taxRate: 20 },
        { id: "slab-s4", maritalStatus: "single", thresholdFrom: 1000001, thresholdTo: 2000000, taxRate: 30 },
        { id: "slab-s5", maritalStatus: "single", thresholdFrom: 2000001, thresholdTo: 999999999, taxRate: 36 },
        { id: "slab-m1", maritalStatus: "married", thresholdFrom: 0, thresholdTo: 550000, taxRate: 1 },
        { id: "slab-m2", maritalStatus: "married", thresholdFrom: 550001, thresholdTo: 770000, taxRate: 10 },
        { id: "slab-m3", maritalStatus: "married", thresholdFrom: 770001, thresholdTo: 1100000, taxRate: 20 },
        { id: "slab-m4", maritalStatus: "married", thresholdFrom: 1100001, thresholdTo: 2200000, taxRate: 30 },
        { id: "slab-m5", maritalStatus: "married", thresholdFrom: 2200001, thresholdTo: 999999999, taxRate: 36 },
      ];
      for (const slab of defaultSlabs) {
        await db.salarySlabs.put(slab);
      }

      const initAudit: AuditLog & { id: string } = {
        id: generateId("audit"),
        timestamp: new Date().toISOString(),
        userId: adminUser.id,
        userName: adminUser.name,
        action: "database_initialize",
        module: "system",
        recordId: "system",
        recordType: "metadata",
        newValue: JSON.stringify({ message: "Seed data populated successfully." }),
      };
      await db.auditLogs.put(initAudit);

      console.log("Sutra ERP: Initial DB Seeding completed.");
    });
  } catch (error) {
    console.error("Fatal: Failed to initialize and seed local Database:", error);
    throw error;
  } finally {
    isSeedingActive = false;
  }
}

export async function clearAllData(): Promise<void> {
  try {
    const db = getDB();
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
    });
    console.log("Sutra ERP: All local DB tables cleared.");
  } catch (error) {
    console.error("Error during data erasure:", error);
    throw error;
  }
}

export async function exportAllData(): Promise<Record<string, any[]>> {
  try {
    const db = getDB();
    const backupData: Record<string, any[]> = {};

    await db.transaction("r", db.tables, async () => {
      for (const table of db.tables) {
        backupData[table.name] = await table.toArray();
      }
    });

    return backupData;
  } catch (error) {
    console.error("Error during data export operations:", error);
    throw error;
  }
}

export async function importAllData(data: Record<string, any[]>): Promise<void> {
  try {
    const db = getDB();
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
      for (const [tableName, rows] of Object.entries(data)) {
        const table = db.table(tableName);
        if (rows && rows.length > 0) {
          await table.bulkAdd(rows);
        }
      }
    });
    console.log("Sutra ERP: Local database successfully restored from backup.");
  } catch (error) {
    console.error("Error during database restoration:", error);
    throw error;
  }
}

export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const backupMap: Record<string, any> = {};
    const migratingKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sa_") || key.startsWith("sutra_"))) {
        migratingKeys.push(key);
        try {
          const value = localStorage.getItem(key);
          if (value) {
            backupMap[key] = JSON.parse(value);
          }
        } catch (err) {
          console.warn(`Could not parse localStorage key "${key}":`, err);
        }
      }
    }

    if (migratingKeys.length === 0) {
      console.log("Sutra ERP Migration: No legacy localStorage keys found to migrate.");
      return;
    }

    console.log(
      `Sutra ERP Migration: Found ${migratingKeys.length} legacy keys. Starting migration to Dexie DB...`,
    );
    const db = getDB();

    const keyMapping: Record<string, string> = {
      sa_accounts: "accounts",
      sa_parties: "parties",
      sa_items: "items",
      sa_vouchers: "vouchers",
      sa_invoices: "invoices",
      sa_warehouses: "warehouses",
      sa_units: "units",
      sa_stockMovements: "stockMovements",
      sa_costCenters: "costCenters",
      sa_bankAccounts: "bankAccounts",
      sa_budgets: "budgets",
      sa_users: "users",
      sa_companySettings: "companySettings",
      sa_fiscalYears: "fiscalYears",
    };

    await db.transaction("rw", db.tables, async () => {
      for (const [storeKey, legacyValue] of Object.entries(backupMap)) {
        const mappedTableName = keyMapping[storeKey];
        if (mappedTableName && Array.isArray(legacyValue)) {
          console.log(
            `Migrating array of ${legacyValue.length} items from legacy key "${storeKey}" -> Table "${mappedTableName}"`,
          );
          const table = db.table(mappedTableName);
          await table.clear();
          await table.bulkAdd(legacyValue);
        } else if (mappedTableName) {
          console.log(
            `Migrating object from legacy key "${storeKey}" -> Table "${mappedTableName}"`,
          );
          const table = db.table(mappedTableName);
          await table.clear();
          await table.put(legacyValue);
        }
      }
    });

    localStorage.setItem("sa_backup_migrated", JSON.stringify(backupMap));
    for (const oldKey of migratingKeys) {
      localStorage.removeItem(oldKey);
    }

    console.log(
      'Sutra ERP Migration: LocalStorage migration completed and backup stored successfully under "sa_backup_migrated"!',
    );
  } catch (error) {
    console.error("Error during local storage migration operation:", error);
  }
}
