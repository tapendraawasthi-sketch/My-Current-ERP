import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell, { type ReportDepth } from "../components/reports/ReportShell";
import AccountTreeRenderer, { type ReportNode } from "../components/reports/AccountTreeRenderer";
import { AccountType } from "../lib/types";

function buildTree(accounts: any[], type: AccountType, balanceMap: Record<string, number>): ReportNode[] {
  // Roots: no parent of this type
  const byId = new Map(accounts.map(a => [a.id, a]));

  function makeNode(acc: any): ReportNode {
    const children: ReportNode[] = accounts
      .filter(a => a.parentId === acc.id && a.type === type)
      .map(makeNode);

    const childrenBalance = children.reduce((s, c) => s + c.balance, 0);
    const ownBalance = Number(balanceMap[acc.id] ?? acc.balance ?? 0);
    const balance = acc.isGroup ? childrenBalance : ownBalance;

    return {
      id: acc.id,
      name: acc.name,
      code: acc.code,
      level: acc.level === "group" ? "group" : acc.level === "subgroup" ? "subgroup" : "ledger",
      balance,
      isGroup: !!acc.isGroup,
      children,
    };
  }

  return accounts
    .filter(a => a.type === type && (!a.parentId || !byId.has(a.parentId) || byId.get(a.parentId)?.type !== type))
    .map(makeNode);
}

export default function BalanceSheet() {
  const { accounts, vouchers, currentFiscalYear } = useStore();
  const [asOf, setAsOf] = useState(
    currentFiscalYear?.endDate ?? new Date().toISOString().split("T")[0]
  );

  // Compute ledger balances up to asOf
  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const acc of accounts) {
      map[acc.id] = Number(acc.openingBalanceDr ?? 0) - Number(acc.openingBalanceCr ?? 0);
    }
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      if (v.date > asOf) continue;
      for (const line of v.lines || []) {
        if (!line.accountId) continue;
        if (!map[line.accountId]) map[line.accountId] = 0;
        map[line.accountId] += Number(line.debit || 0) - Number(line.credit || 0);
      }
    }
    return map;
  }, [accounts, vouchers, asOf]);

  const assetTree    = useMemo(() => buildTree(accounts, AccountType.ASSET, balanceMap), [accounts, balanceMap]);
  const liabilityTree= useMemo(() => buildTree(accounts, AccountType.LIABILITY, balanceMap), [accounts, balanceMap]);
  const equityTree   = useMemo(() => buildTree(accounts, AccountType.EQUITY, balanceMap), [accounts, balanceMap]);

  const totalAssets      = assetTree.reduce((s, n) => s + n.balance, 0);
  const totalLiabilities = liabilityTree.reduce((s, n) => s + Math.abs(n.balance), 0);
  const totalEquity      = equityTree.reduce((s, n) => s + Math.abs(n.balance), 0);
  const totalLiabEq      = totalLiabilities + totalEquity;

  return (
    <ReportShell
      title="Balance Sheet"
      subtitle={`As of ${asOf}`}
      onPrint={() => window.print()}
    >
      {(depth: ReportDepth) => (
        <div>
          {/* As-of date */}
          <div className="mb-4 flex gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">As of Date</label>
              <input
                type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ASSETS */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#e8f0fe] border-b border-[#c7d2fe]">
                <h2 className="text-[13px] font-bold text-[#1557b0]">Assets</h2>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  <AccountTreeRenderer nodes={assetTree} depth={depth} creditNature={false} />
                </tbody>
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 font-bold text-[12px] text-gray-800">Total Assets</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[12px] font-mono text-[#1557b0]">
                      Rs. {formatNumber(totalAssets)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* LIABILITIES + EQUITY */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                  <h2 className="text-[13px] font-bold text-red-700">Liabilities</h2>
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    <AccountTreeRenderer nodes={liabilityTree} depth={depth} creditNature={true} />
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50 border-t-2 border-red-200">
                      <td className="px-3 py-2.5 font-bold text-[12px] text-gray-800">Total Liabilities</td>
                      <td className="px-3 py-2.5 text-right font-bold text-[12px] font-mono text-red-700">
                        Rs. {formatNumber(totalLiabilities)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
                  <h2 className="text-[13px] font-bold text-purple-700">Equity</h2>
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    <AccountTreeRenderer nodes={equityTree} depth={depth} creditNature={true} />
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 border-t-2 border-purple-200">
                      <td className="px-3 py-2.5 font-bold text-[12px] text-gray-800">Total Equity</td>
                      <td className="px-3 py-2.5 text-right font-bold text-[12px] font-mono text-purple-700">
                        Rs. {formatNumber(totalEquity)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Grand total */}
              <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="font-bold text-[12px] text-gray-800">Total Liabilities + Equity</span>
                <span className="font-bold text-[14px] font-mono text-[#1557b0]">
                  Rs. {formatNumber(totalLiabEq)}
                </span>
              </div>
              <div
                className={`rounded-lg px-4 py-2.5 text-[11px] font-semibold flex items-center gap-2
                  ${Math.abs(totalAssets - totalLiabEq) < 1
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"}`}
              >
                {Math.abs(totalAssets - totalLiabEq) < 1 ? "✓ Balance Sheet is balanced" :
                  `⚠ Difference: Rs. ${formatNumber(Math.abs(totalAssets - totalLiabEq))}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
