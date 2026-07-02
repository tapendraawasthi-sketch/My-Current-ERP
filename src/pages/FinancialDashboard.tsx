// src/pages/FinancialDashboard.tsx
// @ts-nocheck
import React, { useMemo, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  const abs = Math.abs(Number(n) || 0);
  return (
    "Rs. " +
    abs.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtShort(n: number): string {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 10_000_000) return `Rs. ${(abs / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000)    return `Rs. ${(abs / 100_000).toFixed(2)} L`;
  if (abs >= 1_000)      return `Rs. ${(abs / 1_000).toFixed(1)} K`;
  return `Rs. ${abs.toFixed(2)}`;
}

function fmtCount(n: number): string {
  return String(n || 0);
}

// Derive today's AD date parts for display
function getADDateString(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getWeekday(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function getADShort(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} (A.D.)`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Books status pill */
const BooksPill: React.FC<{ isOpen: boolean; fyName: string }> = ({ isOpen, fyName }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: isOpen ? "var(--color-success-light)" : "var(--color-danger-light)",
      color: isOpen ? "var(--color-success)" : "var(--color-danger)",
      border: `1px solid ${isOpen ? "var(--color-success-border)" : "var(--color-danger-border)"}`,
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: isOpen ? "var(--color-success)" : "var(--color-danger)",
        flexShrink: 0,
      }}
    />
    {isOpen ? `Books Open — FY ${fyName}` : `FY ${fyName} Closed`}
  </div>
);

/** Profit Pulse cell */
const PulseCell: React.FC<{
  label: string;
  value: number;
  note: string;
  isLast?: boolean;
}> = ({ label, value, note, isLast }) => {
  const isPos  = value > 0;
  const isNeg  = value < 0;
  const trend  = isPos ? "+ " : isNeg ? "− " : "";
  const trendClass = isPos
    ? "profit-pulse-positive"
    : isNeg
    ? "profit-pulse-negative"
    : "profit-pulse-neutral";

  return (
    <div
      className="profit-pulse-cell"
      style={{ borderRight: isLast ? "none" : "1px solid var(--border-default)" }}
    >
      <div className="profit-pulse-label">{label}</div>
      <div
        className="profit-pulse-value"
        style={{ color: isPos ? "var(--color-success)" : isNeg ? "var(--color-danger)" : "var(--text-primary)" }}
      >
        {fmtMoney(value)}
      </div>
      <div className={`profit-pulse-trend ${trendClass}`}>
        {trend}{note}
      </div>
    </div>
  );
};

/** KPI card — no icons, left accent stripe only */
const KpiCard: React.FC<{
  label: string;
  amount: number;
  sub: string;
  onClick?: () => void;
  accentColour?: string;
}> = ({ label, amount, sub, onClick, accentColour = "var(--color-primary)" }) => (
  <div
    className="kpi-card"
    style={{ borderLeftColor: accentColour }}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
  >
    <div className="kpi-card-label">{label}</div>
    <div className="kpi-card-amount">{fmtShort(amount)}</div>
    <div className="kpi-card-sub">{sub}</div>
    <div
      style={{
        fontSize: 10,
        color: "var(--text-placeholder)",
        marginTop: 6,
        fontFamily: "monospace",
      }}
    >
      {fmtMoney(amount)}
    </div>
  </div>
);

/** Activity cell in the today strip */
const ActivityCell: React.FC<{
  label: string;
  count: number;
  amount?: number;
  onClick?: () => void;
  isLast?: boolean;
}> = ({ label, count, amount, onClick, isLast }) => (
  <div
    className="activity-cell"
    style={{ borderRight: isLast ? "none" : undefined }}
    onClick={onClick}
  >
    <div className="activity-label">{label}</div>
    <div className="activity-count">{fmtCount(count)}</div>
    {amount !== undefined && (
      <div className="activity-amount">{fmtShort(amount)}</div>
    )}
  </div>
);

/** Balance Sheet row */
const BSLine: React.FC<{ name: string; amount: number; indent?: boolean }> = ({
  name,
  amount,
  indent = false,
}) => (
  <div className="bs-line" style={{ paddingLeft: indent ? 12 : 0 }}>
    <span className="bs-line-name" style={{ color: indent ? "var(--text-muted)" : "var(--text-secondary)" }}>
      {name}
    </span>
    <span className="bs-line-amount">{fmtMoney(amount)}</span>
  </div>
);

