import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell, { type ReportDepth } from "../components/reports/ReportShell";
import AccountTreeRenderer, { type ReportNode } from "../components/reports/AccountTreeRenderer";
import { AccountType } from "../lib/types";

function buildPLTree(accounts: any[], type: AccountType, txMap: Record<string, number>): ReportNode[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  function makeNode(acc: any): ReportNode {
    const children: ReportNode[] = accounts
      .filter(a => a.parentId === acc.id && a.type === type)
      .map(makeNode);
    const childrenBalance = children.reduce((s, c) => s + c.balance, 0);
    const ownBalance = Number(txMap[acc.id] ?? 0);
    return {
      id: acc.id,
      name: acc.name,
      code: acc.code,
      level: acc.level === "group" ? "group" : acc.level === "subgroup" ? "subgroup" : "ledger",
      balance: acc.isGroup ? childrenBalance : ownBalance,
      isGroup: !!acc.isGroup,
      children,
    };
  }
  return accounts
    .filter(a => a.type === type && (!a.parentId || !byId.has(a.parentId) || byId.get(a.parentId)?.type !== type))
    .map(makeNode);
}

export default function ProfitLoss() {
  const { accounts, vouchers, invoices, currentFiscalYear } = useStore();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate ?? "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate ?? new Date().toISOString().split("T")[0]);

  const txMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const d = v.date || "";
      if (fromDate && d < fromDate) continue;
      if (toDate && d > toDate) continue;
      for (const line of v.lines || []) {
        if (!line.accountId) continue;
        if (!map[line.accountId]) map[line.accountId] = 0;
        // Income: credits increase, Expense: debits increase
        map[line.accountId] += Number(line.credit || 0) - Number(line.debit || 0);
      }
    }
    return map;
  }, [vouchers, fromDate, toDate]);

  const incomeTree  = useMemo(() => buildPLTree(accounts, AccountType.INCOME, txMap), [accounts, txMap]);
  const expenseTree = useMemo(() => buildPLTree(accounts, AccountType.EXPENSE, txMap), [accounts, txMap]);

  const totalIncome  = incomeTree.reduce((s, n) => s + n.balance, 0);
  const totalExpense = Math.abs(expenseTree.reduce((s, n) => s + n.balance, 0));
  const netProfit    = totalIncome - totalExpense;

  return (
    <ReportShell
      title="Profit & Loss Statement"
      subtitle={`Period: ${fromDate} to ${toDate}`}
      onPrint={() => window.print()}
    >
      {(depth: ReportDepth) => (
        <div>
          {/* Filters */}
          <div className="mb-4 flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100">
                <h2 className="text-[13px] font-bold text-green-700">Income</h2>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  <AccountTreeRenderer nodes={incomeTree} depth={depth} creditNature={true} />
                </tbody>
                <tfoot>
                  <tr className="bg-green-50 border-t-2 border-green-200">
                    <td className="px-3 py-2.5 font-bold text-[12px] text-gray-800">Total Income</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[12px] font-mono text-green-700">
                      Rs. {formatNumber(totalIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Expense */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <h2 className="text-[13px] font-bold text-amber-700">Expenses</h2>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  <AccountTreeRenderer nodes={expenseTree} depth={depth} creditNature={false} />
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td className="px-3 py-2.5 font-bold text-[12px] text-gray-800">Total Expenses</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[12px] font-mono text-amber-700">
                      Rs. {formatNumber(totalExpense)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net Profit / Loss */}
          <div
            className={`mt-4 rounded-lg px-5 py-4 flex justify-between items-center border
              ${netProfit >= 0
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"}`}
          >
            <span className={`font-bold text-[14px] ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              {netProfit >= 0 ? "Net Profit" : "Net Loss"}
            </span>
            <span className={`font-bold text-[18px] font-mono ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              Rs. {formatNumber(Math.abs(netProfit))}
            </span>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
