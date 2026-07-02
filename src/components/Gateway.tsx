// src/components/Gateway.tsx
// @ts-nocheck
/**
 * Gateway — The ERP Navigation Hub.
 *
 * Design principles applied:
 * - One accent colour only (#1557b0). No per-section rainbow palette.
 * - No per-item icons in section panels. Icons are section-level only.
 * - Metrics strip uses #1557b0 for all values, #6b7280 for all labels.
 * - Action tiles are monochrome; keyboard shortcut badge identifies each.
 * - Left panel shows Recent Activity (last 5 transactions) instead of
 *   duplicate Profit Pulse data already shown on FinancialDashboard.
 * - Search bar unchanged (dark input on dark bar is correct).
 * - Search result dot reduced from 6px to 4px.
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { useNavFrequency } from "../hooks/useNavFrequency";
import { getBSTodayLong } from "../lib/nepaliDate";
import { isAdminOrOwner, isAccountantOrAdmin } from "../lib/permissions";
import {
  Search,
  BookOpen,
  Receipt,
  BarChart2,
  Landmark,
  Settings,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type PermissionScope = "all" | "accounting" | "admin";

interface GatewayMenuItem {
  label: string;
  page: string;
  shortcut?: string;
  permission?: PermissionScope;
}

interface MenuSection {
  title: string;
  // Single icon per section only. No per-item icons.
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  items: GatewayMenuItem[];
}

// ─── Menu Structure ──────────────────────────────────────────────────────────
// Icons are section-level only. Individual items are clean text rows.

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Masters",
    icon: BookOpen,
    items: [
      { label: "Chart of Accounts",   page: "accounts",          shortcut: "F4",    permission: "accounting" },
      { label: "Parties Directory",   page: "parties",           shortcut: "F3",    permission: "accounting" },
      { label: "Item Groups",         page: "item-groups",                          permission: "accounting" },
      { label: "Item Master",         page: "item-master",                          permission: "accounting" },
      { label: "Units of Measure",    page: "units",                                permission: "accounting" },
      { label: "Bill Sundries",       page: "bill-sundry",                          permission: "accounting" },
      { label: "Price Lists",         page: "price-lists",                          permission: "accounting" },
      { label: "Cost Centers",        page: "cost-centers",                         permission: "accounting" },
      { label: "Budget Master",       page: "budget",                               permission: "accounting" },
      { label: "Standard Narrations", page: "standard-narration",                   permission: "accounting" },
      { label: "Warehouses",          page: "warehouses",                           permission: "accounting" },
      { label: "Sales Persons",       page: "sales-persons",                        permission: "accounting" },
    ],
  },
  {
    title: "Transactions",
    icon: Receipt,
    items: [
      { label: "Sales Invoice",       page: "billing",           shortcut: "F9",    permission: "accounting" },
      { label: "Purchase Invoice",    page: "purchase",          shortcut: "F10",   permission: "accounting" },
      { label: "Journal Entry",       page: "journal",           shortcut: "F5",    permission: "accounting" },
      { label: "Payment Voucher",     page: "payment",           shortcut: "F6",    permission: "accounting" },
      { label: "Receipt Voucher",     page: "receipt",           shortcut: "F7",    permission: "accounting" },
      { label: "Contra Voucher",      page: "contra",            shortcut: "F8",    permission: "accounting" },
      { label: "Debit Note",          page: "debit-note",                           permission: "accounting" },
      { label: "Credit Note",         page: "credit-note",                          permission: "accounting" },
      { label: "Sales Order",         page: "sales-order",                          permission: "accounting" },
      { label: "Purchase Order",      page: "purchase-order",                       permission: "accounting" },
      { label: "Delivery Challan",    page: "delivery-challan",                     permission: "accounting" },
      { label: "Goods Receipt Note",  page: "goods-receipt",                        permission: "accounting" },
      { label: "Stock Transfer",      page: "stock-transfer",                       permission: "accounting" },
      { label: "Recurring Vouchers",  page: "recurring-vouchers",                   permission: "accounting" },
    ],
  },
  {
    title: "Reports",
    icon: BarChart2,
    items: [
      { label: "Balance Sheet",           page: "balance-sheet",          shortcut: "Ctrl+B", permission: "accounting" },
      { label: "Profit & Loss",           page: "profit-loss",                                permission: "accounting" },
      { label: "Trial Balance",           page: "trial-balance",          shortcut: "Ctrl+T", permission: "accounting" },
      { label: "General Ledger",          page: "ledger",                 shortcut: "Ctrl+L", permission: "accounting" },
      { label: "Day Book",                page: "day-book",                                   permission: "accounting" },
      { label: "Cash Flow Statement",     page: "cash-flow",                                  permission: "accounting" },
      { label: "Outstanding Receivables", page: "outstanding-receivables",                    permission: "accounting" },
      { label: "Outstanding Payables",    page: "outstanding-payables",                       permission: "accounting" },
      { label: "Aging Report",            page: "aging-report",                               permission: "accounting" },
      { label: "Party Statement",         page: "party-statement",                            permission: "accounting" },
      { label: "Stock Summary",           page: "stock-summary",                              permission: "accounting" },
      { label: "Stock Ledger",            page: "stock-ledger",                               permission: "accounting" },
      { label: "Sales Analysis",          page: "sales-analysis",                             permission: "accounting" },
      { label: "VAT Reports",             page: "vat-reports",            shortcut: "Ctrl+G", permission: "accounting" },
      { label: "Ratio Analysis",          page: "ratio-analysis",                             permission: "accounting" },
      { label: "Budget vs Actual",        page: "budget-vs-actual",                           permission: "accounting" },
    ],
  },
  {
    title: "Banking & Finance",
    icon: Landmark,
    items: [
      { label: "PDC Summary",          page: "pdc-management",      permission: "accounting" },
      { label: "Batch Management",     page: "batch-management",    permission: "accounting" },
      { label: "Fixed Assets",         page: "fixed-assets",        permission: "accounting" },
      { label: "Interest Calculation", page: "interest-calculation",permission: "accounting" },
      { label: "Payroll",              page: "payroll",             permission: "accounting" },
    ],
  },
  {
    title: "Utilities",
    icon: Settings,
    items: [
      { label: "Fiscal Year",               page: "fiscal-year",              permission: "admin" },
      { label: "Audit Log",                 page: "audit-log",                permission: "admin" },
      { label: "Accounts Configuration",    page: "accounts-configuration",   permission: "admin" },
      { label: "Inventory Configuration",   page: "inventory-config",         permission: "admin" },
      { label: "Company Settings",          page: "settings",                 permission: "admin" },
      { label: "Users Management",          page: "users",                    permission: "admin" },
    ],
  },
];

// ─── Quick Actions ───────────────────────────────────────────────────────────
// Monochrome tiles. Shortcut badge is the only differentiator — no colours.

const QUICK_ACTIONS: Array<{
  label: string;
  page: string;
  shortcut: string;
  permission?: PermissionScope;
}> = [
  { label: "New Sales Invoice",    page: "billing",       shortcut: "F9"     },
  { label: "New Purchase Invoice", page: "purchase",      shortcut: "F10"    },
  { label: "New Journal Entry",    page: "journal",       shortcut: "F5"     },
  { label: "New Payment",          page: "payment",       shortcut: "F6"     },
  { label: "New Receipt",          page: "receipt",       shortcut: "F7"     },
  { label: "New Contra",           page: "contra",        shortcut: "F8"     },
  { label: "VAT Reports",          page: "vat-reports",   shortcut: "Ctrl+G" },
  { label: "Day Book",             page: "day-book",      shortcut: "D"      },
];

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtShort(n: number): string {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 10_000_000) return `Rs. ${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000)    return `Rs. ${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000)      return `Rs. ${(abs / 1_000).toFixed(1)}K`;
  return `Rs. ${abs.toFixed(2)}`;
}

function fmtFull(n: number): string {
  return (
    "Rs. " +
    Math.abs(Number(n) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * MetricCell — all values in #1557b0, all labels in #6b7280.
 * No per-cell colour variation.
 */
