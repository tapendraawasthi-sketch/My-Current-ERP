// Removed @ts-nocheck
import React, { useMemo, useRef, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { getBSTodayLong } from "../lib/nepaliDate";
import { computeAllStockPositions } from "../lib/stockUtils";
import { computeOutstandingReceivables, computeOutstandingPayables } from "../lib/accounting";
import { isAdminOrOwner, isAccountantOrAdmin } from "../lib/permissions";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import {
  Search,
  BookOpen,
  Users,
  Package,
  Tags,
  TrendingUp,
  TrendingDown,
  BarChart2,
  FileText,
  CreditCard,
  Banknote,
  Landmark,
  ShoppingCart,
  ClipboardList,
  Truck,
  Archive,
  ArrowLeftRight,
  Settings,
  Database,
  FileClock,
  Shield,
  Download,
  RefreshCw,
  Receipt,
  Wallet,
  Building2,
  Calendar,
  ScrollText,
  BookMarked,
  Activity,
  PieChart,
  Factory,
  Tag,
  Repeat,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Layers,
  Calculator,
  FileBarChart,
  Briefcase,
  Map,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type PermissionScope = "all" | "accounting" | "admin";

interface GatewayMenuItem {
  label: string;
  page: string;
  icon?: React.ComponentType<any>;
  shortcut?: string;
  permission?: PermissionScope;
}

interface MenuSection {
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  items: GatewayMenuItem[];
}

// ─── Formatting (STEP 6.1 — shared money helpers) ─────────────────────────────

const fmtShort = (n: number) => formatCompactCurrency(n);
const fmt = (n: number) => formatCurrency(Math.abs(Number(n) || 0));

// ─── Menu structure with icons + shortcuts ───────────────────────────────────

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Masters",
    icon: BookOpen,
    color: "var(--ds-action-primary)",
    items: [
      {
        label: "Chart of Accounts",
        page: "accounts",
        icon: BookOpen,
        shortcut: "F4",
        permission: "accounting",
      },
      {
        label: "Parties Directory",
        page: "parties",
        icon: Users,
        shortcut: "F3",
        permission: "accounting",
      },
      { label: "Item Groups", page: "item-groups", icon: Layers, permission: "accounting" },
      { label: "Item Master", page: "item-master", icon: Package, permission: "accounting" },
      { label: "Units of Measure", page: "units", icon: Calculator, permission: "accounting" },
      { label: "Bill Sundries", page: "bill-sundry", icon: Tags, permission: "accounting" },
      { label: "Price List Master", page: "price-lists", icon: Tags, permission: "accounting" },
      { label: "Cost Centers", page: "cost-centers", icon: Map, permission: "accounting" },
      { label: "Budget Master", page: "budget", icon: Wallet, permission: "accounting" },
      {
        label: "Standard Narrations",
        page: "standard-narration",
        icon: ScrollText,
        permission: "accounting",
      },
      { label: "Warehouses", page: "warehouses", icon: Archive, permission: "accounting" },
      { label: "Sales Persons", page: "sales-persons", icon: Users, permission: "accounting" },
    ],
  },
  {
    title: "Transactions",
    icon: Receipt,
    color: "var(--ox-success)",
    items: [
      {
        label: "Sales Invoice",
        page: "billing",
        icon: TrendingUp,
        shortcut: "F9",
        permission: "accounting",
      },
      {
        label: "Purchase Invoice",
        page: "purchase",
        icon: TrendingDown,
        shortcut: "F10",
        permission: "accounting",
      },
      {
        label: "Journal Entry",
        page: "journal",
        icon: FileText,
        shortcut: "F5",
        permission: "accounting",
      },
      {
        label: "Payment Voucher",
        page: "payment",
        icon: Banknote,
        shortcut: "F6",
        permission: "accounting",
      },
      {
        label: "Receipt Voucher",
        page: "receipt",
        icon: Receipt,
        shortcut: "F7",
        permission: "accounting",
      },
      {
        label: "Contra Voucher",
        page: "contra",
        icon: ArrowLeftRight,
        shortcut: "F8",
        permission: "accounting",
      },
      { label: "Debit Note", page: "debit-note", icon: FileText, permission: "accounting" },
      { label: "Credit Note", page: "credit-note", icon: FileText, permission: "accounting" },
      { label: "Sales Order", page: "sales-order", icon: ClipboardList, permission: "accounting" },
      {
        label: "Purchase Order",
        page: "purchase-order",
        icon: ClipboardList,
        permission: "accounting",
      },
      {
        label: "Delivery Challan",
        page: "delivery-challan",
        icon: Truck,
        permission: "accounting",
      },
      {
        label: "Goods Receipt Note",
        page: "goods-receipt",
        icon: Archive,
        permission: "accounting",
      },
      {
        label: "Stock Transfer",
        page: "stock-transfer",
        icon: ArrowLeftRight,
        permission: "accounting",
      },
      { label: "Stock Journal", page: "stock-journal", icon: BookOpen, permission: "accounting" },
      { label: "Physical Stock", page: "physical-stock", icon: Package, permission: "accounting" },
      {
        label: "Recurring Vouchers",
        page: "recurring-vouchers",
        icon: Repeat,
        permission: "accounting",
      },
    ],
  },
  {
    title: "Reports",
    icon: BarChart2,
    color: "var(--ds-action-primary)",
    items: [
      {
        label: "Balance Sheet",
        page: "balance-sheet",
        icon: PieChart,
        shortcut: "Ctrl+B",
        permission: "accounting",
      },
      { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp, permission: "accounting" },
      {
        label: "Trial Balance",
        page: "trial-balance",
        icon: FileBarChart,
        shortcut: "Ctrl+T",
        permission: "accounting",
      },
      {
        label: "General Ledger",
        page: "ledger",
        icon: BookOpen,
        shortcut: "Ctrl+L",
        permission: "accounting",
      },
      { label: "Day Book", page: "day-book", icon: BookMarked, permission: "accounting" },
      { label: "Cash Flow", page: "cash-flow", icon: Activity, permission: "accounting" },
      {
        label: "Outstanding Receivables",
        page: "outstanding-receivables",
        icon: TrendingUp,
        permission: "accounting",
      },
      {
        label: "Outstanding Payables",
        page: "outstanding-payables",
        icon: TrendingDown,
        permission: "accounting",
      },
      { label: "Aging Report", page: "aging-report", icon: Calendar, permission: "accounting" },
      { label: "Party Statement", page: "party-statement", icon: Users, permission: "accounting" },
      { label: "Stock Summary", page: "stock-summary", icon: Package, permission: "accounting" },
      { label: "Stock Ledger", page: "stock-ledger", icon: BookOpen, permission: "accounting" },
      {
        label: "Sales Analysis",
        page: "sales-analysis",
        icon: BarChart2,
        permission: "accounting",
      },
      {
        label: "VAT Reports",
        page: "vat-reports",
        icon: FileText,
        shortcut: "Ctrl+G",
        permission: "accounting",
      },
      { label: "Ratio Analysis", page: "ratio-analysis", icon: PieChart, permission: "accounting" },
      {
        label: "Budget vs Actual",
        page: "budget-vs-actual",
        icon: BarChart2,
        permission: "accounting",
      },
    ],
  },
  {
    title: "Banking",
    icon: Landmark,
    color: "var(--ox-info)",
    items: [
      { label: "PDC Summary", page: "pdc-management", icon: CreditCard, permission: "accounting" },
      {
        label: "Bank Reconciliation",
        page: "bank-reconciliation",
        icon: Landmark,
        permission: "accounting",
      },
      {
        label: "Batch Management",
        page: "batch-management",
        icon: Layers,
        permission: "accounting",
      },
      { label: "Fixed Assets", page: "fixed-assets", icon: Building2, permission: "accounting" },
      {
        label: "Interest Calculation",
        page: "interest-calculation",
        icon: Calculator,
        permission: "accounting",
      },
      { label: "Payroll", page: "payroll", icon: Wallet, permission: "accounting" },
    ],
  },
  {
    title: "Utilities",
    icon: Settings,
    color: "var(--ox-text-muted)",
    items: [
      { label: "Fiscal Year", page: "fiscal-year", icon: Calendar, permission: "admin" },
      {
        label: "Audit Log",
        page: "audit-log",
        icon: FileClock,
        shortcut: "Ctrl+U",
        permission: "admin",
      },
      {
        label: "Accounts Configuration",
        page: "accounts-configuration",
        icon: Settings,
        permission: "admin",
      },
      {
        label: "Inventory Configuration",
        page: "inventory-config",
        icon: Settings,
        permission: "admin",
      },
      { label: "Company Settings", page: "settings", icon: Building2, permission: "admin" },
      { label: "Users Management", page: "users", icon: Shield, permission: "admin" },
      {
        label: "Data Export/Import",
        page: "data-import-export",
        icon: Download,
        permission: "admin",
      },
    ],
  },
];

