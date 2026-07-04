// src/pages/FinancialDashboard.tsx
// @ts-nocheck
/**
 * SUTRA ERP — Financial Dashboard (Single Authoritative Version)
 * Replaces both src/components/Dashboard.tsx (now dead) and the old FinancialDashboard.
 *
 * Layout hierarchy (top → bottom):
 *   Row 1  — Enterprise Header Bar  (company, date BS+AD, FY, user, Books status)
 *   Row 2  — Profit Pulse Strip     (Today / MTD / YTD Gross Margin)
 *   Row 3  — Four Primary KPI Cards (Cash+Bank, AR, AP, VAT Payable)
 *   Row 4  — Balance Sheet Mini-Snapshot (T-format)
 *   Row 5  — Six-month Sales vs Expenses bar chart
 *   Row 6  — Aging Receivables + Top-5 Customers side-by-side
 *   Row 7  — Alerts & Action Required
 */

import React, { useMemo, useCallback } from "react";
import { useStore } from "../store/useStore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Package,
  BookOpen,
  BookX,
  ArrowRight,
  Banknote,
  FileText,
  Receipt,
} from "lucide-react";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";
import { mergeSystemConfiguration } from "../lib/systemConfiguration";
import { computeOutstandingAnalysis } from "../lib/accounting";

