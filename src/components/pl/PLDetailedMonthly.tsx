// src/components/pl/PLDetailedMonthly.tsx
import React, { useMemo } from "react";
import type { PLComputation, PLReportOptions, PLDrillState } from "../../lib/plTypes";

const fmt = (n: number) =>
  n === 0 ? "—" :
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  pl: PLComputation;
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
}

export default function PLDetailedMonthly({ pl, options, onDrillDown }: Props) {
  if (!pl.monthlyData || !pl.monthLabels) {
    return <div className="p-4 text-center text-gray-500">Monthly data not available.</div>;
  }

  // Flatten accounts from sections to display
  const accounts = useMemo(() => {
    const list: Array<{ id: string, name: string, group: string, nature: "debit" | "credit", total: number }> = [];
    
    const addSection = (section: any, groupName: string, nature: "debit" | "credit") => {
      section.lines.forEach((l: any) => {
        if (!l.isGroup) {
          list.push({
            id: l.accountId,
            name: l.accountName,
            group: groupName,
            nature,
            total: l.absBalance
          });
        }
      });
    };

    addSection(pl.sales, "Sales", "credit");
    addSection(pl.directIncome, "Direct Income", "credit");
    addSection(pl.purchases, "Purchases", "debit");
    addSection(pl.directExpenses, "Direct Expenses", "debit");
    addSection(pl.indirectIncome, "Indirect Income", "credit");
    addSection(pl.indirectExpenses, "Indirect Expenses", "debit");

    return list;
  }, [pl]);

  const thCls = "px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 border-l";
  const tdCls = "px-3 py-1.5 text-right font-mono text-[11px] border-l border-gray-100";
  const td0Cls = "px-3 py-1.5 text-right font-mono text-[11px] text-gray-300 border-l border-gray-100";

  let currentGroup = "";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb]">
        <h3 className="text-[14px] font-semibold text-gray-800">Detailed Monthly Breakup</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          For the period: {pl.fromDate} to {pl.toDate}
        </p>
      </div>

      <table className="w-full min-w-[1000px]">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 sticky left-0 z-10 min-w-[200px]">
              Account
            </th>
            {pl.monthLabels.map(label => (
              <th key={label} className={thCls}>{label}</th>
            ))}
            <th className={`${thCls} bg-[#eef2ff] text-[#1557b0] border-l-2 border-[#c7d2fe]`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map(acc => {
            const showGroup = currentGroup !== acc.group;
            if (showGroup) currentGroup = acc.group;

            return (
              <React.Fragment key={acc.id}>
                {showGroup && (
                  <tr className="bg-gray-50 border-y border-gray-200">
                    <td 
                      colSpan={pl.monthLabels!.length + 2} 
                      className="px-3 py-1.5 text-[11px] font-bold text-[#1557b0] uppercase tracking-wider sticky left-0 bg-gray-50 z-10"
                    >
                      {acc.group}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-[#f5f8ff] cursor-pointer" onClick={() => onDrillDown({ level: 2, selectedAccountId: acc.id, selectedAccountName: acc.name, selectedGroupId: acc.group, selectedGroupLabel: acc.group, fromDate: pl.fromDate, toDate: pl.toDate })}>
                  <td className="px-3 py-1.5 text-[11px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100 hover:bg-[#f5f8ff] truncate max-w-[250px]" title={acc.name}>
                    {acc.name}
                  </td>
                  {pl.monthlyData!.map((m, i) => {
                    const val = Math.abs(m.accountBreakdown?.[acc.id] || 0);
                    return (
                      <td key={i} className={val === 0 ? td0Cls : tdCls}>
                        {fmt(val)}
                      </td>
                    );
                  })}
                  <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>
                    {fmt(acc.total)}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
