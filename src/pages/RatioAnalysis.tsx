// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Download } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";

interface FinancialData {
  currentAssets: number;
  currentLiabilities: number;
  stockValue: number;
  netSales: number;
  grossProfit: number;
  netProfit: number;
  equity: number;
  totalDebt: number;
  ebit: number;
  interestExpense: number;
}

interface RatioDef {
  key: string;
  label: string;
  formula: string;
  benchmark: { min: number; max: number; unit: string; label: string };
  category: "liquidity" | "profitability" | "solvency";
  compute: (data: FinancialData) => number;
  higherIsBetter: boolean;
}

const RATIO_DEFS: RatioDef[] = [
  // Liquidity
  {
    key: "currentRatio",
    label: "Current Ratio",
    formula: "Current Assets ÷ Current Liabilities",
    benchmark: { min: 1.5, max: 3.0, unit: ":1", label: "Ideal: 1.5–3.0 for trading" },
    category: "liquidity",
    compute: (d) => (d.currentLiabilities > 0 ? d.currentAssets / d.currentLiabilities : 0),
    higherIsBetter: true,
  },
  {
    key: "quickRatio",
    label: "Quick Ratio",
    formula: "(Current Assets − Stock) ÷ Current Liabilities",
    benchmark: { min: 1.0, max: 2.0, unit: ":1", label: "Ideal: ≥1.0" },
    category: "liquidity",
    compute: (d) =>
      d.currentLiabilities > 0 ? (d.currentAssets - d.stockValue) / d.currentLiabilities : 0,
    higherIsBetter: true,
  },
  // Profitability
  {
    key: "grossProfitRatio",
    label: "Gross Profit Ratio",
    formula: "(Gross Profit ÷ Net Sales) × 100",
    benchmark: { min: 20, max: 40, unit: "%", label: "Ideal: 20–40% for trading" },
    category: "profitability",
    compute: (d) => (d.netSales > 0 ? (d.grossProfit / d.netSales) * 100 : 0),
    higherIsBetter: true,
  },
  {
    key: "netProfitRatio",
    label: "Net Profit Ratio",
    formula: "(Net Profit ÷ Net Sales) × 100",
    benchmark: { min: 5, max: 20, unit: "%", label: "Ideal: 5–20%" },
    category: "profitability",
    compute: (d) => (d.netSales > 0 ? (d.netProfit / d.netSales) * 100 : 0),
    higherIsBetter: true,
  },
  {
    key: "roe",
    label: "Return on Equity",
    formula: "(Net Profit ÷ Equity) × 100",
    benchmark: { min: 15, max: 30, unit: "%", label: "Ideal: ≥15%" },
    category: "profitability",
    compute: (d) => (d.equity > 0 ? (d.netProfit / d.equity) * 100 : 0),
    higherIsBetter: true,
  },
  // Solvency
  {
    key: "debtToEquity",
    label: "Debt to Equity",
    formula: "Total Debt ÷ Shareholders' Equity",
    benchmark: { min: 0, max: 1.5, unit: ":1", label: "Ideal: ≤1.5" },
    category: "solvency",
    compute: (d) => (d.equity > 0 ? d.totalDebt / d.equity : 0),
    higherIsBetter: false,
  },
  {
    key: "interestCoverage",
    label: "Interest Coverage",
    formula: "EBIT ÷ Interest Expense",
    benchmark: { min: 3, max: 999, unit: "x", label: "Ideal: ≥3x" },
    category: "solvency",
    compute: (d) => (d.interestExpense > 0 ? d.ebit / d.interestExpense : 999),
    higherIsBetter: true,
  },
];

const CATEGORIES = [
  {
    key: "liquidity",
    label: "Liquidity Ratios",
    color: "var(--ds-action-primary)",
    desc: "Ability to meet short-term obligations",
  },
  {
    key: "profitability",
    label: "Profitability Ratios",
    color: "#059669",
    desc: "Efficiency in generating profit from operations",
  },
  {
    key: "solvency",
    label: "Solvency Ratios",
    color: "#7c3aed",
    desc: "Long-term financial stability and debt management",
  },
] as const;

