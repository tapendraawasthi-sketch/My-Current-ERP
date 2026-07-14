// src/pages/FundsFlow.tsx
// @ts-nocheck
// NEW PAGE — Funds flow
// Shows changes in Working Capital between two balance sheet dates.
// Different from Cash Flow — focuses on Working Capital as a whole, not just cash.
// Required by many banks for term loan applications.

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import { Download, Info } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Math.abs(n).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const thCls =
  "px-4 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide bg-[var(--ds-canvas)] border-b border-gray-200";
const tdCls = "px-4 py-2 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;

// Current Asset / Liability keywords
const CURRENT_ASSET_KW = [
  "cash",
  "bank",
  "debtor",
  "receivable",
  "inventory",
  "stock",
  "prepaid",
  "advance paid",
  "short term",
  "petty cash",
];
const CURRENT_LIABILITY_KW = [
  "creditor",
  "payable",
  "advance received",
  "tax payable",
  "vat payable",
  "short term loan",
  "overdraft",
  "provision",
];
const LONG_TERM_LIABILITY_KW = [
  "term loan",
  "mortgage",
  "debenture",
  "long term",
  "nfrs",
  "lease liability",
];
const FIXED_ASSET_KW = [
  "fixed asset",
  "property",
  "plant",
  "equipment",
  "furniture",
  "vehicle",
  "machinery",
  "land",
  "building",
  "intangible",
  "goodwill",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function FundsFlow() {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();

  const fyStart = currentFiscalYear?.startDate || new Date().getFullYear() + "-04-01";
  const fyEnd = currentFiscalYear?.endDate || new Date().getFullYear() + 1 + "-03-31";

  const [openingDate, setOpeningDate] = useState(fyStart);
  const [closingDate, setClosingDate] = useState(fyEnd);

  // ── Compute balance at a given date for all accounts ──────────────────────
  const computeBalanceAt = (date: string): Record<string, number> => {
    const map: Record<string, number> = {};

    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      if ((v.date || "") > date) continue;

      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] = (map[aid] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
      }
    }

    // Add opening balances from master
    for (const acc of accounts) {
      if (acc.openingBalance && acc.openingBalanceDate && acc.openingBalanceDate <= date) {
        const sign = (acc.openingBalanceDr || 0) > 0 ? 1 : -1;
        map[acc.id] = (map[acc.id] || 0) + Number(acc.openingBalance || 0) * sign;
      }
    }

    return map;
  };

  const openingBal = useMemo(
    () => computeBalanceAt(openingDate),
    [vouchers, accounts, openingDate],
  );
  const closingBal = useMemo(
    () => computeBalanceAt(closingDate),
    [vouchers, accounts, closingDate],
  );

  // ── Classify accounts ──────────────────────────────────────────────────────
  const classify = (
    acc: any,
  ):
    | "current_asset"
    | "current_liability"
    | "fixed_asset"
    | "long_term_liability"
    | "equity"
    | "other" => {
    const name = (acc.name || "").toLowerCase();
    if (CURRENT_ASSET_KW.some((k) => name.includes(k)) && acc.type === "asset")
      return "current_asset";
    if (CURRENT_LIABILITY_KW.some((k) => name.includes(k)) && acc.type === "liability")
      return "current_liability";
    if (FIXED_ASSET_KW.some((k) => name.includes(k)) && acc.type === "asset") return "fixed_asset";
    if (LONG_TERM_LIABILITY_KW.some((k) => name.includes(k)) && acc.type === "liability")
      return "long_term_liability";
    if (acc.type === "equity") return "equity";
    if (acc.type === "asset") return "current_asset"; // default assets to current
    if (acc.type === "liability") return "current_liability"; // default liabilities to current
    return "other";
  };

  // ── Compute Working Capital changes ────────────────────────────────────────
  const { wcChanges, sourcesOfFunds, applicationOfFunds, openingWC, closingWC } = useMemo(() => {
    const currentAssets = accounts.filter((a) => classify(a) === "current_asset");
    const currentLiabilities = accounts.filter((a) => classify(a) === "current_liability");
    const fixedAssets = accounts.filter((a) => classify(a) === "fixed_asset");
    const longTermLiabilities = accounts.filter((a) => classify(a) === "long_term_liability");
    const equityAccounts = accounts.filter((a) => a.type === "equity");

    // Working Capital = Current Assets - Current Liabilities
    const openCA = currentAssets.reduce((s, a) => s + (openingBal[a.id] || 0), 0);
    const openCL = currentLiabilities.reduce((s, a) => s + (openingBal[a.id] || 0), 0);
    const closeCA = currentAssets.reduce((s, a) => s + (closingBal[a.id] || 0), 0);
    const closeCL = currentLiabilities.reduce((s, a) => s + (closingBal[a.id] || 0), 0);

    const openingWC = openCA - Math.abs(openCL);
    const closingWC = closeCA - Math.abs(closeCL);
    const netChangeInWC = closingWC - openingWC;

    // Working Capital changes by account
    const wcChanges: Array<{
      name: string;
      opening: number;
      closing: number;
      change: number;
      type: string;
    }> = [];

    for (const acc of [...currentAssets, ...currentLiabilities]) {
      const open = openingBal[acc.id] || 0;
      const close = closingBal[acc.id] || 0;
      const change = close - open;
      if (Math.abs(change) > 0.01 || Math.abs(open) > 0.01 || Math.abs(close) > 0.01) {
        wcChanges.push({
          name: acc.name,
          opening: open,
          closing: close,
          change,
          type: classify(acc),
        });
      }
    }

    // Sources of Funds (long-term funds that increased working capital)
    const sourcesOfFunds: Array<{ label: string; amount: number }> = [];
    const applicationOfFunds: Array<{ label: string; amount: number }> = [];

    // Net profit (income accounts)
    const incomeAccs = accounts.filter((a) => a.type === "income");
    const expenseAccs = accounts.filter((a) => a.type === "expense");

    const incomeNet = incomeAccs.reduce((s, a) => {
      const change = (closingBal[a.id] || 0) - (openingBal[a.id] || 0);
      return s - change; // income is credit-nature
    }, 0);
    const expenseNet = expenseAccs.reduce((s, a) => {
      const change = (closingBal[a.id] || 0) - (openingBal[a.id] || 0);
      return s + change;
    }, 0);
    const netProfit = incomeNet - expenseNet;

    if (netProfit > 0)
      sourcesOfFunds.push({ label: "Net Profit from Operations", amount: netProfit });
    else
      applicationOfFunds.push({ label: "Net Loss from Operations", amount: Math.abs(netProfit) });

    // Long-term liability increases = sources
    for (const acc of longTermLiabilities) {
      const open = openingBal[acc.id] || 0;
      const close = closingBal[acc.id] || 0;
      const change = Math.abs(close) - Math.abs(open); // liabilities are credit-nature
      if (change > 0) {
        sourcesOfFunds.push({ label: `Increase in ${acc.name}`, amount: change });
      } else if (change < 0) {
        applicationOfFunds.push({ label: `Repayment of ${acc.name}`, amount: Math.abs(change) });
      }
    }

    // Equity increases = sources
    for (const acc of equityAccounts) {
      const open = openingBal[acc.id] || 0;
      const close = closingBal[acc.id] || 0;
      const change = Math.abs(close) - Math.abs(open);
      if (change > 0) {
        sourcesOfFunds.push({ label: `Increase in ${acc.name}`, amount: change });
      }
    }

    // Fixed asset increases = application
    for (const acc of fixedAssets) {
      const open = openingBal[acc.id] || 0;
      const close = closingBal[acc.id] || 0;
      const change = close - open;
      if (change > 0) {
        applicationOfFunds.push({ label: `Purchase of ${acc.name}`, amount: change });
      } else if (change < 0) {
        sourcesOfFunds.push({ label: `Sale / Disposal of ${acc.name}`, amount: Math.abs(change) });
      }
    }

    // Net change in working capital as balancing figure
    if (netChangeInWC > 0) {
      applicationOfFunds.push({ label: "Net Increase in Working Capital", amount: netChangeInWC });
    } else if (netChangeInWC < 0) {
      sourcesOfFunds.push({
        label: "Net Decrease in Working Capital",
        amount: Math.abs(netChangeInWC),
      });
    }

    return { wcChanges, sourcesOfFunds, applicationOfFunds, openingWC, closingWC };
  }, [accounts, openingBal, closingBal]);

  const totalSources = sourcesOfFunds.reduce((s, r) => s + r.amount, 0);
  const totalApplication = applicationOfFunds.reduce((s, r) => s + r.amount, 0);
  const isBalanced = Math.abs(totalSources - totalApplication) < 1;

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        ...sourcesOfFunds.map((r) => ({
          Section: "Sources",
          Particulars: r.label,
          Amount: r.amount,
        })),
        { Section: "TOTAL SOURCES", Particulars: "", Amount: totalSources },
        ...applicationOfFunds.map((r) => ({
          Section: "Application",
          Particulars: r.label,
          Amount: r.amount,
        })),
        { Section: "TOTAL APPLICATION", Particulars: "", Amount: totalApplication },
      ]),
      "Funds Flow",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        wcChanges.map((r) => ({
          Account: r.name,
          Type: r.type,
          Opening: r.opening,
          Closing: r.closing,
          Change: r.change,
        })),
      ),
      "Working Capital Changes",
    );

    XLSX.writeFile(wb, `FundsFlow_${openingDate}_to_${closingDate}.xlsx`);
  };

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[var(--ds-canvas)] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Funds flow</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} — Changes in Working Capital
          </p>
        </div>
        <button
          onClick={exportToExcel}
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end no-print">
        <div>
          <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Opening Date (Start of Period)
          </label>
          <input
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Closing Date (End of Period)
          </label>
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          />
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-[12px] text-blue-800">
        <strong>What is the Funds flow?</strong> Unlike the Cash flow which
        tracks only cash movements, the Funds flow shows how long-term funds (profits,
        loans, equity) were raised and used (in fixed assets, to increase working capital, etc.).
        Working Capital = Current Assets − Current Liabilities.
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Opening Working Capital", value: openingWC, color: "text-gray-700" },
          {
            label: "Closing Working Capital",
            value: closingWC,
            color: closingWC >= 0 ? "text-[var(--ds-action-primary)]" : "text-red-600",
          },
          {
            label: "Net Change in W.C.",
            value: closingWC - openingWC,
            color: closingWC - openingWC >= 0 ? "text-green-700" : "text-red-600",
          },
          {
            label: "Statement Balanced",
            value: isBalanced ? 1 : 0,
            color: isBalanced ? "text-green-700" : "text-red-600",
            isLabel: true,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              {kpi.label}
            </p>
            {kpi.isLabel ? (
              <p className={`text-[14px] font-bold mt-1 ${kpi.color}`}>
                {isBalanced ? "Balanced" : "Unbalanced"}
              </p>
            ) : (
              <p className={`text-[14px] font-bold font-mono mt-1 ${kpi.color}`}>
                {(kpi.value as number) < 0 ? "(" : ""}Rs. {fmt(kpi.value as number)}
                {(kpi.value as number) < 0 ? ")" : ""}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Main statement — T-format */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Sources */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-green-50 border-b border-green-200">
            <span className="text-[12px] font-semibold text-green-800 uppercase tracking-wide">
              Sources of Funds (Inflows)
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={thCls}>Particulars</th>
                <th className={`${thCls} text-right`}>Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {sourcesOfFunds.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className={tdCls}>{row.label}</td>
                  <td className={amtCls}>{fmt(row.amount)}</td>
                </tr>
              ))}
              {sourcesOfFunds.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-[12px] text-gray-400">
                    No sources identified
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--ds-surface-selected)] border-t-2 border-[var(--ds-border-strong)]">
                <td className="px-4 py-2.5 text-[12px] font-bold text-gray-800">Total Sources</td>
                <td className="px-4 py-2.5 text-[12px] font-bold font-mono text-right text-[var(--ds-action-primary)]">
                  {fmt(totalSources)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Application */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
            <span className="text-[12px] font-semibold text-red-800 uppercase tracking-wide">
              Application of Funds (Outflows)
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={thCls}>Particulars</th>
                <th className={`${thCls} text-right`}>Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {applicationOfFunds.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className={tdCls}>{row.label}</td>
                  <td className={amtCls}>{fmt(row.amount)}</td>
                </tr>
              ))}
              {applicationOfFunds.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-[12px] text-gray-400">
                    No applications identified
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--ds-surface-selected)] border-t-2 border-[var(--ds-border-strong)]">
                <td className="px-4 py-2.5 text-[12px] font-bold text-gray-800">
                  Total Application
                </td>
                <td className="px-4 py-2.5 text-[12px] font-bold font-mono text-right text-[var(--ds-action-primary)]">
                  {fmt(totalApplication)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Working Capital Schedule */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--ds-canvas)] border-b border-gray-200">
          <span className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
            Schedule of Changes in Working Capital
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className={thCls}>Account</th>
                <th className={thCls}>Type</th>
                <th className={`${thCls} text-right`}>Opening Balance</th>
                <th className={`${thCls} text-right`}>Closing Balance</th>
                <th className={`${thCls} text-right`}>Effect on W.C.</th>
                <th className={`${thCls} text-right`}>Increase in W.C.</th>
                <th className={`${thCls} text-right`}>Decrease in W.C.</th>
              </tr>
            </thead>
            <tbody>
              {wcChanges.map((row, i) => {
                // For current assets: increase = increase in WC
                // For current liabilities: increase = decrease in WC
                let wcIncrease = 0;
                let wcDecrease = 0;

                if (row.type === "current_asset") {
                  if (row.change > 0) wcIncrease = row.change;
                  else wcDecrease = Math.abs(row.change);
                } else {
                  // current liability: increase = decrease in WC
                  const libChange = Math.abs(row.closing) - Math.abs(row.opening);
                  if (libChange > 0) wcDecrease = libChange;
                  else wcIncrease = Math.abs(libChange);
                }

                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className={tdCls}>{row.name}</td>
                    <td className="px-4 py-2 text-[12px] border-b border-gray-100">
                      <span
                        className={`px-2 py-0.5 rounded text-[12px] font-semibold uppercase ${
                          row.type === "current_asset"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {row.type === "current_asset" ? "Current Asset" : "Current Liability"}
                      </span>
                    </td>
                    <td className={amtCls}>
                      {Math.abs(row.opening) > 0.01 ? fmt(row.opening) : "—"}
                    </td>
                    <td className={amtCls}>
                      {Math.abs(row.closing) > 0.01 ? fmt(row.closing) : "—"}
                    </td>
                    <td
                      className={`${amtCls} ${row.change >= 0 ? "text-green-700" : "text-red-600"}`}
                    >
                      {Math.abs(row.change) > 0.01
                        ? (row.change > 0 ? "+" : "") +
                          row.change.toLocaleString("en-NP", { minimumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-[12px] font-mono text-right border-b border-gray-100 text-green-700">
                      {wcIncrease > 0.01 ? fmt(wcIncrease) : "—"}
                    </td>
                    <td className="px-4 py-2 text-[12px] font-mono text-right border-b border-gray-100 text-red-600">
                      {wcDecrease > 0.01 ? fmt(wcDecrease) : "—"}
                    </td>
                  </tr>
                );
              })}

              {wcChanges.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-gray-400">
                    No working capital changes found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--ds-surface-selected)] border-t-2 border-[var(--ds-border-strong)] font-bold">
                <td colSpan={5} className="px-4 py-2.5 text-[12px] font-bold text-gray-800">
                  Net Change in Working Capital
                </td>
                <td className="px-4 py-2.5 text-[12px] font-bold font-mono text-right text-green-700">
                  {closingWC > openingWC ? `Rs. ${fmt(closingWC - openingWC)}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-[12px] font-bold font-mono text-right text-red-600">
                  {closingWC < openingWC ? `Rs. ${fmt(openingWC - closingWC)}` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-gray-400 mt-3">
        Based on posted vouchers • Opening: {openingDate} • Closing: {closingDate}
      </p>
    </div>
  );
}