const QUICK_ACTIONS: Array<{
  label: string;
  page: string;
  icon: React.ComponentType<{ size?: number }>;
  shortcut: string;
  color: string;
  permission?: PermissionScope;
}> = [
  {
    label: "New Sales Invoice",
    page: "billing",
    icon: TrendingUp,
    shortcut: "F9",
    color: "var(--ox-success)",
  },
  {
    label: "New Purchase Invoice",
    page: "purchase",
    icon: TrendingDown,
    shortcut: "F10",
    color: "var(--ox-warning)",
  },
  { label: "New Journal Entry", page: "journal", icon: FileText, shortcut: "F5", color: "var(--ds-action-primary)" },
  { label: "New Payment", page: "payment", icon: Banknote, shortcut: "F6", color: "var(--ds-action-primary)" },
  { label: "New Receipt", page: "receipt", icon: Receipt, shortcut: "F7", color: "var(--ox-info)" },
  { label: "New Contra", page: "contra", icon: ArrowLeftRight, shortcut: "F8", color: "var(--ox-text-muted)" },
  {
    label: "VAT Reports",
    page: "vat-reports",
    icon: BarChart2,
    shortcut: "Ctrl+G",
    color: "var(--ox-success)",
  },
  { label: "Day Book", page: "day-book", icon: BookMarked, shortcut: "D", color: "var(--ox-text-muted)" },
];