// ─── Formatting helpers ────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "Rs. " +
  Math.abs(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtShort = (n: number) => {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 10_000_000) return `Rs. ${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `Rs. ${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `Rs. ${(abs / 1_000).toFixed(1)}K`;
  return `Rs. ${abs.toFixed(2)}`;
};

// ─── Weekday lookup (English) ──────────────────────────────────────────────────

const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Custom Bar chart tooltip ──────────────────────────────────────────────────

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1e2433",
        border: "1px solid #2d3748",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 11,
        color: "#e2e8f0",
        minWidth: 140,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#ffffff" }}>{label}</div>
      {payload.map((entry: any) => (
        <div
          key={entry.name}
          style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 2 }}
        >
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmtShort(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Trend indicator ───────────────────────────────────────────────────────────

const TrendIcon: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => {
  if (value > 0) return <TrendingUp size={size} style={{ color: "#059669" }} />;
  if (value < 0) return <TrendingDown size={size} style={{ color: "#dc2626" }} />;
  return <Minus size={size} style={{ color: "#6b7280" }} />;
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  accentColor?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  trend,
  accentColor = "#1557b0",
  icon,
  onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      position: "relative",
      overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      transition: "box-shadow 150ms ease, border-color 150ms ease",
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        (e.currentTarget as HTMLDivElement).style.borderColor = accentColor;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 2px ${accentColor}22`;
      }
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb";
      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
    }}
  >
    {/* Left accent stripe */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 3,
        height: "100%",
        background: accentColor,
        borderRadius: "6px 0 0 6px",
      }}
    />
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingLeft: 4,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#6b7280",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginTop: 4,
            fontFamily: "'Courier New', monospace",
            color: "#111827",
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: `${accentColor}15`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor,
          }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <TrendIcon value={trend} size={12} />
            <span
              style={{ fontSize: 10, color: trend >= 0 ? "#059669" : "#dc2626", fontWeight: 600 }}
            >
              vs yesterday
            </span>
          </div>
        )}
      </div>
    </div>
    {onClick && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          paddingLeft: 4,
          color: accentColor,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        View Report <ArrowRight size={10} />
      </div>
    )}
  </div>
);

// ─── Profit Pulse Cell ─────────────────────────────────────────────────────────

interface PulseCellProps {
  label: string;
  value: number;
  period: string;
}

const PulseCell: React.FC<PulseCellProps> = ({ label, value, period }) => {
  const isPositive = value >= 0;
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 16px",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Courier New', monospace",
            color: isPositive ? "#059669" : "#dc2626",
          }}
        >
          {fmt(value)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 3,
            background: isPositive ? "#dcfce7" : "#fee2e2",
            color: isPositive ? "#166534" : "#991b1b",
          }}
        >
          {isPositive ? "PROFIT" : "LOSS"}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af" }}>
        Gross Margin (Sales − Purchases) · {period}
      </div>
    </div>
  );
};

// ─── Alert row ─────────────────────────────────────────────────────────────────

interface AlertRowProps {
  type: "danger" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}

const AlertRow: React.FC<AlertRowProps> = ({ type, icon, title, message, action, onAction }) => {
  const colors = {
    danger: { border: "#dc2626", bg: "#fff5f5", label: "#991b1b" },
    warning: { border: "#d97706", bg: "#fffbeb", label: "#92400e" },
    info: { border: "#1557b0", bg: "#eff6ff", label: "#1e40af" },
  }[type];

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: 6,
        padding: "10px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div style={{ color: colors.border, flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>{message}</div>
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            flexShrink: 0,
            height: 28,
            padding: "0 10px",
            background: "transparent",
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            color: colors.label,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const FinancialDashboard: React.FC = () => {
  const {
    companySettings,
    currentUser,
    currentFiscalYear,
    invoices,
    vouchers,
    accounts,
    items,
    stockMovements,
    parties,
    initializeApp,
    setCurrentPage,
  } = useStore();

  const warningAlarms = mergeSystemConfiguration(
    companySettings?.systemConfiguration,
  ).warningAlarms;

  // ── Date strings ────────────────────────────────────────────────────────────

  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const weekdayEn = WEEKDAYS_EN[today.getDay()];
  const adDateStr = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  let bsDateStr = "";
  try {
    bsDateStr = getBSTodayLong();
  } catch {
    bsDateStr = getBSToday();
  }

  const fyLabel = currentFiscalYear?.name || currentFiscalYear?.fiscalYearBS || "—";

  // ── Books open/closed (wired to actual fiscal year status) ──────────────────

  const booksOpen = useMemo(() => {
    if (!currentFiscalYear) return false;
    const status = (currentFiscalYear.status || "").toLowerCase();
    return status === "open" || status === "active" || status === "";
  }, [currentFiscalYear]);

  // ── Helpers: compute sales + purchase totals for a date range ───────────────

  const computeRange = useCallback(
    (fromDate: string, toDate: string) => {
      let sales = 0;
      let purchases = 0;
      for (const inv of invoices) {
        if (!inv.date || inv.status !== "posted") continue;
        if (inv.date < fromDate || inv.date > toDate) continue;
        const t = String(inv.type || "").toLowerCase();
        if (t.includes("sales-invoice") || t === "sales_invoice")
          sales += Number(inv.grandTotal || 0);
        if (t.includes("purchase-invoice") || t === "purchase_invoice")
          purchases += Number(inv.grandTotal || 0);
      }
      return { sales, purchases, grossMargin: sales - purchases };
    },
    [invoices],
  );

  // ── Row 2: Profit Pulse ─────────────────────────────────────────────────────

  const todayPulse = useMemo(() => computeRange(todayISO, todayISO), [computeRange, todayISO]);

  const mtdPulse = useMemo(() => {
    const start = todayISO.substring(0, 7) + "-01";
    return computeRange(start, todayISO);
  }, [computeRange, todayISO]);

  const ytdPulse = useMemo(() => {
    const fyStart = currentFiscalYear?.startDate || todayISO.substring(0, 4) + "-01-01";
    return computeRange(fyStart, todayISO);
  }, [computeRange, currentFiscalYear, todayISO]);

  // ── Row 3: Primary KPI Cards ────────────────────────────────────────────────

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
    let total = 0;
    for (const inv of invoices) {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("sales-invoice") || t === "sales_invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps === "unpaid" || ps === "partial") {
        total += Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      }
    }
    return total;
  }, [invoices]);

  const apOutstanding = useMemo(() => {
    let total = 0;
    for (const inv of invoices) {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("purchase-invoice") || t === "purchase_invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps === "unpaid" || ps === "partial") {
        total += Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      }
    }
    return total;
  }, [invoices]);

  const vatPayable = useMemo(() => {
    let output = 0;
    let input = 0;
    for (const inv of invoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const vat = Number(inv.vatAmount || inv.taxAmount || 0);
      if (t.includes("sales-invoice") || t === "sales_invoice") output += vat;
      if (t.includes("purchase-invoice") || t === "purchase_invoice") input += vat;
    }
    return Math.max(0, output - input);
  }, [invoices]);

  // ── Row 4: Balance Sheet Mini-Snapshot ─────────────────────────────────────

  const bsSnapshot = useMemo(() => {
    let currentAssets = 0;
    let fixedAssets = 0;
    let currentLiabilities = 0;
    let longTermLiabilities = 0;
    let equity = 0;

    for (const acc of accounts) {
      if (acc.isGroup || acc.isActive === false) continue;
      const group = (acc.group || acc.groupName || acc.parentGroup || "").toLowerCase();
      const bal = Number(acc.balance || 0);

      if (
        group.includes("cash") ||
        group.includes("bank") ||
        group.includes("sundry debtor") ||
        group.includes("stock") ||
        group.includes("current asset") ||
        group.includes("receivable")
      ) {
        currentAssets += bal;
      } else if (
        group.includes("fixed") ||
        group.includes("plant") ||
        group.includes("equipment") ||
        group.includes("building")
      ) {
        fixedAssets += bal;
      } else if (
        group.includes("sundry creditor") ||
        group.includes("current liab") ||
        group.includes("payable") ||
        group.includes("duties") ||
        group.includes("outstanding")
      ) {
        currentLiabilities += Math.abs(bal);
      } else if (
        group.includes("loan") ||
        group.includes("long-term") ||
        group.includes("debenture") ||
        group.includes("long term")
      ) {
        longTermLiabilities += Math.abs(bal);
      } else if (
        group.includes("capital") ||
        group.includes("reserve") ||
        group.includes("equity") ||
        group.includes("retained") ||
        group.includes("surplus")
      ) {
        equity += Math.abs(bal);
      }
    }

    return { currentAssets, fixedAssets, currentLiabilities, longTermLiabilities, equity };
  }, [accounts]);

  // ── Row 5: 6-month Sales vs Expenses chart ──────────────────────────────────

  const chartData = useMemo(() => {
    const result: Array<{ month: string; sales: number; purchases: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const fromDate = `${ym}-01`;
      const toDate = `${ym}-${String(lastDay).padStart(2, "0")}`;
      const { sales, purchases } = computeRange(fromDate, toDate);
      result.push({
        month:
          d.toLocaleString("en-US", { month: "short" }) + " " + String(d.getFullYear()).slice(2),
        sales,
        purchases,
      });
    }
    return result;
  }, [computeRange, today]);

  // ── Row 6: Aging Receivables ────────────────────────────────────────────────

  const agingBuckets = useMemo(() => {
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    for (const inv of invoices) {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("sales-invoice") || t === "sales_invoice")) continue;
      if (inv.status !== "posted") continue;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps !== "unpaid" && ps !== "partial") continue;
      const outstanding = Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
      if (outstanding <= 0) continue;
      const due = inv.dueDate || inv.date;
      const days = Math.floor((today.getTime() - new Date(due).getTime()) / 86400000);
      if (days <= 0) buckets.current += outstanding;
      else if (days <= 30) buckets.d1_30 += outstanding;
      else if (days <= 60) buckets.d31_60 += outstanding;
      else if (days <= 90) buckets.d61_90 += outstanding;
      else buckets.d90plus += outstanding;
    }
    return buckets;
  }, [invoices, today]);

  // ── Row 6: Top-5 Customers ──────────────────────────────────────────────────

  const topCustomers = useMemo(() => {
    const fyStart = currentFiscalYear?.startDate || todayISO.substring(0, 4) + "-01-01";
    const map = new Map<string, { name: string; total: number }>();
    for (const inv of invoices) {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("sales-invoice") || t === "sales_invoice")) continue;
      if (inv.status !== "posted") continue;
      if ((inv.date || "") < fyStart) continue;
      const id = inv.partyId || inv.partyName || "—";
      const name = inv.partyName || "—";
      const prev = map.get(id) || { name, total: 0 };
      prev.total += Number(inv.grandTotal || 0);
      map.set(id, prev);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices, currentFiscalYear, todayISO]);

  // ── Row 7: Alerts ───────────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const list: AlertRowProps[] = [];

    // Overdue receivables
    const overdue = invoices.filter((inv) => {
      const t = String(inv.type || "").toLowerCase();
      if (!(t.includes("sales-invoice") || t === "sales_invoice")) return false;
      if (inv.status !== "posted") return false;
      const ps = (inv.paymentStatus || "").toLowerCase();
      if (ps !== "unpaid" && ps !== "partial") return false;
      return inv.dueDate && inv.dueDate < todayISO;
    });
    if (warningAlarms.overduePayment && overdue.length > 0) {
      const amt = overdue.reduce(
        (s, i) => s + (Number(i.grandTotal || 0) - Number(i.paidAmount || 0)),
        0,
      );
      list.push({
        type: "danger",
        icon: <AlertTriangle size={16} />,
        title: `${overdue.length} Overdue Invoice${overdue.length > 1 ? "s" : ""}`,
        message: `${fmt(amt)} outstanding beyond due date — requires immediate follow-up`,
        action: "VIEW AR",
        onAction: () => setCurrentPage("outstanding-receivables"),
      });
    }

    // Stock below reorder level
    const reorder = items.filter((item) => {
      const minQty = item.reorderLevel || item.minimumStock || item.minStockLevel || 0;
      if (minQty <= 0) return false;
      const stock = stockMovements
        .filter((m) => m.itemId === item.id)
        .reduce((s, m) => {
          const qty = Number(m.qty || m.quantity || 0);
          const mtype = String(m.type || m.movementType || "").toLowerCase();
          return mtype === "in" || mtype === "purchase" || mtype === "opening" ? s + qty : s - qty;
        }, 0);
      return stock <= minQty;
    });
    if (warningAlarms.lowStock && reorder.length > 0) {
      list.push({
        type: "warning",
        icon: <Package size={16} />,
        title: `${reorder.length} Item${reorder.length > 1 ? "s" : ""} Below Reorder Level`,
        message:
          reorder
            .slice(0, 3)
            .map((i) => i.name)
            .join(", ") + (reorder.length > 3 ? ` + ${reorder.length - 3} more` : ""),
        action: "VIEW STOCK",
        onAction: () => setCurrentPage("stock-summary"),
      });
    }

    // PDC cheques due within 3 days
    const in3days = new Date(today);
    in3days.setDate(in3days.getDate() + 3);
    const in3daysISO = in3days.toISOString().split("T")[0];
    const pdcDue = vouchers.filter(
      (v) =>
        v.type === "receipt" &&
        v.pdc &&
        v.pdcDate &&
        v.pdcDate <= in3daysISO &&
        v.pdcDate >= todayISO &&
        v.status === "posted",
    );
    if (warningAlarms.pdcDueReminder && pdcDue.length > 0) {
      list.push({
        type: "info",
        icon: <Clock size={16} />,
        title: `${pdcDue.length} PDC Cheque${pdcDue.length > 1 ? "s" : ""} Due for Deposit`,
        message: `Due by ${in3daysISO} — total Rs. ${pdcDue.reduce((s, v) => s + Number(v.amount || 0), 0).toLocaleString("en-IN")}`,
        action: "VIEW PDC",
        onAction: () => setCurrentPage("pdc-management"),
      });
    }

    if (warningAlarms.creditLimitExceeded) {
      const creditBreaches = parties.filter((p) => {
        const limit = Number(p.creditLimit || 0);
        if (limit <= 0) return false;
        const analysis = computeOutstandingAnalysis(p.id, invoices);
        return analysis.totalReceivable > limit;
      });
      if (creditBreaches.length > 0) {
        list.push({
          type: "danger",
          icon: <AlertTriangle size={16} />,
          title: `${creditBreaches.length} Part${creditBreaches.length > 1 ? "ies" : "y"} Over Credit Limit`,
          message:
            creditBreaches
              .slice(0, 3)
              .map((p) => p.name)
              .join(", ") +
            (creditBreaches.length > 3 ? ` + ${creditBreaches.length - 3} more` : ""),
          action: "VIEW PARTIES",
          onAction: () => setCurrentPage("parties"),
        });
      }
    }

    if (warningAlarms.belowMinimumPrice) {
      const itemById = new Map(items.map((i) => [i.id, i]));
      const violations = new Set<string>();
      for (const inv of invoices) {
        const t = String(inv.type || "").toLowerCase();
        if (!(t.includes("sales-invoice") || t === "sales_invoice") || inv.status !== "posted")
          continue;
        for (const line of inv.lines || inv.items || []) {
          const item = itemById.get(line.itemId);
          if (!item) continue;
          const floor = Number(item.salePrice ?? item.sellingPrice ?? item.mrp ?? 0);
          const rate = Number(line.rate ?? line.price ?? 0);
          if (floor > 0 && rate > 0 && rate < floor) {
            violations.add(item.name || item.id);
          }
        }
      }
      if (violations.size > 0) {
        const names = Array.from(violations);
        list.push({
          type: "warning",
          icon: <Receipt size={16} />,
          title: `${violations.size} Item${violations.size > 1 ? "s" : ""} Sold Below Minimum Price`,
          message:
            names.slice(0, 3).join(", ") + (names.length > 3 ? ` + ${names.length - 3} more` : ""),
          action: "VIEW SALES",
          onAction: () => setCurrentPage("sales-register"),
        });
      }
    }

    return list;
  }, [
    invoices,
    items,
    stockMovements,
    vouchers,
    parties,
    todayISO,
    today,
    setCurrentPage,
    warningAlarms,
  ]);

  // ── Refresh (calls initializeApp, NOT page reload) ──────────────────────────

  const handleRefresh = useCallback(() => {
    initializeApp();
  }, [initializeApp]);

  // ── Aging bar widths ────────────────────────────────────────────────────────

  const agingTotal = Object.values(agingBuckets).reduce((s, v) => s + v, 0) || 1;

  // ── BSSnapshot totals ───────────────────────────────────────────────────────

  const totalAssets = bsSnapshot.currentAssets + bsSnapshot.fixedAssets;
  const totalLiabEquity =
    bsSnapshot.currentLiabilities + bsSnapshot.longTermLiabilities + bsSnapshot.equity;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#f5f6fa",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          ROW 1 — Enterprise Header Bar (sticky)
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "#1e2433",
          borderBottom: "1px solid #2d3748",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
        className="no-print"
      >
        {/* Left: Company + FY */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
              {companySettings?.companyNameEn || companySettings?.name || "Sutra ERP"}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
              FY {fyLabel} &nbsp;|&nbsp; PAN: {companySettings?.panNumber || "—"}
            </div>
          </div>

          {/* Books Open/Closed badge — wired to actual fiscal year status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 4,
              background: booksOpen ? "#14532d22" : "#7f1d1d22",
              border: `1px solid ${booksOpen ? "#16a34a" : "#dc2626"}`,
            }}
          >
            {booksOpen ? (
              <BookOpen size={12} style={{ color: "#22c55e" }} />
            ) : (
              <BookX size={12} style={{ color: "#dc2626" }} />
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: booksOpen ? "#22c55e" : "#dc2626",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Books {booksOpen ? "Open" : "Closed"}
            </span>
          </div>
        </div>

        {/* Center: Date */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#ffffff" }}>
            {weekdayEn}, {bsDateStr}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{adDateStr} (AD)</div>
        </div>

        {/* Right: User + Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>
              {currentUser?.name || currentUser?.username || "User"}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "capitalize" }}>
              {currentUser?.role || "user"}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            style={{
              height: 30,
              padding: "0 12px",
              background: "#1557b0",
              border: "none",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#0f4a96";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#1557b0";
            }}
            title="Refresh data (does not reload the page)"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* ════════════════════════════════════════════════════════════════════
            ROW 2 — Profit Pulse Strip
        ════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            display: "flex",
            overflow: "hidden",
          }}
        >
          <PulseCell label="Today's Gross Margin" value={todayPulse.grossMargin} period="Today" />
          <PulseCell label="Month-to-Date Gross Margin" value={mtdPulse.grossMargin} period="MTD" />
          <div
            style={{
              flex: 1,
              padding: "10px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7280",
              }}
            >
              Year-to-Date Gross Margin
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "'Courier New', monospace",
                  color: ytdPulse.grossMargin >= 0 ? "#059669" : "#dc2626",
                }}
              >
                {fmt(ytdPulse.grossMargin)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: ytdPulse.grossMargin >= 0 ? "#dcfce7" : "#fee2e2",
                  color: ytdPulse.grossMargin >= 0 ? "#166534" : "#991b1b",
                }}
              >
                {ytdPulse.grossMargin >= 0 ? "PROFIT" : "LOSS"}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              Gross Margin (Sales − Purchases) · YTD
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ROW 3 — Four Primary KPI Cards
        ════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <KpiCard
            label="Cash & Bank Position"
            value={fmtShort(cashBankBalance)}
            sub={fmt(cashBankBalance)}
            accentColor="#059669"
            icon={<Banknote size={16} />}
            onClick={() => setCurrentPage("ledger")}
          />
          <KpiCard
            label="Accounts Receivable"
            value={fmtShort(arOutstanding)}
            sub={fmt(arOutstanding) + " outstanding"}
            accentColor="#1557b0"
            icon={<Receipt size={16} />}
            onClick={() => setCurrentPage("outstanding-receivables")}
          />
          <KpiCard
            label="Accounts Payable"
            value={fmtShort(apOutstanding)}
            sub={fmt(apOutstanding) + " outstanding"}
            accentColor="#d97706"
            icon={<FileText size={16} />}
            onClick={() => setCurrentPage("outstanding-payables")}
          />
          <KpiCard
            label="VAT Payable to IRD"
            value={fmtShort(vatPayable)}
            sub={fmt(vatPayable)}
            accentColor="#7c3aed"
            icon={<TrendingUp size={16} />}
            onClick={() => setCurrentPage("vat-reports")}
          />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ROW 4 — Balance Sheet Mini-Snapshot (T-format)
        ════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {/* Section title */}
          <div
            style={{
              padding: "8px 16px",
              background: "#f5f6fa",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Balance Sheet Snapshot
            </span>
            <button
              onClick={() => setCurrentPage("balance-sheet")}
              style={{
                background: "none",
                border: "none",
                fontSize: 10,
                fontWeight: 600,
                color: "#1557b0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              Full Report <ArrowRight size={10} />
            </button>
          </div>

          {/* T-format two-column table */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "none" }}>
            {/* Assets (Left) */}
            <div style={{ borderRight: "1px solid #e5e7eb" }}>
              <div
                style={{
                  padding: "6px 16px",
                  background: "#eff6ff",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#1557b0",
                }}
              >
                Assets
              </div>
              {[
                {
                  label: "Current Assets",
                  value: bsSnapshot.currentAssets,
                  sub: "Cash, Bank, Debtors, Stock",
                },
                {
                  label: "Fixed Assets",
                  value: bsSnapshot.fixedAssets,
                  sub: "Plant, Equipment, Building",
                },
              ].map(({ label, value, sub }) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid #f3f4f6",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{sub}</div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#059669",
                    }}
                  >
                    {fmtShort(value)}
                  </div>
                </div>
              ))}
              <div
                style={{
                  padding: "10px 16px",
                  background: "#f0fdf4",
                  borderTop: "2px solid #bbf7d0",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  Total Assets
                </span>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#059669",
                  }}
                >
                  {fmtShort(totalAssets)}
                </span>
              </div>
            </div>

            {/* Liabilities + Equity (Right) */}
            <div>
              <div
                style={{
                  padding: "6px 16px",
                  background: "#fff7ed",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#d97706",
                }}
              >
                Liabilities & Equity
              </div>
              {[
                {
                  label: "Current Liabilities",
                  value: bsSnapshot.currentLiabilities,
                  sub: "Creditors, Outstanding Expenses",
                },
                {
                  label: "Long-Term Liabilities",
                  value: bsSnapshot.longTermLiabilities,
                  sub: "Loans, Debentures",
                },
                {
                  label: "Equity / Capital",
                  value: bsSnapshot.equity,
                  sub: "Capital, Reserves & Surplus",
                },
              ].map(({ label, value, sub }) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid #f3f4f6",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{sub}</div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#d97706",
                    }}
                  >
                    {fmtShort(value)}
                  </div>
                </div>
              ))}
              <div
                style={{
                  padding: "10px 16px",
                  background: "#fffbeb",
                  borderTop: "2px solid #fde68a",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  Total Liab. + Equity
                </span>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#d97706",
                  }}
                >
                  {fmtShort(totalLiabEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ROW 5 — Six-month Sales vs Expenses Bar Chart
        ════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              background: "#f5f6fa",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              6-Month Sales vs Purchases
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  color: "#374151",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#1557b0" }} />
                Sales
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  color: "#374151",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#dc2626" }} />
                Purchases
              </div>
            </div>
          </div>
          <div style={{ padding: "16px", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                {/* CartesianGrid intentionally omitted per spec — no grid noise */}
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickFormatter={(v) => {
                    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
                    if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
                    return String(v);
                  }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f6fa" }} />
                <Bar
                  dataKey="sales"
                  name="Sales"
                  fill="#1557b0"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="purchases"
                  name="Purchases"
                  fill="#dc2626"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ROW 6 — Aging Receivables + Top-5 Customers (side by side)
        ════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Aging Receivables */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                background: "#f5f6fa",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                AR Aging
              </span>
              <button
                onClick={() => setCurrentPage("aging-report")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#1557b0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                Full Report <ArrowRight size={10} />
              </button>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Current (Not yet due)", value: agingBuckets.current, color: "#059669" },
                { label: "1 – 30 Days", value: agingBuckets.d1_30, color: "#d97706" },
                { label: "31 – 60 Days", value: agingBuckets.d31_60, color: "#f59e0b" },
                { label: "61 – 90 Days", value: agingBuckets.d61_90, color: "#ef4444" },
                { label: "90+ Days", value: agingBuckets.d90plus, color: "#991b1b" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}
                  >
                    <span style={{ fontSize: 11, color: "#374151" }}>{label}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "'Courier New', monospace",
                        fontWeight: 700,
                        color,
                      }}
                    >
                      {fmt(value)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "#f3f4f6",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (value / agingTotal) * 100)}%`,
                        background: color,
                        borderRadius: 2,
                        transition: "width 600ms ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Customers */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                background: "#f5f6fa",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Top 5 Customers (YTD)
              </span>
              <button
                onClick={() => setCurrentPage("party-statement")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#1557b0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                View All <ArrowRight size={10} />
              </button>
            </div>
            <div>
              {topCustomers.length === 0 ? (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    fontSize: 11,
                    color: "#9ca3af",
                  }}
                >
                  No sales data available for this fiscal year.
                </div>
              ) : (
                topCustomers.map((c, idx) => {
                  return (
                    <div
                      key={c.name + idx}
                      style={{
                        padding: "10px 16px",
                        borderBottom: idx < topCustomers.length - 1 ? "1px solid #f3f4f6" : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background:
                            ["#1557b0", "#059669", "#d97706", "#7c3aed", "#0284c7"][idx % 5] + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: ["#1557b0", "#059669", "#d97706", "#7c3aed", "#0284c7"][idx % 5],
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#111827",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.name}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "'Courier New', monospace",
                          color: "#111827",
                        }}
                      >
                        {fmt(c.total)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ROW 7 — Alerts & Action Required
        ════════════════════════════════════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                background: "#fef2f2",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Action Required
              </span>
            </div>
            <div
              style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}
            >
              {alerts.map((alert, idx) => (
                <AlertRow key={idx} {...alert} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;
