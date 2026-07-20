import type { NavIcon } from "@/design-system/icons/navIcons";
import {
  NavHomeIcon,
  NavOrbixIcon,
  NavSalesIcon,
  NavPurchasesIcon,
  NavBankingIcon,
  NavInventoryIcon,
  NavAccountingIcon,
  NavReportsIcon,
  NavComplianceIcon,
  NavAdminIcon,
  NavSalesInvoiceIcon,
  NavPurchaseInvoiceIcon,
  NavSalesReturnIcon,
  NavPurchaseReturnIcon,
  NavOrderIcon,
  NavDeliveryIcon,
  NavGoodsReceiptIcon,
  NavRegisterIcon,
  NavPartiesIcon,
  NavReceiveMoneyIcon,
  NavPayMoneyIcon,
  NavContraIcon,
  NavBankRecoIcon,
  NavBankImportIcon,
  NavChequeIcon,
  NavChequePrintIcon,
  NavPdcIcon,
  NavPosIcon,
  NavItemMasterIcon,
  NavItemGroupsIcon,
  NavStockSummaryIcon,
  NavStockLedgerIcon,
  NavStockTransferIcon,
  NavStockJournalIcon,
  NavPhysicalStockIcon,
  NavJobWorkIcon,
  NavBatchIcon,
  NavWarehouseIcon,
  NavJournalIcon,
  NavVoucherIndexIcon,
  NavDebitNoteIcon,
  NavCreditNoteIcon,
  NavChartOfAccountsIcon,
  NavDayBookIcon,
  NavGeneralLedgerIcon,
  NavCostCenterIcon,
  NavNarrationIcon,
  NavBillSundryIcon,
  NavUnitsIcon,
  NavPriceListIcon,
  NavBudgetIcon,
  NavFixedAssetsIcon,
  NavFiscalYearIcon,
  NavTrialBalanceIcon,
  NavProfitLossIcon,
  NavBalanceSheetIcon,
  NavCashFlowIcon,
  NavPartyStatementIcon,
  NavReceivablesIcon,
  NavPayablesIcon,
  NavAgingIcon,
  NavBudgetVsActualIcon,
  NavBranchReportsIcon,
  NavSalesAnalysisIcon,
  NavRatiosIcon,
  NavFinancialDashIcon,
  NavVatIcon,
  NavTdsIcon,
  NavStatutoryIcon,
  NavAuditLogIcon,
  NavSettingsIcon,
  NavCompanyFeaturesIcon,
  NavUsersIcon,
  NavBranchesIcon,
  NavPrintSettingsIcon,
  NavConfigHubIcon,
  NavAccountsConfigIcon,
  NavInventoryConfigIcon,
  NavBackupIcon,
  NavPayrollIcon,
  NavRecurringIcon,
  NavMessagesIcon,
} from "@/design-system/icons/navIcons";

/** Shell roles for nav prioritisation (maps from currentUser.role). */
export type ShellRoleHint =
  | "admin"
  | "manager"
  | "owner"
  | "accountant"
  | "cashier"
  | "auditor"
  | "inventory"
  | "banking"
  | "viewer"
  | "all";

export interface ShellNavItem {
  id: string;
  label: string;
  page: string;
  icon: NavIcon;
  orbix?: boolean;
  /** Roles that see this item in primary nav. `all` = every authenticated user. */
  roles?: ShellRoleHint[];
  favouriteEligible?: boolean;
  commandPalette?: boolean;
  mobile?: boolean;
}

export interface ShellNavGroup {
  id: string;
  label: string;
  icon: NavIcon;
  items: ShellNavItem[];
  page?: string;
  orbix?: boolean;
  roles?: ShellRoleHint[];
}

/**
 * Target IA — max ~11 primary modules; duplicates removed.
 * Routes not listed remain reachable via deep link / palette / App switch.
 * Icons: custom communicative set (design-system/icons/navIcons) — not Lucide fillers.
 */
