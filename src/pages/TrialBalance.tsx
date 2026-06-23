/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trial Balance report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Button, NepaliDatePicker } from "../components/ui";
import { FileSpreadsheet, Printer, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { computeTrialBalance } from "../lib/accounting";
import { exportTrialBalanceToExcel } from "../lib/exportUtils";
import { formatNumber } from "../lib/utils";
import { AccountType } from "../lib/types";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../components/BusyShell";

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear, invoices } = useStore();

  const [asOfDate, setAsOfDate] = useState(currentFiscalYear?.endDate || "2027-07-15");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentFiscalYear) {
      setAsOfDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const rawRows = useMemo(() => {
    if (!currentFiscalYear) return [];
    return computeTrialBalance(
      accounts,
      vouchers,
      invoices,
      asOfDate,
      currentFiscalYear.startDate
    );
  }, [accounts, vouchers, invoices, asOfDate, currentFiscalYear]);

  // Group by Nature
  const groupedRows = useMemo(() => {
    const groups: Record<string, typeof rawRows> = {
      [AccountType.ASSET]: [],
      [AccountType.LIABILITY]: [],
      [AccountType.INCOME]: [],
      [AccountType.EXPENSE]: [],
    };

    rawRows.forEach((row) => {
      if (groups[row.nature]) {
        groups[row.nature].push(row);
      }
    });

    return groups;
  }, [rawRows]);

  const totals = useMemo(() => {
    let openingDr = 0, openingCr = 0;
    let periodDebit = 0, periodCredit = 0;
    let closingDr = 0, closingCr = 0;

    rawRows.forEach((r) => {
      openingDr += r.openingDr;
      openingCr += r.openingCr;
      periodDebit += r.periodDebit;
      periodCredit += r.periodCredit;
      closingDr += r.closingDr;
      closingCr += r.closingCr;
    });

    return { openingDr, openingCr, periodDebit, periodCredit, closingDr, closingCr };
  }, [rawRows]);

  const isImbalanced = Math.abs(totals.closingDr - totals.closingCr) > 0.01;
  const imbalanceAmount = Math.abs(totals.closingDr - totals.closingCr);

  const toggleGroup = (nature: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(nature)) {
      next.delete(nature);
    } else {
      next.add(nature);
    }
    setCollapsedGroups(next);
  };

  const handleExport = () => {
    if (rawRows.length === 0) {
      toast.error("No data to export");
      return;
    }
    exportTrialBalanceToExcel(rawRows as any, `Trial_Balance_${asOfDate}.xlsx`);
    toast.success("Trial Balance Exported");
  };

  const handlePrint = () => {
    window.print();
  };

  const renderGroup = (nature: string, label: string) => {
    const rows = groupedRows[nature];
    if (!rows || rows.length === 0) return null;

    const isCollapsed = collapsedGroups.has(nature);

    const groupOpeningDr = rows.reduce((s, r) => s + r.openingDr, 0);
    const groupOpeningCr = rows.reduce((s, r) => s + r.openingCr, 0);
    const groupPeriodDr = rows.reduce((s, r) => s + r.periodDebit, 0);
    const groupPeriodCr = rows.reduce((s, r) => s + r.periodCredit, 0);
    const groupClosingDr = rows.reduce((s, r) => s + r.closingDr, 0);
    const groupClosingCr = rows.reduce((s, r) => s + r.closingCr, 0);

    return (
      <React.Fragment key={nature}>
        {/* Group Header Row */}
        <tr
          className="bg-[#f8fafc] border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => toggleGroup(nature)}
        >
          <td className="px-3 py-2 text-[12px] font-semibold text-gray-800 flex items-center gap-1">
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {label}
          </td>
          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold">{groupOpeningDr > 0 ? formatNumber(groupOpeningDr) : ""}</td>
          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold">{groupOpeningCr > 0 ? formatNumber(groupOpeningCr) : ""}</td>
          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold">{groupPeriodDr > 0 ? formatNumber(groupPeriodDr) : ""}</td>
          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold">{groupPeriodCr > 0 ? formatNumber(groupPeriodCr) : ""}</td>
          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold text-[#1557b0]">{groupClosingDr > 0 ? formatNumber(groupClosingDr) : ""}</td>
          <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold text-[#1557b0]">{groupClosingCr > 0 ? formatNumber(groupClosingCr) : ""}</td>
        </tr>

        {/* Children Rows */}
        {!isCollapsed &&
          rows.map((r) => (
            <tr key={r.accountId} className="border-b border-gray-100 hover:bg-[#f5f6fa] transition-colors">
              <td className="px-3 py-2 text-[12px] text-gray-700 pl-8">{r.accountName}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-600">{r.openingDr ? formatNumber(r.openingDr) : ""}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-600">{r.openingCr ? formatNumber(r.openingCr) : ""}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-600">{r.periodDebit ? formatNumber(r.periodDebit) : ""}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-600">{r.periodCredit ? formatNumber(r.periodCredit) : ""}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-800">{r.closingDr ? formatNumber(r.closingDr) : ""}</td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-800">{r.closingCr ? formatNumber(r.closingCr) : ""}</td>
            </tr>
          ))}
      </React.Fragment>
    );
  };

  return (
    <div style={{ background: "#e8e4f0", padding: 12 }}>
      <PillTitle title="Trial Balance" />
      <FormPanel>
        <div className="flex flex-col gap-6 animate-fadeIn select-none">
          {/* Print Header */}
          <div className="print-only hidden mb-6 text-center">
            <h1 className="text-xl font-bold">{companySettings?.companyNameEn || "Sutra ERP"}</h1>
            <h2 className="text-lg font-semibold mt-1">Trial Balance</h2>
            <p className="text-sm text-gray-600 mt-1">As of: {asOfDate}</p>
          </div>

          <div className="flex items-center justify-between mb-4 no-print">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Summary of all ledger balances</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={handleExport}
              >
                Export Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
              >
                Print
              </Button>
            </div>
          </div>

          <div className="report-toolbar no-print mb-3">
            <div className="grid gap-4 lg:grid-cols-4">
              <NepaliDatePicker label="As of Date" value={asOfDate} onChange={setAsOfDate} />
            </div>
          </div>

          {isImbalanced && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="text-[13px] font-bold">Imbalance Detected</p>
                <p className="text-[11px]">Difference Amount: Rs. {formatNumber(imbalanceAmount)}</p>
              </div>
            </div>
          )}

          <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th rowSpan={2} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide align-middle border-r border-gray-200">Particulars</th>
                  <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-r border-gray-200">Opening Balance</th>
                  <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-r border-gray-200">Transactions</th>
                  <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Closing Balance</th>
                </tr>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Debit</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Credit</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Debit</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Credit</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Debit</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {renderGroup(AccountType.ASSET, "Assets")}
                {renderGroup(AccountType.LIABILITY, "Liabilities")}
                {renderGroup(AccountType.INCOME, "Income")}
                {renderGroup(AccountType.EXPENSE, "Expenses")}

                {rawRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400 text-[12px]">
                      No balances to display.
                    </td>
                  </tr>
                )}
              </tbody>
              {rawRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 pl-3">Grand Total</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{totals.openingDr > 0 ? formatNumber(totals.openingDr) : ""}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{totals.openingCr > 0 ? formatNumber(totals.openingCr) : ""}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#1557b0]">{totals.periodDebit > 0 ? formatNumber(totals.periodDebit) : ""}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-600">{totals.periodCredit > 0 ? formatNumber(totals.periodCredit) : ""}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#1557b0]">{totals.closingDr > 0 ? formatNumber(totals.closingDr) : ""}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-600">{totals.closingCr > 0 ? formatNumber(totals.closingCr) : ""}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </FormPanel>
    </div>
  );
};

export default TrialBalance;
