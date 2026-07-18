// src/components/ReportHub.tsx
import React, { useState } from "react";
import { useStore } from "../store/useStore";
import {
  BarChart2,
  Package,
  FileBarChart,
  TrendingUp,
  BookOpen,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/design-system";

interface Report {
  label: string;
  page: string;
  desc: string;
  shortcut?: string;
}

interface ReportCategory {
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  reports: Report[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: "Account Books",
    icon: BookOpen,
    color: "var(--ds-action-primary)",
    reports: [
      { label: "Day Book", page: "day-book", desc: "All transactions by date", shortcut: "D" },
      {
        label: "General Ledger",
        page: "ledger",
        desc: "Account-wise running balance",
        shortcut: "Ctrl+L",
      },
      { label: "Party Ledger", page: "party-statement", desc: "Customer / Supplier statement" },
      { label: "Cash Book", page: "cash-flow", desc: "Cash receipts and payments" },
      { label: "Bank Book", page: "ledger", desc: "Bank account transactions" },
    ],
  },
  {
    title: "Financial Statements",
    icon: BarChart2,
    color: "var(--ds-status-info)",
    reports: [
      {
        label: "Trial Balance",
        page: "trial-balance",
        desc: "Debit / Credit balance summary",
        shortcut: "Ctrl+T",
      },
      { label: "Profit & Loss", page: "profit-loss", desc: "Income and expense statement" },
      {
        label: "Balance Sheet",
        page: "balance-sheet",
        desc: "Assets, liabilities & equity",
        shortcut: "Ctrl+B",
      },
      { label: "Cash Flow", page: "cash-flow", desc: "Cash inflow and outflow" },
      {
        label: "Ratio Analysis",
        page: "ratio-analysis",
        desc: "Liquidity, profitability & solvency",
      },
    ],
  },
  {
    title: "Sales & Purchase",
    icon: TrendingUp,
    color: "var(--ds-status-success)",
    reports: [
      { label: "Sales Analysis", page: "sales-analysis", desc: "Sales by party, item, period" },
      {
        label: "Outstanding Receivables",
        page: "outstanding-receivables",
        desc: "Unpaid sales invoices",
      },
      {
        label: "Outstanding Payables",
        page: "outstanding-payables",
        desc: "Unpaid purchase invoices",
      },
      { label: "Aging Report", page: "aging-report", desc: "Debtor / creditor aging" },
      { label: "Party Statement", page: "party-statement", desc: "Individual party account" },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    color: "var(--ds-status-warning)",
    reports: [
      { label: "Stock Summary", page: "stock-summary", desc: "Item-wise stock position" },
      { label: "Stock Ledger", page: "stock-ledger", desc: "Detailed stock movements" },
      { label: "Inventory Report", page: "inventory-report", desc: "Closing stock valuation" },
    ],
  },
  {
    title: "Budget & Analysis",
    icon: FileBarChart,
    color: "var(--ds-action-primary)",
    reports: [
      { label: "Budget vs Actual", page: "budget-vs-actual", desc: "Budget deviation analysis" },
      {
        label: "Interest Calculation",
        page: "interest-calculation",
        desc: "Interest on overdue bills",
      },
      {
        label: "Income & Expenditure",
        page: "income-expenditure",
        desc: "For non-profit entities",
      },
    ],
  },
  {
    title: "Statutory Reports",
    icon: ShieldCheck,
    color: "var(--ds-status-danger)",
    reports: [
      {
        label: "VAT Reports",
        page: "vat-reports",
        desc: "Annex-A, B, C — IRD Nepal filing",
        shortcut: "Ctrl+G",
      },
      { label: "GSTR-1", page: "gstr1", desc: "Outward supplies statement" },
      { label: "GSTR-3B", page: "gstr3b", desc: "Monthly return summary" },
      { label: "GST Summary", page: "gst-summary", desc: "Consolidated GST position" },
      { label: "TDS Report", page: "tds-reports", desc: "Tax deducted at source" },
      { label: "Audit Log", page: "audit-log", desc: "Immutable activity trail" },
    ],
  },
];

// ─── Report Item Row ──────────────────────────────────────────────────────────

const ReportRow: React.FC<{
  report: Report;
  accentColor: string;
  onClick: () => void;
}> = ({ report, accentColor, onClick }) => {
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
        padding: "9px 14px",
        background: hovered ? `${accentColor}06` : "transparent",
        border: "none",
        borderLeft: hovered ? `3px solid ${accentColor}` : "3px solid transparent",
        borderBottom: "1px solid #f3f4f6",
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: hovered ? 600 : 500,
            color: hovered ? "var(--ds-text-strong)" : "var(--ds-text-default)",
            transition: "font-weight 120ms ease, color 120ms ease",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {report.label}
        </div>
        <div style={{ fontSize: 12, color: "var(--ds-text-muted)", marginTop: 1 }}>{report.desc}</div>
      </div>

      {/* Shortcut badge */}
      {report.shortcut && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: hovered ? accentColor : "#9ca3af",
            background: hovered ? `${accentColor}12` : "#f3f4f6",
            border: `1px solid ${hovered ? accentColor + "40" : "#e5e7eb"}`,
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "monospace",
            flexShrink: 0,
            transition: "all 120ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {report.shortcut}
        </span>
      )}

      {/* Slide-in arrow */}
      <ChevronRight
        size={12}
        style={{
          color: hovered ? accentColor : "#d1d5db",
          flexShrink: 0,
          transform: hovered ? "translateX(2px)" : "translateX(0)",
          transition: "color 120ms ease, transform 120ms ease",
        }}
      />
    </button>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ReportHub: React.FC = () => {
  const { setCurrentPage } = useStore();

  return (
    <div className="flex flex-col gap-0 p-5">
      <PageHeader
        title="Reports"
        description="Financial reports, registers, and statutory filings"
      />

      {/* Category grid — responsive: 1 col on narrow, 2 on medium, 3 on wide */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.title}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Category header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "#f5f6fa",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    background: `${cat.color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={13} style={{ color: cat.color }} />
                </div>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    flex: 1,
                  }}
                >
                  {cat.title}
                </span>

                {/* Item count badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: cat.color,
                    background: `${cat.color}15`,
                    border: `1px solid ${cat.color}30`,
                    borderRadius: 10,
                    padding: "1px 7px",
                    flexShrink: 0,
                  }}
                >
                  {cat.reports.length}
                </span>
              </div>

              {/* Report rows */}
              <div>
                {cat.reports.map((report) => (
                  <ReportRow
                    key={report.page + report.label}
                    report={report}
                    accentColor={cat.color}
                    onClick={() => setCurrentPage(report.page)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReportHub;
