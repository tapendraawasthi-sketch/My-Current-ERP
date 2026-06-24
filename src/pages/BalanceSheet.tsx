// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { AccountType, VoucherStatus } from "../lib/types";
import { Printer, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const BalanceSheet: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, companySettings } = useStore();

  const fiscalEnd = currentFiscalYear?.endDate || "2027-07-15";
  const fiscalStart = currentFiscalYear?.startDate || "2026-07-16";

  const bsData = useMemo(() => {
    try {
      const postedVouchers = vouchers.filter(
        (v) => v.status === VoucherStatus.POSTED && v.date <= fiscalEnd
      );

      // Compute running balances from opening + all posted vouchers up to fiscal end
      const accountBalances = new Map<string, number>();

      // Start with opening balances
      for (const acc of accounts) {
        if (acc.isGroup) continue;
        const opDr = acc.openingBalanceDr || 0;
        const opCr = acc.openingBalanceCr || 0;
        accountBalances.set(acc.id, opDr - opCr);
      }

      // Add voucher effects
      for (const v of postedVouchers) {
        for (const line of v.lines) {
          const current = accountBalances.get(line.accountId) || 0;
          accountBalances.set(line.accountId, current + (line.debit || 0) - (line.credit || 0));
        }
      }

      // Categorize
      const assetAccounts = accounts.filter((a) => !a.isGroup && a.type === AccountType.ASSET);
      const liabilityAccounts = accounts.filter((a) => !a.isGroup && a.type === AccountType.LIABILITY);
      const equityAccounts = accounts.filter((a) => !a.isGroup && a.type === AccountType.EQUITY);

      const assetItems = assetAccounts
        .map((acc) => ({
          id: acc.id,
          name: acc.name,
          code: acc.code,
          amount: accountBalances.get(acc.id) || 0,
        }))
        .filter((i) => Math.abs(i.amount) > 0.01);

      const liabilityItems = liabilityAccounts
        .map((acc) => ({
          id: acc.id,
          name: acc.name,
          code: acc.code,
          amount: -(accountBalances.get(acc.id) || 0), // Liabilities have credit balance
        }))
        .filter((i) => Math.abs(i.amount) > 0.01);

      const equityItems = equityAccounts
        .map((acc) => ({
          id: acc.id,
          name: acc.name,
          code: acc.code,
          amount: -(accountBalances.get(acc.id) || 0), // Equity has credit balance
        }))
        .filter((i) => Math.abs(i.amount) > 0.01);

      // Compute current period net profit for retained earnings
      const incomeAccounts = accounts.filter((a) => !a.isGroup && a.type === AccountType.INCOME);
      const expenseAccounts = accounts.filter((a) => !a.isGroup && a.type === AccountType.EXPENSE);

      let totalIncome = 0;
      let totalExpense = 0;
      for (const acc of incomeAccounts) {
        totalIncome += -(accountBalances.get(acc.id) || 0);
      }
      for (const acc of expenseAccounts) {
        totalExpense += accountBalances.get(acc.id) || 0;
      }
      const netProfit = totalIncome - totalExpense;

      const totalAssets = assetItems.reduce((s, i) => s + i.amount, 0);
      const totalLiabilities = liabilityItems.reduce((s, i) => s + i.amount, 0);
      const totalEquity = equityItems.reduce((s, i) => s + i.amount, 0);
      const totalLiabAndEquity = totalLiabilities + totalEquity + netProfit;

      return {
        assetItems,
        liabilityItems,
        equityItems,
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
        totalEquity: Math.round(totalEquity * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        totalLiabAndEquity: Math.round(totalLiabAndEquity * 100) / 100,
        isBalanced: Math.abs(totalAssets - totalLiabAndEquity) < 1,
        difference: Math.round(Math.abs(totalAssets - totalLiabAndEquity) * 100) / 100,
        error: null,
      };
    } catch (error) {
      console.error("BalanceSheet computation error:", error);
      return {
        assetItems: [],
        liabilityItems: [],
        equityItems: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        netProfit: 0,
        totalLiabAndEquity: 0,
        isBalanced: false,
        difference: 0,
        error: String(error),
      };
    }
  }, [accounts, vouchers, fiscalEnd]);

  const handlePrint = () => window.print();

  const handleExport = () => {
    try {
      const rows: any[] = [];
      rows.push(["BALANCE SHEET", "", `As on ${fiscalEnd}`]);
      rows.push([]);
      rows.push(["ASSETS", "", ""]);
      rows.push(["Code", "Account", "Amount (Rs.)"]);
      bsData.assetItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "TOTAL ASSETS", bsData.totalAssets]);
      rows.push([]);
      rows.push(["LIABILITIES", "", ""]);
      bsData.liabilityItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "TOTAL LIABILITIES", bsData.totalLiabilities]);
      rows.push([]);
      rows.push(["EQUITY", "", ""]);
      bsData.equityItems.forEach((i) => rows.push([i.code, i.name, i.amount]));
      rows.push(["", "Current Period Profit", bsData.netProfit]);
      rows.push(["", "TOTAL EQUITY", bsData.totalEquity + bsData.netProfit]);
      rows.push([]);
      rows.push(["", "TOTAL LIABILITIES + EQUITY", bsData.totalLiabAndEquity]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
      XLSX.writeFile(wb, `BalanceSheet_${fiscalEnd}.xlsx`);
      toast.success("Exported to Excel");
    } catch {
      toast.error("Export failed");
    }
  };

  const renderSide = (
    title: string,
    items: { code: string; name: string; amount: number }[],
    total: number,
    totalLabel: string
  ) => (
    <div className="flex-1">
      <div className="bg-[#EBF5E2] border border-[#9DC07A] px-3 py-2 font-bold text-[12px] text-[#000000] uppercase tracking-wide">
        {title}
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-3 py-2 text-center text-[#000000] italic">
                No entries
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.code + item.name} className="border-b border-[#9DC07A]/30 hover:bg-[#EBF5E2]/30">
                <td className="px-3 py-1.5 text-[#000000]">
                  <span className="font-mono text-[10px] text-[#000000] mr-2">{item.code}</span>
                  {item.name}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[#000000] w-32">
                  Rs. {formatNumber(Math.abs(item.amount))}
                </td>
              </tr>
            ))
          )}
          <tr className="bg-[#D4EABD] border-t-2 border-[#9DC07A] font-bold">
            <td className="px-3 py-2 text-right text-[12px] text-[#000000] uppercase">
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
      <PillTitle title="Balance Sheet" />
      <FormPanel>
        <div className="flex flex-col gap-4 animate-fadeIn select-none">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[15px] font-semibold text-[#000000]">Balance Sheet</h1>
              <p className="text-[11px] text-[#000000] mt-0.5">
                As on {fiscalEnd} (FY {currentFiscalYear?.name || "—"})
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={handleExport}
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-[#9DC07A] bg-white text-[#000000] hover:bg-[#EBF5E2] flex items-center gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export
              </button>
              <button
                onClick={handlePrint}
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-[#9DC07A] bg-white text-[#000000] hover:bg-[#EBF5E2] flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </div>

          {/* Balance indicator */}
          <div className={`px-4 py-2 rounded-md border text-[12px] font-semibold ${bsData.isBalanced ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {bsData.isBalanced
              ? "✓ Balance Sheet is balanced (Assets = Liabilities + Equity)"
              : `✗ Unbalanced: Difference of Rs. ${formatNumber(bsData.difference)}`}
          </div>

          {bsData.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-[12px]">
              Error: {bsData.error}
            </div>
          )}

          {/* Two-column layout */}
          <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Assets */}
              {renderSide("Assets", bsData.assetItems, bsData.totalAssets, "Total Assets")}

              {/* Right: Liabilities & Equity */}
              <div className="flex-1">
                {renderSide(
                  "Liabilities",
                  bsData.liabilityItems,
                  bsData.totalLiabilities,
                  "Total Liabilities"
                )}
                <div className="mt-4">
                  {renderSide(
                    "Equity & Reserves",
                    [
                      ...bsData.equityItems,
                      { code: "—", name: "Current Period Net Profit", amount: bsData.netProfit },
                    ],
                    bsData.totalEquity + bsData.netProfit,
                    "Total Equity"
                  )}
                </div>
                <div className="bg-[#C9DEB5] border-2 border-[#000000] rounded-md px-4 py-3 mt-4 flex justify-between items-center">
                  <span className="text-[12px] font-bold text-[#000000] uppercase">
                    Total Liabilities + Equity
                  </span>
                  <span className="text-[15px] font-bold font-mono text-[#000000]">
                    Rs. {formatNumber(Math.abs(bsData.totalLiabAndEquity))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormPanel>
    </div>
  );
};

export default BalanceSheet;
