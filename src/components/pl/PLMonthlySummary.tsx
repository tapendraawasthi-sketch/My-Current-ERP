// src/components/pl/PLMonthlySummary.tsx
import React from "react";
import type { PLComputation, PLReportOptions, PLDrillState } from "../../lib/plTypes";

const fmt = (n: number) =>
  n === 0 ? "—" :
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  pl: PLComputation;
  options: PLReportOptions;
  onDrillDown: (state: PLDrillState) => void;
}

export default function PLMonthlySummary({ pl, options, onDrillDown }: Props) {
  if (!pl.monthlyData || !pl.monthLabels) {
    return <div className="p-4 text-center text-gray-500">Monthly data not available.</div>;
  }

  const thCls = "px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 border-l";
  const tdCls = "px-3 py-2 text-right font-mono text-[12px] border-l border-gray-100";
  const td0Cls = "px-3 py-2 text-right font-mono text-[12px] text-gray-400 border-l border-gray-100";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f9fafb]">
        <h3 className="text-[14px] font-semibold text-gray-800">Monthly Profit & Loss Summary</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          For the period: {pl.fromDate} to {pl.toDate}
        </p>
      </div>

      <table className="w-full min-w-[800px]">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200 sticky left-0 z-10 w-48">
              Particulars
            </th>
            {pl.monthLabels.map(label => (
              <th key={label} className={thCls}>{label}</th>
            ))}
            <th className={`${thCls} bg-[#eef2ff] text-[#1557b0] border-l-2 border-[#c7d2fe]`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr className="hover:bg-[#f5f8ff]">
            <td className="px-3 py-2 text-[12px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">Sales (Revenue)</td>
            {pl.monthlyData.map((m, i) => (
              <td key={i} className={m.sales === 0 ? td0Cls : tdCls}>{fmt(m.sales)}</td>
            ))}
            <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>{fmt(pl.sales.total)}</td>
          </tr>
          
          <tr className="hover:bg-[#f5f8ff]">
            <td className="px-3 py-2 text-[12px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">Direct Income</td>
            {pl.monthlyData.map((m, i) => (
              <td key={i} className={m.directIncome === 0 ? td0Cls : tdCls}>{fmt(m.directIncome)}</td>
            ))}
            <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>{fmt(pl.directIncome.total)}</td>
          </tr>

          <tr className="hover:bg-[#f5f8ff]">
            <td className="px-3 py-2 text-[12px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">Purchases</td>
            {pl.monthlyData.map((m, i) => (
              <td key={i} className={m.purchases === 0 ? td0Cls : tdCls}>{fmt(m.purchases)}</td>
            ))}
            <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>{fmt(pl.purchases.total)}</td>
          </tr>

          <tr className="hover:bg-[#f5f8ff]">
            <td className="px-3 py-2 text-[12px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">Direct Expenses</td>
            {pl.monthlyData.map((m, i) => (
              <td key={i} className={m.directExpenses === 0 ? td0Cls : tdCls}>{fmt(m.directExpenses)}</td>
            ))}
            <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>{fmt(pl.directExpenses.total)}</td>
          </tr>

          {options.showDetailedSummary && (
            <>
              <tr className="bg-gray-50 border-y-2 border-gray-200">
                <td className="px-3 py-2 text-[12px] font-bold text-gray-800 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">Gross Profit</td>
                {pl.monthlyData.map((m, i) => (
                  <td key={i} className={`${tdCls} font-bold ${m.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmt(Math.abs(m.grossProfit))}
                  </td>
                ))}
                <td className={`${tdCls} bg-[#eef2ff] font-bold border-l-2 border-[#c7d2fe] ${pl.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(Math.abs(pl.grossProfit))}
                </td>
              </tr>
              
              <tr className="hover:bg-[#f5f8ff]">
                <td className="px-3 py-2 text-[12px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">Indirect Income</td>
                {pl.monthlyData.map((m, i) => (
                  <td key={i} className={m.indirectIncome === 0 ? td0Cls : tdCls}>{fmt(m.indirectIncome)}</td>
                ))}
                <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>{fmt(pl.indirectIncome.total)}</td>
              </tr>

              <tr className="hover:bg-[#f5f8ff]">
                <td className="px-3 py-2 text-[12px] font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">Indirect Expenses</td>
                {pl.monthlyData.map((m, i) => (
                  <td key={i} className={m.indirectExpenses === 0 ? td0Cls : tdCls}>{fmt(m.indirectExpenses)}</td>
                ))}
                <td className={`${tdCls} bg-[#f8faff] font-bold border-l-2 border-[#c7d2fe]`}>{fmt(pl.indirectExpenses.total)}</td>
              </tr>
            </>
          )}

          <tr className="bg-[#1557b0] text-white">
            <td className="px-3 py-2 text-[12px] font-bold sticky left-0 bg-[#1557b0] z-10 border-r border-[#0f4a96]">Net Profit</td>
            {pl.monthlyData.map((m, i) => (
              <td key={i} className="px-3 py-2 text-right font-mono text-[12px] font-bold border-l border-[#0f4a96]">
                {fmt(m.netProfit)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-mono text-[12px] font-bold border-l-2 border-[#0f4a96] bg-[#0f4a96]">
              {fmt(pl.netProfit)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