const MetricCell: React.FC<{
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
  isLast?: boolean;
}> = ({ label, value, sub, onClick, isLast }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        padding: "11px 14px",
        borderRight: isLast ? "none" : "1px solid #e5e7eb",
        cursor: onClick ? "pointer" : "default",
        background: hov && onClick ? "#f5f6fa" : "transparent",
        transition: "background 100ms ease",
      }}
    >
      {/* Label — same muted grey for every cell */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "#6b7280",
        marginBottom: 3,
      }}>
        {label}
      </div>

      {/* Value — same primary blue for every cell */}
      <div style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 15,
        fontWeight: 700,
        color: "#1557b0",
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>

      {/* Sub-line — same muted grey for every cell */}
      {sub && (
        <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
};

/**
 * SectionPanel — section header with single icon and left-border stripe.
 * Items are plain text rows with NO per-item icons.
 */
const SectionPanel: React.FC<{
  section: MenuSection;
  onNavigate: (page: string) => void;
  canSee: (item: GatewayMenuItem) => boolean;
  frequentPages?: string[];
}> = ({ section, onNavigate, canSee, frequentPages = [] }) => {
  const Icon = section.icon;
  const visible = section.items.filter(canSee);

  const frequentItems = frequentPages.length > 0
    ? visible.filter((item) => frequentPages.includes(item.page))
    : [];
  const regularItems = visible.filter(
    (item) => !frequentPages.includes(item.page),
  );

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Section header — one icon, one label, item count */}
      <div style={{
        padding: "8px 14px",
        background: "#f5f6fa",
        borderBottom: "1px solid #e5e7eb",
        borderLeft: "3px solid #1557b0",   /* single primary accent stripe */
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <Icon
          size={13}
          style={{ color: "#1557b0", flexShrink: 0 }}
        />
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#374151",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          flex: 1,
        }}>
          {section.title}
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: "#9ca3af",
          background: "#e5e7eb",
          borderRadius: 10,
          padding: "1px 6px",
        }}>
          {visible.length}
        </span>
      </div>

      {/* Items — text-only rows, no per-item icons */}
      <div>
        {frequentItems.length > 0 && (
          <>
            <div className="freq-section-label" style={{ fontSize: 9, padding: "8px 14px 4px", color: "#9ca3af" }}>Frequently Used</div>
            {frequentItems.map((item) => (
              <NavRow
                key={`freq-${item.page}`}
                label={item.label}
                shortcut={item.shortcut}
                onClick={() => onNavigate(item.page)}
                isFrequent={true}
              />
            ))}
            <div className="freq-section-label" style={{ fontSize: 9, padding: "12px 14px 4px", color: "#9ca3af" }}>All Reports</div>
          </>
        )}
        
        {regularItems.map((item) => (
          <NavRow
            key={item.page}
            label={item.label}
            shortcut={item.shortcut}
            onClick={() => onNavigate(item.page)}
            isFrequent={false}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * NavRow — clean text row with left-border-on-hover.
 * No icon. Shortcut badge on the right only if the item has one.
 */
const NavRow: React.FC<{
  label: string;
  shortcut?: string;
  onClick: () => void;
  isFrequent?: boolean;
}> = ({ label, shortcut, onClick, isFrequent }) => {
  const [hov, setHov] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 14px",
        background: hov ? "#f5f6fa" : "transparent",
        border: "none",
        borderLeft: hov ? "3px solid #1557b0" : "3px solid transparent",
        borderBottom: "1px solid #f3f4f6",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 80ms ease, border-color 80ms ease",
        paddingLeft: hov ? 11 : 11, /* compensates for 3px border */
      }}
    >
      <span style={{
        fontSize: 12,
        color: hov ? "#111827" : "#374151",
        fontWeight: hov || isFrequent ? 600 : 400,
        transition: "color 80ms ease, font-weight 80ms ease",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        {label}
        {isFrequent && <div className="nav-freq-dot" style={{ width: 4, height: 4, borderRadius: "50%", background: "#1557b0" }} />}
      </span>

      {/* Shortcut badge — only for items that have one */}
      {shortcut && (
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: hov ? "#1557b0" : "#9ca3af",
          background: hov ? "#eef2ff" : "#f3f4f6",
          border: `1px solid ${hov ? "#c7d2fe" : "#e5e7eb"}`,
          borderRadius: 3,
          padding: "1px 5px",
          fontFamily: "monospace",
          flexShrink: 0,
          marginLeft: 8,
          transition: "all 80ms ease",
          whiteSpace: "nowrap",
        }}>
          {shortcut}
        </span>
      )}

      {/* Subtle chevron on hover only */}
      {hov && (
        <ChevronRight
          size={10}
          style={{ color: "#1557b0", flexShrink: 0, marginLeft: 4 }}
        />
      )}
    </button>
  );
};