const getRatioStatus = (ratio: RatioDef, value: number): "good" | "warning" | "bad" => {
  const { min, max } = ratio.benchmark;
  if (ratio.higherIsBetter) {
    if (value >= min) return "good";
    if (value >= min * 0.7) return "warning";
    return "bad";
  } else {
    if (value <= max) return "good";
    if (value <= max * 1.3) return "warning";
    return "bad";
  }
};

const RatioCard: React.FC<{ ratio: RatioDef; value: number; color: string }> = ({
  ratio,
  value,
  color,
}) => {
  const status = getRatioStatus(ratio, value);
  const statusColors = {
    good: { bg: "#f0fdf4", border: "#86efac", text: "#059669", dot: "#059669" },
    warning: { bg: "#fffbeb", border: "#fde68a", text: "#d97706", dot: "#d97706" },
    bad: { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", dot: "#dc2626" },
  }[status];

  const displayValue = Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: value < 10 ? 2 : 1,
        maximumFractionDigits: 2,
      })
    : "—";

  return (
    <div
      style={{
        background: statusColors.bg,
        border: `1px solid ${statusColors.border}`,
        borderRadius: 6,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusColors.dot,
            flexShrink: 0,
            marginTop: 4,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{ratio.label}</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, fontStyle: "italic" }}>
            {ratio.formula}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "'Courier New', monospace",
          color: statusColors.text,
          lineHeight: 1.1,
        }}
      >
        {displayValue}
        <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>{ratio.benchmark.unit}</span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          padding: "3px 8px",
          background: "rgba(0,0,0,0.04)",
          borderRadius: 3,
          borderLeft: `2px solid ${color}`,
        }}
      >
        {ratio.benchmark.label}
      </div>
    </div>
  );
};

