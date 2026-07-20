import { formatCurrency } from "@/lib/utils";
import type { AccountGroup, FeatureConfig, MasterConfig } from "./types";
// â”€â”€â”€ 15 PREDEFINED PRIMARY GROUPS (BUSY-style) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PREDEFINED_GROUPS = [
  // Capital / Equity
  {
    id: "pg-capital",
    name: "Capital Account",
    nature: "credit",
    category: "Capital/Equity",
    sortOrder: 1,
    icon: "Wallet",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-partners-capital", name: "Partners Capital Account", parentId: "pg-capital" },
      { id: "sg-share-capital", name: "Share Capital", parentId: "pg-capital" },
    ],
  },
  {
    id: "pg-reserves",
    name: "Reserves & Surplus",
    nature: "credit",
    category: "Capital/Equity",
    sortOrder: 2,
    icon: "Wallet",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-general-reserve", name: "General Reserve", parentId: "pg-reserves" },
      { id: "sg-retained-earnings", name: "Retained Earnings", parentId: "pg-reserves" },
    ],
  },
  // Liabilities
  {
    id: "pg-loans-liability",
    name: "Loans (Liability)",
    nature: "credit",
    category: "Liabilities",
    sortOrder: 3,
    icon: "Landmark",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-secured-loans", name: "Secured Loans", parentId: "pg-loans-liability" },
      { id: "sg-unsecured-loans", name: "Unsecured Loans", parentId: "pg-loans-liability" },
    ],
  },
  {
    id: "pg-current-liability",
    name: "Current Liabilities",
    nature: "credit",
    category: "Liabilities",
    sortOrder: 4,
    icon: "Briefcase",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-sundry-creditors", name: "Sundry Creditors", parentId: "pg-current-liability" },
      { id: "sg-duties-taxes", name: "Duties & Taxes", parentId: "pg-current-liability" },
      {
        id: "sg-advances-customers",
        name: "Advances from Customers",
        parentId: "pg-current-liability",
      },
      {
        id: "sg-outstanding-expenses",
        name: "Outstanding Expenses",
        parentId: "pg-current-liability",
      },
    ],
  },
  {
    id: "pg-provisions",
    name: "Provisions",
    nature: "credit",
    category: "Liabilities",
    sortOrder: 5,
    icon: "Briefcase",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-provision-tax", name: "Provision for Tax", parentId: "pg-provisions" },
      {
        id: "sg-provision-doubtful",
        name: "Provision for Doubtful Debts",
        parentId: "pg-provisions",
      },
    ],
  },
  // Assets
  {
    id: "pg-fixed-assets",
    name: "Fixed Assets",
    nature: "debit",
    category: "Assets",
    sortOrder: 6,
    icon: "Building",
    color: "var(--ds-action-primary)",
    subGroups: [],
  },
  {
    id: "pg-current-assets",
    name: "Current Assets",
    nature: "debit",
    category: "Assets",
    sortOrder: 7,
    icon: "Package",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-cash-in-hand", name: "Cash-in-Hand", parentId: "pg-current-assets" },
      { id: "sg-bank-accounts", name: "Bank Accounts", parentId: "pg-current-assets" },
      { id: "sg-sundry-debtors", name: "Sundry Debtors", parentId: "pg-current-assets" },
      { id: "sg-deposits-asset", name: "Deposits (Asset)", parentId: "pg-current-assets" },
      { id: "sg-stock-in-hand", name: "Stock-in-Hand", parentId: "pg-current-assets" },
    ],
  },
  {
    id: "pg-investments",
    name: "Investments",
    nature: "debit",
    category: "Assets",
    sortOrder: 8,
    icon: "TrendingUp",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-fixed-deposits", name: "Fixed Deposits", parentId: "pg-investments" },
      { id: "sg-shares-bonds", name: "Shares & Bonds", parentId: "pg-investments" },
    ],
  },
  {
    id: "pg-loans-asset",
    name: "Loans & Advances (Asset)",
    nature: "debit",
    category: "Assets",
    sortOrder: 9,
    icon: "Users",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-employee-advances", name: "Employee Advances", parentId: "pg-loans-asset" },
      { id: "sg-advances-suppliers", name: "Advances to Suppliers", parentId: "pg-loans-asset" },
    ],
  },
  // Income
  {
    id: "pg-direct-income",
    name: "Direct Income",
    nature: "credit",
    category: "Income/Revenue",
    sortOrder: 10,
    icon: "TrendingUp",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-sales-accounts", name: "Sales Accounts", parentId: "pg-direct-income" },
      { id: "sg-service-income", name: "Service Income", parentId: "pg-direct-income" },
    ],
  },
  {
    id: "pg-indirect-income",
    name: "Indirect Income",
    nature: "credit",
    category: "Income/Revenue",
    sortOrder: 11,
    icon: "TrendingUp",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-interest-received", name: "Interest Received", parentId: "pg-indirect-income" },
      { id: "sg-commission-received", name: "Commission Received", parentId: "pg-indirect-income" },
      { id: "sg-rent-received", name: "Rent Received", parentId: "pg-indirect-income" },
    ],
  },
  // Expenses
  {
    id: "pg-direct-expense",
    name: "Direct Expenses (Mfg.)",
    nature: "debit",
    category: "Expenses",
    sortOrder: 12,
    icon: "TrendingDown",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-raw-material", name: "Raw Material Purchase", parentId: "pg-direct-expense" },
      { id: "sg-freight-inward", name: "Freight Inward", parentId: "pg-direct-expense" },
      { id: "sg-factory-wages", name: "Factory Wages", parentId: "pg-direct-expense" },
    ],
  },
  {
    id: "pg-indirect-expense",
    name: "Indirect Expenses (Admn.)",
    nature: "debit",
    category: "Expenses",
    sortOrder: 13,
    icon: "TrendingDown",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-admin-expenses", name: "Administrative Expenses", parentId: "pg-indirect-expense" },
      { id: "sg-selling-expenses", name: "Selling Expenses", parentId: "pg-indirect-expense" },
      { id: "sg-financial-charges", name: "Financial Charges", parentId: "pg-indirect-expense" },
    ],
  },
  {
    id: "pg-purchase",
    name: "Purchase Accounts",
    nature: "debit",
    category: "Expenses",
    sortOrder: 14,
    icon: "ShoppingCart",
    color: "var(--ds-action-primary)",
    subGroups: [
      { id: "sg-purchase-local", name: "Purchase (Local)", parentId: "pg-purchase" },
      { id: "sg-purchase-interstate", name: "Purchase (Interstate)", parentId: "pg-purchase" },
      { id: "sg-purchase-import", name: "Purchase (Import)", parentId: "pg-purchase" },
    ],
  },
  // Miscellaneous
  {
    id: "pg-suspense",
    name: "Suspense Account",
    nature: "debit",
    category: "Miscellaneous",
    sortOrder: 15,
    icon: "BarChart2",
    color: "var(--ds-action-primary)",
    subGroups: [],
  },
];

