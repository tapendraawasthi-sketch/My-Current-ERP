// @ts-nocheck
import React, { useState, useMemo } from "react";
import { Plus, X, Search, FileEdit } from "lucide-react";
import { useStore } from "../store";
import toast from "react-hot-toast";

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

export default function BudgetMaster() {
  const { budgets, accounts, costCenters, currentFiscalYear, setBudgetEntries } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [accountId, setAccountId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [budgetMode, setBudgetMode] = useState<"ANNUAL" | "MONTHLY">("ANNUAL");
  const [annualAmount, setAnnualAmount] = useState<number | "">("");
  const [monthlyAmounts, setMonthlyAmounts] = useState<Record<string, number | "">>({});

  // Flattened budget list for display
  const budgetList = useMemo(() => {
    // Group budgets by Account + CostCenter
    const grouped: Record<string, { accountId: string, costCenterId?: string, total: number, months: number }> = {};
    
    budgets.filter(b => b.fiscalYearBS === currentFiscalYear?.name).forEach(b => {
      const key = `${b.accountId}_${b.costCenterId || 'none'}`;
      if (!grouped[key]) {
        grouped[key] = { accountId: b.accountId, costCenterId: b.costCenterId, total: 0, months: 0 };
      }
      grouped[key].total += b.budgetedAmount;
      grouped[key].months += 1;
    });

    return Object.values(grouped).map(g => ({
      ...g,
      accountName: accounts.find(a => a.id === g.accountId)?.name || "Unknown",
      costCenterName: costCenters.find(c => c.id === g.costCenterId)?.name || "N/A"
    })).filter(g => g.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [budgets, currentFiscalYear, accounts, costCenters, searchTerm]);

  const handleOpenModal = () => {
    setAccountId("");
    setCostCenterId("");
    setBudgetMode("ANNUAL");
    setAnnualAmount("");
    setMonthlyAmounts({});
    setShowModal(true);
  };

  const handleAnnualChange = (val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;
    setAnnualAmount(num);
    const split = num / 12;
    const newMonthly: Record<string, number> = {};
    BS_MONTHS.forEach((m, idx) => {
      newMonthly[String(idx + 1).padStart(2, "0")] = split;
    });
    setMonthlyAmounts(newMonthly);
  };

  const handleMonthlyChange = (monthStr: string, val: string) => {
    const num = Number(val);
    setMonthlyAmounts(prev => ({
      ...prev,
      [monthStr]: isNaN(num) ? "" : num
    }));
  };

  const calculateTotalMonthly = () => {
    return Object.values(monthlyAmounts).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFiscalYear) {
      toast.error("No active fiscal year");
      return;
    }
    if (!accountId) {
      toast.error("Account is required");
      return;
    }

    const entriesToSave = [];
    if (budgetMode === "ANNUAL" && annualAmount) {
      const split = Number(annualAmount) / 12;
      for (let i = 1; i <= 12; i++) {
        entriesToSave.push({
          accountId,
          costCenterId: costCenterId || undefined,
          fiscalYearBS: currentFiscalYear.name,
          month: String(i).padStart(2, "0"),
          budgetedAmount: split
        });
      }
    } else if (budgetMode === "MONTHLY") {
      for (let i = 1; i <= 12; i++) {
        const monthStr = String(i).padStart(2, "0");
        const amt = Number(monthlyAmounts[monthStr]) || 0;
        if (amt > 0) {
          entriesToSave.push({
            accountId,
            costCenterId: costCenterId || undefined,
            fiscalYearBS: currentFiscalYear.name,
            month: monthStr,
            budgetedAmount: amt
          });
        }
      }
    }

    if (entriesToSave.length === 0) {
      toast.error("Budget amount must be greater than zero");
      return;
    }

    try {
      await setBudgetEntries(entriesToSave);
      toast.success("Budget saved successfully");
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save budget");
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000]">Budget Master</h1>
          <p className="text-[11px] text-[#000000] mt-0.5">Set monthly or annual limits for income and expense accounts</p>
        </div>
        <button onClick={handleOpenModal} className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> Set Budget
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-[#9DC07A] flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#9DC07A] flex items-center justify-between bg-[#EBF5E2] shrink-0">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-[#000000] absolute left-2.5 top-2" />
            <input 
              type="text" 
              placeholder="Search by account..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
            />
          </div>
          <div className="text-[11px] text-[#000000] font-medium">
            Fiscal Year: <span className="font-bold text-[#1557b0]">{currentFiscalYear?.name || "N/A"}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f5f6fa] border-b border-[#9DC07A] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Account Name</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Cost Center</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide text-center">Period</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide text-right">Total Budgeted Amount (Rs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {budgetList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <FileEdit className="w-12 h-12 text-[#000000] mx-auto mb-3" />
                    <p className="text-[13px] font-medium text-[#000000]">No Budgets Configured</p>
                    <p className="text-[11px] text-[#000000] mt-1">Click 'Set Budget' to create limits.</p>
                  </td>
                </tr>
              ) : (
                budgetList.map((b, i) => (
                  <tr key={i} className="hover:bg-[#EBF5E2] transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-[#000000]">{b.accountName}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#000000]">{b.costCenterName}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#000000] text-center">{b.months === 12 ? "Annual" : `${b.months} Months`}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-right font-medium text-[#000000]">{b.total.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl w-[600px] flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#9DC07A] flex items-center justify-between shrink-0">
              <h2 className="text-[15px] font-semibold text-[#000000]">Set Budget for FY {currentFiscalYear?.name}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#000000] hover:text-[#000000]"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Account <span className="text-red-500">*</span></label>
                    <select required value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded bg-white focus:outline-none focus:border-[#1557b0]">
                      <option value="">-- Select Account --</option>
                      {accounts.filter(a => a.type === "Ledger").map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.group})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Cost Center (Optional)</label>
                    <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded bg-white focus:outline-none focus:border-[#1557b0]">
                      <option value="">-- Apply to All / None --</option>
                      {costCenters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#000000] mb-2">Budget Distribution Mode</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="mode" checked={budgetMode === "ANNUAL"} onChange={() => { setBudgetMode("ANNUAL"); setMonthlyAmounts({}); }} className="text-[#1557b0] focus:ring-[#1557b0]" />
                      <span className="text-[12px] text-[#000000]">Annual (Equally divided into 12 months)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="mode" checked={budgetMode === "MONTHLY"} onChange={() => { setBudgetMode("MONTHLY"); setAnnualAmount(""); }} className="text-[#1557b0] focus:ring-[#1557b0]" />
                      <span className="text-[12px] text-[#000000]">Monthly (Specify for each month)</span>
                    </label>
                  </div>
                </div>

                {budgetMode === "ANNUAL" && (
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Total Annual Amount</label>
                    <input 
                      type="number" min="0" required
                      value={annualAmount} onChange={e => handleAnnualChange(e.target.value)}
                      className="w-1/2 h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] font-mono"
                    />
                  </div>
                )}

                {budgetMode === "MONTHLY" && (
                  <div className="bg-[#EBF5E2] border border-[#9DC07A] rounded p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                      {BS_MONTHS.map((month, idx) => {
                        const mStr = String(idx + 1).padStart(2, "0");
                        return (
                          <div key={mStr}>
                            <label className="block text-[10px] font-medium text-[#000000] mb-1 uppercase">{month}</label>
                            <input 
                              type="number" min="0"
                              value={monthlyAmounts[mStr] || ""}
                              onChange={e => handleMonthlyChange(mStr, e.target.value)}
                              className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] font-mono"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#9DC07A] flex justify-between items-center">
                      <span className="text-[11px] font-bold text-[#000000] uppercase tracking-wide">Total Calculated Annual:</span>
                      <span className="text-[14px] font-mono font-bold text-[#1557b0]">Rs. {calculateTotalMonthly().toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[#9DC07A] flex justify-end gap-2 bg-[#EBF5E2] shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="h-8 px-4 bg-white border border-[#9DC07A] text-[#000000] text-[12px] font-medium rounded hover:bg-[#EBF5E2]">Cancel</button>
                <button type="submit" className="h-8 px-4 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded shadow-sm">Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