/** Balance Sheet subtotal row */
const BSSubtotal: React.FC<{ name: string; amount: number }> = ({ name, amount }) => (
  <div className="bs-subtotal">
    <span className="bs-subtotal-name">{name}</span>
    <span className="bs-subtotal-amount">{fmtMoney(amount)}</span>
  </div>
);

/** Alert card — stripe-only severity indicator, text-link action */
const AlertCard: React.FC<{
  type: "danger" | "warning" | "info";
  title: string;
  message: string;
  action: string;
  onAction: () => void;
}> = ({ type, title, message, action, onAction }) => (
  <div className="alert-card">
    <div className={`alert-stripe alert-stripe-${type}`} />
    <div style={{ flex: 1 }}>
      <div className="alert-title">{title}</div>
      <div className="alert-message">{message}</div>
      <button className="alert-action" onClick={onAction}>
        {action} →
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const FinancialDashboard: React.FC = () => {
  const {
    accounts,
    vouchers,
    invoices,
    items,
    parties,
    stockMovements,
    fiscalYears,
    companySettings,
    setCurrentPage,
  } = useStore();

  // ── Date state ───────────────────────────────────────────────
  const [bsDate, setBsDate] = useState("");
  const [bsDateLong, setBsDateLong] = useState("");

  useEffect(() => {
    try {
      setBsDate(getBSToday());
      setBsDateLong(getBSTodayLong());
    } catch {
      setBsDate("");
      setBsDateLong("");
    }
  }, []);

  const weekday   = getWeekday();
  const adShort   = getADShort();
  const todayISO  = new Date().toISOString().split("T")[0];

  // ── Fiscal year state ─────────────────────────────────────────
  const currentFY = useMemo(
    () => fiscalYears.find((fy) => fy.status === "open"),
    [fiscalYears],
  );
  const fyName    = currentFY?.name || "—";
  const fyOpen    = !!currentFY;
  const fyStart   = currentFY?.startDate || todayISO.substring(0, 4) + "-01-01";

  // ── Company ───────────────────────────────────────────────────
  const companyName =
    companySettings?.companyNameEn ||
    companySettings?.name ||
    "Company";

  // ── Profit Pulse calculations ─────────────────────────────────
  const mtdStart = todayISO.substring(0, 7) + "-01";

  function grossMargin(from: string, to: string): number {
    let sales = 0;
    let cost  = 0;
    for (const inv of invoices) {
      if (!inv.date || inv.status !== "posted") continue;
      if (inv.date < from || inv.date > to) continue;
      const t = String(inv.type || "").toLowerCase();
      if (t.includes("sales-invoice") || t === "sales_invoice")    sales += Number(inv.grandTotal || 0);
      if (t.includes("purchase-invoice") || t === "purchase_invoice") cost  += Number(inv.grandTotal || 0);
    }
    return sales - cost;
  }

  const todayMargin = useMemo(() => grossMargin(todayISO, todayISO),   [invoices, todayISO]);
  const mtdMargin   = useMemo(() => grossMargin(mtdStart, todayISO),   [invoices, mtdStart, todayISO]);
  const ytdMargin   = useMemo(() => grossMargin(fyStart,  todayISO),   [invoices, fyStart,  todayISO]);

  // ── KPI cards ─────────────────────────────────────────────────
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
    let out = 0;
    let inp = 0;
    for (const inv of invoices) {
      if (inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const v = Number(inv.vatAmount || inv.taxAmount || 0);
      if (t.includes("sales-invoice") || t === "sales_invoice")    out += v;
      if (t.includes("purchase-invoice") || t === "purchase_invoice") inp += v;
    }
    return Math.max(0, out - inp);
  }, [invoices]);

  // ── Balance Sheet snapshot ────────────────────────────────────
  //
  // Group accounts by their standard accounting group names.
  // We look at acc.group or acc.groupName to classify.

  const bsSnapshot = useMemo(() => {
    const sums: Record<string, number> = {
      fixedAssets:        0,
      currentAssets:      0,
      cashBank:           0,
      receivables:        0,
      totalAssets:        0,
      equity:             0,
      loans:              0,
      currentLiabilities: 0,
      payables:           0,
      totalLiabilities:   0,
    };

    for (const acc of accounts) {
      if (acc.isGroup || acc.isActive === false) continue;
      const bal = Number(acc.balance || 0);
      const g   = (acc.group || acc.groupName || acc.parentGroup || "").toLowerCase();
      const n   = (acc.name || "").toLowerCase();

      // Assets
      if (g.includes("fixed") || g.includes("plant") || g.includes("property")) {
        sums.fixedAssets += bal;
      } else if (n.includes("cash") || g.includes("cash-in-hand") || g.includes("cash in hand")) {
        sums.cashBank += bal;
      } else if (n.includes("bank") || g.includes("bank account")) {
        sums.cashBank += bal;
      } else if (g.includes("sundry debtor") || g.includes("receivable")) {
        sums.receivables += bal;
      } else if (
        g.includes("current asset") ||
        g.includes("stock") ||
        g.includes("inventory") ||
        g.includes("advance") ||
        g.includes("deposit")
      ) {
        sums.currentAssets += bal;
      }

      // Liabilities
      else if (
        g.includes("capital") ||
        g.includes("equity") ||
        g.includes("reserve") ||
        g.includes("partner")
      ) {
        sums.equity += bal;
      } else if (g.includes("loan") || g.includes("secured") || g.includes("unsecured")) {
        sums.loans += bal;
      } else if (g.includes("sundry creditor") || g.includes("payable")) {
        sums.payables += bal;
      } else if (g.includes("current liabilit") || g.includes("duties") || g.includes("tax")) {
        sums.currentLiabilities += bal;
      }
    }

    sums.totalAssets =
      sums.fixedAssets +
      sums.cashBank +
      sums.receivables +
      sums.currentAssets;

    sums.totalLiabilities =
      sums.equity +
      sums.loans +
      sums.payables +
      sums.currentLiabilities;

    const diff    = Math.abs(sums.totalAssets - sums.totalLiabilities);
    const tallied = diff < 1;

    return { ...sums, tallied, diff };
  }, [accounts]);

  // ── Today's activity ──────────────────────────────────────────
  const todayActivity = useMemo(() => {
    const result = {
      salesCount:    0, salesAmount:    0,
      purchaseCount: 0, purchaseAmount: 0,
      receiptCount:  0, receiptAmount:  0,
      paymentCount:  0, paymentAmount:  0,
      journalCount:  0,
    };

    for (const inv of invoices) {
      if (inv.date !== todayISO || inv.status !== "posted") continue;
      const t = String(inv.type || "").toLowerCase();
      const a = Number(inv.grandTotal || 0);
      if (t.includes("sales-invoice") || t === "sales_invoice") {
        result.salesCount++;
        result.salesAmount += a;
      } else if (t.includes("purchase-invoice") || t === "purchase_invoice") {
        result.purchaseCount++;
        result.purchaseAmount += a;
      }
    }

    for (const v of vouchers) {
      if (v.date !== todayISO || v.status !== "posted") continue;
      const t = String(v.type || "").toLowerCase();
      const a = Number(v.grandTotal || v.totalDebit || 0);
      if (t === "receipt") {
        result.receiptCount++;
        result.receiptAmount += a;
      } else if (t === "payment") {
        result.paymentCount++;
        result.paymentAmount += a;
      } else if (t === "journal") {
        result.journalCount++;
      }
    }

    return result;
  }, [invoices, vouchers, todayISO]);

  // ── Alerts ────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      type: "danger" | "warning" | "info";
      title: string;
      message: string;
      action: string;
      page: string;
    }> = [];

    // Overdue receivables
    const overdueInvs = invoices.filter(
      (inv) =>
        String(inv.type || "").toLowerCase().includes("sales-invoice") &&
        inv.status === "posted" &&
        (inv.paymentStatus === "unpaid" || inv.paymentStatus === "partial") &&
        inv.dueDate &&
        inv.dueDate < todayISO,
    );
    if (overdueInvs.length > 0) {
      const overdueAmt = overdueInvs.reduce((s, i) => s + Number(i.grandTotal || 0), 0);
      list.push({
        id: "overdue",
        type: "danger",
        title: `${overdueInvs.length} Overdue Invoice${overdueInvs.length > 1 ? "s" : ""}`,
        message: `${fmtShort(overdueAmt)} outstanding beyond due date`,
        action: "View Outstanding Receivables",
        page: "outstanding-receivables",
      });
    }

    // Items below reorder level
    const reorderItems = items.filter((item) => {
      const reorder = item.reorderLevel || item.minStockLevel || 0;
      if (reorder <= 0) return false;
      const stock = stockMovements
        .filter((m) => m.itemId === item.id)
        .reduce((s, m) => {
          const q = Number(m.quantity || m.qty || 0);
          const t = String(m.type || m.movementType || "").toLowerCase();
          return t === "in" || t === "purchase" ? s + q : s - q;
        }, 0);
      return stock <= reorder;
    });
    if (reorderItems.length > 0) {
      list.push({
        id: "reorder",
        type: "warning",
        title: `${reorderItems.length} Item${reorderItems.length > 1 ? "s" : ""} Below Reorder Level`,
        message: reorderItems
          .slice(0, 3)
          .map((i) => i.name)
          .join(", ") + (reorderItems.length > 3 ? ` and ${reorderItems.length - 3} more` : ""),
        action: "View Stock Summary",
        page: "stock-summary",
      });
    }

    // PDC cheques due in 3 days
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    const threeDaysStr = threeDays.toISOString().split("T")[0];
    const duePDC = vouchers.filter(
      (v) =>
        v.type === "receipt" &&
        v.pdc &&
        v.pdcDate &&
        v.pdcDate <= threeDaysStr &&
        v.pdcDate >= todayISO &&
        v.status === "posted",
    );
    if (duePDC.length > 0) {
      list.push({
        id: "pdc",
        type: "info",
        title: `${duePDC.length} PDC Cheque${duePDC.length > 1 ? "s" : ""} Due for Deposit`,
        message: `Due by ${threeDaysStr}`,
        action: "View PDC Summary",
        page: "pdc-management",
      });
    }

    // Unreconciled vouchers pending approval > 24h
    const pendingApproval = vouchers.filter((v) => {
      if (v.status !== "pending_approval") return false;
      const created = new Date(v.createdAt || v.date);
      return (Date.now() - created.getTime()) / 3_600_000 > 24;
    });
    if (pendingApproval.length > 0) {
      list.push({
        id: "approval",
        type: "warning",
        title: `${pendingApproval.length} Voucher${pendingApproval.length > 1 ? "s" : ""} Pending Approval`,
        message: "Awaiting approval for more than 24 hours",
        action: "Review Pending Vouchers",
        page: "approval-workflow",
      });
    }

    return list;
  }, [invoices, items, stockMovements, vouchers, todayISO]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: "var(--page-padding)",
        background: "var(--surface-page)",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* ── ROW 1: Date & Context Header ────────────────────── */}
      <div
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Left: BS Date */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="date-bs">{bsDateLong || bsDate || "—"}</span>
            <span className="date-bs-day">{weekday}</span>
          </div>
          <div className="date-ad">{adShort}</div>
        </div>

        {/* Centre: Company & FY */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            {companyName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Fiscal Year {fyName}
          </div>
        </div>

        {/* Right: Books status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BooksPill isOpen={fyOpen} fyName={fyName} />
          {/* Minimal refresh — icon-only, unobtrusive */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh data"
            style={{
              background: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "5px 6px",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {/* Minimal SVG refresh — avoids Lucide icon import just for this */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M13 7A6 6 0 1 1 7 1a6 6 0 0 1 4.95 2.63"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M10 1l2 3-3 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── ROW 2: Profit Pulse Strip ────────────────────────── */}
      <div className="profit-pulse-strip">
        <PulseCell
          label="Today's Gross Margin"
          value={todayMargin}
          note="Revenue minus Cost of Goods · Today"
        />
        <PulseCell
          label="Month-to-Date Margin"
          value={mtdMargin}
          note={`Since ${mtdStart}`}
        />
        <PulseCell
          label="Year-to-Date Margin"
          value={ytdMargin}
          note={`Since ${fyStart}`}
          isLast
        />
      </div>

      {/* ── ROW 3: Four KPI Cards ─────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="Cash & Bank"
          amount={cashBankBalance}
          sub="Liquid assets across all accounts"
          onClick={() => setCurrentPage("ledger")}
          accentColour="var(--color-primary)"
        />
        <KpiCard
          label="Outstanding Receivables"
          amount={arOutstanding}
          sub="Unpaid sales invoices"
          onClick={() => setCurrentPage("outstanding-receivables")}
          accentColour="var(--color-warning)"
        />
        <KpiCard
          label="Outstanding Payables"
          amount={apOutstanding}
          sub="Unpaid purchase invoices"
          onClick={() => setCurrentPage("outstanding-payables")}
          accentColour="var(--color-danger)"
        />
        <KpiCard
          label="VAT Payable"
          amount={vatPayable}
          sub="Output VAT minus Input VAT"
          onClick={() => setCurrentPage("vat-reports")}
          accentColour="var(--color-info)"
        />
      </div>

      {/* ── ROW 4: Balance Sheet Mini-Snapshot ───────────────── */}
      <div className="bs-snapshot">
        <div className="bs-snapshot-header">
          <span className="bs-snapshot-title">
            Balance Sheet — As at {bsDateLong || bsDate || todayISO}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage("balance-sheet")}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              padding: 0,
            }}
          >
            Full Report →
          </button>
        </div>

        <div className="bs-snapshot-body">
          {/* Assets column */}
          <div className="bs-col">
            <div className="bs-col-header">Assets</div>
            <BSLine
              name="Fixed Assets"
              amount={bsSnapshot.fixedAssets}
              indent
            />
            <BSLine
              name="Cash & Bank"
              amount={bsSnapshot.cashBank}
              indent
            />
            <BSLine
              name="Receivables"
              amount={bsSnapshot.receivables}
              indent
            />
            <BSLine
              name="Other Current Assets"
              amount={bsSnapshot.currentAssets}
              indent
            />
            <BSSubtotal name="Total Assets" amount={bsSnapshot.totalAssets} />
          </div>

          {/* Capital & Liabilities column */}
          <div className="bs-col bs-col-right">
            <div className="bs-col-header">Capital &amp; Liabilities</div>
            <BSLine
              name="Equity / Capital"
              amount={bsSnapshot.equity}
              indent
            />
            <BSLine
              name="Loans &amp; Borrowings"
              amount={bsSnapshot.loans}
              indent
            />
            <BSLine
              name="Payables"
              amount={bsSnapshot.payables}
              indent
            />
            <BSLine
              name="Other Current Liabilities"
              amount={bsSnapshot.currentLiabilities}
              indent
            />
            <BSSubtotal
              name="Total Liabilities"
              amount={bsSnapshot.totalLiabilities}
            />
          </div>
        </div>

        {/* Tally row */}
        <div
          className={`bs-tally-row ${bsSnapshot.tallied ? "bs-tally-balanced" : "bs-tally-unbalanced"}`}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: bsSnapshot.tallied
                ? "var(--color-success)"
                : "var(--color-danger)",
            }}
          >
            {bsSnapshot.tallied
              ? `✓ Assets = Liabilities (${fmtMoney(bsSnapshot.totalAssets)})`
              : `⚠ Difference: ${fmtMoney(bsSnapshot.diff)} — Check your chart of accounts`}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            {bsSnapshot.tallied ? "Balanced" : "Unbalanced"}
          </span>
        </div>
      </div>

      {/* ── ROW 5: Today's Activity Summary ─────────────────── */}
      <div>
        {/* Strip label */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          Today's Activity
        </div>
        <div className="activity-strip">
          <ActivityCell
            label="Sales Invoices"
            count={todayActivity.salesCount}
            amount={todayActivity.salesAmount}
            onClick={() => setCurrentPage("billing")}
          />
          <ActivityCell
            label="Purchase Invoices"
            count={todayActivity.purchaseCount}
            amount={todayActivity.purchaseAmount}
            onClick={() => setCurrentPage("purchase")}
          />
          <ActivityCell
            label="Receipts"
            count={todayActivity.receiptCount}
            amount={todayActivity.receiptAmount}
            onClick={() => setCurrentPage("receipt")}
          />
          <ActivityCell
            label="Payments"
            count={todayActivity.paymentCount}
            amount={todayActivity.paymentAmount}
            onClick={() => setCurrentPage("payment")}
          />
          <ActivityCell
            label="Journal Entries"
            count={todayActivity.journalCount}
            onClick={() => setCurrentPage("journal")}
            isLast
          />
        </div>
      </div>

      {/* ── ROW 6: Alerts ────────────────────────────────────── */}
      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          Alerts &amp; Required Actions
        </div>

        {alerts.length === 0 ? (
          <div
            style={{
              background: "var(--color-success-light)",
              border: "1px solid var(--color-success-border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>✓</span>
            <span>All clear — no pending alerts for today.</span>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 8,
            }}
          >
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                action={alert.action}
                onAction={() => setCurrentPage(alert.page)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom padding for status bar ───────────────────── */}
      <div style={{ height: 8 }} />
    </div>
  );
};

export default FinancialDashboard;
