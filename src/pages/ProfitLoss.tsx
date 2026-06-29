// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import { Printer, Download } from "lucide-react";
import toast from "react-hot-toast";
import { formatADToBS } from "../lib/nepaliDate";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

// Helper function to compute account balance
function computeAccountBalance(
  accountId: string,
  accounts: any[],
  vouchers: any[],
  startDate: string,
  endDate: string,
) {
  const account = accounts.find((acc) => acc.id === accountId);
  if (!account) return 0;

  let balance = (account.openingBalanceDr || 0) - (account.openingBalanceCr || 0);

  const relevantVouchers = vouchers.filter(
    (v) =>
      v.status === "posted" &&
      new Date(v.date) >= new Date(startDate) &&
      new Date(v.date) <= new Date(endDate),
  );

  relevantVouchers.forEach((voucher) => {
    if (voucher.lines) {
      voucher.lines.forEach((line) => {
        if (line.accountId === accountId) {
          balance += (line.debit || 0) - (line.credit || 0);
        }
      });
    }
  });

  return balance;
}

// Group accounts into P&L sections
function groupAccounts(accounts: any[], vouchers: any[], startDate: string, endDate: string) {
  const grouped = {
    revenue: [] as any[],
    cogs: [] as any[],
    operatingExpenses: [] as any[],
    financeCosts: [] as any[],
    otherIncome: [] as any[],
    totalRevenue: 0,
    totalCogs: 0,
    totalOperatingExpenses: 0,
    totalFinanceCosts: 0,
    totalOtherIncome: 0,
  };

  accounts.forEach((acc) => {
    const balance = computeAccountBalance(acc.id, accounts, vouchers, startDate, endDate);

    if (acc.type === "income") {
      if (
        acc.name.toLowerCase().includes("other") ||
        acc.name.toLowerCase().includes("sundry") ||
        acc.name.toLowerCase().includes("misc") ||
        acc.name.toLowerCase().includes("interest income")
      ) {
        grouped.otherIncome.push({ ...acc, balance });
        grouped.totalOtherIncome += balance;
      } else {
        grouped.revenue.push({ ...acc, balance });
        grouped.totalRevenue += balance;
      }
    } else if (acc.type === "expense") {
      if (
        acc.name.toLowerCase().includes("purchase") ||
        acc.name.toLowerCase().includes("cost of sales") ||
        acc.name.toLowerCase().includes("material") ||
        acc.name.toLowerCase().includes("cogs") ||
        acc.name.toLowerCase().includes("trading")
      ) {
        grouped.cogs.push({ ...acc, balance });
        grouped.totalCogs += balance;
      } else if (
        acc.name.toLowerCase().includes("interest") ||
        acc.name.toLowerCase().includes("finance") ||
        acc.name.toLowerCase().includes("bank charge")
      ) {
        grouped.financeCosts.push({ ...acc, balance });
        grouped.totalFinanceCosts += balance;
      } else {
        grouped.operatingExpenses.push({ ...acc, balance });
        grouped.totalOperatingExpenses += balance;
      }
    }
  });

  return grouped;
}

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear } = useStore();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate || "");
  const [activeTab, setActiveTab] = useState(0);
  const [includeManufacturing, setIncludeManufacturing] = useState(false);

  const previousYearVouchers = useMemo(() => {
    if (!currentFiscalYear) return [];
    return vouchers.filter(
      (v) => v.status === "posted" && new Date(v.date) < new Date(currentFiscalYear.startDate),
    );
  }, [vouchers, currentFiscalYear]);

  const currentYearVouchers = useMemo(() => {
    return vouchers.filter(
      (v) =>
        v.status === "posted" &&
        new Date(v.date) >= new Date(fromDate) &&
        new Date(v.date) <= new Date(toDate),
    );
  }, [vouchers, fromDate, toDate]);

  const groupedAccounts = useMemo(() => {
    return groupAccounts(accounts, currentYearVouchers, fromDate, toDate);
  }, [accounts, currentYearVouchers, fromDate, toDate]);

  const previousGroupedAccounts = useMemo(() => {
    if (!currentFiscalYear)
      return groupAccounts(
        accounts,
        [],
        currentFiscalYear?.startDate || "",
        currentFiscalYear?.startDate || "",
      );
    return groupAccounts(
      accounts,
      previousYearVouchers,
      currentFiscalYear.startDate,
      currentFiscalYear.startDate,
    );
  }, [accounts, previousYearVouchers, currentFiscalYear]);

  const grossProfit = groupedAccounts.totalRevenue - groupedAccounts.totalCogs;
  const operatingProfit = grossProfit - groupedAccounts.totalOperatingExpenses;
  const profitBeforeTax =
    operatingProfit + groupedAccounts.totalOtherIncome - groupedAccounts.totalFinanceCosts;
  const netProfitAfterTax = profitBeforeTax;

  const prevGrossProfit = previousGroupedAccounts.totalRevenue - previousGroupedAccounts.totalCogs;
  const prevOperatingProfit = prevGrossProfit - previousGroupedAccounts.totalOperatingExpenses;
  const prevProfitBeforeTax =
    prevOperatingProfit +
    previousGroupedAccounts.totalOtherIncome -
    previousGroupedAccounts.totalFinanceCosts;

  const monthlyData = useMemo(() => {
    if (!currentFiscalYear) return [];
    const start = new Date(currentFiscalYear.startDate);
    const end = new Date(currentFiscalYear.endDate);

    const months = [];
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthVouchers = vouchers.filter(
        (v) =>
          v.status === "posted" && new Date(v.date) >= monthStart && new Date(v.date) <= monthEnd,
      );

      const monthGrouped = groupAccounts(
        accounts,
        monthVouchers,
        monthStart.toISOString().split("T")[0],
        monthEnd.toISOString().split("T")[0],
      );
      months.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        ...monthGrouped,
      });
    }

    const annual = {
      month: "Annual",
      totalRevenue: months.reduce((sum, m) => sum + m.totalRevenue, 0),
      totalCogs: months.reduce((sum, m) => sum + m.totalCogs, 0),
      totalOperatingExpenses: months.reduce((sum, m) => sum + m.totalOperatingExpenses, 0),
      totalFinanceCosts: months.reduce((sum, m) => sum + m.totalFinanceCosts, 0),
      totalOtherIncome: months.reduce((sum, m) => sum + m.totalOtherIncome, 0),
    };

    return [...months, annual];
  }, [accounts, vouchers, currentFiscalYear]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    let wsData: any[] = [];

    if (activeTab === 0) {
      // Vertical
      wsData = [
        ["Particulars", "Current Year", "Previous Year"],
        ["REVENUE", "", ""],
        ...groupedAccounts.revenue.map((acc) => [
          acc.name,
          money(acc.balance),
          money(previousGroupedAccounts.revenue.find((p) => p.id === acc.id)?.balance || 0),
        ]),
        [
          "Total Revenue",
          money(groupedAccounts.totalRevenue),
          money(previousGroupedAccounts.totalRevenue),
        ],
        ["LESS: COST OF GOODS SOLD", "", ""],
        ...groupedAccounts.cogs.map((acc) => [
          acc.name,
          money(acc.balance),
          money(previousGroupedAccounts.cogs.find((p) => p.id === acc.id)?.balance || 0),
        ]),
        ["Total COGS", money(groupedAccounts.totalCogs), money(previousGroupedAccounts.totalCogs)],
        ["GROSS PROFIT", money(grossProfit), money(prevGrossProfit)],
        ["LESS: OPERATING EXPENSES", "", ""],
        ...groupedAccounts.operatingExpenses.map((acc) => [
          acc.name,
          money(acc.balance),
          money(
            previousGroupedAccounts.operatingExpenses.find((p) => p.id === acc.id)?.balance || 0,
          ),
        ]),
        [
          "Total Operating Expenses",
          money(groupedAccounts.totalOperatingExpenses),
          money(previousGroupedAccounts.totalOperatingExpenses),
        ],
        ["OPERATING PROFIT", money(operatingProfit), money(prevOperatingProfit)],
        ["ADD: OTHER INCOME", "", ""],
        ...groupedAccounts.otherIncome.map((acc) => [
          acc.name,
          money(acc.balance),
          money(previousGroupedAccounts.otherIncome.find((p) => p.id === acc.id)?.balance || 0),
        ]),
        [
          "Total Other Income",
          money(groupedAccounts.totalOtherIncome),
          money(previousGroupedAccounts.totalOtherIncome),
        ],
        ["LESS: FINANCE COSTS", "", ""],
        ...groupedAccounts.financeCosts.map((acc) => [
          acc.name,
          money(acc.balance),
          money(previousGroupedAccounts.financeCosts.find((p) => p.id === acc.id)?.balance || 0),
        ]),
        [
          "Total Finance Costs",
          money(groupedAccounts.totalFinanceCosts),
          money(previousGroupedAccounts.totalFinanceCosts),
        ],
        ["NET PROFIT BEFORE TAX", money(profitBeforeTax), money(prevProfitBeforeTax)],
        ["NET PROFIT AFTER TAX", money(netProfitAfterTax), money(prevProfitBeforeTax)],
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
    XLSX.writeFile(wb, `Profit_Loss_${fromDate}_to_${toDate}.xlsx`);
    toast.success("Profit & Loss exported to Excel");
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            .print-container { width: 100% !important; }
            .print-only { display: block !important; }
          }
        `}
      </style>

      <div className="print-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 no-print">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Profit & Loss Statement</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              For the period ended {formatADToBS(toDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>

        {/* Print Only Header */}
        <div className="print-only hidden text-center mb-4">
          <h1 className="text-[16px] font-bold text-gray-800">
            {companySettings?.name || "Company Name"}
          </h1>
          <h2 className="text-[15px] font-semibold text-gray-700">
            {companySettings?.nameNepali || "कम्पनीको नाम"}
          </h2>
          <p className="text-[11px] text-gray-600 mt-1">{companySettings?.address || "Address"}</p>
          <p className="text-[11px] text-gray-600">
            PAN No: {companySettings?.panNumber || companySettings?.vatNumber || "—"}
          </p>
          <p className="text-[11px] text-gray-800 mt-2 font-semibold">
            Profit & Loss Statement for the Period ended {formatADToBS(toDate)}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-4 no-print flex flex-wrap items-end gap-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-md h-8 self-end items-center">
            {["Vertical (NAS)", "Horizontal", "With %", "Comparative", "Monthly"].map(
              (tab, index) => (
                <button
                  key={index}
                  className={`px-3 py-1 text-[12px] font-medium rounded ${
                    activeTab === index
                      ? "bg-white text-[#1557b0] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  onClick={() => setActiveTab(index)}
                >
                  {tab}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center gap-2 self-end pb-1.5 ml-auto">
            <label className="flex items-center space-x-2 cursor-pointer mr-4">
              <input
                type="checkbox"
                checked={includeManufacturing}
                onChange={(e) => setIncludeManufacturing(e.target.checked)}
                className="form-checkbox h-4 w-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
              />
              <span className="text-[12px] text-gray-700 font-medium">
                Include Manufacturing Account
              </span>
            </label>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>
          </div>
        </div>

        {/* Manufacturing Account (if enabled) */}
        {includeManufacturing && (
          <div className="mb-6 bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5">
              <h2 className="text-[12px] font-semibold text-gray-700 tracking-wide uppercase">
                MANUFACTURING ACCOUNT
              </h2>
            </div>
            <table className="w-full min-w-max border-collapse">
              <tbody>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-[12px] text-gray-700">
                    Raw Material Opening Stock
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">0.00</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-[12px] text-gray-700">
                    Add: Raw Material Purchases
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">0.00</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-[12px] text-gray-700">
                    Less: Raw Material Closing Stock
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">0.00</td>
                </tr>
                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800">
                    Material Consumed
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    0.00
                  </td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-[12px] text-gray-700">Add: Direct Labour</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">0.00</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-[12px] text-gray-700">Add: Factory Overhead</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">0.00</td>
                </tr>
                <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800">
                    Cost of Production
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    0.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Main P&L Content */}
        {activeTab === 0 && ( // Vertical (NAS)
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden max-w-full">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Particulars
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Current Year
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Previous Year
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    REVENUE
                  </td>
                </tr>
                {groupedAccounts.revenue.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.revenue.find((p) => p.id === acc.id)?.balance || 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">Total Revenue</td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalRevenue)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalRevenue)}
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: COST OF GOODS SOLD
                  </td>
                </tr>
                {groupedAccounts.cogs.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.cogs.find((p) => p.id === acc.id)?.balance || 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">Total COGS</td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalCogs)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalCogs)}
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    GROSS PROFIT
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(grossProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevGrossProfit)}
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: OPERATING EXPENSES
                  </td>
                </tr>
                {groupedAccounts.operatingExpenses.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.operatingExpenses.find((p) => p.id === acc.id)
                      ?.balance || 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Operating Expenses
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalOperatingExpenses)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalOperatingExpenses)}
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    OPERATING PROFIT
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(operatingProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevOperatingProfit)}
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    ADD: OTHER INCOME
                  </td>
                </tr>
                {groupedAccounts.otherIncome.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.otherIncome.find((p) => p.id === acc.id)?.balance || 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Other Income
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalOtherIncome)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalOtherIncome)}
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: FINANCE COSTS
                  </td>
                </tr>
                {groupedAccounts.financeCosts.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.financeCosts.find((p) => p.id === acc.id)?.balance || 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Finance Costs
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalFinanceCosts)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalFinanceCosts)}
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    NET PROFIT BEFORE TAX
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(profitBeforeTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevProfitBeforeTax)}
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-b-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    NET PROFIT AFTER TAX
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(netProfitAfterTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevProfitBeforeTax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 1 && ( // Horizontal (T-Format)
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column - Expenses */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5">
                <h2 className="text-[12px] font-semibold text-gray-700 tracking-wide uppercase">
                  Expenses & Profit
                </h2>
              </div>
              <table className="w-full min-w-max border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Opening Stock</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Purchases</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Direct Labour</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Factory Overhead</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                      Gross Profit c/d
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                      {money(grossProfit)}
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Operating Expenses</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      {money(groupedAccounts.totalOperatingExpenses)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Finance Costs</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      {money(groupedAccounts.totalFinanceCosts)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Depreciation</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2 text-[12px] font-bold text-gray-800">Net Profit</td>
                    <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                      {money(netProfitAfterTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Column - Income */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5">
                <h2 className="text-[12px] font-semibold text-gray-700 tracking-wide uppercase">
                  Income
                </h2>
              </div>
              <table className="w-full min-w-max border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Sales Revenue</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      {money(groupedAccounts.totalRevenue)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Closing Stock</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                      Gross Profit b/d
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                      {money(grossProfit)}
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Other Income</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      {money(groupedAccounts.totalOtherIncome)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700">Interest Income</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                      0.00
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 2 && ( // With %
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden max-w-full">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Particulars
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Current Year
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    % of Net Sales
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Previous Year
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Prev %
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    REVENUE
                  </td>
                </tr>
                {groupedAccounts.revenue.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.revenue.find((p) => p.id === acc.id)?.balance || 0;
                  const percent =
                    groupedAccounts.totalRevenue !== 0
                      ? (acc.balance / groupedAccounts.totalRevenue) * 100
                      : 0;
                  const prevPercent =
                    previousGroupedAccounts.totalRevenue !== 0
                      ? (prevBalance / previousGroupedAccounts.totalRevenue) * 100
                      : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {percent.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {prevPercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">Total Revenue</td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalRevenue)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    100.00%
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalRevenue)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    100.00%
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: COST OF GOODS SOLD
                  </td>
                </tr>
                {groupedAccounts.cogs.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.cogs.find((p) => p.id === acc.id)?.balance || 0;
                  const percent =
                    groupedAccounts.totalRevenue !== 0
                      ? (acc.balance / groupedAccounts.totalRevenue) * 100
                      : 0;
                  const prevPercent =
                    previousGroupedAccounts.totalRevenue !== 0
                      ? (prevBalance / previousGroupedAccounts.totalRevenue) * 100
                      : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${percent > prevPercent ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {percent.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {prevPercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">Total COGS</td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalCogs)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {((groupedAccounts.totalCogs / groupedAccounts.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalCogs)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (previousGroupedAccounts.totalCogs / previousGroupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    GROSS PROFIT
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(grossProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((grossProfit / groupedAccounts.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevGrossProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((prevGrossProfit / previousGroupedAccounts.totalRevenue) * 100).toFixed(2)}%
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: OPERATING EXPENSES
                  </td>
                </tr>
                {groupedAccounts.operatingExpenses.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.operatingExpenses.find((p) => p.id === acc.id)
                      ?.balance || 0;
                  const percent =
                    groupedAccounts.totalRevenue !== 0
                      ? (acc.balance / groupedAccounts.totalRevenue) * 100
                      : 0;
                  const prevPercent =
                    previousGroupedAccounts.totalRevenue !== 0
                      ? (prevBalance / previousGroupedAccounts.totalRevenue) * 100
                      : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${percent > prevPercent ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {percent.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {prevPercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Operating Expenses
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalOperatingExpenses)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (groupedAccounts.totalOperatingExpenses / groupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalOperatingExpenses)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (previousGroupedAccounts.totalOperatingExpenses /
                        previousGroupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    OPERATING PROFIT
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(operatingProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((operatingProfit / groupedAccounts.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevOperatingProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((prevOperatingProfit / previousGroupedAccounts.totalRevenue) * 100).toFixed(
                      2,
                    )}
                    %
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    ADD: OTHER INCOME
                  </td>
                </tr>
                {groupedAccounts.otherIncome.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.otherIncome.find((p) => p.id === acc.id)?.balance || 0;
                  const percent =
                    groupedAccounts.totalRevenue !== 0
                      ? (acc.balance / groupedAccounts.totalRevenue) * 100
                      : 0;
                  const prevPercent =
                    previousGroupedAccounts.totalRevenue !== 0
                      ? (prevBalance / previousGroupedAccounts.totalRevenue) * 100
                      : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {percent.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {prevPercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Other Income
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalOtherIncome)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (groupedAccounts.totalOtherIncome / groupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalOtherIncome)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (previousGroupedAccounts.totalOtherIncome /
                        previousGroupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: FINANCE COSTS
                  </td>
                </tr>
                {groupedAccounts.financeCosts.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.financeCosts.find((p) => p.id === acc.id)?.balance || 0;
                  const percent =
                    groupedAccounts.totalRevenue !== 0
                      ? (acc.balance / groupedAccounts.totalRevenue) * 100
                      : 0;
                  const prevPercent =
                    previousGroupedAccounts.totalRevenue !== 0
                      ? (prevBalance / previousGroupedAccounts.totalRevenue) * 100
                      : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${percent > prevPercent ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {percent.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {prevPercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Finance Costs
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalFinanceCosts)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (groupedAccounts.totalFinanceCosts / groupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalFinanceCosts)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {(
                      (previousGroupedAccounts.totalFinanceCosts /
                        previousGroupedAccounts.totalRevenue) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    NET PROFIT BEFORE TAX
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(profitBeforeTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((profitBeforeTax / groupedAccounts.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevProfitBeforeTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((prevProfitBeforeTax / previousGroupedAccounts.totalRevenue) * 100).toFixed(
                      2,
                    )}
                    %
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-b-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    NET PROFIT AFTER TAX
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(netProfitAfterTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((netProfitAfterTax / groupedAccounts.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevProfitBeforeTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {((prevProfitBeforeTax / previousGroupedAccounts.totalRevenue) * 100).toFixed(
                      2,
                    )}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 3 && ( // Comparative
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden max-w-full">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Particulars
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Current Year
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Previous Year
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Change NPR
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Change %
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    REVENUE
                  </td>
                </tr>
                {groupedAccounts.revenue.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.revenue.find((p) => p.id === acc.id)?.balance || 0;
                  const change = acc.balance - prevBalance;
                  const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#059669]" : change < 0 ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {money(change)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#059669]" : change < 0 ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Revenue */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">Total Revenue</td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalRevenue)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalRevenue)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalRevenue - previousGroupedAccounts.totalRevenue > 0 ? "text-[#059669]" : groupedAccounts.totalRevenue - previousGroupedAccounts.totalRevenue < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {money(groupedAccounts.totalRevenue - previousGroupedAccounts.totalRevenue)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalRevenue - previousGroupedAccounts.totalRevenue > 0 ? "text-[#059669]" : groupedAccounts.totalRevenue - previousGroupedAccounts.totalRevenue < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {(previousGroupedAccounts.totalRevenue !== 0
                      ? ((groupedAccounts.totalRevenue - previousGroupedAccounts.totalRevenue) /
                          previousGroupedAccounts.totalRevenue) *
                        100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: COST OF GOODS SOLD
                  </td>
                </tr>
                {groupedAccounts.cogs.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.cogs.find((p) => p.id === acc.id)?.balance || 0;
                  const change = acc.balance - prevBalance;
                  const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#dc2626]" : change < 0 ? "text-[#059669]" : "text-gray-700"}`}
                      >
                        {money(change)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#dc2626]" : change < 0 ? "text-[#059669]" : "text-gray-700"}`}
                      >
                        {changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total COGS */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">Total COGS</td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalCogs)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalCogs)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalCogs - previousGroupedAccounts.totalCogs > 0 ? "text-[#dc2626]" : groupedAccounts.totalCogs - previousGroupedAccounts.totalCogs < 0 ? "text-[#059669]" : "text-gray-800"}`}
                  >
                    {money(groupedAccounts.totalCogs - previousGroupedAccounts.totalCogs)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalCogs - previousGroupedAccounts.totalCogs > 0 ? "text-[#dc2626]" : groupedAccounts.totalCogs - previousGroupedAccounts.totalCogs < 0 ? "text-[#059669]" : "text-gray-800"}`}
                  >
                    {(previousGroupedAccounts.totalCogs !== 0
                      ? ((groupedAccounts.totalCogs - previousGroupedAccounts.totalCogs) /
                          previousGroupedAccounts.totalCogs) *
                        100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                {/* Gross Profit */}
                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    GROSS PROFIT
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(grossProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevGrossProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${grossProfit - prevGrossProfit > 0 ? "text-[#059669]" : grossProfit - prevGrossProfit < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {money(grossProfit - prevGrossProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${grossProfit - prevGrossProfit > 0 ? "text-[#059669]" : grossProfit - prevGrossProfit < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {(prevGrossProfit !== 0
                      ? ((grossProfit - prevGrossProfit) / prevGrossProfit) * 100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                {/* Operating Expenses */}
                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: OPERATING EXPENSES
                  </td>
                </tr>
                {groupedAccounts.operatingExpenses.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.operatingExpenses.find((p) => p.id === acc.id)
                      ?.balance || 0;
                  const change = acc.balance - prevBalance;
                  const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#dc2626]" : change < 0 ? "text-[#059669]" : "text-gray-700"}`}
                      >
                        {money(change)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#dc2626]" : change < 0 ? "text-[#059669]" : "text-gray-700"}`}
                      >
                        {changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Operating Expenses */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Operating Expenses
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalOperatingExpenses)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalOperatingExpenses)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalOperatingExpenses - previousGroupedAccounts.totalOperatingExpenses > 0 ? "text-[#dc2626]" : groupedAccounts.totalOperatingExpenses - previousGroupedAccounts.totalOperatingExpenses < 0 ? "text-[#059669]" : "text-gray-800"}`}
                  >
                    {money(
                      groupedAccounts.totalOperatingExpenses -
                        previousGroupedAccounts.totalOperatingExpenses,
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalOperatingExpenses - previousGroupedAccounts.totalOperatingExpenses > 0 ? "text-[#dc2626]" : groupedAccounts.totalOperatingExpenses - previousGroupedAccounts.totalOperatingExpenses < 0 ? "text-[#059669]" : "text-gray-800"}`}
                  >
                    {(previousGroupedAccounts.totalOperatingExpenses !== 0
                      ? ((groupedAccounts.totalOperatingExpenses -
                          previousGroupedAccounts.totalOperatingExpenses) /
                          previousGroupedAccounts.totalOperatingExpenses) *
                        100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                {/* Operating Profit */}
                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    OPERATING PROFIT
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(operatingProfit)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevOperatingProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${operatingProfit - prevOperatingProfit > 0 ? "text-[#059669]" : operatingProfit - prevOperatingProfit < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {money(operatingProfit - prevOperatingProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${operatingProfit - prevOperatingProfit > 0 ? "text-[#059669]" : operatingProfit - prevOperatingProfit < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {(prevOperatingProfit !== 0
                      ? ((operatingProfit - prevOperatingProfit) / prevOperatingProfit) * 100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                {/* Other Income */}
                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    ADD: OTHER INCOME
                  </td>
                </tr>
                {groupedAccounts.otherIncome.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.otherIncome.find((p) => p.id === acc.id)?.balance || 0;
                  const change = acc.balance - prevBalance;
                  const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#059669]" : change < 0 ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {money(change)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#059669]" : change < 0 ? "text-[#dc2626]" : "text-gray-700"}`}
                      >
                        {changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Other Income */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Other Income
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalOtherIncome)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalOtherIncome)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalOtherIncome - previousGroupedAccounts.totalOtherIncome > 0 ? "text-[#059669]" : groupedAccounts.totalOtherIncome - previousGroupedAccounts.totalOtherIncome < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {money(
                      groupedAccounts.totalOtherIncome - previousGroupedAccounts.totalOtherIncome,
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalOtherIncome - previousGroupedAccounts.totalOtherIncome > 0 ? "text-[#059669]" : groupedAccounts.totalOtherIncome - previousGroupedAccounts.totalOtherIncome < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {(previousGroupedAccounts.totalOtherIncome !== 0
                      ? ((groupedAccounts.totalOtherIncome -
                          previousGroupedAccounts.totalOtherIncome) /
                          previousGroupedAccounts.totalOtherIncome) *
                        100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                {/* Finance Costs */}
                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    LESS: FINANCE COSTS
                  </td>
                </tr>
                {groupedAccounts.financeCosts.map((acc) => {
                  const prevBalance =
                    previousGroupedAccounts.financeCosts.find((p) => p.id === acc.id)?.balance || 0;
                  const change = acc.balance - prevBalance;
                  const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                  return (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-[12px] text-gray-700 pl-6">{acc.name}</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(acc.balance)}
                      </td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-gray-700">
                        {money(prevBalance)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#dc2626]" : change < 0 ? "text-[#059669]" : "text-gray-700"}`}
                      >
                        {money(change)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-mono text-right ${change > 0 ? "text-[#dc2626]" : change < 0 ? "text-[#059669]" : "text-gray-700"}`}
                      >
                        {changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Finance Costs */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800">
                    Total Finance Costs
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(groupedAccounts.totalFinanceCosts)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800">
                    {money(previousGroupedAccounts.totalFinanceCosts)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalFinanceCosts - previousGroupedAccounts.totalFinanceCosts > 0 ? "text-[#dc2626]" : groupedAccounts.totalFinanceCosts - previousGroupedAccounts.totalFinanceCosts < 0 ? "text-[#059669]" : "text-gray-800"}`}
                  >
                    {money(
                      groupedAccounts.totalFinanceCosts - previousGroupedAccounts.totalFinanceCosts,
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-medium text-right ${groupedAccounts.totalFinanceCosts - previousGroupedAccounts.totalFinanceCosts > 0 ? "text-[#dc2626]" : groupedAccounts.totalFinanceCosts - previousGroupedAccounts.totalFinanceCosts < 0 ? "text-[#059669]" : "text-gray-800"}`}
                  >
                    {(previousGroupedAccounts.totalFinanceCosts !== 0
                      ? ((groupedAccounts.totalFinanceCosts -
                          previousGroupedAccounts.totalFinanceCosts) /
                          previousGroupedAccounts.totalFinanceCosts) *
                        100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    NET PROFIT BEFORE TAX
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(profitBeforeTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevProfitBeforeTax)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${profitBeforeTax - prevProfitBeforeTax > 0 ? "text-[#059669]" : profitBeforeTax - prevProfitBeforeTax < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {money(profitBeforeTax - prevProfitBeforeTax)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${profitBeforeTax - prevProfitBeforeTax > 0 ? "text-[#059669]" : profitBeforeTax - prevProfitBeforeTax < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {(prevProfitBeforeTax !== 0
                      ? ((profitBeforeTax - prevProfitBeforeTax) / prevProfitBeforeTax) * 100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>

                <tr className="bg-[#eef2ff] border-b-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider">
                    NET PROFIT AFTER TAX
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(netProfitAfterTax)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800">
                    {money(prevProfitBeforeTax)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${netProfitAfterTax - prevProfitBeforeTax > 0 ? "text-[#059669]" : netProfitAfterTax - prevProfitBeforeTax < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {money(netProfitAfterTax - prevProfitBeforeTax)}
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] font-mono font-bold text-right ${netProfitAfterTax - prevProfitBeforeTax > 0 ? "text-[#059669]" : netProfitAfterTax - prevProfitBeforeTax < 0 ? "text-[#dc2626]" : "text-gray-800"}`}
                  >
                    {(prevProfitBeforeTax !== 0
                      ? ((netProfitAfterTax - prevProfitBeforeTax) / prevProfitBeforeTax) * 100
                      : 0
                    ).toFixed(2)}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 4 && ( // Monthly Columnar
          <div className="bg-white border border-gray-200 rounded-md overflow-x-auto max-w-full">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-[#f5f6fa] z-10 border-r border-gray-200">
                    Particulars
                  </th>
                  {monthlyData.map((data, index) => (
                    <th
                      key={index}
                      className={`px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide min-w-[100px] ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {data.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-[#f5f6fa] z-10 border-r border-gray-200">
                    REVENUE
                  </td>
                  {monthlyData.map((_, index) => (
                    <td
                      key={index}
                      className={
                        _?.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""
                      }
                    ></td>
                  ))}
                </tr>
                {groupedAccounts.revenue.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700 pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">
                      {acc.name}
                    </td>
                    {monthlyData.map((data, index) => {
                      const mAcc = data.revenue?.find((a: any) => a.id === acc.id);
                      return (
                        <td
                          key={index}
                          className={`px-3 py-2 text-[12px] font-mono text-right text-gray-700 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                        >
                          {mAcc
                            ? money(mAcc.balance)
                            : data.month === "Annual"
                              ? money(acc.balance)
                              : "0.00"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    Total Revenue
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalRevenue)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-[#f5f6fa] z-10 border-r border-gray-200">
                    COST OF GOODS SOLD
                  </td>
                  {monthlyData.map((_, index) => (
                    <td
                      key={index}
                      className={
                        _?.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""
                      }
                    ></td>
                  ))}
                </tr>
                {groupedAccounts.cogs.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700 pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">
                      {acc.name}
                    </td>
                    {monthlyData.map((data, index) => {
                      const mAcc = data.cogs?.find((a: any) => a.id === acc.id);
                      return (
                        <td
                          key={index}
                          className={`px-3 py-2 text-[12px] font-mono text-right text-gray-700 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                        >
                          {mAcc
                            ? money(mAcc.balance)
                            : data.month === "Annual"
                              ? money(acc.balance)
                              : "0.00"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    Total COGS
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalCogs)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider sticky left-0 bg-[#eef2ff] z-10 border-r border-[#c7d2fe]">
                    GROSS PROFIT
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalRevenue - data.totalCogs)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-[#f5f6fa] z-10 border-r border-gray-200">
                    OPERATING EXPENSES
                  </td>
                  {monthlyData.map((_, index) => (
                    <td
                      key={index}
                      className={
                        _?.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""
                      }
                    ></td>
                  ))}
                </tr>
                {groupedAccounts.operatingExpenses.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700 pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">
                      {acc.name}
                    </td>
                    {monthlyData.map((data, index) => {
                      const mAcc = data.operatingExpenses?.find((a: any) => a.id === acc.id);
                      return (
                        <td
                          key={index}
                          className={`px-3 py-2 text-[12px] font-mono text-right text-gray-700 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                        >
                          {mAcc
                            ? money(mAcc.balance)
                            : data.month === "Annual"
                              ? money(acc.balance)
                              : "0.00"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    Total Operating Expenses
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalOperatingExpenses)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider sticky left-0 bg-[#eef2ff] z-10 border-r border-[#c7d2fe]">
                    OPERATING PROFIT
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalRevenue - data.totalCogs - data.totalOperatingExpenses)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-[#f5f6fa] z-10 border-r border-gray-200">
                    OTHER INCOME
                  </td>
                  {monthlyData.map((_, index) => (
                    <td
                      key={index}
                      className={
                        _?.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""
                      }
                    ></td>
                  ))}
                </tr>
                {groupedAccounts.otherIncome.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700 pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">
                      {acc.name}
                    </td>
                    {monthlyData.map((data, index) => {
                      const mAcc = data.otherIncome?.find((a: any) => a.id === acc.id);
                      return (
                        <td
                          key={index}
                          className={`px-3 py-2 text-[12px] font-mono text-right text-gray-700 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                        >
                          {mAcc
                            ? money(mAcc.balance)
                            : data.month === "Annual"
                              ? money(acc.balance)
                              : "0.00"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    Total Other Income
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalOtherIncome)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#f5f6fa] border-y border-gray-200">
                  <td className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-[#f5f6fa] z-10 border-r border-gray-200">
                    FINANCE COSTS
                  </td>
                  {monthlyData.map((_, index) => (
                    <td
                      key={index}
                      className={
                        _?.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""
                      }
                    ></td>
                  ))}
                </tr>
                {groupedAccounts.financeCosts.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-700 pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">
                      {acc.name}
                    </td>
                    {monthlyData.map((data, index) => {
                      const mAcc = data.financeCosts?.find((a: any) => a.id === acc.id);
                      return (
                        <td
                          key={index}
                          className={`px-3 py-2 text-[12px] font-mono text-right text-gray-700 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                        >
                          {mAcc
                            ? money(mAcc.balance)
                            : data.month === "Annual"
                              ? money(acc.balance)
                              : "0.00"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-2 text-[12px] font-medium text-gray-800 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    Total Finance Costs
                  </td>
                  {monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-[12px] font-mono font-medium text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                    >
                      {money(data.totalFinanceCosts)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#eef2ff] border-y-2 border-[#c7d2fe]">
                  <td className="px-3 py-2 text-[12px] font-bold text-gray-800 uppercase tracking-wider sticky left-0 bg-[#eef2ff] z-10 border-r border-[#c7d2fe]">
                    NET PROFIT
                  </td>
                  {monthlyData.map((data, index) => {
                    const gross = data.totalRevenue - data.totalCogs;
                    const opProf = gross - data.totalOperatingExpenses;
                    const net = opProf + data.totalOtherIncome - data.totalFinanceCosts;
                    return (
                      <td
                        key={index}
                        className={`px-3 py-2 text-[12px] font-mono font-bold text-right text-gray-800 ${data.month === "Annual" ? "bg-[#eef2ff] border-l-2 border-[#c7d2fe]" : ""}`}
                      >
                        {money(net)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitLoss;
