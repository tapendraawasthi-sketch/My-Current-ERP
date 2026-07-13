import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  ArrowLeftRight,
  BookOpen,
  Landmark,
  Package,
  BarChart3,
  LineChart,
  ShieldCheck,
  Zap,
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
} from "lucide-react";

export interface ShellNavItem {
  id: string;
  label: string;
  page: string;
  icon: LucideIcon;
  /** Opens Orbix workspace instead of a normal page */
  orbix?: boolean;
}

export interface ShellNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: ShellNavItem[];
  /** Top-level single destination (no children) */
  page?: string;
  orbix?: boolean;
}

export const SHELL_NAV: ShellNavGroup[] = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    page: "dashboard",
    items: [],
  },
  {
    id: "orbix",
    label: "Orbix",
    icon: Sparkles,
    page: "orbix",
    orbix: true,
    items: [],
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    items: [
      { id: "billing", label: "Sales Invoice", page: "billing", icon: TrendingUp },
      { id: "purchase", label: "Purchase Invoice", page: "purchase", icon: TrendingDown },
      { id: "sales-return", label: "Sales Return", page: "sales-return", icon: RefreshCw },
      { id: "purchase-return", label: "Purchase Return", page: "purchase-return", icon: RefreshCw },
      { id: "receipt", label: "Receipt", page: "receipt", icon: Receipt },
      { id: "payment", label: "Payment", page: "payment", icon: Banknote },
      { id: "journal", label: "Journal", page: "journal", icon: FileText },
      { id: "contra", label: "Contra", page: "contra", icon: ArrowLeftRight },
      { id: "voucher-entry", label: "Voucher Hub", page: "voucher-entry", icon: ClipboardList },
      { id: "debit-note", label: "Debit Note", page: "debit-note", icon: FileText },
      { id: "credit-note", label: "Credit Note", page: "credit-note", icon: FileText },
      { id: "sales-order", label: "Sales Order", page: "sales-order", icon: ClipboardList },
      { id: "purchase-order", label: "Purchase Order", page: "purchase-order", icon: ClipboardList },
      { id: "delivery-challan", label: "Delivery Challan", page: "delivery-challan", icon: Truck },
      { id: "goods-receipt", label: "Goods Receipt", page: "goods-receipt", icon: Archive },
    ],
  },
  {
    id: "masters",
    label: "Masters",
    icon: BookOpen,
    items: [
      { id: "accounts", label: "Chart of Accounts", page: "accounts", icon: BookOpen },
      { id: "parties", label: "Parties", page: "parties", icon: Users },
      { id: "units", label: "Units", page: "units", icon: Calculator },
      { id: "price-lists", label: "Price Lists", page: "price-lists", icon: Tags },
      { id: "cost-centers", label: "Cost Centers", page: "cost-centers", icon: Building2 },
      { id: "standard-narration", label: "Narrations", page: "standard-narration", icon: ScrollText },
      { id: "bill-sundry", label: "Bill Sundries", page: "bill-sundry", icon: Tags },
      { id: "fiscal-year", label: "Fiscal Year", page: "fiscal-year", icon: Calendar },
      { id: "budget", label: "Budget", page: "budget", icon: Wallet },
      { id: "fixed-assets", label: "Fixed Assets", page: "fixed-assets", icon: Building2 },
      { id: "payroll", label: "Payroll", page: "payroll", icon: Wallet },
      { id: "pdc-management", label: "PDC", page: "pdc-management", icon: CreditCard },
    ],
  },
  {
    id: "banking",
    label: "Banking",
    icon: Landmark,
    items: [
      { id: "receipt-b", label: "Receipt", page: "receipt", icon: Receipt },
      { id: "payment-b", label: "Payment", page: "payment", icon: Banknote },
      { id: "contra-b", label: "Contra", page: "contra", icon: ArrowLeftRight },
      { id: "pdc-b", label: "PDC Register", page: "pdc-register", icon: CreditCard },
      { id: "day-book-b", label: "Day Book", page: "day-book", icon: BookOpen },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    items: [
      { id: "items", label: "Item Master", page: "items", icon: Package },
      { id: "item-groups", label: "Item Groups", page: "item-groups", icon: Layers },
      { id: "stock-summary", label: "Stock Summary", page: "stock-summary", icon: Package },
      { id: "stock-ledger", label: "Stock Ledger", page: "stock-ledger", icon: BookOpen },
      { id: "stock-transfer", label: "Stock Transfer", page: "stock-transfer", icon: ArrowLeftRight },
      { id: "stock-journal", label: "Stock Journal", page: "stock-journal", icon: FileText },
      { id: "physical-stock", label: "Physical Stock", page: "physical-stock", icon: Archive },
      { id: "batch-management", label: "Batches", page: "batch-management", icon: Layers },
      { id: "warehouses", label: "Warehouses", page: "warehouses", icon: Building2 },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    items: [
      { id: "day-book", label: "Day Book", page: "day-book", icon: BookOpen },
      { id: "ledger", label: "General Ledger", page: "ledger", icon: BookOpen },
      { id: "trial-balance", label: "Trial Balance", page: "trial-balance", icon: Scale },
      { id: "profit-loss", label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
      { id: "balance-sheet", label: "Balance Sheet", page: "balance-sheet", icon: PieChart },
      { id: "cash-flow", label: "Cash Flow", page: "cash-flow", icon: Activity },
      { id: "party-statement", label: "Party Statement", page: "party-statement", icon: Users },
      {
        id: "outstanding-receivables",
        label: "Receivables",
        page: "outstanding-receivables",
        icon: TrendingUp,
      },
      {
        id: "outstanding-payables",
        label: "Payables",
        page: "outstanding-payables",
        icon: TrendingDown,
      },
      { id: "aging-report", label: "Aging", page: "aging-report", icon: Calendar },
      { id: "vat-reports", label: "VAT Reports", page: "vat-reports", icon: FileText },
      { id: "ratio-analysis", label: "Ratio Analysis", page: "ratio-analysis", icon: PieChart },
      {
        id: "budget-vs-actual",
        label: "Budget vs Actual",
        page: "budget-vs-actual",
        icon: BarChart3,
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: LineChart,
    items: [
      {
        id: "financial-dashboard",
        label: "Financial Dashboard",
        page: "financial-dashboard",
        icon: LayoutDashboard,
      },
      { id: "sales-analysis", label: "Sales Analysis", page: "sales-analysis", icon: LineChart },
      { id: "ratio-analysis-a", label: "Ratios", page: "ratio-analysis", icon: PieChart },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    items: [
      { id: "vat-c", label: "VAT Reports", page: "vat-reports", icon: FileText },
      { id: "tds-report", label: "TDS Report", page: "tds-report", icon: FileText },
      { id: "audit-log", label: "Audit Log", page: "audit-log", icon: ShieldCheck },
    ],
  },
  {
    id: "automations",
    label: "Automations",
    icon: Zap,
    items: [
      {
        id: "recurring-vouchers",
        label: "Recurring Vouchers",
        page: "recurring-vouchers",
        icon: Repeat,
      },
      {
        id: "communication-hub",
        label: "Communication Hub",
        page: "communication-hub",
        icon: Mail,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { id: "settings", label: "Company Settings", page: "settings", icon: Settings },
      { id: "users", label: "Users", page: "users", icon: Users },
      {
        id: "configuration-hub",
        label: "Configuration Hub",
        page: "configuration-hub",
        icon: Settings,
      },
      {
        id: "accounts-configuration",
        label: "Accounts Config",
        page: "accounts-configuration",
        icon: Settings,
      },
      {
        id: "inventory-config",
        label: "Inventory Config",
        page: "inventory-config",
        icon: Settings,
      },
      { id: "backup-restore", label: "Backup & Restore", page: "backup-restore", icon: HardDrive },
      { id: "fiscal-year-s", label: "Fiscal Year", page: "fiscal-year", icon: Calendar },
    ],
  },
];

export function findNavLabel(page: string): string {
  for (const group of SHELL_NAV) {
    if (group.page === page) return group.label;
    const hit = group.items.find((i) => i.page === page);
    if (hit) return hit.label;
  }
  return page
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
