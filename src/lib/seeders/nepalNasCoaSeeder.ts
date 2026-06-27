// src/lib/seeders/nepalNasCoaSeeder.ts

import type { Table } from "dexie";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountLevel = "group" | "subgroup" | "ledger";

export interface DBAccount {
  id: string;
  code: string;
  name: string;
  nameNepali: string;
  type: AccountType;
  level: AccountLevel;
  parentId?: string;
  isGroup: boolean;
  isActive: boolean;
  balance: number;
  openingBalance: number;
  openingBalanceDr: number;
  openingBalanceCr: number;
  isSystemAccount: boolean;
}

/**
 * Deterministic UUID-style ID from account code.
 * Example: 1401 -> 00000000-0000-4000-8000-000000001401
 */
export const coaId = (code: string) =>
  `00000000-0000-4000-8000-${code.padStart(12, "0")}`;

const ID_MAP: Record<string, string> = {
  // Ledgers
  "1401": "acc-cash",
  "1321": "acc-sundry-debtors",
  "2411": "acc-sundry-creditors",
  "4101": "acc-sales",
  "5101": "acc-purchase",
  "2441": "acc-vat-payable",
  "2442": "acc-tds-payable",
  "3101": "acc-capital",
  "3121": "acc-retained",
  "4102": "acc-sales-return",
  "5102": "acc-purchase-return",
  
  // Groups
  "1000": "grp-assets",
  "1300": "grp-current-assets",
  "1320": "grp-sundry-debtors",
  "1400": "grp-cash-in-hand",
  "1410": "grp-bank-accounts",
  "2000": "grp-liabilities",
  "2400": "grp-current-liabilities",
  "2410": "grp-sundry-creditors",
  "3000": "grp-equity",
  "4000": "grp-income",
  "4100": "grp-sales",
  "5000": "grp-expenses",
  "5100": "grp-purchase",
};

/**
 * parentCode is converted to parentId using coaId(parentCode).
 * This keeps parent references stable and based on the CoA code field.
 */
const acc = (
  code: string,
  name: string,
  nameNepali: string,
  type: AccountType,
  level: AccountLevel,
  parentCode?: string,
  isGroup = true,
): DBAccount => ({
  id: ID_MAP[code] || coaId(code),
  code,
  name,
  nameNepali,
  type,
  level,
  parentId: parentCode ? (ID_MAP[parentCode] || coaId(parentCode)) : undefined,
  isGroup,
  isActive: true,
  balance: 0,
  openingBalance: 0,
  openingBalanceDr: 0,
  openingBalanceCr: 0,
  isSystemAccount: true,
});

/**
 * Critical 20 ledgers marked as isGroup: false:
 * 1311 Closing Stock / Inventory Ledger
 * 1321 Default Customer / Debtors Control
 * 1371 TDS Receivable
 * 1381 VAT Receivable / Input VAT
 * 1401 Main Cash
 * 1402 Petty Cash
 * 1411 Default Bank Account
 * 2411 Default Supplier / Creditors Control
 * 2441 VAT Payable
 * 2442 TDS Payable
 * 2443 Income Tax Payable
 * 2444 SSF Payable
 * 2445 PF Payable
 * 3101 Owner / Partner Capital
 * 3121 Retained Earnings
 * 4101 Local Taxable Sales
 * 5101 Local Taxable Purchase
 * 5321 Salary
 * 5331 Bank Charges
 * 5351 Income Tax Expense
 */
