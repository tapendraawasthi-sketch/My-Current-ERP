// src/pages/RatioAnalysis.tsx
// @ts-nocheck
// NEW PAGE — Financial Ratio Analysis Dashboard
// Automatically computes all key financial ratios from live data.
// Covers: Liquidity, Profitability, Efficiency, Solvency ratios.
// Tally Prime equivalent feature — "Ratio Analysis" from Gateway.

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ratio {
  name: string;
  value: number | null;
  unit: string;
  description: string;
  formula: string;
  benchmark?: string;
  status: "good" | "warning" | "danger" | "neutral";
  category: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt2 = (n: number | null, decimals = 2) => {
  if (n === null || !isFinite(n)) return "N/A";
  return Number(n).toLocaleString("en-NP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtAmt = (n: number) =>
  Math.abs(n).toLocaleString("en-NP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const safe = (num: number, den: number): number | null =>
  den === 0 ? null : num / den;

// Account classification keywords
const CURRENT_ASSET_KW  = ["cash", "bank", "debtor", "receivable", "inventory", "stock", "prepaid", "advance paid", "petty cash"];
const CURRENT_LIAB_KW   = ["creditor", "payable", "advance received", "tax payable", "vat payable", "overdraft", "short term"];
const FIXED_ASSET_KW    = ["fixed asset", "property", "plant", "equipment", "furniture", "vehicle", "machinery", "land", "building"];
const LONG_TERM_LIAB_KW = ["term loan", "mortgage", "debenture", "long term", "bond"];
const CASH_BANK_KW      = ["cash", "bank", "petty cash"];
const INVENTORY_KW      = ["inventory", "stock", "goods"];
const DEBTOR_KW         = ["debtor", "receivable", "trade receivable"];
const CREDITOR_KW       = ["creditor", "payable", "trade payable"];
const INTEREST_KW       = ["interest expense", "finance charge", "bank charge", "interest on loan"];
const DEPRECIATION_KW   = ["depreciation", "amortization", "amortisation"];

// ─── Component ────────────────────────────────────────────────────────────────
export default function RatioAnalysis() {
  const {
    accounts,
    vouchers,
    invoices,
    stockMovements,
    currentFiscalYear,
    companySettings,
  } = useStore();

  const fyStart =
    currentFiscalYear?.startDate || new Date().getFullYear() + "-04-01";
  const fyEnd =
    currentFiscalYear?.endDate ||
    new Date().getFullYear() + 1 + "-03-31";

  const [fromDate, setFromDate] = useState(fyStart);
  const [toDate,   setToDate]   = useState(fyEnd);
  const [activeCategory, setActiveCategory] = useState("All");

  // ── Balance at closing date ───────────────────────────────────────────────
  const balanceAt = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      if ((v.date || "") > toDate) continue;
      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] =
          (map[aid] || 0) +
          Number(line.debit || 0) -
          Number(line.credit || 0);
      }
    }
    for (const acc of accounts) {
      if (acc.openingBalance && acc.openingBalanceDate && acc.openingBalanceDate <= toDate) {
        const sign = (acc.openingBalanceDr || 0) > 0 ? 1 : -1;
        map[acc.id] = (map[acc.id] || 0) + Number(acc.openingBalance || 0) * sign;
      }
    }
    return map;
  }, [vouchers, accounts, toDate]);

  // ── Period movements ───────────────────────────────────────────────────────
  const periodMov = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const vDate = v.date || "";
      if (vDate < fromDate || vDate > toDate) continue;
      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] =
          (map[aid] || 0) +
          Number(line.debit || 0) -
          Number(line.credit || 0);
      }
    }
    return map;
  }, [vouchers, fromDate, toDate]);

  // ── Account group aggregator helper ───────────────────────────────────────
  const sumAccounts = (
    keywords: string[],
    types: string[],
    useBalance = true,
    absolute = true
  ) => {
    const map = useBalance ? balanceAt : periodMov;
    return accounts
      .filter(
        (a) =>
          !a.isGroup &&
          types.includes(a.type) &&
          keywords.some((k) => (a.name || "").toLowerCase().includes(k))
      )
      .reduce((s, a) => s + (map[a.id] || 0), 0);
  };

  // ── Key financial figures ─────────────────────────────────────────────────
  const financials = useMemo(() => {
    // --- Balance Sheet items ---
    const cashAndBank = sumAccounts(CASH_BANK_KW, ["asset"]);
    const inventory   = sumAccounts(INVENTORY_KW, ["asset"]);
    const debtors     = sumAccounts(DEBTOR_KW, ["asset"]);
    const creditors   = Math.abs(sumAccounts(CREDITOR_KW, ["liability"]));

    const currentAssets = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          a.type === "asset" &&
          CURRENT_ASSET_KW.some((k) => (a.name || "").toLowerCase().includes(k))
      )
      .reduce((s, a) => s + (balanceAt[a.id] || 0), 0);

    const currentLiabilities = Math.abs(
      accounts
        .filter(
          (a) =>
            !a.isGroup &&
            a.type === "liability" &&
            CURRENT_LIAB_KW.some((k) => (a.name || "").toLowerCase().includes(k))
        )
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0)
    );

    const fixedAssets = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          a.type === "asset" &&
          FIXED_ASSET_KW.some((k) => (a.name || "").toLowerCase().includes(k))
      )
      .reduce((s, a) => s + (balanceAt[a.id] || 0), 0);

    const totalAssets = accounts
      .filter((a) => !a.isGroup && a.type === "asset")
      .reduce((s, a) => s + (balanceAt[a.id] || 0), 0);

    const longTermLiabilities = Math.abs(
      accounts
        .filter(
          (a) =>
            !a.isGroup &&
            a.type === "liability" &&
            LONG_TERM_LIAB_KW.some((k) => (a.name || "").toLowerCase().includes(k))
        )
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0)
    );

    const totalLiabilities = Math.abs(
      accounts
        .filter((a) => !a.isGroup && a.type === "liability")
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0)
    );

    const equity = Math.abs(
      accounts
        .filter((a) => !a.isGroup && a.type === "equity")
        .reduce((s, a) => s + (balanceAt[a.id] || 0), 0)
    );

    // --- P&L items (period movements) ---
    const totalRevenue = accounts
      .filter((a) => !a.isGroup && a.type === "income")
      .reduce((s, a) => s + -(periodMov[a.id] || 0), 0);

    const totalExpenses = accounts
      .filter((a) => !a.isGroup && a.type === "expense")
      .reduce((s, a) => s + (periodMov[a.id] || 0), 0);

    const cogsAccounts = accounts.filter(
      (a) =>
        !a.isGroup &&
        a.type === "expense" &&
        ((a.name || "").toLowerCase().includes("cost of") ||
          (a.name || "").toLowerCase().includes("purchase") ||
          (a.name || "").toLowerCase().includes("direct expense"))
    );
    const cogs = cogsAccounts.reduce(
      (s, a) => s + (periodMov[a.id] || 0),
      0
    );

    const grossProfit = totalRevenue - cogs;
    const netProfit   = totalRevenue - totalExpenses;

    const interestExpense = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          a.type === "expense" &&
          INTEREST_KW.some((k) => (a.name || "").toLowerCase().includes(k))
      )
      .reduce((s, a) => s + (periodMov[a.id] || 0), 0);

    const depreciation = accounts
      .filter(
        (a) =>
          !a.isGroup &&
          a.type === "expense" &&
          DEPRECIATION_KW.some((k) =>
            (a.name || "").toLowerCase().includes(k)
          )
      )
      .reduce((s, a) => s + (periodMov[a.id] || 0), 0);

    const ebit   = netProfit + interestExpense;
    const ebitda = ebit + depreciation;

    // Closing stock from inventory movements
    const closingStock = Math.max(
      0,
      (stockMovements || [])
        .filter((m) => (m.date || "") <= toDate)
        .reduce((s, m) => {
          const t = (m.type || "").toLowerCase();
          const q = Math.abs(Number(m.qty || 0));
          const r = Number(m.rate || 0);
          return t.includes("in") || t.includes("purchase") || t.includes("opening")
            ? s + q * r
            : s - q * r;
        }, 0)
    );

    // Average inventory (simple: use closing stock as proxy)
    const avgInventory = closingStock > 0 ? closingStock : inventory;

    // Average debtors (use closing balance as proxy)
    const avgDebtors = debtors > 0 ? debtors : 1;

    // Average creditors
    const avgCreditors = creditors > 0 ? creditors : 1;

    // Days in period
    const periodDays = Math.max(
      1,
      Math.round(
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    return {
      cashAndBank,
      inventory,
      debtors,
      creditors,
      currentAssets,
      currentLiabilities,
      fixedAssets,
      totalAssets,
      longTermLiabilities,
      totalLiabilities,
      equity,
      totalRevenue,
      totalExpenses,
      cogs,
      grossProfit,
      netProfit,
      interestExpense,
      depreciation,
      ebit,
      ebitda,
      avgInventory,
      avgDebtors,
      avgCreditors,
      closingStock,
      periodDays,
      capitalEmployed: totalAssets - currentLiabilities,
      netWorkingCapital: currentAssets - currentLiabilities,
    };
  }, [accounts, balanceAt, periodMov, stockMovements, toDate, fromDate]);

  // ── Compute ratios ────────────────────────────────────────────────────────
  const ratios = useMemo((): Ratio[] => {
    const f = financials;

    const r: Ratio[] = [
      // ── LIQUIDITY ──────────────────────────────────────────────────────
      {
        category: "Liquidity",
        name: "Current Ratio",
        value: safe(f.currentAssets, f.currentLiabilities),
        unit: ":1",
        description:
          "Measures ability to pay short-term obligations. Higher is better. Standard benchmark is 2:1.",
        formula: "Current Assets ÷ Current Liabilities",
        benchmark: "Ideal: 2:1 or higher",
        status:
          safe(f.currentAssets, f.currentLiabilities) === null
            ? "neutral"
            : (safe(f.currentAssets, f.currentLiabilities) as number) >= 2
            ? "good"
            : (safe(f.currentAssets, f.currentLiabilities) as number) >= 1
            ? "warning"
            : "danger",
      },
      {
        category: "Liquidity",
        name: "Quick Ratio (Acid Test)",
        value: safe(
          f.currentAssets - f.inventory,
          f.currentLiabilities
        ),
        unit: ":1",
        description:
          "Like current ratio but excludes inventory (less liquid). Shows ability to pay debts without selling stock.",
        formula: "(Current Assets − Inventory) ÷ Current Liabilities",
        benchmark: "Ideal: 1:1 or higher",
        status:
          safe(f.currentAssets - f.inventory, f.currentLiabilities) === null
            ? "neutral"
            : (safe(f.currentAssets - f.inventory, f.currentLiabilities) as number) >= 1
            ? "good"
            : (safe(f.currentAssets - f.inventory, f.currentLiabilities) as number) >= 0.5
            ? "warning"
            : "danger",
      },
      {
        category: "Liquidity",
        name: "Cash Ratio",
        value: safe(f.cashAndBank, f.currentLiabilities),
        unit: ":1",
        description:
          "Most conservative liquidity ratio. Only cash and bank vs current liabilities. Shows immediate payment ability.",
        formula: "(Cash + Bank) ÷ Current Liabilities",
        benchmark: "Ideal: 0.5:1 or higher",
        status:
          safe(f.cashAndBank, f.currentLiabilities) === null
            ? "neutral"
            : (safe(f.cashAndBank, f.currentLiabilities) as number) >= 0.5
            ? "good"
            : (safe(f.cashAndBank, f.currentLiabilities) as number) >= 0.2
            ? "warning"
            : "danger",
      },
      {
        category: "Liquidity",
        name: "Net Working Capital",
        value: f.netWorkingCapital,
        unit: "Rs.",
        description:
          "Absolute working capital buffer. Positive means current assets exceed current liabilities.",
        formula: "Current Assets − Current Liabilities",
        benchmark: "Should be positive",
        status:
          f.netWorkingCapital > 0
            ? "good"
            : f.netWorkingCapital === 0
            ? "warning"
            : "danger",
      },

      // ── PROFITABILITY ──────────────────────────────────────────────────
      {
        category: "Profitability",
        name: "Gross Profit Margin",
        value: safe(f.grossProfit * 100, f.totalRevenue),
        unit: "%",
        description:
          "Percentage of revenue remaining after cost of goods sold. Higher means better control over production/purchase costs.",
        formula: "(Gross Profit ÷ Net Revenue) × 100",
        benchmark: "Industry varies; typically 20–60%",
        status:
          safe(f.grossProfit * 100, f.totalRevenue) === null
            ? "neutral"
            : (safe(f.grossProfit * 100, f.totalRevenue) as number) >= 30
            ? "good"
            : (safe(f.grossProfit * 100, f.totalRevenue) as number) >= 10
            ? "warning"
            : "danger",
      },
      {
        category: "Profitability",
        name: "Net Profit Margin",
        value: safe(f.netProfit * 100, f.totalRevenue),
        unit: "%",
        description:
          "Percentage of revenue that becomes net profit after all expenses including tax. Key indicator of overall profitability.",
        formula: "(Net Profit ÷ Net Revenue) × 100",
        benchmark: "Good: >10%; Fair: 5–10%",
        status:
          safe(f.netProfit * 100, f.totalRevenue) === null
            ? "neutral"
            : (safe(f.netProfit * 100, f.totalRevenue) as number) >= 10
            ? "good"
            : (safe(f.netProfit * 100, f.totalRevenue) as number) >= 5
            ? "warning"
            : "danger",
      },
      {
        category: "Profitability",
        name: "Return on Assets (ROA)",
        value: safe(f.netProfit * 100, f.totalAssets),
        unit: "%",
        description:
          "How efficiently assets are used to generate profit. Higher ROA means better asset utilization.",
        formula: "(Net Profit ÷ Total Assets) × 100",
        benchmark: "Good: >5%",
        status:
          safe(f.netProfit * 100, f.totalAssets) === null
            ? "neutral"
            : (safe(f.netProfit * 100, f.totalAssets) as number) >= 5
            ? "good"
            : (safe(f.netProfit * 100, f.totalAssets) as number) >= 2
            ? "warning"
            : "danger",
      },
      {
        category: "Profitability",
        name: "Return on Equity (ROE)",
        value: safe(f.netProfit * 100, f.equity),
        unit: "%",
        description:
          "Return generated on shareholders' investment. Key metric for investors and owners.",
        formula: "(Net Profit ÷ Shareholders' Equity) × 100",
        benchmark: "Good: >15%",
        status:
          safe(f.netProfit * 100, f.equity) === null
            ? "neutral"
            : (safe(f.netProfit * 100, f.equity) as number) >= 15
            ? "good"
            : (safe(f.netProfit * 100, f.equity) as number) >= 8
            ? "warning"
            : "danger",
      },
      {
        category: "Profitability",
        name: "Return on Capital Employed (ROCE)",
        value: safe(f.ebit * 100, f.capitalEmployed),
        unit: "%",
        description:
          "Profitability relative to capital employed (Total Assets − Current Liabilities). Used for investment decisions.",
        formula: "(EBIT ÷ Capital Employed) × 100",
        benchmark: "Should exceed cost of debt",
        status:
          safe(f.ebit * 100, f.capitalEmployed) === null
            ? "neutral"
            : (safe(f.ebit * 100, f.capitalEmployed) as number) >= 15
            ? "good"
            : (safe(f.ebit * 100, f.capitalEmployed) as number) >= 8
            ? "warning"
            : "danger",
      },
      {
        category: "Profitability",
        name: "EBITDA Margin",
        value: safe(f.ebitda * 100, f.totalRevenue),
        unit: "%",
        description:
          "Earnings before interest, tax, depreciation, amortization as % of revenue. Popular with analysts and banks.",
        formula: "(EBITDA ÷ Revenue) × 100",
        benchmark: "Good: >15%",
        status:
          safe(f.ebitda * 100, f.totalRevenue) === null
            ? "neutral"
            : (safe(f.ebitda * 100, f.totalRevenue) as number) >= 15
            ? "good"
            : (safe(f.ebitda * 100, f.totalRevenue) as number) >= 8
            ? "warning"
            : "danger",
      },

      // ── EFFICIENCY ─────────────────────────────────────────────────────
      {
        category: "Efficiency",
        name: "Inventory Turnover",
        value: safe(f.cogs, f.avgInventory),
        unit: "times",
        description:
          "How many times inventory is sold and replaced in the period. Higher = faster moving stock.",
        formula: "Cost of Goods Sold ÷ Average Inventory",
        benchmark: "Higher is better; varies by industry",
        status:
          safe(f.cogs, f.avgInventory) === null
            ? "neutral"
            : (safe(f.cogs, f.avgInventory) as number) >= 6
            ? "good"
            : (safe(f.cogs, f.avgInventory) as number) >= 3
            ? "warning"
            : "danger",
      },
      {
        category: "Efficiency",
        name: "Days Inventory Outstanding",
        value:
          safe(f.avgInventory * f.periodDays, f.cogs),
        unit: "days",
        description:
          "Average number of days inventory is held before being sold. Lower is better.",
        formula: "(Average Inventory ÷ COGS) × Period Days",
        benchmark: "Lower is better; <30 days is good for trading",
        status:
          safe(f.avgInventory * f.periodDays, f.cogs) === null
            ? "neutral"
            : (safe(f.avgInventory * f.periodDays, f.cogs) as number) <= 30
            ? "good"
            : (safe(f.avgInventory * f.periodDays, f.cogs) as number) <= 60
            ? "warning"
            : "danger",
      },
      {
        category: "Efficiency",
        name: "Debtors Turnover",
        value: safe(f.totalRevenue, f.avgDebtors),
        unit: "times",
        description:
          "How many times debtors are collected in the period. Higher = faster collections.",
        formula: "Net Credit Sales ÷ Average Trade Debtors",
        benchmark: "Higher is better",
        status:
          safe(f.totalRevenue, f.avgDebtors) === null
            ? "neutral"
            : (safe(f.totalRevenue, f.avgDebtors) as number) >= 6
            ? "good"
            : (safe(f.totalRevenue, f.avgDebtors) as number) >= 3
            ? "warning"
            : "danger",
      },
      {
        category: "Efficiency",
        name: "Days Sales Outstanding (DSO)",
        value: safe(
          f.avgDebtors * f.periodDays,
          f.totalRevenue
        ),
        unit: "days",
        description:
          "Average collection period — how many days to collect payment from customers.",
        formula: "(Average Debtors ÷ Net Credit Sales) × Period Days",
        benchmark: "Good: <30 days",
        status:
          safe(f.avgDebtors * f.periodDays, f.totalRevenue) === null
            ? "neutral"
            : (safe(f.avgDebtors * f.periodDays, f.totalRevenue) as number) <= 30
            ? "good"
            : (safe(f.avgDebtors * f.periodDays, f.totalRevenue) as number) <= 60
            ? "warning"
            : "danger",
      },
      {
        category: "Efficiency",
        name: "Creditors Turnover",
        value: safe(f.cogs, f.avgCreditors),
        unit: "times",
        description:
          "How many times the company pays its creditors. Lower turnover = longer credit period enjoyed.",
        formula: "Purchases ÷ Average Trade Creditors",
        benchmark: "Lower is better for cash flow",
        status: "neutral",
      },
      {
        category: "Efficiency",
        name: "Days Payable Outstanding (DPO)",
        value: safe(
          f.avgCreditors * f.periodDays,
          f.cogs
        ),
        unit: "days",
        description:
          "Average days taken to pay suppliers. Longer DPO = better cash flow management.",
        formula: "(Average Creditors ÷ Purchases) × Period Days",
        benchmark: "Higher is better for cash flow",
        status:
          safe(f.avgCreditors * f.periodDays, f.cogs) === null
            ? "neutral"
            : (safe(f.avgCreditors * f.periodDays, f.cogs) as number) >= 30
            ? "good"
            : "warning",
      },
      {
        category: "Efficiency",
        name: "Asset Turnover",
        value: safe(f.totalRevenue, f.totalAssets),
        unit: "times",
        description:
          "Revenue generated per rupee of assets. Higher = more efficient use of assets.",
        formula: "Net Revenue ÷ Total Assets",
        benchmark: "Higher is better",
        status:
          safe(f.totalRevenue, f.totalAssets) === null
            ? "neutral"
            : (safe(f.totalRevenue, f.totalAssets) as number) >= 1
            ? "good"
            : (safe(f.totalRevenue, f.totalAssets) as number) >= 0.5
            ? "warning"
            : "danger",
      },

      // ── SOLVENCY ───────────────────────────────────────────────────────
      {
        category: "Solvency",
        name: "Debt-to-Equity Ratio",
        value: safe(f.totalLiabilities, f.equity),
        unit: ":1",
        description:
          "Total debt vs shareholders' equity. Lower ratio = less financial risk. Banks prefer < 2:1.",
        formula: "Total Liabilities ÷ Shareholders' Equity",
        benchmark: "Good: <1:1; Acceptable: <2:1",
        status:
          safe(f.totalLiabilities, f.equity) === null
            ? "neutral"
            : (safe(f.totalLiabilities, f.equity) as number) <= 1
            ? "good"
            : (safe(f.totalLiabilities, f.equity) as number) <= 2
            ? "warning"
            : "danger",
      },
      {
        category: "Solvency",
        name: "Debt Ratio",
        value: safe(f.totalLiabilities, f.totalAssets),
        unit: ":1",
        description:
          "Proportion of assets financed by debt. Lower = more conservative financing structure.",
        formula: "Total Liabilities ÷ Total Assets",
        benchmark: "Good: <0.5 (less than 50% debt-financed)",
        status:
          safe(f.totalLiabilities, f.totalAssets) === null
            ? "neutral"
            : (safe(f.totalLiabilities, f.totalAssets) as number) <= 0.5
            ? "good"
            : (safe(f.totalLiabilities, f.totalAssets) as number) <= 0.7
            ? "warning"
            : "danger",
      },
      {
        category: "Solvency",
        name: "Interest Coverage Ratio",
        value: safe(f.ebit, f.interestExpense),
        unit: "times",
        description:
          "How many times EBIT covers interest expense. Banks require minimum 1.5x for loans.",
        formula: "EBIT ÷ Interest Expense",
        benchmark: "Good: >3x; Minimum for loans: 1.5x",
        status:
          safe(f.ebit, f.interestExpense) === null
            ? "neutral"
            : (safe(f.ebit, f.interestExpense) as number) >= 3
            ? "good"
            : (safe(f.ebit, f.interestExpense) as number) >= 1.5
            ? "warning"
            : "danger",
      },
      {
        category: "Solvency",
        name: "Equity Ratio",
        value: safe(f.equity * 100, f.totalAssets),
        unit: "%",
        description:
          "Percentage of assets financed by equity. Higher = stronger financial position.",
        formula: "(Equity ÷ Total Assets) × 100",
        benchmark: "Good: >50%",
        status:
          safe(f.equity * 100, f.totalAssets) === null
            ? "neutral"
            : (safe(f.equity * 100, f.totalAssets) as number) >= 50
            ? "good"
            : (safe(f.equity * 100, f.totalAssets) as number) >= 30
            ? "warning"
            : "danger",
      },
    ];

    return r;
  }, [financials]);

  // ── Filter by category ────────────────────────────────────────────────────
  const categories = ["All", "Liquidity", "Profitability", "Efficiency", "Solvency"];
  const filteredRatios =
    activeCategory === "All"
      ? ratios
      : ratios.filter((r) => r.category === activeCategory);

  // Status color helpers
  const statusColors = {
    good:    { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-100 text-green-700" },
    warning: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-700" },
    danger:  { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-600",    badge: "bg-red-100 text-red-700" },
    neutral: { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-700",   badge: "bg-gray-100 text-gray-700" },
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "good")    return <TrendingUp   className="h-4 w-4 text-green-600" />;
    if (status === "danger")  return <TrendingDown className="h-4 w-4 text-red-600" />;
    if (status === "warning") return <Minus        className="h-4 w-4 text-amber-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  // ── Summary counts ────────────────────────────────────────────────────────
  const goodCount    = ratios.filter((r) => r.status === "good").length;
  const warningCount = ratios.filter((r) => r.status === "warning").length;
  const dangerCount  = ratios.filter((r) => r.status === "danger").length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Ratio Analysis
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} — Financial Health
            Dashboard
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Period From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Period To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`h-8 px-3 text-[11px] font-medium rounded-md transition-colors ${
                activeCategory === cat
                  ? "bg-[#1557b0] text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Health summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3 md:col-span-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Key Figures — Period
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px]">
            {[
              ["Revenue",      financials.totalRevenue],
              ["Gross Profit", financials.grossProfit],
              ["Net Profit",   financials.netProfit],
              ["Total Assets", financials.totalAssets],
              ["Equity",       financials.equity],
              ["Closing Stock",financials.closingStock],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <span className="text-gray-500">{label as string}</span>
                <span className="font-mono font-semibold text-gray-800">
                  {fmtAmt(val as number)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Healthy</p>
          <p className="text-[32px] font-bold text-green-700 mt-1">{goodCount}</p>
          <p className="text-[10px] text-green-600">ratios</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Monitor</p>
          <p className="text-[32px] font-bold text-amber-700 mt-1">{warningCount}</p>
          <p className="text-[10px] text-amber-600">ratios</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Critical</p>
          <p className="text-[32px] font-bold text-red-600 mt-1">{dangerCount}</p>
          <p className="text-[10px] text-red-500">ratios</p>
        </div>
      </div>

      {/* Ratio cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredRatios.map((ratio) => {
          const colors = statusColors[ratio.status];
          return (
            <div
              key={ratio.name}
              className={`bg-white border rounded-lg p-4 ${colors.border}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-semibold uppercase rounded ${colors.badge}`}
                    >
                      {ratio.category}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-gray-800 leading-tight">
                    {ratio.name}
                  </p>
                </div>
                <StatusIcon status={ratio.status} />
              </div>

              {/* Ratio value */}
              <div className={`text-[24px] font-bold font-mono ${colors.text} mb-2`}>
                {ratio.unit === "Rs."
                  ? ratio.value !== null
                    ? (ratio.value < 0 ? "(" : "") +
                      "Rs. " +
                      fmtAmt(Math.abs(ratio.value)) +
                      (ratio.value < 0 ? ")" : "")
                    : "N/A"
                  : ratio.value !== null
                  ? fmt2(ratio.value) + " " + ratio.unit
                  : "N/A"}
              </div>

              {/* Description */}
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                {ratio.description}
              </p>

              {/* Formula */}
              <div className="bg-gray-50 border border-gray-100 rounded px-2 py-1.5 mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                  Formula
                </p>
                <p className="text-[11px] font-mono text-gray-600">
                  {ratio.formula}
                </p>
              </div>

              {/* Benchmark */}
              {ratio.benchmark && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <Info className="h-3 w-3 shrink-0" />
                  {ratio.benchmark}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 mt-4">
        Ratios computed from posted vouchers • Period: {fromDate} to{" "}
        {toDate} • {ratios.length} ratios calculated
      </p>
    </div>
  );
}