export const SHELL_NAV: ShellNavGroup[] = [
  {
    id: "home",
    label: "Home",
    icon: NavHomeIcon,
    page: "dashboard",
    roles: ["all"],
    items: [],
  },
  {
    id: "orbix",
    label: "Ask Orbix",
    icon: NavOrbixIcon,
    page: "orbix",
    orbix: true,
    roles: ["all"],
    items: [],
  },
  {
    id: "sales",
    label: "Sales",
    icon: NavSalesIcon,
    roles: ["all", "owner", "manager", "accountant", "cashier", "admin"],
    items: [
      { id: "billing", label: "Sales invoice", page: "billing", icon: NavSalesInvoiceIcon, roles: ["all"], favouriteEligible: true },
      { id: "sales-return", label: "Sales return", page: "sales-return", icon: NavSalesReturnIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "sales-order", label: "Sales order", page: "sales-order", icon: NavOrderIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "delivery-challan", label: "Delivery note", page: "delivery-challan", icon: NavDeliveryIcon, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "sales-register", label: "Sales register", page: "sales-register", icon: NavRegisterIcon, roles: ["accountant", "owner", "manager", "cashier", "admin"], favouriteEligible: true },
      { id: "parties-sales", label: "Customers & suppliers", page: "parties", icon: NavPartiesIcon, roles: ["all"], favouriteEligible: true },
    ],
  },
  {
    id: "purchases",
    label: "Purchases",
    icon: NavPurchasesIcon,
    roles: ["all", "owner", "manager", "accountant", "inventory", "admin"],
    items: [
      { id: "purchase", label: "Purchase invoice", page: "purchase", icon: NavPurchaseInvoiceIcon, roles: ["all"], favouriteEligible: true },
      { id: "purchase-return", label: "Purchase return", page: "purchase-return", icon: NavPurchaseReturnIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "purchase-order", label: "Purchase order", page: "purchase-order", icon: NavOrderIcon, roles: ["accountant", "owner", "manager", "admin", "inventory"] },
      { id: "goods-receipt", label: "Goods receipt", page: "goods-receipt", icon: NavGoodsReceiptIcon, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "purchase-register", label: "Purchase register", page: "purchase-register", icon: NavRegisterIcon, roles: ["accountant", "owner", "manager", "admin"], favouriteEligible: true },
    ],
  },
  {
    id: "banking",
    label: "Banking",
    icon: NavBankingIcon,
    roles: ["all", "owner", "manager", "accountant", "cashier", "banking", "admin"],
    items: [
      { id: "receipt", label: "Receive money", page: "receipt", icon: NavReceiveMoneyIcon, roles: ["all"], favouriteEligible: true, mobile: true },
      { id: "payment", label: "Pay money", page: "payment", icon: NavPayMoneyIcon, roles: ["all"], favouriteEligible: true, mobile: true },
      { id: "contra", label: "Transfer between accounts", page: "contra", icon: NavContraIcon, roles: ["accountant", "banking", "owner", "manager", "admin"] },
      { id: "bank-reconciliation", label: "Match bank statement", page: "bank-reconciliation", icon: NavBankRecoIcon, roles: ["banking", "accountant", "owner", "manager", "admin"], favouriteEligible: true },
      { id: "bank-statement-import", label: "Import bank statement", page: "bank-statement-import", icon: NavBankImportIcon, roles: ["banking", "accountant", "owner", "manager", "admin"] },
      { id: "cheque-register", label: "Cheque register", page: "cheque-register", icon: NavChequeIcon, roles: ["banking", "accountant", "owner", "manager", "admin"] },
      { id: "cheque-printing", label: "Cheque printing", page: "cheque-printing", icon: NavChequePrintIcon, roles: ["banking", "accountant", "owner", "manager", "admin"] },
      { id: "pdc-register", label: "Post-dated cheques", page: "pdc-register", icon: NavPdcIcon, roles: ["banking", "accountant", "owner", "manager", "admin"] },
      { id: "pos-billing", label: "POS counter", page: "pos-billing", icon: NavPosIcon, roles: ["cashier", "owner", "manager", "admin"], favouriteEligible: true, mobile: true },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: NavInventoryIcon,
    roles: ["inventory", "owner", "manager", "accountant", "admin"],
    items: [
      { id: "items", label: "Item Master", page: "items", icon: NavItemMasterIcon, roles: ["inventory", "owner", "manager", "accountant", "admin"], favouriteEligible: true },
      { id: "item-groups", label: "Item Groups", page: "item-groups", icon: NavItemGroupsIcon, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "stock-summary", label: "Stock summary", page: "stock-summary", icon: NavStockSummaryIcon, roles: ["inventory", "owner", "manager", "accountant", "admin"] },
      { id: "stock-ledger", label: "Stock Ledger", page: "stock-ledger", icon: NavStockLedgerIcon, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "stock-transfer", label: "Stock transfer", page: "stock-transfer", icon: NavStockTransferIcon, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "stock-journal", label: "Stock journal", page: "stock-journal", icon: NavStockJournalIcon, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "physical-stock", label: "Physical stock count", page: "physical-stock", icon: NavPhysicalStockIcon, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "job-work-register", label: "Job work", page: "job-work-register", icon: NavJobWorkIcon, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "batch-management", label: "Batches", page: "batch-management", icon: NavBatchIcon, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "warehouses", label: "Warehouses", page: "warehouses", icon: NavWarehouseIcon, roles: ["inventory", "owner", "manager", "admin"] },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: NavAccountingIcon,
    roles: ["accountant", "owner", "manager", "auditor", "admin"],
    items: [
      { id: "journal", label: "Journal", page: "journal", icon: NavJournalIcon, roles: ["accountant", "owner", "manager", "admin"], favouriteEligible: true },
      { id: "voucher-entry", label: "Voucher index", page: "voucher-entry", icon: NavVoucherIndexIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "debit-note", label: "Debit Note", page: "debit-note", icon: NavDebitNoteIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "credit-note", label: "Credit Note", page: "credit-note", icon: NavCreditNoteIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "accounts", label: "Chart of Accounts", page: "accounts", icon: NavChartOfAccountsIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"], favouriteEligible: true },
      { id: "day-book", label: "Day Book", page: "day-book", icon: NavDayBookIcon, roles: ["accountant", "cashier", "owner", "manager", "auditor", "banking", "admin"], favouriteEligible: true },
      { id: "ledger", label: "General Ledger", page: "ledger", icon: NavGeneralLedgerIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "cost-centers", label: "Cost Centers", page: "cost-centers", icon: NavCostCenterIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "standard-narration", label: "Narrations", page: "standard-narration", icon: NavNarrationIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "bill-sundry", label: "Bill Sundries", page: "bill-sundry", icon: NavBillSundryIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "units", label: "Units", page: "units", icon: NavUnitsIcon, roles: ["accountant", "inventory", "owner", "manager", "admin"] },
      { id: "price-lists", label: "Price Lists", page: "price-lists", icon: NavPriceListIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "budget", label: "Budget", page: "budget", icon: NavBudgetIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "fixed-assets", label: "Fixed Assets", page: "fixed-assets", icon: NavFixedAssetsIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "fiscal-year", label: "Fiscal Year", page: "fiscal-year", icon: NavFiscalYearIcon, roles: ["accountant", "owner", "manager", "admin"] },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: NavReportsIcon,
    roles: ["all", "owner", "manager", "accountant", "auditor", "admin"],
    items: [
      { id: "trial-balance", label: "Trial Balance", page: "trial-balance", icon: NavTrialBalanceIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"], favouriteEligible: true },
      { id: "profit-loss", label: "Profit & Loss", page: "profit-loss", icon: NavProfitLossIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "balance-sheet", label: "Balance Sheet", page: "balance-sheet", icon: NavBalanceSheetIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "cash-flow", label: "Cash flow", page: "cash-flow", icon: NavCashFlowIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "party-statement", label: "Party Statement", page: "party-statement", icon: NavPartyStatementIcon, roles: ["accountant", "owner", "manager", "cashier", "admin"] },
      { id: "outstanding-receivables", label: "Receivables", page: "outstanding-receivables", icon: NavReceivablesIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "outstanding-payables", label: "Payables", page: "outstanding-payables", icon: NavPayablesIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "aging-report", label: "Aging", page: "aging-report", icon: NavAgingIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "budget-vs-actual", label: "Budget vs actual", page: "budget-vs-actual", icon: NavBudgetVsActualIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "branch-reports", label: "Branch reports", page: "branch-reports", icon: NavBranchReportsIcon, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "sales-analysis", label: "Sales analysis", page: "sales-analysis", icon: NavSalesAnalysisIcon, roles: ["owner", "manager", "accountant", "admin"] },
      { id: "ratio-analysis", label: "Ratios", page: "ratio-analysis", icon: NavRatiosIcon, roles: ["owner", "manager", "accountant", "auditor", "admin"] },
      { id: "financial-dashboard", label: "Financial Dashboard", page: "financial-dashboard", icon: NavFinancialDashIcon, roles: ["owner", "manager", "accountant", "admin"] },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: NavComplianceIcon,
    roles: ["accountant", "owner", "manager", "auditor", "admin"],
    items: [
      { id: "vat-reports", label: "VAT Reports", page: "vat-reports", icon: NavVatIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "tds-report", label: "TDS Report", page: "tds-report", icon: NavTdsIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "statutory-compliance", label: "Statutory pack", page: "statutory-compliance", icon: NavStatutoryIcon, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "audit-log", label: "Audit log", page: "audit-log", icon: NavAuditLogIcon, roles: ["auditor", "owner", "manager", "admin", "accountant"] },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: NavAdminIcon,
    roles: ["admin", "owner", "manager"],
    items: [
      { id: "settings", label: "Company settings", page: "settings", icon: NavSettingsIcon, roles: ["admin", "owner", "manager"] },
      { id: "company-features", label: "Company features", page: "company-features", icon: NavCompanyFeaturesIcon, roles: ["admin", "owner"] },
      { id: "users", label: "Users", page: "users", icon: NavUsersIcon, roles: ["admin", "owner"] },
      { id: "branch-master", label: "Branches", page: "branch-master", icon: NavBranchesIcon, roles: ["admin", "owner", "manager"] },
      { id: "print-settings", label: "Print settings", page: "print-settings", icon: NavPrintSettingsIcon, roles: ["admin", "owner", "manager"] },
      { id: "configuration-hub", label: "Configuration index", page: "configuration-hub", icon: NavConfigHubIcon, roles: ["admin", "owner", "manager"] },
      { id: "accounts-configuration", label: "Accounts Config", page: "accounts-configuration", icon: NavAccountsConfigIcon, roles: ["admin", "owner", "manager"] },
      { id: "inventory-config", label: "Inventory Config", page: "inventory-config", icon: NavInventoryConfigIcon, roles: ["admin", "owner", "manager"] },
      { id: "backup-restore", label: "Backup & restore", page: "backup-restore", icon: NavBackupIcon, roles: ["admin", "owner"] },
      { id: "payroll", label: "Payroll", page: "payroll", icon: NavPayrollIcon, roles: ["admin", "owner", "manager"] },
      { id: "pdc-management", label: "PDC Management", page: "pdc-management", icon: NavPdcIcon, roles: ["admin", "owner", "manager", "banking"] },
      { id: "recurring-vouchers", label: "Recurring entries", page: "recurring-vouchers", icon: NavRecurringIcon, roles: ["admin", "owner", "manager", "accountant"] },
      { id: "communication-hub", label: "Messages & email", page: "communication-hub", icon: NavMessagesIcon, roles: ["admin", "owner", "manager"] },
    ],
  },
];

/**
 * STEP 2.2 — Daily 12 default favourites (ordered).
 * Seeded once into pinned nav; role filter may shorten the list.
 * Full leaf catalogue stays in Command Palette + “All menus…”.
 */
export const DAILY_NAV_FAVOURITES: readonly string[] = [
  "billing",
  "purchase",
  "receipt",
  "payment",
  "journal",
  "day-book",
  "accounts",
  "parties-sales",
  "items",
  "trial-balance",
  "bank-reconciliation",
  "sales-register",
] as const;

export const DAILY_NAV_PIN_CAP = 12;

/** Canonical page → primary module for active-state highlighting */
export const PAGE_MODULE: Record<string, string> = {};
for (const g of SHELL_NAV) {
  if (g.page) PAGE_MODULE[g.page] = g.id;
  for (const i of g.items) PAGE_MODULE[i.page] = g.id;
}

/** Resolve Daily-12 seed ids present in the role-filtered item list. */
export function resolveDailyFavouriteIds(items: ShellNavItem[]): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered: string[] = [];
  for (const id of DAILY_NAV_FAVOURITES) {
    if (byId.has(id)) ordered.push(id);
    if (ordered.length >= DAILY_NAV_PIN_CAP) break;
  }
  if (ordered.length >= Math.min(8, DAILY_NAV_PIN_CAP)) return ordered;
  // Fallback: favouriteEligible fillers if role hid most Daily-12 entries
  for (const i of items) {
    if (!i.favouriteEligible || i.orbix || !i.page) continue;
    if (ordered.includes(i.id)) continue;
    ordered.push(i.id);
    if (ordered.length >= DAILY_NAV_PIN_CAP) break;
  }
  return ordered;
}

export function findNavLabel(page: string): string {
  for (const g of SHELL_NAV) {
    if (g.page === page) return g.label;
    const hit = g.items.find((i) => i.page === page);
    if (hit) return hit.label;
  }
  return page;
}

export function flattenNavItems(): ShellNavItem[] {
  return SHELL_NAV.flatMap((g) =>
    g.items.length
      ? g.items
      : g.page
        ? [{ id: g.id, label: g.label, page: g.page, icon: g.icon, orbix: g.orbix, roles: g.roles }]
        : [],
  );
}
