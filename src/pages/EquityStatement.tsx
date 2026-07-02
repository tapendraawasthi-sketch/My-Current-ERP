// src/pages/EquityStatement.tsx
// @ts-nocheck
// NEW PAGE — Statement of Changes in Equity
// Mandatory under NFRS (Nepal Financial Reporting Standards) for companies.
// Shows movement in equity accounts: opening balance, profit/loss, dividends,
// capital contributions, and closing balance for each equity component.

import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Math.abs(n).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const thCls =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 whitespace-nowrap";
const tdCls =
  "px-3 py-2 text-[12px] text-gray-700 border-b border-gray-100";
const amtCls = `${tdCls} font-mono text-right`;
const totalCls =
  "px-3 py-2.5 text-[12px] font-bold font-mono text-right border-b border-gray-100";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EquityRow {
  id: string;
  name: string;
  openingBalance: number;
  capitalContributed: number;
  netProfitTransferred: number;
  dividendsPaid: number;
  otherAdjustments: number;
  closingBalance: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EquityStatement() {
  const {
    accounts,
    vouchers,
    currentFiscalYear,
    companySettings,
  } = useStore();

  const fyStart =
    currentFiscalYear?.startDate ||
    new Date().getFullYear() + "-04-01";
  const fyEnd =
    currentFiscalYear?.endDate ||
    new Date().getFullYear() + 1 + "-03-31";

  const [fromDate, setFromDate] = useState(fyStart);
  const [toDate, setToDate] = useState(fyEnd);

  // ── Compute balance at date for all accounts ──────────────────────────────
  const computeBalAt = (date: string): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      if ((v.date || "") > date) continue;
      for (const line of v.lines || []) {
        const aid = line.accountId;
        if (!aid) continue;
        map[aid] =
          (map[aid] || 0) +
          Number(line.debit || 0) -
          Number(line.credit || 0);
      }
    }
    // Opening balances from master
    for (const acc of accounts) {
      if (
        acc.openingBalance &&
        acc.openingBalanceDate &&
        acc.openingBalanceDate <= date
      ) {
        const sign = (acc.openingBalanceDr || 0) > 0 ? 1 : -1;
        map[acc.id] =
          (map[acc.id] || 0) +
          Number(acc.openingBalance || 0) * sign;
      }
    }
    return map;
  };

  // Opening = day before fromDate
  const prevDate = useMemo(() => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, [fromDate]);

  const openingBal = useMemo(
    () => computeBalAt(prevDate),
    [vouchers, accounts, prevDate]
  );
  const closingBal = useMemo(
    () => computeBalAt(toDate),
    [vouchers, accounts, toDate]
  );

  // ── Compute period movements ───────────────────────────────────────────────
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

  // ── Net profit for the period ─────────────────────────────────────────────
  const netProfit = useMemo(() => {
    const incomeAccs = accounts.filter((a) => a.type === "income");
    const expenseAccs = accounts.filter((a) => a.type === "expense");
    const totalIncome = incomeAccs.reduce(
      (s, a) => s + -(periodMov[a.id] || 0),
      0
    );
    const totalExpense = expenseAccs.reduce(
      (s, a) => s + (periodMov[a.id] || 0),
      0
    );
    return totalIncome - totalExpense;
  }, [accounts, periodMov]);

  // ── Identify dividend / drawing accounts ─────────────────────────────────
  const dividendKeywords = [
    "dividend",
    "drawing",
    "drawings",
    "distribution",
    "withdrawal",
  ];

  // ── Build equity rows ─────────────────────────────────────────────────────
  const equityRows = useMemo((): EquityRow[] => {
    const equityAccounts = accounts.filter(
      (a) => a.type === "equity" && !a.isGroup
    );

    return equityAccounts.map((acc) => {
      // Equity accounts are credit-nature: negative raw = positive balance
      const openRaw = openingBal[acc.id] || 0;
      const closeRaw = closingBal[acc.id] || 0;
      const movRaw = periodMov[acc.id] || 0;

      const openingBalance = -openRaw; // credit-nature: negate
      const closingBalance = -closeRaw;

      const isDividendAcc = dividendKeywords.some((k) =>
        (acc.name || "").toLowerCase().includes(k)
      );

      // Classify period movement
      const dividendsPaid = isDividendAcc ? Math.max(0, movRaw) : 0;
      const capitalContributed = !isDividendAcc
        ? Math.max(0, -movRaw)
        : 0;
      const otherAdjustments =
        -movRaw - capitalContributed + dividendsPaid;

      return {
        id: acc.id,
        name: acc.name || "",
        openingBalance,
        capitalContributed,
        netProfitTransferred: 0, // allocated below to retained earnings
        dividendsPaid: isDividendAcc ? Math.abs(dividendsPaid) : 0,
        otherAdjustments,
        closingBalance,
      };
    });
  }, [accounts, openingBal, closingBal, periodMov]);

  // ── Identify retained earnings account ───────────────────────────────────
  const retainedEarningsIdx = equityRows.findIndex(
    (r) =>
      r.name.toLowerCase().includes("retained") ||
      r.name.toLowerCase().includes("surplus") ||
      r.name.toLowerCase().includes("profit") ||
      r.name.toLowerCase().includes("reserve")
  );

  // Inject net profit into retained earnings row
  const finalRows = equityRows.map((row, idx) => {
    if (idx === retainedEarningsIdx) {
      return { ...row, netProfitTransferred: netProfit };
    }
    return row;
  });

  // If no retained earnings account found, add a virtual row
  if (retainedEarningsIdx === -1 && netProfit !== 0) {
    finalRows.push({
      id: "virtual-retained",
      name: "Retained Earnings / Net Profit",
      openingBalance: 0,
      capitalContributed: 0,
      netProfitTransferred: netProfit,
      dividendsPaid: 0,
      otherAdjustments: 0,
      closingBalance: netProfit,
    });
  }

  // ── Column totals ─────────────────────────────────────────────────────────
  const totals = {
    openingBalance: finalRows.reduce((s, r) => s + r.openingBalance, 0),
    capitalContributed: finalRows.reduce(
      (s, r) => s + r.capitalContributed,
      0
    ),
    netProfitTransferred: finalRows.reduce(
      (s, r) => s + r.netProfitTransferred,
      0
    ),
    dividendsPaid: finalRows.reduce((s, r) => s + r.dividendsPaid, 0),
    otherAdjustments: finalRows.reduce(
      (s, r) => s + r.otherAdjustments,
      0
    ),
    closingBalance: finalRows.reduce((s, r) => s + r.closingBalance, 0),
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const data = [
      ...finalRows.map((r) => ({
        "Equity Component": r.name,
        "Opening Balance": r.openingBalance,
        "Capital Contributed": r.capitalContributed,
        "Net Profit / (Loss)": r.netProfitTransferred,
        "Dividends / Drawings": -r.dividendsPaid,
        "Other Adjustments": r.otherAdjustments,
        "Closing Balance": r.closingBalance,
      })),
      {
        "Equity Component": "TOTAL",
        "Opening Balance": totals.openingBalance,
        "Capital Contributed": totals.capitalContributed,
        "Net Profit / (Loss)": totals.netProfitTransferred,
        "Dividends / Drawings": -totals.dividendsPaid,
        "Other Adjustments": totals.otherAdjustments,
        "Closing Balance": totals.closingBalance,
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Changes in Equity"
    );
    XLSX.writeFile(
      wb,
      `EquityStatement_${fromDate}_to_${toDate}.xlsx`
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Statement of Changes in Equity
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} — {fromDate} to{" "}
            {toDate} • NFRS Compliant
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
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-[11px] text-blue-800">
        <strong>NFRS Requirement:</strong> The Statement of Changes in
        Equity is mandatory for all companies under Nepal Financial
        Reporting Standards. It shows how each component of equity
        changed during the period — through profits, capital
        contributions, dividends, and other comprehensive income.
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          {
            label: "Opening Total Equity",
            value: totals.openingBalance,
            color: "text-gray-700",
          },
          {
            label: "Net Profit / (Loss)",
            value: netProfit,
            color:
              netProfit >= 0 ? "text-green-700" : "text-red-600",
          },
          {
            label: "Dividends / Drawings",
            value: -totals.dividendsPaid,
            color: "text-amber-700",
          },
          {
            label: "Closing Total Equity",
            value: totals.closingBalance,
            color:
              totals.closingBalance >= 0
                ? "text-[#1557b0]"
                : "text-red-600",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            <p className="text-[10px] font-semibold text-gray-500 tracking-wide">
              {kpi.label}
            </p>
            <p
              className={`text-[14px] font-bold font-mono mt-1 ${kpi.color}`}
            >
              {kpi.value < 0 ? "(" : ""}Rs. {fmt(kpi.value)}
              {kpi.value < 0 ? ")" : ""}
            </p>
          </div>
        ))}
      </div>

      {/* Main statement table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th className={thCls} style={{ minWidth: 180 }}>
                  Particulars
                </th>
                <th
                  className={`${thCls} text-right`}
                  style={{ width: 130 }}
                >
                  Opening Balance
                </th>
                <th
                  className={`${thCls} text-right`}
                  style={{ width: 130 }}
                >
                  Capital Contributed
                </th>
                <th
                  className={`${thCls} text-right`}
                  style={{ width: 140 }}
                >
                  Net Profit / (Loss)
                </th>
                <th
                  className={`${thCls} text-right`}
                  style={{ width: 140 }}
                >
                  Dividends / Drawings
                </th>
                <th
                  className={`${thCls} text-right`}
                  style={{ width: 130 }}
                >
                  Other Adjustments
                </th>
                <th
                  className={`${thCls} text-right`}
                  style={{ width: 130 }}
                >
                  Closing Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {finalRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-[12px] text-gray-400"
                  >
                    No equity accounts found. Add accounts with type
                    "equity" in Chart of Accounts.
                  </td>
                </tr>
              )}

              {finalRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800 border-b border-gray-100">
                    {row.name}
                  </td>
                  <td className={amtCls}>
                    {row.openingBalance !== 0
                      ? fmt(row.openingBalance)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right border-b border-gray-100 text-green-700">
                    {row.capitalContributed > 0.01
                      ? fmt(row.capitalContributed)
                      : "—"}
                  </td>
                  <td
                    className={`${amtCls} ${
                      row.netProfitTransferred >= 0
                        ? "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    {row.netProfitTransferred !== 0
                      ? (row.netProfitTransferred < 0 ? "(" : "") +
                        fmt(row.netProfitTransferred) +
                        (row.netProfitTransferred < 0 ? ")" : "")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right border-b border-gray-100 text-red-600">
                    {row.dividendsPaid > 0.01
                      ? "(" + fmt(row.dividendsPaid) + ")"
                      : "—"}
                  </td>
                  <td className={amtCls}>
                    {Math.abs(row.otherAdjustments) > 0.01
                      ? fmt(row.otherAdjustments)
                      : "—"}
                  </td>
                  <td
                    className={`${amtCls} font-semibold ${
                      row.closingBalance >= 0
                        ? "text-[#1557b0]"
                        : "text-red-600"
                    }`}
                  >
                    {row.closingBalance < 0 ? "(" : ""}
                    {fmt(row.closingBalance)}
                    {row.closingBalance < 0 ? ")" : ""}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Totals row */}
            <tfoot>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                  TOTAL EQUITY
                </td>
                <td className={totalCls}>
                  Rs. {fmt(totals.openingBalance)}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right border-b border-gray-100 text-green-700">
                  {totals.capitalContributed > 0.01
                    ? "Rs. " + fmt(totals.capitalContributed)
                    : "—"}
                </td>
                <td
                  className={`${totalCls} ${
                    totals.netProfitTransferred >= 0
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {totals.netProfitTransferred < 0 ? "(" : ""}Rs.{" "}
                  {fmt(totals.netProfitTransferred)}
                  {totals.netProfitTransferred < 0 ? ")" : ""}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-right border-b border-gray-100 text-red-600">
                  {totals.dividendsPaid > 0.01
                    ? "(Rs. " + fmt(totals.dividendsPaid) + ")"
                    : "—"}
                </td>
                <td className={totalCls}>
                  {Math.abs(totals.otherAdjustments) > 0.01
                    ? "Rs. " + fmt(totals.otherAdjustments)
                    : "—"}
                </td>
                <td
                  className={`${totalCls} ${
                    totals.closingBalance >= 0
                      ? "text-[#1557b0]"
                      : "text-red-600"
                  }`}
                >
                  {totals.closingBalance < 0 ? "(" : ""}Rs.{" "}
                  {fmt(totals.closingBalance)}
                  {totals.closingBalance < 0 ? ")" : ""}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 text-[11px] text-gray-600 space-y-2">
        <p className="font-semibold text-gray-800 text-[12px]">
          Notes to Statement of Changes in Equity
        </p>
        <p>
          1. <strong>Capital Contributed:</strong> Represents fresh
          capital introduced by owners / shareholders during the period.
        </p>
        <p>
          2. <strong>Net Profit / (Loss):</strong> Transferred from the
          Profit &amp; Loss Account for the period {fromDate} to {toDate}.
          Amount: Rs. {netProfit >= 0 ? "" : "("}
          {fmt(netProfit)}
          {netProfit < 0 ? ")" : ""}.
        </p>
        <p>
          3. <strong>Dividends / Drawings:</strong> Amounts withdrawn by
          owners or declared as dividends during the period.
        </p>
        <p>
          4. <strong>Other Adjustments:</strong> Includes prior period
          corrections, revaluation surplus, and other comprehensive
          income items not routed through P&amp;L.
        </p>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        Prepared as per NFRS (Nepal Financial Reporting Standards) •
        Period: {fromDate} to {toDate}
      </p>
    </div>
  );
}
