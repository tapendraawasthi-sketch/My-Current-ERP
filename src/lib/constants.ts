/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TdsType, CompanySettings, VoucherType, DateFormat, StockValuationMethod, TdsSection } from "./types";

export const VAT_RATE = 13;

export const TDS_RATES: Record<TdsType, number> = {
  contractor: 1.5,
  consultancy: 15,
  rent: 10,
  salary: 15,
  dividend: 5,
  commission: 10,
  other: 5,
  none: 0,
};

export const TDS_SECTIONS: Record<TdsType, string> = {
  contractor: "Section 89",
  consultancy: "Section 88(1)",
  rent: "Section 88(2)",
  salary: "Section 87",
  dividend: "Section 88(3)",
  commission: "Section 88(4)",
  other: "Section 88(5)",
  none: "N/A",
};

export const NEPAL_PROVINCES: string[] = [
  "Koshi Province",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
];

export const NEPAL_VAT_THRESHOLD = 5000000; // 50 Lakhs

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const ITEMS_PER_PAGE = 25;
export const MAX_INVOICE_LINES = 100;

export const BS_YEAR_START = 2000;
export const BS_YEAR_END = 2090;

export const VOUCHER_PREFIX_MAP: Record<VoucherType, string> = {
  journal: "JV",
  payment: "PV",
  receipt: "RV",
  contra: "CV",
  "sales-invoice": "SI",
  "purchase-invoice": "PI",
  "sales-return": "SR",
  "purchase-return": "PR",
  "debit-note": "DN",
  "credit-note": "CN",
  "stock-journal": "SJ",
  "opening-balance": "OB",
};

export const PERMISSION_MODULES: string[] = [
  "accounts.view",
  "accounts.create",
  "accounts.edit",
  "accounts.delete",
  "voucher.journal.create",
  "voucher.payment.create",
  "voucher.receipt.create",
  "voucher.contra.create",
  "reports.view",
  "reports.export",
  "settings.view",
  "settings.edit",
  "users.manage",
  "backup.create",
  "backup.restore",
];

export const COLOR_PALETTE = {
  primary: "#1e3a5f",
  secondary: "#2563eb",
  accent: "#16a34a",
  danger: "#dc2626",
  warning: "#d97706",
  success: "#22c55e",
  info: "#3b82f6",
  neutral: "#64748b",
};

export const NEPALI_MONTHS_BS: string[] = [
  "à¤¬à¥ˆà¤¶à¤¾à¤–",
  "à¤œà¥‡à¤ ",
  "à¤…à¤¸à¤¾à¤°",
  "à¤¸à¤¾à¤‰à¤¨",
  "à¤­à¤¦à¥Œ",
  "à¤…à¤¸à¥‹à¤œ",
  "à¤•à¤¾à¤¤à¥à¤¤à¤¿à¤•",
  "à¤®à¤‚à¤¸à¤¿à¤°",
  "à¤ªà¥à¤¸",
  "à¤®à¤¾à¤˜",
  "à¤«à¤¾à¤—à¥à¤¨",
  "à¤šà¥ˆà¤¤",
];

export const NEPALI_MONTHS_EN: string[] = [
  "Baishakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

export const DEFAULT_COMPANY_SETTINGS: Partial<CompanySettings> = {
  name: "Sutra ERP Pvt. Ltd.",
  nameNepali: "à¤¸à¥‚à¤¤à¥à¤° à¤‡à¤†à¤°à¤ªà¥€ à¤ªà¥à¤°à¤¾. à¤²à¤¿.",
  panNumber: "",
  address: "",
  phone: "",
  defaultCurrency: "NPR",
  currencySymbol: "Rs.",
  defaultDateFormat: DateFormat.BS,
  fiscalYearStartMonth: 4,
  stockValuationMethod: StockValuationMethod.WEIGHTED_AVERAGE,
  enableCostCenter: false,
  enableMultiCurrency: false,
  enableBillWiseTracking: true,
  enableBatchTracking: false,
  printLogoOnInvoice: false,
  printTermsOnInvoice: true,
  tdsEnabled: true,
};

// ==========================================
// FULL ITA 2058 TDS SECTIONS (Batch I)
// ==========================================
export const TDS_SECTIONS_FULL: TdsSection[] = [
  {
    id: "tds-87-1a",
    section: "87(1)(a)",
    description: "Employment income (salary)",
    descriptionNepali: "रोजगारीबाट आय (तलब)",
    defaultRate: 1, // slab-based; rate here is minimum
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-87-1b",
    section: "87(1)(b)",
    description: "Dividends – public company",
    descriptionNepali: "लाभांश – सार्वजनिक कम्पनी",
    defaultRate: 5,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-87-1c",
    section: "87(1)(c)",
    description: "Dividends – private company",
    descriptionNepali: "लाभांश – निजी कम्पनी",
    defaultRate: 5,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-87-1d",
    section: "87(1)(d)",
    description: "Interest – resident bank",
    descriptionNepali: "ब्याज – आवासीय बैंक",
    defaultRate: 6,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-87-1e",
    section: "87(1)(e)",
    description: "Interest – other sources",
    descriptionNepali: "ब्याज – अन्य स्रोत",
    defaultRate: 15,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-87-2a",
    section: "87(2)(a)",
    description: "Rent – land/building",
    descriptionNepali: "भाडा – जग्गा/भवन",
    defaultRate: 10,
    applicableTo: "entity",
    isActive: true,
  },
  {
    id: "tds-87-2b",
    section: "87(2)(b)",
    description: "Royalty",
    descriptionNepali: "रोयल्टी",
    defaultRate: 15,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-88",
    section: "88",
    description: "Services / Consultancy / Commission",
    descriptionNepali: "सेवा / परामर्श / कमिसन",
    defaultRate: 15,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-88k",
    section: "88K",
    description: "Contract work",
    descriptionNepali: "ठेक्का काम",
    defaultRate: 1.5,
    thresholdAmount: 50000,
    annualThreshold: 150000,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-89",
    section: "89",
    description: "Lottery / games winnings",
    descriptionNepali: "लटरी / खेल जितेको रकम",
    defaultRate: 25,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-90",
    section: "90",
    description: "Payment to non-resident",
    descriptionNepali: "अनिवासीलाई भुक्तानी",
    defaultRate: 25,
    applicableTo: "both",
    isActive: true,
  },
  {
    id: "tds-95ka",
    section: "95Ka",
    description: "Advance income tax – land/property sale",
    descriptionNepali: "अग्रिम आयकर – जग्गा/सम्पत्ति बिक्री",
    defaultRate: 2.5,
    applicableTo: "both",
    isActive: true,
  },
];