const CATEGORY_ORDER = [
  "Capital/Equity",
  "Liabilities",
  "Assets",
  "Income/Revenue",
  "Expenses",
  "Miscellaneous",
];
const CATEGORY_COLORS: Record<string, string> = {
  "Capital/Equity": "var(--ds-action-primary)",
  Liabilities: "var(--ds-action-primary)",
  Assets: "var(--ds-action-primary)",
  "Income/Revenue": "var(--ds-action-primary)",
  Expenses: "var(--ds-action-primary)",
  Miscellaneous: "var(--ds-action-primary)",
};

// â”€â”€â”€ Account Type Options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ACCOUNT_TYPES = ["General Ledger", "Party", "Bank", "Cash"];
const PARTY_REG_TYPES = [
  "Regular",
  "Composition",
  "Unregistered",
  "Consumer",
  "SEZ",
  "Deemed Export",
];
const BANK_ACCOUNT_TYPES = ["Savings", "Current", "Overdraft", "Cash Credit", "Fixed Deposit"];
const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Chandigarh",
  "Dadra & Nagar Haveli",
  "Daman & Diu",
  "Lakshadweep",
  "Puducherry",
  "Andaman & Nicobar Islands",
];

// â”€â”€â”€ localStorage helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LS_KEYS = {
  GROUPS: "busy_account_groups",
  LEDGERS: "busy_ledgers",
  FEATURES: "busy_features",
  MASTER_CONFIG: "busy_master_config",
};

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveToLS(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// â”€â”€â”€ Initial data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildInitialGroups(): AccountGroup[] {
  const groups: AccountGroup[] = [];
  PREDEFINED_GROUPS.forEach((pg) => {
    groups.push({
      id: pg.id,
      name: pg.name,
      isPrimary: true,
      isSystem: true,
      nature: pg.nature as any,
      category: pg.category,
      sortOrder: pg.sortOrder,
    });
    pg.subGroups.forEach((sg) => {
      groups.push({
        id: sg.id,
        name: sg.name,
        isPrimary: false,
        parentId: pg.id,
        isSystem: true,
        nature: pg.nature as any,
        category: pg.category,
      });
    });
  });
  return groups;
}

const DEFAULT_FEATURES: FeatureConfig = {
  multiCurrency: false,
  subLedgers: false,
  billByBill: true,
  autoRefSales: true,
  autoRefPurchase: true,
  bankInstruments: true,
  ledgerReconciliation: false,
  salesman: false,
  costCenter: false,
  budgeting: false,
  interestCalculation: false,
  tds: false,
  tcs: false,
  branchDivision: false,
  multiGodown: true,
};

const DEFAULT_MASTER_CONFIG: MasterConfig = {
  dropdownDisplay: "name_alias",
  additionalDropdownFields: [
    { field: "group", width: 20 },
    { field: "gstin", width: 16 },
  ],
  showBottomPanel: true,
  bottomPanelFields: ["Name", "Group", "City", "GSTIN", "Phone", "Opening Balance"],
  optionalFields: [],
  hiddenFields: [],
  mandatoryFields: [],
};

// â”€â”€â”€ Utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const inputCls =
  "w-full h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/15 focus:border-[var(--ds-action-primary)] transition-colors";
const labelCls = "text-[11px] font-medium text-gray-500 mb-1 block";
const sectionHdr =
  "text-[11px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/80 px-4 py-2 border-y border-gray-100 -mx-4 mb-3 mt-4";

function fmt(n: number): string {
  return formatCurrency(Math.abs(n));
}
export {
  PREDEFINED_GROUPS,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  ACCOUNT_TYPES,
  PARTY_REG_TYPES,
  BANK_ACCOUNT_TYPES,
  INDIA_STATES,
  LS_KEYS,
  DEFAULT_FEATURES,
  DEFAULT_MASTER_CONFIG,
  inputCls,
  labelCls,
  sectionHdr,
  fmt,
  loadFromLS,
  saveToLS,
  buildInitialGroups,
};