// ─── Pulse Cell ──────────────────────────────────────────────────────────────

const PulseCell: React.FC<{ label: string; value: number; note: string }> = ({
  label,
  value,
  note,
}) => (
  <div className="flex-1 border-r border-gray-200 px-3.5 py-2.5">
    <div className="text-[9px] font-bold uppercase tracking-[0.07em] text-gray-500">{label}</div>
    <div
      className={`mt-0.5 font-mono text-[16px] font-bold leading-tight ${value >= 0 ? "text-[var(--ox-success)]" : "text-[var(--ox-danger)]"}`}
    >
      {fmt(value)}
    </div>
    <div className="mt-0.5 text-[9px] text-gray-400">{note}</div>
  </div>
);

// ─── Metric Cell (borderless, separator-only) ─────────────────────────────────

const MetricCell: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color?: string;
  onClick?: () => void;
  isLast?: boolean;
}> = ({ label, value, sub, color = "var(--ox-text)", onClick, isLast }) => (
  <div
    onClick={onClick}
    className={`flex-1 px-3.5 py-3 transition-colors ${isLast ? "" : "border-r border-gray-200"} ${onClick ? "cursor-pointer hover:bg-[var(--ds-surface-muted)]" : "cursor-default"}`}
  >
    <div className="text-[9px] font-bold uppercase tracking-[0.07em] text-gray-500">{label}</div>
    <div className="mt-0.5 font-mono text-[15px] font-bold leading-tight" style={{ color }}>
      {value}
    </div>
    {sub && <div className="mt-0.5 text-[9px] text-gray-400">{sub}</div>}
  </div>
);

