// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import { formatADToBS } from "../lib/nepaliDate";
import { generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Download, Printer, Search, Calendar, ChevronDown, ChevronUp, RotateCcw, ChevronRight } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

// Helper function to compute account balance
function getAccountBalance(accountId: string, vouchers: any[], startDate?: string, endDate?: string) {
  let balance = 0;
  for (const v of vouchers) {
    if (v.status !== "posted") continue;
    if (startDate && v.date < startDate) continue;
    if (endDate && v.date > endDate) continue;
    for (const line of v.lines || []) {
      if (line.accountId === accountId) {
        balance += (line.debit || 0) - (line.credit || 0);
      }
    }
  }
  return balance;
}

export function computeTrialBalance(accounts: any[], vouchers: any[], fromAD: string, toAD: string) {
  const balances: Record<string, { debit: number; credit: number }> = {};

  // Initialize all accounts with zero balances
  for (const acc of accounts) {
    balances[acc.id] = { debit: 0, credit: 0 };
  }

  // Process vouchers within date range
  for (const v of vouchers) {
    if (v.status !== "posted") continue;
    if (v.date < fromAD || v.date > toAD) continue;
    for (const line of v.lines || []) {
      if (!balances[line.accountId]) continue;
      if (line.debit) {
        balances[line.accountId].debit += line.debit;
      }
      if (line.credit) {
        balances[line.accountId].credit += line.credit;
      }
    }
  }

  // Calculate totals
  let totalDebit = 0;
  let totalCredit = 0;
  for (const bal of Object.values(balances)) {
    totalDebit += bal.debit;
    totalCredit += bal.credit;
  }

  return { balances, totalDebit, totalCredit };
}

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, fiscalYears, currentFiscalYear, companySettings } = useStore();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate || "");
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0); // 0: Standard, 1: Condensed, 2: Vertical, 3: Comparative, 4: Cost Center
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Compute trial balance data
  const computeTrialBalance = (accs: any[], vouchs: any[], fromAD: string, toAD: string) => {
    const balances: Record<string, { debit: number; credit: number }> = {};
    const groupTotals: Record<string, { debit: number; credit: number }> = {};

    // Initialize all accounts with zero balances
    for (const acc of accs) {
      balances[acc.id] = { debit: 0, credit: 0 };
      if (acc.groupId && !groupTotals[acc.groupId]) {
        groupTotals[acc.groupId] = { debit: 0, credit: 0 };
      }
    }

    // Process vouchers within date range
    for (const v of vouchs) {
      if (v.status !== "posted") continue;
      if (v.date < fromAD || v.date > toAD) continue;
      for (const line of v.lines || []) {
        if (!balances[line.accountId]) continue;
        if (line.debit) {
          balances[line.accountId].debit += line.debit;
        }
        if (line.credit) {
          balances[line.accountId].credit += line.credit;
        }
      }
    }

    // Aggregate into groups
    for (const [accId, bal] of Object.entries(balances)) {
      const account = accs.find(a => a.id === accId);
      if (account && account.groupId) {
        if (!groupTotals[account.groupId]) {
          groupTotals[account.groupId] = { debit: 0, credit: 0 };
        }
        groupTotals[account.groupId].debit += bal.debit;
        groupTotals[account.groupId].credit += bal.credit;
      }
    }

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    for (const bal of Object.values(balances)) {
      totalDebit += bal.debit;
      totalCredit += bal.credit;
    }

    return { balances, groupTotals, totalDebit, totalCredit };
  };

  const { balances, groupTotals, totalDebit, totalCredit } = useMemo(() => {
    return computeTrialBalance(accounts, vouchers, fromDate, toDate);
  }, [accounts, vouchers, fromDate, toDate]);

  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01;

  const exportToExcel = () => {
    const data = [];
    data.push(["Trial Balance", "", "", ""]);
    data.push(["Company:", companySettings?.name || "—", "Period:", `${formatADToBS(fromDate)} to ${formatADToBS(toDate)}`]);
    data.push(["", "", "", ""]);
    data.push(["Account Name", "Debit", "Credit", "Balance"]);
    
    // Add account lines
    accounts.forEach(acc => {
      const balance = balances[acc.id];
      if (!showZeroBalances && Math.abs(balance.debit - balance.credit) < 0.01) return;
      
      const accountName = acc.parentId ? `  ${acc.name}` : acc.name; // Indent child accounts
      data.push([
        accountName,
        balance.debit,
        balance.credit,
        balance.debit - balance.credit
      ]);
    });
    
    data.push(["", "", "", ""]);
    data.push(["TOTALS", totalDebit, totalCredit, totalDebit - totalCredit]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    XLSX.writeFile(wb, `Trial_Balance_${formatADToBS(fromDate)}_to_${formatADToBS(toDate)}.xlsx`);
    toast.success("Trial Balance exported to Excel");
  };

  const periodEnd = formatADToBS(toDate);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">As of {periodEnd} — All posted vouchers</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToExcel}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              Export Excel
            </button>
            <button className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">
              Print
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-md mb-4">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-600">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 px-2 text-[12px] border border-gray-300 rounded bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-600">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 px-2 text-[12px] border border-gray-300 rounded bg-white"
            />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <input
              type="checkbox"
              id="showZeros"
              checked={showZeroBalances}
              onChange={(e) => setShowZeroBalances(e.target.checked)}
              className="h-4 w-4 text-[#1557b0] rounded border-gray-300"
            />
            <label htmlFor="showZeros" className="text-[12px] text-gray-700">Show Zero Balances</label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 h-7 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]"
              />
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-md mb-3 text-[12px] font-medium ${
          isBalanced
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {isBalanced ? "✓ Trial Balance: Balanced" : `⚠ Trial Balance: Unbalanced — Difference: ${money(diff)}`}
        </div>

        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right first:text-left">
                  Account Name
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                  Debit
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                  Credit
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f3f4f6] border-b border-gray-200 text-right">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => {
                const balance = balances[acc.id];
                const netBalance = balance.debit - balance.credit;
                
                if (!showZeroBalances && Math.abs(netBalance) < 0.01) return null;
                if (searchTerm && !acc.name.toLowerCase().includes(searchTerm.toLowerCase())) return null;

                return (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 border-b border-gray-100 first:text-left">
                      {acc.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700 border-b border-gray-100">
                      {balance.debit > 0 ? money(balance.debit) : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700 border-b border-gray-100">
                      {balance.credit > 0 ? money(balance.credit) : ""}
                    </td>
                    <td className={`px-3 py-2 font-mono text-right text-gray-700 border-b border-gray-100 ${
                      netBalance < 0 ? "text-[#dc2626]" : netBalance === 0 ? "text-gray-400" : ""
                    }`}>
                      {money(netBalance)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="px-3 py-2.5 font-bold text-gray-900 bg-[#f3f4f6] border-t-2 border-gray-300 first:text-left">
                  TOTALS
                </td>
                <td className="px-3 py-2.5 font-bold text-gray-900 bg-[#f3f4f6] border-t-2 border-gray-300 font-mono text-right">
                  {money(totalDebit)}
                </td>
                <td className="px-3 py-2.5 font-bold text-gray-900 bg-[#f3f4f6] border-t-2 border-gray-300 font-mono text-right">
                  {money(totalCredit)}
                </td>
                <td className="px-3 py-2.5 font-bold text-gray-900 bg-[#f3f4f6] border-t-2 border-gray-300 font-mono text-right">
                  {money(totalDebit - totalCredit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrialBalance;