/**
 * ActionTile — monochrome. No per-tile colours.
 * Border turns #1557b0 on hover. Icon turns #1557b0 on hover.
 * Keyboard shortcut badge is the primary differentiator.
 */
const ActionTile: React.FC<{
  label: string;
  shortcut: string;
  onClick: () => void;
}> = ({ label, shortcut, onClick }) => {
  const [hov, setHov] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 12px",
        background: hov ? "#f5f6fa" : "#ffffff",
        border: `1px solid ${hov ? "#1557b0" : "#e5e7eb"}`,
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 100ms ease, background 100ms ease",
      }}
    >
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: hov ? "#111827" : "#374151",
        flex: 1,
      }}>
        {label}
      </span>

      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: hov ? "#1557b0" : "#6b7280",
        background: hov ? "#eef2ff" : "#f3f4f6",
        border: `1px solid ${hov ? "#c7d2fe" : "#e5e7eb"}`,
        borderRadius: 3,
        padding: "2px 6px",
        fontFamily: "monospace",
        flexShrink: 0,
        transition: "all 100ms ease",
        whiteSpace: "nowrap",
      }}>
        {shortcut}
      </span>
    </button>
  );
};

/**
 * RecentActivityFeed — replaces the duplicate Profit Pulse in the left panel.
 * Shows the last 5 posted transactions as a compact list.
 * Date, type badge, party name, and amount on each row.
 */
