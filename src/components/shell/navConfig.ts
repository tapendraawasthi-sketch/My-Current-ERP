import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MessageSquare,
  Landmark,
  Package,
  BarChart3,
  ShieldCheck,
  Settings,
  Users,
  FileText,
  Receipt,
  Banknote,
  ClipboardList,
  Truck,
  Archive,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Scale,
  PieChart,
  Activity,
  Calendar,
  Layers,
  Building2,
  Wallet,
  HardDrive,
  Mail,
  Calculator,
  Tags,
  ScrollText,
  CreditCard,
  Repeat,
  BookOpen,
  ShoppingCart,
  BookMarked,
} from "lucide-react";

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
  icon: LucideIcon;
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
  icon: LucideIcon;
  items: ShellNavItem[];
  page?: string;
  orbix?: boolean;
  roles?: ShellRoleHint[];
}

/**
 * Target IA — max ~11 primary modules; duplicates removed.
 * Routes not listed remain reachable via deep link / palette / App switch.
 */
export const SHELL_NAV: ShellNavGroup[] = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    page: "dashboard",
    roles: ["all"],
    items: [],
  },
  {
    id: "orbix",
    label: "Ask Orbix",
    icon: MessageSquare,
    page: "orbix",
    orbix: true,
    roles: ["all"],
    items: [],
  },
  {
    id: "sales",
    label: "Sales",
    icon: TrendingUp,
    roles: ["all", "owner", "manager", "accountant", "cashier", "admin"],
    items: [
      { id: "billing", label: "Sales invoice", page: "billing", icon: TrendingUp, roles: ["all"], favouriteEligible: true },
      { id: "sales-return", label: "Sales return", page: "sales-return", icon: RefreshCw, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "sales-order", label: "Sales order", page: "sales-order", icon: ClipboardList, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "delivery-challan", label: "Delivery note", page: "delivery-challan", icon: Truck, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "sales-register", label: "Sales register", page: "sales-register", icon: ClipboardList, roles: ["accountant", "owner", "manager", "cashier", "admin"], favouriteEligible: true },
      { id: "parties-sales", label: "Customers & suppliers", page: "parties", icon: Users, roles: ["all"], favouriteEligible: true },
    ],
  },
  {
    id: "purchases",
    label: "Purchases",
    icon: ShoppingCart,
    roles: ["all", "owner", "manager", "accountant", "inventory", "admin"],
    items: [
      { id: "purchase", label: "Purchase invoice", page: "purchase", icon: TrendingDown, roles: ["all"], favouriteEligible: true },
      { id: "purchase-return", label: "Purchase return", page: "purchase-return", icon: RefreshCw, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "purchase-order", label: "Purchase order", page: "purchase-order", icon: ClipboardList, roles: ["accountant", "owner", "manager", "admin", "inventory"] },
      { id: "goods-receipt", label: "Goods receipt", page: "goods-receipt", icon: Archive, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "purchase-register", label: "Purchase register", page: "purchase-register", icon: ClipboardList, roles: ["accountant", "owner", "manager", "admin"], favouriteEligible: true },
    ],
  },
  {
    id: "banking",
    label: "Banking",
    icon: Landmark,
    roles: ["all", "owner", "manager", "accountant", "cashier", "banking", "admin"],
    items: [
      { id: "receipt", label: "Receive money", page: "receipt", icon: Receipt, roles: ["all"], favouriteEligible: true, mobile: true },
      { id: "payment", label: "Pay money", page: "payment", icon: Banknote, roles: ["all"], favouriteEligible: true, mobile: true },
      { id: "contra", label: "Transfer between accounts", page: "contra", icon: Repeat, roles: ["accountant", "banking", "owner", "manager", "admin"] },
      { id: "bank-reconciliation", label: "Match bank statement", page: "bank-reconciliation", icon: Scale, roles: ["banking", "accountant", "owner", "manager", "admin"], favouriteEligible: true },
      { id: "bank-statement-import", label: "Import bank statement", page: "bank-statement-import", icon: FileText, roles: ["banking", "accountant", "owner", "manager", "admin"] },
      { id: "cheque-register", label: "Cheque register", page: "cheque-register", icon: CreditCard, roles: ["banking", "accountant", "owner", "manager", "admin"] },
      { id: "pdc-register", label: "Post-dated cheques", page: "pdc-register", icon: CreditCard, roles: ["banking", "accountant", "owner", "manager", "admin"] },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    roles: ["inventory", "owner", "manager", "accountant", "admin"],
    items: [
      { id: "items", label: "Item Master", page: "items", icon: Package, roles: ["inventory", "owner", "manager", "accountant", "admin"], favouriteEligible: true },
      { id: "item-groups", label: "Item Groups", page: "item-groups", icon: Layers, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "stock-summary", label: "Stock summary", page: "stock-summary", icon: Package, roles: ["inventory", "owner", "manager", "accountant", "admin"] },
      { id: "stock-ledger", label: "Stock Ledger", page: "stock-ledger", icon: BookOpen, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "stock-transfer", label: "Stock transfer", page: "stock-transfer", icon: Repeat, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "stock-journal", label: "Stock journal", page: "stock-journal", icon: FileText, roles: ["inventory", "accountant", "owner", "manager", "admin"] },
      { id: "physical-stock", label: "Physical stock count", page: "physical-stock", icon: Archive, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "batch-management", label: "Batches", page: "batch-management", icon: Layers, roles: ["inventory", "owner", "manager", "admin"] },
      { id: "warehouses", label: "Warehouses", page: "warehouses", icon: Building2, roles: ["inventory", "owner", "manager", "admin"] },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: BookMarked,
    roles: ["accountant", "owner", "manager", "auditor", "admin"],
    items: [
      { id: "journal", label: "Journal", page: "journal", icon: FileText, roles: ["accountant", "owner", "manager", "admin"], favouriteEligible: true },
      { id: "voucher-entry", label: "Voucher Hub", page: "voucher-entry", icon: ClipboardList, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "debit-note", label: "Debit Note", page: "debit-note", icon: FileText, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "credit-note", label: "Credit Note", page: "credit-note", icon: FileText, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "accounts", label: "Chart of Accounts", page: "accounts", icon: BookOpen, roles: ["accountant", "owner", "manager", "auditor", "admin"], favouriteEligible: true },
      { id: "day-book", label: "Day Book", page: "day-book", icon: BookOpen, roles: ["accountant", "cashier", "owner", "manager", "auditor", "banking", "admin"], favouriteEligible: true },
      { id: "ledger", label: "General Ledger", page: "ledger", icon: BookOpen, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "cost-centers", label: "Cost Centers", page: "cost-centers", icon: Building2, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "standard-narration", label: "Narrations", page: "standard-narration", icon: ScrollText, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "bill-sundry", label: "Bill Sundries", page: "bill-sundry", icon: Tags, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "units", label: "Units", page: "units", icon: Calculator, roles: ["accountant", "inventory", "owner", "manager", "admin"] },
      { id: "price-lists", label: "Price Lists", page: "price-lists", icon: Tags, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "budget", label: "Budget", page: "budget", icon: Wallet, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "fixed-assets", label: "Fixed Assets", page: "fixed-assets", icon: Building2, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "fiscal-year", label: "Fiscal Year", page: "fiscal-year", icon: Calendar, roles: ["accountant", "owner", "manager", "admin"] },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["all", "owner", "manager", "accountant", "auditor", "admin"],
    items: [
      { id: "trial-balance", label: "Trial Balance", page: "trial-balance", icon: Scale, roles: ["accountant", "owner", "manager", "auditor", "admin"], favouriteEligible: true },
      { id: "profit-loss", label: "Profit & Loss", page: "profit-loss", icon: TrendingUp, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "balance-sheet", label: "Balance Sheet", page: "balance-sheet", icon: PieChart, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "cash-flow", label: "Cash flow", page: "cash-flow", icon: Activity, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "party-statement", label: "Party Statement", page: "party-statement", icon: Users, roles: ["accountant", "owner", "manager", "cashier", "admin"] },
      { id: "outstanding-receivables", label: "Receivables", page: "outstanding-receivables", icon: TrendingUp, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "outstanding-payables", label: "Payables", page: "outstanding-payables", icon: TrendingDown, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "aging-report", label: "Aging", page: "aging-report", icon: Calendar, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "budget-vs-actual", label: "Budget vs actual", page: "budget-vs-actual", icon: BarChart3, roles: ["accountant", "owner", "manager", "admin"] },
      { id: "sales-analysis", label: "Sales analysis", page: "sales-analysis", icon: BarChart3, roles: ["owner", "manager", "accountant", "admin"] },
      { id: "ratio-analysis", label: "Ratios", page: "ratio-analysis", icon: PieChart, roles: ["owner", "manager", "accountant", "auditor", "admin"] },
      { id: "financial-dashboard", label: "Financial Dashboard", page: "financial-dashboard", icon: LayoutDashboard, roles: ["owner", "manager", "accountant", "admin"] },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    roles: ["accountant", "owner", "manager", "auditor", "admin"],
    items: [
      { id: "vat-reports", label: "VAT Reports", page: "vat-reports", icon: FileText, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "tds-report", label: "TDS Report", page: "tds-report", icon: FileText, roles: ["accountant", "owner", "manager", "auditor", "admin"] },
      { id: "audit-log", label: "Audit log", page: "audit-log", icon: ShieldCheck, roles: ["auditor", "owner", "manager", "admin", "accountant"] },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    roles: ["admin", "owner", "manager"],
    items: [
      { id: "settings", label: "Company settings", page: "settings", icon: Settings, roles: ["admin", "owner", "manager"] },
      { id: "users", label: "Users", page: "users", icon: Users, roles: ["admin", "owner"] },
      { id: "configuration-hub", label: "Configuration Hub", page: "configuration-hub", icon: Settings, roles: ["admin", "owner", "manager"] },
      { id: "accounts-configuration", label: "Accounts Config", page: "accounts-configuration", icon: Settings, roles: ["admin", "owner", "manager"] },
      { id: "inventory-config", label: "Inventory Config", page: "inventory-config", icon: Settings, roles: ["admin", "owner", "manager"] },
      { id: "backup-restore", label: "Backup & restore", page: "backup-restore", icon: HardDrive, roles: ["admin", "owner"] },
      { id: "payroll", label: "Payroll", page: "payroll", icon: Wallet, roles: ["admin", "owner", "manager"] },
      { id: "pdc-management", label: "PDC Management", page: "pdc-management", icon: CreditCard, roles: ["admin", "owner", "manager", "banking"] },
      { id: "recurring-vouchers", label: "Recurring entries", page: "recurring-vouchers", icon: Repeat, roles: ["admin", "owner", "manager", "accountant"] },
      { id: "communication-hub", label: "Messages & email", page: "communication-hub", icon: Mail, roles: ["admin", "owner", "manager"] },
    ],
  },
];

/** Canonical page → primary module for active-state highlighting */
export const PAGE_MODULE: Record<string, string> = {};
for (const g of SHELL_NAV) {
  if (g.page) PAGE_MODULE[g.page] = g.id;
  for (const i of g.items) PAGE_MODULE[i.page] = g.id;
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
