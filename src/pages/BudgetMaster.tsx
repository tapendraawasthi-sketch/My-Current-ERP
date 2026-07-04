// @ts-nocheck
import React, { useState, useMemo } from "react";
import { Plus, X, Search, Save } from "lucide-react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import { ReportEmptyState } from "../components/ReportEmptyState";

const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

export default function BudgetMaster() {
  const { budgets, accounts, costCenters, currentFiscalYear, setBudgetEntries } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [budgetMode, setBudgetMode] = useState<"ANNUAL" | "MONTHLY">("ANNUAL");
  const [annualAmount, setAnnualAmount] = useState<number | "">("");
  const [monthlyAmounts, setMonthlyAmounts] = useState<Record<string, number | "">>({});

  const budgetList = useMemo(() => {
    const grouped: Record<
      string,
      { accountId: string; costCenterId?: string; total: number; months: number }
    > = {};

    budgets
      .filter((b) => b.fiscalYearBS === currentFiscalYear?.name)
      .forEach((b) => {
        const key = `${b.accountId}_${b.costCenterId || "none"}`;
        if (!grouped[key]) {
          grouped[key] = {
            accountId: b.accountId,
            costCenterId: b.costCenterId,
            total: 0,
            months: 0,
          };
        }
        grouped[key].total += b.budgetedAmount;
        grouped[key].months += 1;
      });

    return Object.values(grouped)
      .map((g) => ({
        ...g,
        accountName: accounts.find((a) => a.id === g.accountId)?.name || "Unknown",
        costCenterName: costCenters.find((c) => c.id === g.costCenterId)?.name || "N/A",
      }))
      .filter((g) => g.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [budgets, currentFiscalYear, accounts, costCenters, searchTerm]);

  const resetForm = () => {
    setAccountId("");
    setCostCenterId("");
    setBudgetMode("ANNUAL");
    setAnnualAmount("");
    setMonthlyAmounts({});
    setShowForm(false);
  };

  const handleOpenForm = () => {
    setAccountId("");
    setCostCenterId("");
    setBudgetMode("ANNUAL");
    setAnnualAmount("");
    setMonthlyAmounts({});
    setShowForm(true);
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
    setMonthlyAmounts((prev) => ({
      ...prev,
      [monthStr]: isNaN(num) ? "" : num,
    }));
  };

  const calculateTotalMonthly = () => {
    return Object.values(monthlyAmounts).reduce(
      (acc: number, curr) => acc + (Number(curr) || 0),
      0,
    );
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
          budgetedAmount: split,
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
            budgetedAmount: amt,
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
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save budget");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa] overflow-hidden">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Budget Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Set monthly or annual limits for income and expense accounts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">
                FY{" "}
                <span className="font-semibold text-[#1557b0]">
                  {currentFiscalYear?.name || "N/A"}
                </span>
              </span>
              <button type="button" className={btnPrimary} onClick={handleOpenForm}>
                <Plus className="h-3.5 w-3.5" />
                Set budget
              </button>
            </div>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {budgetList.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={searchTerm ? "No budgets match your search" : "No budgets configured"}
                hint={
                  searchTerm
                    ? "Try a different search term."
                    : 'Click "Set budget" to create limits for the current fiscal year.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Account name</th>
                    <th className={th}>Cost center</th>
                    <th className={`${th} text-center`}>Period</th>
                    <th className={`${th} text-right`}>Total budgeted (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetList.map((b, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className={`${td} font-medium text-gray-800`}>{b.accountName}</td>
                      <td className={td}>{b.costCenterName}</td>
                      <td className={`${td} text-center`}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">
                          {b.months === 12 ? "Annual" : `${b.months} months`}
                        </span>
                      </td>
                      <td className={`${td} text-right font-mono font-medium text-gray-800`}>
                        {b.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {budgetList.length} budget{budgetList.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-full lg:w-[560px] xl:w-[600px] shrink-0 flex flex-col bg-white border-l border-gray-200 min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-800">
              Set budget — FY {currentFiscalYear?.name}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select account</option>
                    {accounts
                      .filter((a) => a.type === "Ledger")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.group})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Cost center (optional)</label>
                  <select
                    value={costCenterId}
                    onChange={(e) => setCostCenterId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Apply to all / none</option>
                    {costCenters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Budget distribution mode</label>
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                    <input
                      type="radio"
                      name="mode"
                      checked={budgetMode === "ANNUAL"}
                      onChange={() => {
                        setBudgetMode("ANNUAL");
                        setMonthlyAmounts({});
                      }}
                      className="text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    Annual (equally divided into 12 months)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                    <input
                      type="radio"
                      name="mode"
                      checked={budgetMode === "MONTHLY"}
                      onChange={() => {
                        setBudgetMode("MONTHLY");
                        setAnnualAmount("");
                      }}
                      className="text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    Monthly (specify for each month)
                  </label>
                </div>
              </div>

              {budgetMode === "ANNUAL" && (
                <div>
                  <label className={labelCls}>Total annual amount</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={annualAmount}
                    onChange={(e) => handleAnnualChange(e.target.value)}
                    className={`${inputCls} max-w-xs font-mono`}
                  />
                </div>
              )}

              {budgetMode === "MONTHLY" && (
                <div className="bg-[#f5f6fa] border border-gray-200 rounded-md p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
                    {BS_MONTHS.map((month, idx) => {
                      const mStr = String(idx + 1).padStart(2, "0");
                      return (
                        <div key={mStr}>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                            {month}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={monthlyAmounts[mStr] || ""}
                            onChange={(e) => handleMonthlyChange(mStr, e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center bg-[#eef2ff] -mx-4 -mb-4 px-4 py-2.5 rounded-b-md border-t-2 border-[#c7d2fe]">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Total calculated annual
                    </span>
                    <span className="text-[12px] font-mono font-bold text-gray-800">
                      Rs. {calculateTotalMonthly().toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 shrink-0">
              <button type="button" className={btnOutline} onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary}>
                <Save className="h-3.5 w-3.5" />
                Save budget
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