const RecentActivityFeed: React.FC<{
  vouchers: any[];
  invoices: any[];
  onNavigate: (page: string) => void;
}> = ({ vouchers, invoices, onNavigate }) => {
  const recent = useMemo(() => {
    const all: Array<{
      id: string;
      date: string;
      type: string;
      party: string;
      amount: number;
      page: string;
    }> = [];

    for (const inv of invoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      all.push({
        id: inv.id,
        date: inv.date || "",
        type: t.includes("sales") ? "Sales" : t.includes("purchase") ? "Purchase" : "Invoice",
        party: inv.partyName || "—",
        amount: Number(inv.grandTotal || 0),
        page: t.includes("purchase") ? "purchase" : "billing",
      });
    }

    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const t = String(v.type || "").toLowerCase();
      const typeLabel =
        t === "receipt"  ? "Receipt"  :
        t === "payment"  ? "Payment"  :
        t === "journal"  ? "Journal"  :
        t === "contra"   ? "Contra"   :
        "Voucher";
      const page =
        t === "receipt" ? "receipt" :
        t === "payment" ? "payment" :
        t === "journal" ? "journal" :
        t === "contra"  ? "contra"  :
        "day-book";

      all.push({
        id: v.id,
        date: v.date || "",
        type: typeLabel,
        party: v.partyName || v.narration?.slice(0, 28) || "—",
        amount: Number(v.grandTotal || v.totalDebit || 0),
        page,
      });
    }

    // Sort by date descending, take latest 5
    return all
      .filter((x) => x.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [vouchers, invoices]);

  if (recent.length === 0) {
    return (
      <div style={{
        padding: "16px 14px",
        fontSize: 11,
        color: "#9ca3af",
        textAlign: "center",
        fontStyle: "italic",
      }}>
        No recent transactions found.
      </div>
    );
  }

  return (
    <div>
      {recent.map((tx, i) => (
        <button
          key={tx.id}
          type="button"
          onClick={() => onNavigate(tx.page)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 14px",
            background: "transparent",
            border: "none",
            borderBottom: i < recent.length - 1 ? "1px solid #f3f4f6" : "none",
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#f5f6fa";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {/* Type badge */}
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#1557b0",
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
            borderRadius: 3,
            padding: "1px 5px",
            whiteSpace: "nowrap",
            flexShrink: 0,
            minWidth: 52,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}>
            {tx.type}
          </span>

          {/* Party / description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#374151",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {tx.party}
            </div>
            <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 1 }}>
              {tx.date}
            </div>
          </div>

          {/* Amount */}
          <span style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 11,
            fontWeight: 600,
            color: "#111827",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}>
            {fmtShort(tx.amount)}
          </span>
        </button>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

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
    setCurrentPage,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { pushActivity } = useRecentActivity();
  const { frequencies, recordVisit, getTopPages } = useNavFrequency();

  // ── Permissions ──────────────────────────────────────────────
  const role = currentUser?.role;

  const canAdmin = useMemo(() => {
    try { return isAdminOrOwner(role) || isAdminOrOwner(currentUser); } catch { return false; }
  }, [role, currentUser]);

  const canAccounting = useMemo(() => {
    try { return isAccountantOrAdmin(role) || isAccountantOrAdmin(currentUser) || canAdmin; }
    catch { return canAdmin; }
  }, [role, currentUser, canAdmin]);

  const canSee = (item: GatewayMenuItem): boolean => {
    if (!item.permission || item.permission === "all") return true;
    if (item.permission === "admin")      return canAdmin;
    if (item.permission === "accounting") return canAccounting;
    return true;
  };

  const navigate = (label: string, page: string) => {
    recordVisit(page);
    pushActivity(label, page);
    setCurrentPage(page);
  };

  // ── Metrics ──────────────────────────────────────────────────
  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  const cashBankBalance = useMemo(() => {
    let total = 0;
    for (const acc of accounts) {
      if (acc.isGroup || acc.isActive === false) continue;
      const n = (acc.name || "").toLowerCase();
      const g = (acc.group || acc.groupName || "").toLowerCase();
      if (n.includes("cash") || n.includes("bank") || g.includes("cash") || g.includes("bank")) {
        total += Number(acc.balance || 0);
      }
    }
    return total;
  }, [accounts]);

  const arOutstanding = useMemo(() => {
    let t = 0;
    for (const inv of invoices) {
      if (!String(inv.type || "").toLowerCase().includes("sales-invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps === "unpaid" || ps === "partial") {
        t += Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      }
    }
    return t;
  }, [invoices]);

  const apOutstanding = useMemo(() => {
    let t = 0;
    for (const inv of invoices) {
      if (!String(inv.type || "").toLowerCase().includes("purchase-invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps === "unpaid" || ps === "partial") {
        t += Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      }
    }
    return t;
  }, [invoices]);

  const vatPayable = useMemo(() => {
    let out = 0, inp = 0;
    for (const inv of invoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const v = Number(inv.vatAmount || inv.taxAmount || 0);
      if (t.includes("sales-invoice"))    out += v;
      if (t.includes("purchase-invoice")) inp += v;
    }
    return Math.max(0, out - inp);
  }, [invoices]);

  const todaySales = useMemo(() => {
    return invoices
      .filter((inv) => {
        const t = String(inv.type || "").toLowerCase();
        return inv.date === todayISO &&
          inv.status === "posted" &&
          (t.includes("sales-invoice") || t === "sales_invoice");
      })
      .reduce((s, inv) => s + Number(inv.grandTotal || 0), 0);
  }, [invoices, todayISO]);

  const todayPurchases = useMemo(() => {
    return invoices
      .filter((inv) => {
        const t = String(inv.type || "").toLowerCase();
        return inv.date === todayISO &&
          inv.status === "posted" &&
          (t.includes("purchase-invoice") || t === "purchase_invoice");
      })
      .reduce((s, inv) => s + Number(inv.grandTotal || 0), 0);
  }, [invoices, todayISO]);

  const stockValue = useMemo(() => {
    let val = 0;
    const byItem: Record<string, { qty: number; rate: number }> = {};
    for (const m of stockMovements) {
      const id   = m.itemId;
      const qty  = Number(m.quantity || m.qty || 0);
      const rate = Number(m.rate || m.costRate || 0);
      const type = String(m.type || m.movementType || "").toLowerCase();
      if (!byItem[id]) byItem[id] = { qty: 0, rate: 0 };
      if (type === "in" || type === "purchase" || type === "opening") {
        byItem[id].qty  += qty;
        byItem[id].rate  = rate || byItem[id].rate;
      } else {
        byItem[id].qty -= qty;
      }
    }
    for (const { qty, rate } of Object.values(byItem)) {
      val += Math.max(0, qty) * rate;
    }
    return val;
  }, [stockMovements]);

  // ── Search ───────────────────────────────────────────────────
  const allSearchable = useMemo(() => {
    const list: Array<{
      section: string;
      item: GatewayMenuItem;
    }> = [];
    for (const section of MENU_SECTIONS) {
      for (const item of section.items) {
        if (canSee(item)) list.push({ section: section.title, item });
      }
    }
    return list;
  }, [canAccounting, canAdmin]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allSearchable
      .filter(({ item }) =>
        item.label.toLowerCase().includes(q) ||
        item.page.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [searchQuery, allSearchable]);

  // "/" focuses search
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

  const companyName  = companySettings?.companyNameEn || companySettings?.name || "Company";
  const fyLabel      = currentFiscalYear?.name || "—";
  const bsToday      = getBSTodayLong();

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#f5f6fa",
      overflow: "hidden",
    }}>

      {/* ── Top command bar ──────────────────────────────────── */}
      <div style={{
        background: "#1e2433",
        borderBottom: "1px solid #2d3748",
        padding: "9px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}>
        {/* Company + FY */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", lineHeight: 1 }}>
            {companyName}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            FY {fyLabel} &nbsp;·&nbsp; {bsToday}
          </div>
        </div>

        {/* Search bar — unchanged from original (correct dark styling) */}
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
                padding: 0,
              }}
            >
              ×
            </button>
          )}

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div style={{
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
            }}>
              {searchResults.map(({ section, item }) => (
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
                    transition: "background 80ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#f5f6fa";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  {/* 4px dot (reduced from 6px) — keeps section identity in results */}
                  <div style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#1557b0",
                    flexShrink: 0,
                    marginTop: 1,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                      {section}
                      {item.shortcut ? ` · ${item.shortcut}` : ""}
                    </div>
                  </div>

                  <ChevronRight size={10} style={{ color: "#d1d5db", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User info */}
        <div style={{ fontSize: 10, color: "#64748b", flexShrink: 0 }}>
          {currentUser?.name || "User"}&nbsp;·&nbsp;
          <span style={{ textTransform: "capitalize" }}>
            {currentUser?.role || "user"}
          </span>
        </div>
      </div>

      {/* ── Main body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>

        {/* ── LEFT PANEL: Recent Activity + Quick Actions ──── */}
        <div style={{
          width: 284,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
        }}>

          {/* Recent Activity */}
          <div style={{ borderBottom: "1px solid #e5e7eb" }}>
            <div style={{
              padding: "8px 14px",
              background: "#f5f6fa",
              borderBottom: "1px solid #e5e7eb",
              borderLeft: "3px solid #1557b0",
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#374151",
              }}>
                Recent Activity
              </span>
            </div>
            <RecentActivityFeed
              vouchers={vouchers}
              invoices={invoices}
              onNavigate={(page) => {
                const item = allSearchable.find((s) => s.item.page === page);
                navigate(item?.item.label || page, page);
              }}
            />
            <div style={{ padding: "6px 14px", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={() => navigate("Day Book", "day-book")}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#1557b0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                View Day Book →
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div style={{
              padding: "8px 14px",
              background: "#f5f6fa",
              borderBottom: "1px solid #e5e7eb",
              borderLeft: "3px solid #1557b0",
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#374151",
              }}>
                Quick Actions
              </span>
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
              {QUICK_ACTIONS.map((action) => (
                <ActionTile
                  key={action.page}
                  label={action.label}
                  shortcut={action.shortcut}
                  onClick={() => navigate(action.label, action.page)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Metrics + Section Grid ──────────── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Metrics strip — all values #1557b0, all labels #6b7280 */}
          <div style={{
            background: "#ffffff",
            borderBottom: "2px solid #e5e7eb",
            display: "flex",
            flexWrap: "wrap",
            flexShrink: 0,
          }}>
            <MetricCell
              label="Cash & Bank"
              value={fmtShort(cashBankBalance)}
              sub={fmtFull(cashBankBalance)}
              onClick={() => navigate("General Ledger", "ledger")}
            />
            <MetricCell
              label="Receivables"
              value={fmtShort(arOutstanding)}
              sub="Outstanding AR"
              onClick={() => navigate("Outstanding Receivables", "outstanding-receivables")}
            />
            <MetricCell
              label="Payables"
              value={fmtShort(apOutstanding)}
              sub="Outstanding AP"
              onClick={() => navigate("Outstanding Payables", "outstanding-payables")}
            />
            <MetricCell
              label="VAT Payable"
              value={fmtShort(vatPayable)}
              sub="Due to IRD"
              onClick={() => navigate("VAT Reports", "vat-reports")}
            />
            <MetricCell
              label="Today's Sales"
              value={fmtShort(todaySales)}
              sub={fmtFull(todaySales)}
              onClick={() => navigate("Day Book", "day-book")}
            />
            <MetricCell
              label="Today's Purchases"
              value={fmtShort(todayPurchases)}
              sub={fmtFull(todayPurchases)}
              onClick={() => navigate("Day Book", "day-book")}
            />
            <MetricCell
              label="Stock Value"
              value={fmtShort(stockValue)}
              sub="Inventory"
              onClick={() => navigate("Stock Summary", "stock-summary")}
            />
            <MetricCell
              label="Active Parties"
              value={String(parties.filter((p) => p.isActive !== false).length)}
              sub="Customers & Suppliers"
              onClick={() => navigate("Parties", "parties")}
              isLast
            />
          </div>

          {/* Section panels grid — persistent, never hidden */}
          <div style={{
            padding: 14,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            alignItems: "start",
          }}>
            {MENU_SECTIONS.map((section) => {
              const isReports = section.title === "Reports";
              const reportPages = isReports
                ? section.items.filter(canSee).map((i) => i.page)
                : [];
              const topReportPages = isReports ? getTopPages(3, reportPages) : [];

              return (
                <SectionPanel
                  key={section.title}
                  section={section}
                  onNavigate={(page) => {
                    const item = section.items.find((i) => i.page === page);
                    navigate(item?.label || page, page);
                  }}
                  canSee={canSee}
                  frequentPages={isReports ? topReportPages : []}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gateway;