// ─── Section Panel (card-based, always visible) ───────────────────────────────

const SectionPanel: React.FC<{
  section: MenuSection;
  onNavigate: (page: string) => void;
  canSee: (item: GatewayMenuItem) => boolean;
}> = ({ section, onNavigate, canSee }) => {
  const visibleItems = section.items.filter(canSee);
  const Icon = section.icon;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-[var(--ds-surface-muted)] px-3.5 py-2">
        <div
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-[color:color-mix(in_srgb,var(--gw-accent)_9%,transparent)]"
          style={{ ["--gw-accent" as string]: section.color } as React.CSSProperties}
        >
          <Icon size={13} className="text-[color:var(--gw-accent)]" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-700">
          {section.title}
        </span>
        <span className="ml-auto rounded-[10px] bg-gray-200 px-1.5 py-px text-[9px] font-bold text-gray-400">
          {visibleItems.length}
        </span>
      </div>

      <div className="flex-1">
        {visibleItems.map((item) => {
          const ItemIcon = item.icon;
          return (
            <NavRow
              key={item.page}
              label={item.label}
              shortcut={item.shortcut}
              icon={ItemIcon}
              accentColor={section.color}
              onClick={() => onNavigate(item.page)}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── Nav Row (Bloomberg/SAP style: left accent border on hover) ───────────────

const NavRow: React.FC<{
  label: string;
  shortcut?: string;
  icon?: React.ComponentType<any>;
  accentColor: string;
  onClick: () => void;
}> = ({ label, shortcut, icon: Icon, accentColor, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-2 border-b border-gray-100 border-l-[3px] border-l-transparent py-[7px] pl-[11px] pr-3.5 text-left transition-[border-color] duration-100 hover:border-l-[color:var(--gw-accent)]"
    style={{ ["--gw-accent" as string]: accentColor } as React.CSSProperties}
  >
    {Icon && (
      <Icon
        size={12}
        className="shrink-0 text-gray-400 transition-colors duration-100 group-hover:text-[color:var(--gw-accent)]"
      />
    )}
    <span className="flex-1 text-[12px] font-medium text-gray-700 transition-[color,font-weight] duration-100 group-hover:font-semibold group-hover:text-gray-900">
      {label}
    </span>
    {shortcut && (
      <span className="shrink-0 rounded-[3px] border border-gray-200 bg-gray-100 px-[5px] py-px font-mono text-[9px] font-bold text-gray-400 transition-all duration-100 group-hover:border-[color:color-mix(in_srgb,var(--gw-accent)_25%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--gw-accent)_7%,transparent)] group-hover:text-[color:var(--gw-accent)]">
        {shortcut}
      </span>
    )}
    <ChevronRight
      size={10}
      className="shrink-0 text-gray-300 transition-colors duration-100 group-hover:text-[color:var(--gw-accent)]"
    />
  </button>
);

// ─── Quick Action Tile ────────────────────────────────────────────────────────

const ActionTile: React.FC<{
  label: string;
  page: string;
  icon: React.ComponentType<any>;
  shortcut: string;
  color: string;
  onClick: () => void;
}> = ({ label, icon: Icon, shortcut, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-2.5 rounded-lg border border-gray-200 border-l-[3px] border-l-[color:var(--gw-accent)] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[background,border-color] duration-[120ms] hover:border-[color:color-mix(in_srgb,var(--gw-accent)_25%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--gw-accent)_5%,transparent)]"
    style={{ ["--gw-accent" as string]: color } as React.CSSProperties}
  >
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--gw-accent)]">
      <Icon size={14} className="text-white" />
    </div>
    <span className="flex-1 text-[12px] font-semibold text-gray-900">{label}</span>
    <span className="shrink-0 rounded-[3px] border border-[color:color-mix(in_srgb,var(--gw-accent)_19%,transparent)] bg-[color:color-mix(in_srgb,var(--gw-accent)_7%,transparent)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[color:var(--gw-accent)]">
      {shortcut}
    </span>
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Gateway: React.FC = () => {
  const {
    currentUser,
    companySettings,
    currentFiscalYear,
    accounts,
    vouchers,
    invoices,
    items,
    parties,
    stockMovements,
    warehouses,
    setCurrentPage,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const { pushActivity } = useRecentActivity();

  // ── Permission helpers ────────────────────────────────────────────────────

  const role = currentUser?.role;

  const canAdmin = useMemo(() => {
    try {
      return isAdminOrOwner(role);
    } catch {
      return false;
    }
  }, [role]);

  const canAccounting = useMemo(() => {
    try {
      return isAccountantOrAdmin(role) || canAdmin;
    } catch {
      return canAdmin;
    }
  }, [role, canAdmin]);

  const canSee = (item: GatewayMenuItem) => {
    if (!item.permission || item.permission === "all") return true;
    if (item.permission === "admin") return canAdmin;
    if (item.permission === "accounting") return canAccounting;
    return true;
  };

  const navigate = (label: string, page: string) => {
    pushActivity(label, page);
    setCurrentPage(page);
  };

  // ── Financial snapshot data ───────────────────────────────────────────────

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  const cashBankBalance = useMemo(() => {
    let total = 0;
    for (const acc of accounts) {
      if (acc.isGroup || acc.isActive === false) continue;
      const name = (acc.name || "").toLowerCase();
      const group = (acc.group || acc.groupName || "").toLowerCase();
      if (
        name.includes("cash") ||
        name.includes("bank") ||
        group.includes("cash") ||
        group.includes("bank")
      ) {
        total += Number(acc.balance || 0);
      }
    }
    return total;
  }, [accounts]);

  const arOutstanding = useMemo(() => {
    return computeOutstandingReceivables(parties, invoices, vouchers).totalAmount;
  }, [parties, invoices, vouchers]);

  const apOutstanding = useMemo(() => {
    return computeOutstandingPayables(parties, invoices, vouchers).totalAmount;
  }, [parties, invoices, vouchers]);

  const vatPayable = useMemo(() => {
    let out = 0,
      inp = 0;
    for (const inv of invoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const v = Number(inv.vatAmount || inv.taxAmount || 0);
      if (t.includes("sales-invoice") || t === "sales_invoice") out += v;
      if (t.includes("purchase-invoice") || t === "purchase_invoice") inp += v;
    }
    return Math.max(0, out - inp);
  }, [invoices]);

  const todaySales = useMemo(() => {
    return invoices
      .filter((inv) => {
        const t = String(inv.type || "").toLowerCase();
        return (
          inv.date === todayISO &&
          inv.status === "posted" &&
          (t.includes("sales-invoice") || t === "sales_invoice")
        );
      })
      .reduce((s, inv) => s + Number(inv.grandTotal || 0), 0);
  }, [invoices, todayISO]);

  const todayPurchases = useMemo(() => {
    return invoices
      .filter((inv) => {
        const t = String(inv.type || "").toLowerCase();
        return (
          inv.date === todayISO &&
          inv.status === "posted" &&
          (t.includes("purchase-invoice") || t === "purchase_invoice")
        );
      })
      .reduce((s, inv) => s + Number(inv.grandTotal || 0), 0);
  }, [invoices, todayISO]);

  const stockPositions = useMemo(() => {
    try {
      return computeAllStockPositions(stockMovements, items, warehouses);
    } catch {
      return [];
    }
  }, [stockMovements, items, warehouses]);

  const stockValue = useMemo(
    () => stockPositions.reduce((s: number, sp: any) => s + (sp.value || 0), 0),
    [stockPositions],
  );

  // Profit Pulse
  const fyStart = currentFiscalYear?.startDate || todayISO.substring(0, 4) + "-01-01";
  const mtdStart = todayISO.substring(0, 7) + "-01";

  const computeMargin = (from: string, to: string) => {
    let s = 0,
      p = 0;
    for (const inv of invoices) {
      if (!inv.date || inv.status !== "posted") continue;
      if (inv.date < from || inv.date > to) continue;
      const t = String(inv.type || "").toLowerCase();
      if (t.includes("sales-invoice") || t === "sales_invoice") s += Number(inv.grandTotal || 0);
      if (t.includes("purchase-invoice") || t === "purchase_invoice")
        p += Number(inv.grandTotal || 0);
    }
    return s - p;
  };

  const todayMargin = useMemo(() => computeMargin(todayISO, todayISO), [invoices, todayISO]);
  const mtdMargin = useMemo(
    () => computeMargin(mtdStart, todayISO),
    [invoices, mtdStart, todayISO],
  );
  const ytdMargin = useMemo(() => computeMargin(fyStart, todayISO), [invoices, fyStart, todayISO]);

  // ── Search with shortcut hints ────────────────────────────────────────────

  const canAdminRef = React.useRef(canAdmin);
  const canAccountingRef = React.useRef(canAccounting);
  React.useEffect(() => {
    canAdminRef.current = canAdmin;
  }, [canAdmin]);
  React.useEffect(() => {
    canAccountingRef.current = canAccounting;
  }, [canAccounting]);

  const [authKey, setAuthKey] = useState(() => `${canAdmin}-${canAccounting}`);
  React.useEffect(() => {
    setAuthKey(`${canAdmin}-${canAccounting}`);
  }, [canAdmin, canAccounting]);

  const allSearchableItems = useMemo(() => {
    const list: Array<{ section: string; item: GatewayMenuItem; sectionColor: string }> = [];
    for (const section of MENU_SECTIONS) {
      for (const item of section.items) {
        const permitted =
          !item.permission ||
          item.permission === "all" ||
          (item.permission === "admin" && canAdminRef.current) ||
          (item.permission === "accounting" && canAccountingRef.current);
        if (permitted) {
          list.push({ section: section.title, item, sectionColor: section.color });
        }
      }
    }
    return list;
  }, [authKey]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allSearchableItems.filter(
      ({ item }) => item.label.toLowerCase().includes(q) || item.page.toLowerCase().includes(q),
    );
  }, [searchQuery, allSearchableItems]);

  // Keyboard shortcut: "/" focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const companyName = companySettings?.companyNameEn || companySettings?.name || "No company";
  const fyLabel = currentFiscalYear?.name || "—";
  const bsToday = getBSTodayLong();

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--ds-surface-muted)]">
      <div className="flex shrink-0 items-center gap-4 border-b border-[var(--ox-border-sidebar)] bg-[var(--ox-surface-sidebar)] px-5 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-white">{companyName}</div>
          <div className="mt-px text-[10px] text-slate-400">
            FY {fyLabel} &nbsp;·&nbsp; {bsToday}
          </div>
        </div>

        <div className="relative w-80">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search features… (press "/" to focus)'
            className="h-8 w-full rounded-[5px] border border-[var(--ox-border-sidebar)] bg-[var(--ox-surface-sidebar-hover)] pl-[30px] pr-2.5 text-[12px] text-slate-200 outline-none focus:border-[var(--ds-action-primary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent text-[14px] leading-none text-slate-400"
            >
              ×
            </button>
          )}

          {filteredItems.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[100] max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.06)]">
              {filteredItems.slice(0, 12).map(({ section, item, sectionColor }) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => {
                    navigate(item.label, item.page);
                    setSearchQuery("");
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-gray-100 px-3.5 py-2 text-left hover:bg-[var(--ds-surface-muted)]"
                >
                  <div
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--gw-accent)]"
                    style={{ ["--gw-accent" as string]: sectionColor } as React.CSSProperties}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-gray-900">{item.label}</div>
                    <div className="mt-px text-[10px] text-gray-400">{section}</div>
                    {item.shortcut && (
                      <div
                        className="mt-px font-mono text-[9px] font-bold text-[color:var(--gw-accent)]"
                        style={{ ["--gw-accent" as string]: sectionColor } as React.CSSProperties}
                      >
                        Shortcut: {item.shortcut}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={12} className="shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-500">
          {currentUser?.name || "User"} &nbsp;·&nbsp;{" "}
          <span className="capitalize">{currentUser?.role || "user"}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-[300px] shrink-0 flex-col gap-0 overflow-y-auto border-r border-gray-200 bg-white">
          <div className="border-b border-gray-200">
            <div className="border-b border-gray-200 bg-[var(--ds-surface-muted)] px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-500">
                Profit Pulse
              </span>
            </div>
            <PulseCell label="Today" value={todayMargin} note="Gross Margin · Today" />
            <PulseCell label="Month-to-Date" value={mtdMargin} note="Gross Margin · MTD" />
            <PulseCell label="Year-to-Date" value={ytdMargin} note="Gross Margin · YTD" />
          </div>

          <div className="border-b border-gray-200">
            <div className="border-b border-gray-200 bg-[var(--ds-surface-muted)] px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-500">
                Quick Actions
              </span>
            </div>
            <div className="flex flex-col gap-1.5 p-2.5">
              {QUICK_ACTIONS.map((action) => (
                <ActionTile
                  key={action.page}
                  {...action}
                  onClick={() => navigate(action.label, action.page)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-wrap border-b-2 border-gray-200 bg-white">
            <MetricCell
              label="Cash & Bank"
              value={fmtShort(cashBankBalance)}
              sub={fmt(cashBankBalance)}
              color="var(--ox-success)"
              onClick={() => navigate("General Ledger", "ledger")}
            />
            <MetricCell
              label="Receivables"
              value={fmtShort(arOutstanding)}
              sub="Outstanding AR"
              color="var(--ds-action-primary)"
              onClick={() => navigate("Outstanding Receivables", "outstanding-receivables")}
            />
            <MetricCell
              label="Payables"
              value={fmtShort(apOutstanding)}
              sub="Outstanding AP"
              color="var(--ox-warning)"
              onClick={() => navigate("Outstanding Payables", "outstanding-payables")}
            />
            <MetricCell
              label="VAT Payable"
              value={fmtShort(vatPayable)}
              sub="Due to IRD"
              color="var(--ds-action-primary)"
              onClick={() => navigate("VAT Reports", "vat-reports")}
            />
            <MetricCell
              label="Today's Sales"
              value={fmtShort(todaySales)}
              sub={fmt(todaySales)}
              color="var(--ox-success)"
              onClick={() => navigate("Day Book", "day-book")}
            />
            <MetricCell
              label="Today's Purchases"
              value={fmtShort(todayPurchases)}
              sub={fmt(todayPurchases)}
              color="var(--ox-warning)"
              onClick={() => navigate("Day Book", "day-book")}
            />
            <MetricCell
              label="Stock Value"
              value={fmtShort(stockValue)}
              sub="Inventory"
              color="var(--ox-info)"
              onClick={() => navigate("Stock Summary", "stock-summary")}
            />
            <MetricCell
              label="Active Parties"
              value={String(parties.filter((p) => p.isActive !== false).length)}
              sub="Customers & Suppliers"
              color="var(--ox-text-muted)"
              onClick={() => navigate("Parties", "parties")}
              isLast
            />
          </div>

          <div className="grid grid-cols-3 items-start gap-4 p-5">
            {MENU_SECTIONS.map((section) => (
              <SectionPanel
                key={section.title}
                section={section}
                onNavigate={(page) => {
                  const item = section.items.find((i) => i.page === page);
                  navigate(item?.label || page, page);
                }}
                canSee={canSee}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gateway;
