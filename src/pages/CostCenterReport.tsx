import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import { Filter, FileText, ArrowRightLeft, Download } from "lucide-react";
import { format } from "date-fns";
import * as xlsx from "xlsx";

export default function CostCenterReport() {
  const { costCenters, vouchers, accounts } = useStore();
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  
  // For Comparison Mode
  const [isComparing, setIsComparing] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Helpers to check if an account is Income or Expense
  const getAccountNature = (accountId: string): "INCOME" | "EXPENSE" | "OTHER" => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return "OTHER";
    if (["Direct Incomes", "Indirect Incomes", "Sales Accounts"].includes(acc.group || "")) return "INCOME";
    if (["Direct Expenses", "Indirect Expenses", "Purchase Accounts"].includes(acc.group || "")) return "EXPENSE";
    return "OTHER";
  };

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "Unknown Account";

  // Single Report Calculation
  const singleReport = useMemo(() => {
    if (!selectedCenterId) return null;
    let filteredVouchers = vouchers.filter(v => v.status === "POSTED");
    if (fromDate) filteredVouchers = filteredVouchers.filter(v => v.date >= fromDate);
    if (toDate) filteredVouchers = filteredVouchers.filter(v => v.date <= toDate);

    const incomes: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    filteredVouchers.forEach(v => {
      v.lines.forEach(l => {
        if (l.costCenterId === selectedCenterId) {
          const nature = getAccountNature(l.accountId);
          if (nature === "INCOME") {
            const amount = l.credit - l.debit;
            incomes[l.accountId] = (incomes[l.accountId] || 0) + amount;
            totalIncome += amount;
          } else if (nature === "EXPENSE") {
            const amount = l.debit - l.credit;
            expenses[l.accountId] = (expenses[l.accountId] || 0) + amount;
            totalExpense += amount;
          }
        }
      });
    });

    return { incomes, expenses, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
  }, [vouchers, accounts, selectedCenterId, fromDate, toDate]);

  // Comparison Calculation
  const compareReports = useMemo(() => {
    if (!isComparing || compareIds.length === 0) return [];
    
    let filteredVouchers = vouchers.filter(v => v.status === "POSTED");
    if (fromDate) filteredVouchers = filteredVouchers.filter(v => v.date >= fromDate);
    if (toDate) filteredVouchers = filteredVouchers.filter(v => v.date <= toDate);

    return compareIds.map(ccId => {
      const cc = costCenters.find(c => c.id === ccId);
      let totalIncome = 0;
      let totalExpense = 0;

      filteredVouchers.forEach(v => {
        v.lines.forEach(l => {
          if (l.costCenterId === ccId) {
            const nature = getAccountNature(l.accountId);
            if (nature === "INCOME") {
              totalIncome += (l.credit - l.debit);
            } else if (nature === "EXPENSE") {
              totalExpense += (l.debit - l.credit);
            }
          }
        });
      });

      return {
        id: ccId,
        name: cc?.name || "Unknown",
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense
      };
    });
  }, [vouchers, accounts, compareIds, fromDate, toDate, isComparing, costCenters]);

  const toggleCompareId = (id: string) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter(c => c !== id));
    } else {
      if (compareIds.length >= 3) return; // limit to 3
      setCompareIds([...compareIds, id]);
    }
  };

  const exportExcel = () => {
    if (isComparing) {
      const data = compareReports.map(r => ({
        "Cost Center": r.name,
        "Total Income (Rs.)": r.totalIncome,
        "Total Expense (Rs.)": r.totalExpense,
        "Net Profit/Loss (Rs.)": r.netProfit
      }));
      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Comparison");
      xlsx.writeFile(wb, "CostCenter_Comparison.xlsx");
    } else if (singleReport) {
      const data: any[] = [];
      data.push({ "Account": "--- INCOMES ---", "Amount (Rs.)": "" });
      Object.entries(singleReport.incomes).forEach(([accId, amt]) => {
        if (amt !== 0) data.push({ "Account": getAccountName(accId), "Amount (Rs.)": amt });
      });
      data.push({ "Account": "Total Income", "Amount (Rs.)": singleReport.totalIncome });
      data.push({ "Account": "", "Amount (Rs.)": "" });
      data.push({ "Account": "--- EXPENSES ---", "Amount (Rs.)": "" });
      Object.entries(singleReport.expenses).forEach(([accId, amt]) => {
        if (amt !== 0) data.push({ "Account": getAccountName(accId), "Amount (Rs.)": amt });
      });
      data.push({ "Account": "Total Expense", "Amount (Rs.)": singleReport.totalExpense });
      data.push({ "Account": "", "Amount (Rs.)": "" });
      data.push({ "Account": "NET PROFIT/LOSS", "Amount (Rs.)": singleReport.netProfit });

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Report");
      xlsx.writeFile(wb, `CostCenter_${selectedCenterId}.xlsx`);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Cost Center Profit & Loss</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Analyze income and expenses per cost center</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setIsComparing(!isComparing); setCompareIds([]); }} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
            <ArrowRightLeft className="w-4 h-4" /> {isComparing ? "Single Report Mode" : "Compare Cost Centers"}
          </button>
          <button onClick={exportExcel} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 no-print flex gap-4 items-end">
        {!isComparing ? (
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Cost Center</label>
            <select value={selectedCenterId} onChange={e => setSelectedCenterId(e.target.value)} className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:border-[#1557b0]">
              <option value="">-- Choose --</option>
              {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Select up to 3 Cost Centers to compare</label>
            <div className="flex gap-2 flex-wrap">
              {costCenters.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCompareId(c.id)}
                  className={`px-3 py-1 text-[11px] rounded-full border transition-colors ${compareIds.includes(c.id) ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[#1557b0]" />
        </div>
      </div>

      {!isComparing ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {!selectedCenterId || !singleReport ? (
            <div className="text-center text-gray-500 py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-[14px] font-medium text-gray-600">No Cost Center Selected</p>
              <p className="text-[12px] mt-1">Please select a cost center above to view its P&L.</p>
            </div>
          ) : (
            <div className="p-6">
              <h2 className="text-[16px] font-bold text-gray-800 text-center mb-6">{costCenters.find(c => c.id === selectedCenterId)?.name} P&L</h2>
              
              <div className="grid grid-cols-2 gap-8">
                {/* Expenses */}
                <div>
                  <h3 className="text-[12px] font-bold text-red-700 uppercase tracking-wide border-b-2 border-red-200 pb-2 mb-3">Expenses</h3>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {Object.entries(singleReport.expenses).filter(([_, amt]) => amt !== 0).map(([accId, amt]) => (
                        <tr key={accId} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 text-gray-700">{getAccountName(accId)}</td>
                          <td className="py-2 text-right font-mono text-gray-900">{(amt).toLocaleString()}</td>
                        </tr>
                      ))}
                      {Object.keys(singleReport.expenses).length === 0 && (
                        <tr><td colSpan={2} className="py-2 text-gray-400 italic">No expenses recorded</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td className="py-2 font-bold text-gray-800">Total Expense</td>
                        <td className="py-2 text-right font-mono font-bold text-red-600">{singleReport.totalExpense.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Incomes */}
                <div>
                  <h3 className="text-[12px] font-bold text-green-700 uppercase tracking-wide border-b-2 border-green-200 pb-2 mb-3">Incomes</h3>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {Object.entries(singleReport.incomes).filter(([_, amt]) => amt !== 0).map(([accId, amt]) => (
                        <tr key={accId} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 text-gray-700">{getAccountName(accId)}</td>
                          <td className="py-2 text-right font-mono text-gray-900">{(amt).toLocaleString()}</td>
                        </tr>
                      ))}
                      {Object.keys(singleReport.incomes).length === 0 && (
                        <tr><td colSpan={2} className="py-2 text-gray-400 italic">No incomes recorded</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td className="py-2 font-bold text-gray-800">Total Income</td>
                        <td className="py-2 text-right font-mono font-bold text-green-600">{singleReport.totalIncome.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Net Profit/Loss */}
              <div className={`mt-8 p-4 rounded-lg border-2 flex justify-between items-center ${singleReport.netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="text-[14px] font-bold uppercase tracking-wider text-gray-800">
                  {singleReport.netProfit >= 0 ? "Net Profit" : "Net Loss"}
                </div>
                <div className={`text-[20px] font-mono font-bold ${singleReport.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  Rs. {Math.abs(singleReport.netProfit).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {compareIds.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <ArrowRightLeft className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-[14px] font-medium text-gray-600">Select Cost Centers</p>
              <p className="text-[12px] mt-1">Select up to 3 cost centers above to compare.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Metric</th>
                  {compareReports.map(r => (
                    <th key={r.id} className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 text-[12px] font-medium text-gray-700">Total Income</td>
                  {compareReports.map(r => (
                    <td key={r.id} className="px-4 py-3 text-[12px] font-mono text-green-600 text-right">{r.totalIncome.toLocaleString()}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-[12px] font-medium text-gray-700">Total Expense</td>
                  {compareReports.map(r => (
                    <td key={r.id} className="px-4 py-3 text-[12px] font-mono text-red-600 text-right">{r.totalExpense.toLocaleString()}</td>
                  ))}
                </tr>
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-4 py-4 text-[12px] text-gray-800">Net Profit / Loss</td>
                  {compareReports.map(r => (
                    <td key={r.id} className={`px-4 py-4 text-[13px] font-mono text-right ${r.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {r.netProfit >= 0 ? "+" : ""}{r.netProfit.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