export default function RatioAnalysis() {
  const { accounts, vouchers, stockMovements, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch, matchMovement } =
    useBranchFilter();

  const fyStart = currentFiscalYear?.startDate || new Date().getFullYear() + "-04-01";
  const fyEnd = currentFiscalYear?.endDate || new Date().getFullYear() + 1 + "-03-31";

  const [fromDate, setFromDate] = useState(fyStart);
  const [toDate, setToDate] = useState(fyEnd);

  const scopedVouchers = useMemo(
    () => (vouchers || []).filter((v) => matchBranch((v as any).branchId)),
    [vouchers, matchBranch, branchFilter],
  );
  const scopedMovements = useMemo(
    () => (stockMovements || []).filter((m) => matchMovement(m as any)),
    [stockMovements, matchMovement, branchFilter],
  );

  const financialData: FinancialData = useMemo(() => {
    const balanceAt: Record<string, number> = {};
    for (const v of scopedVouchers) {
      if (v.status !== "posted") continue;
      if ((v.date || "") > toDate) continue;
      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        balanceAt[aid] = (balanceAt[aid] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
      }
    }
    for (const acc of accounts) {
      if (acc.openingBalance && acc.openingBalanceDate && acc.openingBalanceDate <= toDate) {
        const sign = (acc.openingBalanceDr || 0) > 0 ? 1 : -1;
        balanceAt[acc.id] = (balanceAt[acc.id] || 0) + Number(acc.openingBalance || 0) * sign;
      }
    }

    const periodMov: Record<string, number> = {};
    for (const v of scopedVouchers) {
      if (v.status !== "posted") continue;
      if ((v.date || "") < fromDate || (v.date || "") > toDate) continue;
      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        periodMov[aid] = (periodMov[aid] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
      }
    }

    const kwMatch = (name, kws) => kws.some((k) => (name || "").toLowerCase().includes(k));

    const currentAssets = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          a.type === "asset" &&
          kwMatch(a.name, [
            "cash",
            "bank",
            "debtor",
            "receivable",
            "inventory",
            "stock",
            "prepaid",
            "advance paid",
            "petty cash",
          ]),
      )
      .reduce((s, a) => s + (balanceAt[a.id] || 0), 0);
    const currentLiabilities = Math.abs(
      accounts
        .filter(
          (a) =>
            !a.isGroup &&
            a.type === "liability" &&
            kwMatch(a.name, [
              "creditor",
              "payable",
              "advance received",
              "tax payable",
              "vat payable",
              "overdraft",
              "short term",
            ]),
        )
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0),
    );

    const stockValue = Math.max(
      0,
      (scopedMovements || [])
        .filter((m) => (m.date || "") <= toDate)
        .reduce((s, m) => {
          const q = Math.abs(Number(m.qty || m.quantity || 0));
          const r = Number(m.rate || m.costRate || 0);
          return String(m.type || m.movementType || "")
            .toLowerCase()
            .includes("in") ||
            String(m.type || m.movementType || "")
              .toLowerCase()
              .includes("purchase") ||
            String(m.type || m.movementType || "")
              .toLowerCase()
              .includes("opening")
            ? s + q * r
            : s - q * r;
        }, 0),
    );

    const netSales =
      accounts
        .filter((a) => !a.isGroup && a.type === "income" && kwMatch(a.name, ["sales", "revenue"]))
        .reduce((s, a) => s + -(periodMov[a.id] || 0), 0) ||
      accounts
        .filter((a) => !a.isGroup && a.type === "income")
        .reduce((s, a) => s + -(periodMov[a.id] || 0), 0);
    const totalRevenue = accounts
      .filter((a) => !a.isGroup && a.type === "income")
      .reduce((s, a) => s + -(periodMov[a.id] || 0), 0);
    const totalExpenses = accounts
      .filter((a) => !a.isGroup && a.type === "expense")
      .reduce((s, a) => s + (periodMov[a.id] || 0), 0);

    const cogs = accounts
      .filter(
        (a) =>
          !a.isGroup && a.type === "expense" && kwMatch(a.name, ["cost of", "purchase", "direct"]),
      )
      .reduce((s, a) => s + (periodMov[a.id] || 0), 0);
    const grossProfit = totalRevenue - cogs;
    const netProfit = totalRevenue - totalExpenses;

    const equity = Math.abs(
      accounts
        .filter((a) => !a.isGroup && a.type === "equity")
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0),
    );
    const totalDebt = Math.abs(
      accounts
        .filter(
          (a) =>
            !a.isGroup &&
            a.type === "liability" &&
            kwMatch(a.name, ["term loan", "mortgage", "debenture", "long term", "bond"]),
        )
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0),
    );
    const interestExpense = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          a.type === "expense" &&
          kwMatch(a.name, [
            "interest expense",
            "finance charge",
            "bank charge",
            "interest on loan",
          ]),
      )
      .reduce((s, a) => s + (periodMov[a.id] || 0), 0);
    const ebit = netProfit + interestExpense;

    return {
      currentAssets,
      currentLiabilities,
      stockValue,
      netSales,
      grossProfit,
      netProfit,
      equity,
      totalDebt,
      ebit,
      interestExpense,
    };
  }, [accounts, scopedVouchers, scopedMovements, fromDate, toDate]);

  const computedRatios = useMemo(() => {
    const res: Record<string, number> = {};
    for (const r of RATIO_DEFS) {
      res[r.key] = r.compute(financialData);
    }
    return res;
  }, [financialData]);

  return (
    <div className="bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Ratios</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Key financial indicators and metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
            aria-label="To date"
          />
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          <button className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-2">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
        {CATEGORIES.map((cat) => {
          const catRatios = RATIO_DEFS.filter((r) => r.category === cat.key);
          return (
            <div key={cat.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 4, height: 20, background: cat.color, borderRadius: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{cat.label}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{cat.desc}</div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {catRatios.map((ratio) => (
                  <RatioCard
                    key={ratio.key}
                    ratio={ratio}
                    value={computedRatios[ratio.key] || 0}
                    color={cat.color}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
