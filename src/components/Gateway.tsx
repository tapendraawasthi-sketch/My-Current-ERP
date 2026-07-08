// Removed @ts-nocheck
import React, { useMemo, useRef, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { getBSTodayLong } from "../lib/nepaliDate";
import { computeAllStockPositions } from "../lib/stockUtils";
import { computeOutstandingReceivables, computeOutstandingPayables } from "../lib/accounting";
import { isAdminOrOwner, isAccountantOrAdmin } from "../lib/permissions";
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

// ─── Formatting ──────────────────────────────────────────────────────────────

const fmtShort = (n: number) => {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 10_000_000) return `Rs. ${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `Rs. ${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `Rs. ${(abs / 1_000).toFixed(1)}K`;
  return `Rs. ${abs.toFixed(2)}`;
};

const fmt = (n: number) =>
  "Rs. " +
  Math.abs(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Menu structure with icons + shortcuts ───────────────────────────────────

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Masters",
    icon: BookOpen,
    color: "#1557b0",
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
    color: "#059669",
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
    color: "#7c3aed",
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
    color: "#0284c7",
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
    color: "#374151",
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
    color: "#059669",
  },
  {
    label: "New Purchase Invoice",
    page: "purchase",
    icon: TrendingDown,
    shortcut: "F10",
    color: "#d97706",
  },
  { label: "New Journal Entry", page: "journal", icon: FileText, shortcut: "F5", color: "#1557b0" },
  { label: "New Payment", page: "payment", icon: Banknote, shortcut: "F6", color: "#7c3aed" },
  { label: "New Receipt", page: "receipt", icon: Receipt, shortcut: "F7", color: "#0284c7" },
  { label: "New Contra", page: "contra", icon: ArrowLeftRight, shortcut: "F8", color: "#374151" },
  {
    label: "VAT Reports",
    page: "vat-reports",
    icon: BarChart2,
    shortcut: "Ctrl+G",
    color: "#059669",
  },
  { label: "Day Book", page: "day-book", icon: BookMarked, shortcut: "D", color: "#6b7280" },
];

// ─── Pulse Cell ──────────────────────────────────────────────────────────────

const PulseCell: React.FC<{ label: string; value: number; note: string }> = ({
  label,
  value,
  note,
}) => (
  <div style={{ flex: 1, padding: "10px 14px", borderRight: "1px solid #e5e7eb" }}>
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "#6b7280",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 16,
        fontWeight: 700,
        fontFamily: "'Courier New', monospace",
        color: value >= 0 ? "#059669" : "#dc2626",
        marginTop: 3,
        lineHeight: 1.2,
      }}
    >
      {fmt(value)}
    </div>
    <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>{note}</div>
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
}> = ({ label, value, sub, color = "#111827", onClick, isLast }) => (
  <div
    onClick={onClick}
    style={{
      flex: 1,
      padding: "12px 14px",
      borderRight: isLast ? "none" : "1px solid #e5e7eb",
      cursor: onClick ? "pointer" : "default",
      transition: "background 120ms ease",
    }}
    onMouseEnter={(e) => {
      if (onClick) (e.currentTarget as HTMLDivElement).style.background = "#f9fafb";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.background = "transparent";
    }}
  >
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "#6b7280",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        fontFamily: "'Courier New', monospace",
        color,
        marginTop: 3,
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    {sub && <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
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
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "8px 14px",
          background: "#f5f6fa",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: section.color + "18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={13} style={{ color: section.color }} />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#374151",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {section.title}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 9,
            fontWeight: 700,
            color: "#9ca3af",
            background: "#e5e7eb",
            borderRadius: 10,
            padding: "1px 6px",
          }}
        >
          {visibleItems.length}
        </span>
      </div>

      {/* Items */}
      <div style={{ flex: 1 }}>
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
}> = ({ label, shortcut, icon: Icon, accentColor, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        background: "transparent",
        border: "none",
        borderLeft: hovered ? `3px solid ${accentColor}` : "3px solid transparent",
        borderBottom: "1px solid #f3f4f6",
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 100ms ease",
        paddingLeft: hovered ? 11 : 11,
      }}
    >
      {Icon && (
        <Icon
          size={12}
          style={{
            color: hovered ? accentColor : "#9ca3af",
            flexShrink: 0,
            transition: "color 100ms ease",
          }}
        />
      )}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: hovered ? "#111827" : "#374151",
          fontWeight: hovered ? 600 : 400,
          transition: "color 100ms ease, font-weight 100ms ease",
        }}
      >
        {label}
      </span>
      {shortcut && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: hovered ? accentColor : "#9ca3af",
            background: hovered ? accentColor + "12" : "#f3f4f6",
            border: `1px solid ${hovered ? accentColor + "40" : "#e5e7eb"}`,
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "monospace",
            flexShrink: 0,
            transition: "all 100ms ease",
          }}
        >
          {shortcut}
        </span>
      )}
      <ChevronRight
        size={10}
        style={{
          color: hovered ? accentColor : "#d1d5db",
          flexShrink: 0,
          transition: "color 100ms ease",
        }}
      />
    </button>
  );
};

// ─── Quick Action Tile ────────────────────────────────────────────────────────

