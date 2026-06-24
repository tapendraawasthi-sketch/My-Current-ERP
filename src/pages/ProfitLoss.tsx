// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { AccountType, VoucherStatus } from "../lib/types";
import { Printer, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, invoices, currentFiscalYear, companySettings } = useStore();

  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";
  const fiscalEnd = currentFiscalYear?.endDate || "2027-07-15";

  const plData = useMemo(() => {
    try {
      // Filter posted vouchers within fiscal year
      const postedVouchers = vouchers.filter(
        (v) => v.status === VoucherStatus.POSTED && v.date >= fiscalStart && v.date <= fiscalEnd
      );

      // Compute balances for income and expense accounts
      const accountBalances = new Map<string, number>();

      for (const v of postedVouchers) {
        for (const line of v.lines) {
          const current = accountBalances.get(line.accountId) || 0;
          const effect = (line.debit || 0) - (line.credit || 0);
          accountBalances.set(line.accountId, current + effect);
        }
      }

      // Separate income and expense ledgers
      const incomeAccounts = accounts.filter(
        (a) => !a.isGroup && a.type === AccountType.INCOME
      );
      const expenseAccounts = accounts.filter(
        (a) => !a.isGroup && a.type === AccountType.EXPENSE
      );

      // For income accounts, credit balance is positive income
      // Income: Cr - Dr = positive means income earned
      const incomeItems = incomeAccounts
        .map((acc) => {
          const netMovement = accountBalances.get(acc.id) || 0;
          // For income, a credit excess means income, so negate
          const amount = -netMovement; // credits are negative in Dr-Cr, so negate
          return { id: acc.id, name: acc.name, code: acc.code, group: acc.group || "", amount };
        })
        .filter((item) => Math.abs(item.amount) > 0.01);

      // For expense accounts, debit balance is positive expense
      const expenseItems = expenseAccounts
        .map((acc) => {
          const netMovement = accountBalances.get(acc.id) || 0;
          // For expense, a debit excess means expense
          const amount = netMovement;
          return { id: acc.id, name: acc.name, code: acc.code, group: acc.group || "", amount };
        })
        .filter((item) => Math.abs(item.amount) > 0.01);

      // Categorize income
      const salesItems = incomeItems.filter(
        (i) =>
          i.group.toLowerCase().includes("sales") ||
          i.name.toLowerCase().includes("sales")
      );
      const otherIncomeItems = incomeItems.filter(
        (i) => !salesItems.includes(i)
      );

      // Categorize expenses
      const purchaseItems = expenseItems.filter(
        (i) =>
          i.group.toLowerCase().includes("purchase") ||
          i.name.toLowerCase().includes("purchase") ||
          i.group.toLowerCase().includes("direct") ||
          i.group.toLowerCase().includes("cost of goods")
      );
      const operatingExpenseItems = expenseItems.filter(
        (i) => !purchaseItems.includes(i)
      );

      const totalSales = salesItems.reduce((s, i) => s + i.amount, 0);
      const totalOtherIncome = otherIncomeItems.reduce((s, i) => s + i.amount, 0);
      const totalPurchases = purchaseItems.reduce((s, i) => s + i.amount, 0);
      const totalOperating = operatingExpenseItems.reduce((s, i) => s + i.amount, 0);

      const grossProfit = totalSales - totalPurchases;
      const netProfit = grossProfit + totalOtherIncome - totalOperating;

      return {
        salesItems,
        otherIncomeItems,
        purchaseItems,
        operatingExpenseItems,
        totalSales: Math.round(totalSales * 100) / 100,
        totalOtherIncome: Math.round(totalOtherIncome * 100) / 100,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        totalOperating: Math.round(totalOperating * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        error: null,
      };
    } catch (error) {
      console.error("ProfitLoss computation error:", error);
      return {
        salesItems: [],
        otherIncomeItems: [],
        purchaseItems: [],
        operatingExpenseItems: [],
        totalSales: 0,
        totalOtherIncome: 0,
        totalPurchases: 0,
        totalOperating: 0,
        grossProfit: 0,
        netProfit: 0,
        error: String(error),
      };
    }
  }, [accounts, vouchers, fiscalStart, fiscalEnd]);

  const handlePrint = () => window.print();

  const handleExport = () => {
    try {
      const rows: any[] = [];
      rows.push(["", "PROFIT & LOSS STATEMENT", ""]);
      rows.push(["", `Period: ${fiscalStart} to ${fiscalEnd}`, ""]);
      rows.push([]);
      rows.push(["", "INCOME", ""]);
      rows.push(["Code", "Account Name", "Amount (Rs.)"]);
      plData.salesItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "Total Sales Revenue", plData.totalSales]);
      rows.push([]);
      plData.otherIncomeItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "Total Other Income", plData.totalOtherIncome]);
      rows.push([]);
      rows.push(["", "EXPENSES", ""]);
      plData.purchaseItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "Total Cost of Sales", plData.totalPurchases]);
      rows.push([]);
      rows.push(["", "GROSS PROFIT", plData.grossProfit]);
      rows.push([]);
      plData.operatingExpenseItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "Total Operating Expenses", plData.totalOperating]);
      rows.push([]);
      rows.push(["", "NET PROFIT / (LOSS)", plData.netProfit]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
      XLSX.writeFile(wb, `ProfitLoss_${fiscalStart}_to_${fiscalEnd}.xlsx`);
      toast.success("Exported to Excel");
    } catch {
      toast.error("Export failed");
    }
  };

  const renderSection = (
    title: string,
    items: { code: string; name: string; amount: number }[],
    total: number,
    totalLabel: string
  ) => (
    <div className="mb-4">
      <div className="bg-[#EBF5E2] border border-[#9DC07A] px-3 py-2 font-bold text-[12px] text-[#000000] uppercase tracking-wide">
        {title}
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-2 text-center text-[#000000] italic">
                No entries
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.code + item.name} className="border-b border-[#9DC07A]/30 hover:bg-[#EBF5E2]/30">
                <td className="px-3 py-1.5 font-mono text-[11px] text-[#000000] w-20">{item.code}</td>
                <td className="px-3 py-1.5 text-[#000000]">{item.name}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[#000000] w-32">
                  Rs. {formatNumber(Math.abs(item.amount))}
                </td>
              </tr>
            ))
          )}
          <tr className="bg-[#D4EABD] border-t-2 border-[#9DC07A] font-bold">
            <td colSpan={2} className="px-3 py-2 text-right text-[12px] text-[#000000] uppercase">
              {totalLabel}
            </td>
            <td className="px-3 py-2 text-right font-mono text-[#000000] w-32">
              Rs. {formatNumber(Math.abs(total))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ background: "#e8e4f0", padding: 12 }}>
      <PillTitle title="Profit & Loss Statement" />
      <FormPanel>
        <div className="flex flex-col gap-4 animate-fadeIn select-none">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[15px] font-semibold text-[#000000]">Profit & Loss Statement</h1>
              <p className="text-[11px] text-[#000000] mt-0.5">
                Period: {fiscalStart} to {fiscalEnd} (FY {currentFiscalYear?.name || "—"})
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={handleExport}
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-[#9DC07A] bg-white text-[#000000] hover:bg-[#EBF5E2] flex items-center gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
              </button>
              <button
                onClick={handlePrint}
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-[#9DC07A] bg-white text-[#000000] hover:bg-[#EBF5E2] flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </div>

          {plData.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-[12px]">
              Error computing report: {plData.error}
            </div>
          )}

          {/* Report Body */}
          <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden">
            {/* Company Header for Print */}
            <div className="text-center py-3 border-b border-[#9DC07A] print-only hidden">
              <h2 className="text-[14px] font-bold text-[#000000]">
                {companySettings?.name || "Company"}
              </h2>
              <p className="text-[11px] text-[#000000]">
                Profit & Loss Statement for {fiscalStart} to {fiscalEnd}
              </p>
            </div>

            <div className="p-4">
              {/* Income */}
              {renderSection(
                "Sales Revenue",
                plData.salesItems,
                plData.totalSales,
                "Total Sales Revenue"
              )}

              {renderSection(
                "Other Income",
                plData.otherIncomeItems,
                plData.totalOtherIncome,
                "Total Other Income"
              )}

              {/* Cost of Sales */}
              {renderSection(
                "Cost of Sales / Purchases",
                plData.purchaseItems,
                plData.totalPurchases,
                "Total Cost of Sales"
              )}

              {/* Gross Profit */}
              <div className="bg-[#D4EABD] border-2 border-[#9DC07A] rounded-md px-4 py-3 mb-4 flex justify-between items-center">
                <span className="text-[13px] font-bold text-[#000000] uppercase">Gross Profit</span>
                <span className={`text-[15px] font-bold font-mono ${plData.grossProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  Rs. {formatNumber(Math.abs(plData.grossProfit))}
                  {plData.grossProfit < 0 ? " (Loss)" : ""}
                </span>
              </div>

              {/* Operating Expenses */}
              {renderSection(
                "Operating Expenses",
                plData.operatingExpenseItems,
                plData.totalOperating,
                "Total Operating Expenses"
              )}

              {/* Net Profit */}
              <div className="bg-[#C9DEB5] border-2 border-[#000000] rounded-md px-4 py-4 flex justify-between items-center">
                <span className="text-[14px] font-bold text-[#000000] uppercase">
                  Net Profit / (Loss)
                </span>
                <span className={`text-[18px] font-bold font-mono ${plData.netProfit >= 0 ? "text-green-800" : "text-red-800"}`}>
                  Rs. {formatNumber(Math.abs(plData.netProfit))}
                  {plData.netProfit < 0 ? " (Loss)" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </FormPanel>
    </div>
  );
};

export default ProfitLoss;