export const NEPAL_NAS_CHART_OF_ACCOUNTS: DBAccount[] = [
  // =========================================================
  // 1xxx — ASSETS / सम्पत्ति
  // =========================================================
  acc("1000", "Assets", "सम्पत्ति", "asset", "group"),

  acc("1100", "Fixed Assets", "स्थायी सम्पत्ति", "asset", "group", "1000"),
  acc("1110", "Land & Building", "जग्गा तथा भवन", "asset", "subgroup", "1100"),
  acc("1119", "Accumulated Depreciation - Building", "भवनको सञ्चित ह्रासकट्टी", "asset", "subgroup", "1110"),

  acc("1120", "Plant & Machinery", "प्लान्ट तथा मेसिनरी", "asset", "subgroup", "1100"),
  acc("1129", "Accumulated Depreciation - Plant & Machinery", "प्लान्ट तथा मेसिनरीको सञ्चित ह्रासकट्टी", "asset", "subgroup", "1120"),

  acc("1130", "Furniture & Fixtures", "फर्निचर तथा फिक्स्चर", "asset", "subgroup", "1100"),
  acc("1139", "Accumulated Depreciation - Furniture & Fixtures", "फर्निचर तथा फिक्स्चरको सञ्चित ह्रासकट्टी", "asset", "subgroup", "1130"),

  acc("1140", "Vehicles", "सवारी साधन", "asset", "subgroup", "1100"),
  acc("1149", "Accumulated Depreciation - Vehicles", "सवारी साधनको सञ्चित ह्रासकट्टी", "asset", "subgroup", "1140"),

  acc("1150", "Computer Equipment", "कम्प्युटर उपकरण", "asset", "subgroup", "1100"),
  acc("1159", "Accumulated Depreciation - Computer Equipment", "कम्प्युटर उपकरणको सञ्चित ह्रासकट्टी", "asset", "subgroup", "1150"),

  acc("1160", "Office Equipment", "कार्यालय उपकरण", "asset", "subgroup", "1100"),
  acc("1169", "Accumulated Depreciation - Office Equipment", "कार्यालय उपकरणको सञ्चित ह्रासकट्टी", "asset", "subgroup", "1160"),

  acc("1170", "Intangible Assets", "अमूर्त सम्पत्ति", "asset", "subgroup", "1100"),
  acc("1171", "Goodwill", "गुडविल", "asset", "subgroup", "1170"),
  acc("1172", "Software", "सफ्टवेयर", "asset", "subgroup", "1170"),
  acc("1179", "Accumulated Amortization - Intangible Assets", "अमूर्त सम्पत्तिको सञ्चित अमोर्टाइजेसन", "asset", "subgroup", "1170"),

  acc("1180", "Capital Work in Progress", "पुँजीगत कार्य प्रगति", "asset", "subgroup", "1000"),

  acc("1200", "Investments", "लगानी", "asset", "group", "1000"),
  acc("1210", "Long-term Investments", "दीर्घकालीन लगानी", "asset", "subgroup", "1200"),
  acc("1220", "Short-term Investments", "अल्पकालीन लगानी", "asset", "subgroup", "1200"),

  acc("1300", "Current Assets", "चालू सम्पत्ति", "asset", "group", "1000"),

  acc("1310", "Inventories / Closing Stock", "मौज्दात / अन्तिम स्टक", "asset", "subgroup", "1300"),
  acc("1311", "Closing Stock / Inventory Ledger", "अन्तिम मौज्दात खाता", "asset", "ledger", "1310", false),

  acc("1320", "Sundry Debtors", "विविध देनदार", "asset", "subgroup", "1300"),
  acc("1321", "Default Customer / Debtors Control", "ग्राहक / देनदार नियन्त्रण खाता", "asset", "ledger", "1320", false),

  acc("1330", "Bills Receivable", "प्राप्य बिल", "asset", "subgroup", "1300"),
  acc("1340", "Advance to Suppliers", "आपूर्तिकर्तालाई अग्रिम", "asset", "subgroup", "1300"),
  acc("1350", "Advance to Employees", "कर्मचारीलाई अग्रिम", "asset", "subgroup", "1300"),
  acc("1360", "Prepaid Expenses", "अग्रिम भुक्तानी खर्च", "asset", "subgroup", "1300"),

  acc("1370", "TDS Receivable", "अग्रिम कर कट्टी प्राप्य", "asset", "subgroup", "1300"),
  acc("1371", "TDS Receivable Ledger", "अग्रिम कर कट्टी प्राप्य खाता", "asset", "ledger", "1370", false),

  acc("1380", "VAT Receivable / Input VAT", "मूल्य अभिवृद्धि कर प्राप्य / इनपुट भ्याट", "asset", "subgroup", "1300"),
  acc("1381", "VAT Receivable / Input VAT Ledger", "इनपुट भ्याट प्राप्य खाता", "asset", "ledger", "1380", false),

  acc("1390", "Loans & Advances", "ऋण तथा अग्रिम", "asset", "subgroup", "1300"),

  acc("1400", "Cash-in-Hand", "हातमा नगद", "asset", "subgroup", "1300"),
  acc("1401", "Main Cash", "मुख्य नगद", "asset", "ledger", "1400", false),
  acc("1402", "Petty Cash", "सानो नगद", "asset", "ledger", "1400", false),

  acc("1410", "Bank Accounts", "बैंक खाताहरू", "asset", "subgroup", "1300"),
  acc("1411", "Default Bank Account", "पूर्वनिर्धारित बैंक खाता", "asset", "ledger", "1410", false),

  acc("1420", "Short-term Investments - Current", "चालू अल्पकालीन लगानी", "asset", "subgroup", "1300"),

  // =========================================================
  // 2xxx — LIABILITIES / दायित्व
  // =========================================================
  acc("2000", "Liabilities", "दायित्व", "liability", "group"),

  acc("2100", "Secured Loans", "सुरक्षित ऋण", "liability", "group", "2100"),
  acc("2110", "Bank Overdraft", "बैंक ओभरड्राफ्ट", "liability", "subgroup", "2100"),
  acc("2120", "Term Loans", "आवधिक ऋण", "liability", "subgroup", "2100"),

  acc("2200", "Unsecured Loans", "असुरक्षित ऋण", "liability", "group", "2000"),
  acc("2300", "Debentures & Bonds", "डिबेन्चर तथा बण्ड", "liability", "group", "2000"),

  acc("2400", "Current Liabilities", "चालू दायित्व", "liability", "group", "2000"),

  acc("2410", "Sundry Creditors", "विविध साहूकार", "liability", "subgroup", "2400"),
  acc("2411", "Default Supplier / Creditors Control", "आपूर्तिकर्ता / साहूकार नियन्त्रण खाता", "liability", "ledger", "2410", false),

  acc("2420", "Bills Payable", "भुक्तानीयोग्य बिल", "liability", "subgroup", "2400"),
  acc("2430", "Advance from Customers", "ग्राहकबाट अग्रिम", "liability", "subgroup", "2400"),

  acc("2440", "Duties & Taxes", "महसुल तथा कर", "liability", "subgroup", "2400"),
  acc("2441", "VAT Payable", "मूल्य अभिवृद्धि कर भुक्तानीयोग्य", "liability", "ledger", "2440", false),
  acc("2442", "TDS Payable", "कर कट्टी भुक्तानीयोग्य", "liability", "ledger", "2440", false),
  acc("2443", "Income Tax Payable", "आयकर भुक्तानीयोग्य", "liability", "ledger", "2440", false),
  acc("2444", "SSF Payable", "सामाजिक सुरक्षा कोष भुक्तानीयोग्य", "liability", "ledger", "2440", false),
  acc("2445", "PF Payable", "सञ्चय कोष भुक्तानीयोग्य", "liability", "ledger", "2440", false),
  acc("2446", "Custom Duty Payable", "भन्सार महसुल भुक्तानीयोग्य", "liability", "subgroup", "2440"),

  acc("2450", "Provisions", "प्रावधानहरू", "liability", "subgroup", "2400"),
  acc("2451", "Provision for Gratuity", "उपदान प्रावधान", "liability", "subgroup", "2450"),
  acc("2452", "Provision for Leave", "बिदा प्रावधान", "liability", "subgroup", "2450"),
  acc("2453", "Provision for Tax", "कर प्रावधान", "liability", "subgroup", "2450"),

  // =========================================================
  // 3xxx — EQUITY / स्वामित्व पूँजी
  // =========================================================
  acc("3000", "Equity", "स्वामित्व पूँजी", "equity", "group"),

  acc("3100", "Capital Account", "पूँजी खाता", "equity", "group", "3000"),
  acc("3101", "Owner / Partner Capital", "सञ्चालक / साझेदार पूँजी", "equity", "ledger", "3100", false),

  acc("3110", "Share Capital", "शेयर पूँजी", "equity", "subgroup", "3000"),

  acc("3120", "Reserves & Surplus", "जगेडा तथा बचत", "equity", "subgroup", "3000"),
  acc("3121", "Retained Earnings", "सञ्चित नाफा", "equity", "ledger", "3120", false),

  // =========================================================
  // 4xxx — INCOME / आम्दानी
  // =========================================================
  acc("4000", "Income", "आम्दानी", "income", "group"),

  acc("4100", "Sales Accounts", "बिक्री खाता", "income", "group", "4000"),
  acc("4101", "Local Taxable Sales", "स्थानीय करयोग्य बिक्री", "income", "ledger", "4100", false),
  acc("4102", "Local Exempt Sales", "स्थानीय कर छुट बिक्री", "income", "subgroup", "4100"),
  acc("4103", "Export Sales", "निर्यात बिक्री", "income", "subgroup", "4100"),

  acc("4200", "Other Income", "अन्य आम्दानी", "income", "group", "4000"),
  acc("4210", "Interest Income", "ब्याज आम्दानी", "income", "subgroup", "4200"),
  acc("4220", "Discount Received", "प्राप्त छुट", "income", "subgroup", "4200"),
  acc("4230", "Commission Received", "प्राप्त कमिशन", "income", "subgroup", "4200"),
  acc("4290", "Miscellaneous Income", "विविध आम्दानी", "income", "subgroup", "4200"),

  // =========================================================
  // 5xxx — EXPENSES / खर्च
  // =========================================================
  acc("5000", "Expenses", "खर्च", "expense", "group"),

  acc("5100", "Purchase Accounts", "खरीद खाता", "expense", "group", "5000"),
  acc("5101", "Local Taxable Purchase", "स्थानीय करयोग्य खरीद", "expense", "ledger", "5100", false),
  acc("5102", "Local Exempt Purchase", "स्थानीय कर छुट खरीद", "expense", "subgroup", "5100"),
  acc("5103", "Import Purchase", "पैठारी खरीद", "expense", "subgroup", "5100"),

  acc("5200", "Direct Expenses", "प्रत्यक्ष खर्च", "expense", "group", "5000"),
  acc("5210", "Freight Inward", "भित्र्याउने ढुवानी", "expense", "subgroup", "5200"),
  acc("5220", "Cartage", "ढुवानी खर्च", "expense", "subgroup", "5200"),
  acc("5230", "Labour", "श्रमिक खर्च", "expense", "subgroup", "5200"),
  acc("5240", "Wages", "ज्याला", "expense", "subgroup", "5200"),
  acc("5250", "Manufacturing Expenses", "उत्पादन खर्च", "expense", "subgroup", "5200"),

  acc("5300", "Indirect Expenses", "अप्रत्यक्ष खर्च", "expense", "group", "5000"),

  acc("5310", "Admin Expenses", "प्रशासनिक खर्च", "expense", "subgroup", "5300"),
  acc("5311", "Rent", "भाडा", "expense", "subgroup", "5310"),
  acc("5312", "Electricity", "बिजुली", "expense", "subgroup", "5310"),
  acc("5313", "Telephone", "टेलिफोन", "expense", "subgroup", "5310"),
  acc("5314", "Office Supplies", "कार्यालय सामग्री", "expense", "subgroup", "5310"),
  acc("5315", "Printing & Stationery", "छपाइ तथा स्टेशनरी", "expense", "subgroup", "5310"),
  acc("5316", "Postage", "हुलाक खर्च", "expense", "subgroup", "5310"),

  acc("5320", "Salary & Staff Expenses", "तलब तथा कर्मचारी खर्च", "expense", "subgroup", "5300"),
  acc("5321", "Salary", "तलब", "expense", "ledger", "5320", false),
  acc("5322", "Allowances", "भत्ता", "expense", "subgroup", "5320"),
  acc("5323", "SSF Employer Contribution", "सामाजिक सुरक्षा कोष रोजगारदाता योगदान", "expense", "subgroup", "5320"),
  acc("5324", "PF Employer Contribution", "सञ्चय कोष रोजगारदाता योगदान", "expense", "subgroup", "5320"),
  acc("5325", "Staff Welfare", "कर्मचारी कल्याण", "expense", "subgroup", "5320"),
  acc("5326", "Dashain Bonus", "दशैं बोनस", "expense", "subgroup", "5320"),
  acc("5327", "Gratuity Expense", "उपदान खर्च", "expense", "subgroup", "5320"),
  acc("5328", "Leave Encashment", "बिदा नगदीकरण", "expense", "subgroup", "5320"),

  acc("5330", "Financial Expenses", "वित्तीय खर्च", "expense", "subgroup", "5300"),
  acc("5331", "Bank Charges", "बैंक शुल्क", "expense", "ledger", "5330", false),
  acc("5332", "Interest Expense", "ब्याज खर्च", "expense", "subgroup", "5330"),
  acc("5333", "Loan Processing Fee", "ऋण प्रक्रिया शुल्क", "expense", "subgroup", "5330"),

  acc("5340", "Depreciation", "ह्रासकट्टी", "expense", "subgroup", "5300"),

  acc("5350", "Tax Expenses", "कर खर्च", "expense", "subgroup", "5300"),
  acc("5351", "Income Tax Expense", "आयकर खर्च", "expense", "ledger", "5350", false),
  acc("5352", "Deferred Tax", "स्थगित कर", "expense", "subgroup", "5350"),
];

export async function seedNepalNASChartOfAccounts(db: {
  accounts: Table<any, any>;
}): Promise<{ skipped: boolean; inserted: number }> {
  /**
   * Requirement:
   * If any system account already exists, skip seeding.
   *
   * Using filter() instead of where("isSystemAccount") so this works even
   * if isSystemAccount is not indexed in your Dexie schema.
   */
  const existingSystemAccount = await db.accounts
    .filter((account: any) => account.isSystemAccount === true)
    .first();

  if (existingSystemAccount) {
    console.info("[Nepal NAS CoA Seeder] System accounts already exist. Skipping seed.");
    return { skipped: true, inserted: 0 };
  }

  await db.accounts.bulkPut(NEPAL_NAS_CHART_OF_ACCOUNTS as any[]);

  console.info(
    `[Nepal NAS CoA Seeder] Seeded ${NEPAL_NAS_CHART_OF_ACCOUNTS.length} Nepal NAS chart-of-accounts entries.`,
  );

  return { skipped: false, inserted: NEPAL_NAS_CHART_OF_ACCOUNTS.length };
}