const ActionTile: React.FC<{
  label: string;
  page: string;
  icon: React.ComponentType<any>;
  shortcut: string;
  color: string;
  onClick: () => void;
}> = ({ label, icon: Icon, shortcut, color, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        background: hovered ? color + "08" : "#ffffff",
        border: `1px solid ${hovered ? color + "40" : "#e5e7eb"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} style={{ color: "#ffffff" }} />
      </div>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#111827" }}>{label}</span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: color,
          background: color + "12",
          border: `1px solid ${color}30`,
          borderRadius: 3,
          padding: "2px 6px",
          fontFamily: "monospace",
          flexShrink: 0,
        }}
      >
        {shortcut}
      </span>
    </button>
  );
};

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f5f6fa",
        overflow: "hidden",
      }}
    >
      {/* ── Top command bar ─────────────────────────────────────────────── */}
      <div
        style={{
          background: "#1e2433",
          borderBottom: "1px solid #2d3748",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{companyName}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
            FY {fyLabel} &nbsp;·&nbsp; {bsToday}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", width: 320 }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search features… (press "/" to focus)'
            style={{
              width: "100%",
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              fontSize: 12,
              background: "#273148",
              border: "1px solid #2d3748",
              borderRadius: 5,
              color: "#e2e8f0",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "#1557b0";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "#2d3748";
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}

          {/* Search results dropdown */}
          {filteredItems.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 100,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {filteredItems.slice(0, 12).map(({ section, item, sectionColor }) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => {
                    navigate(item.label, item.page);
                    setSearchQuery("");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#f5f6fa";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: sectionColor,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{section}</div>
                    {item.shortcut && (
                      <div
                        style={{
                          fontSize: 9,
                          color: sectionColor,
                          marginTop: 1,
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                      >
                        Shortcut: {item.shortcut}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={12} style={{ color: "#d1d5db", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 10, color: "#64748b" }}>
          {currentUser?.name || "User"} &nbsp;·&nbsp;{" "}
          <span style={{ textTransform: "capitalize" }}>{currentUser?.role || "user"}</span>
        </div>
      </div>

      {/* ── Main body (two-column: left panel + right content) ───────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>
        {/* ── LEFT COLUMN: Financial Position + Quick Actions ──────────── */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            borderRight: "1px solid #e5e7eb",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            background: "#ffffff",
          }}
        >
          {/* Profit Pulse */}
          <div style={{ borderBottom: "1px solid #e5e7eb" }}>
            <div
              style={{
                padding: "8px 14px",
                background: "#f5f6fa",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#6b7280",
                }}
              >
                Profit Pulse
              </span>
            </div>
            <PulseCell label="Today" value={todayMargin} note="Gross Margin · Today" />
            <PulseCell label="Month-to-Date" value={mtdMargin} note="Gross Margin · MTD" />
            <PulseCell label="Year-to-Date" value={ytdMargin} note="Gross Margin · YTD" />
          </div>

          {/* Quick Actions */}
          <div style={{ borderBottom: "1px solid #e5e7eb" }}>
            <div
              style={{
                padding: "8px 14px",
                background: "#f5f6fa",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#6b7280",
                }}
              >
                Quick Actions
              </span>
            </div>
            <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
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

        {/* ── RIGHT COLUMN: Metrics strip + All sections ────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Metrics strip (borderless, separator-only) */}
          <div
            style={{
              background: "#ffffff",
              borderBottom: "2px solid #e5e7eb",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            <MetricCell
              label="Cash & Bank"
              value={fmtShort(cashBankBalance)}
              sub={fmt(cashBankBalance)}
              color="#059669"
              onClick={() => navigate("General Ledger", "ledger")}
            />
            <MetricCell
              label="Receivables"
              value={fmtShort(arOutstanding)}
              sub="Outstanding AR"
              color="#1557b0"
              onClick={() => navigate("Outstanding Receivables", "outstanding-receivables")}
            />
            <MetricCell
              label="Payables"
              value={fmtShort(apOutstanding)}
              sub="Outstanding AP"
              color="#d97706"
              onClick={() => navigate("Outstanding Payables", "outstanding-payables")}
            />
            <MetricCell
              label="VAT Payable"
              value={fmtShort(vatPayable)}
              sub="Due to IRD"
              color="#7c3aed"
              onClick={() => navigate("VAT Reports", "vat-reports")}
            />
            <MetricCell
              label="Today's Sales"
              value={fmtShort(todaySales)}
              sub={fmt(todaySales)}
              color="#059669"
              onClick={() => navigate("Day Book", "day-book")}
            />
            <MetricCell
              label="Today's Purchases"
              value={fmtShort(todayPurchases)}
              sub={fmt(todayPurchases)}
              color="#d97706"
              onClick={() => navigate("Day Book", "day-book")}
            />
            <MetricCell
              label="Stock Value"
              value={fmtShort(stockValue)}
              sub="Inventory"
              color="#0284c7"
              onClick={() => navigate("Stock Summary", "stock-summary")}
            />
            <MetricCell
              label="Active Parties"
              value={String(parties.filter((p) => p.isActive !== false).length)}
              sub="Customers & Suppliers"
              color="#374151"
              onClick={() => navigate("Parties", "parties")}
              isLast
            />
          </div>

          {/* All sections — persistent multi-column grid, never hidden/toggled */}
          <div
            style={{
              padding: 16,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              alignItems: "start",
            }}
          >
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
