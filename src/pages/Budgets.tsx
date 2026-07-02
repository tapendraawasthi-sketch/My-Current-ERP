// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  Printer,
  Calendar,
  Filter,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

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
const FISCAL_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const FISCAL_MONTH_LABELS = [
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
  "Baisakh",
  "Jestha",
  "Ashadh",
];

const Budgets: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, currentUser, costCenters, fiscalYears } =
    useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [distributionMethod, setDistributionMethod] = useState("equal");
  const [seasonalPercentages, setSeasonalPercentages] = useState<number[]>(Array(12).fill(8.33));
  const [budgetFilter, setBudgetFilter] = useState("");
  const [periodType, setPeriodType] = useState("ytd");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [showOverBudgetOnly, setShowOverBudgetOnly] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [budgetForm, setBudgetForm] = useState({
    name: "",
    fiscalYear: currentFiscalYear?.name || "",
    type: "Combined Budget",
    status: "Draft",
    description: "",
  });
  const [budgetLines, setBudgetLines] = useState<any[]>([]);

  useEffect(() => {
    const db = getDB();
    db.table("budgets")
      .toArray()
      .catch(() => [])
      .then(setBudgets);
  }, []);

  useEffect(() => {
    if (budgetForm.type === "Income Budget") {
      const incomeAccounts = accounts.filter((a) => a.type === "income" && !a.isGroup);
      setBudgetLines(
        incomeAccounts.map((acc) => ({
          id: generateId(),
          accountId: acc.id,
          accountName: acc.name,
          annualAmount: 0,
        })),
      );
    } else if (budgetForm.type === "Expense Budget") {
      const expenseAccounts = accounts.filter((a) => a.type === "expense" && !a.isGroup);
      setBudgetLines(
        expenseAccounts.map((acc) => ({
          id: generateId(),
          accountId: acc.id,
          accountName: acc.name,
          annualAmount: 0,
        })),
      );
    } else if (budgetForm.type === "Combined Budget") {
      const combinedAccounts = accounts.filter(
        (a) => (a.type === "income" || a.type === "expense") && !a.isGroup,
      );
      setBudgetLines(
        combinedAccounts.map((acc) => ({
          id: generateId(),
          accountId: acc.id,
          accountName: acc.name,
          annualAmount: 0,
        })),
      );
    }
  }, [budgetForm.type, accounts]);

  const handleFormChange = (field: string, value: any) => {
    setBudgetForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    setBudgetLines((prev) => {
      const newLines = [...prev];
      newLines[index] = { ...newLines[index], [field]: Number(value) || 0 };
      return newLines;
    });
  };

  const saveBudget = async () => {
    if (!budgetForm.name.trim()) {
      toast.error("Budget name is required");
      return;
    }

    const db = getDB();
    const id = editingBudget?.id || generateId();
    const budgetRecord = {
      id,
      ...budgetForm,
      lines: budgetLines,
      createdAt: new Date().toISOString(),
    };

    try {
      await db
        .table("budgets")
        .put(budgetRecord)
        .catch(() => {
          const arr = JSON.parse(localStorage.getItem("budgets") || "[]");
          const idx = arr.findIndex((b: any) => b.id === id);
          if (idx >= 0) arr[idx] = budgetRecord;
          else arr.push(budgetRecord);
          localStorage.setItem("budgets", JSON.stringify(arr));
        });

      setBudgets((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = budgetRecord;
          return n;
        }
        return [...prev, budgetRecord];
      });

      setShowBudgetForm(false);
      setEditingBudget(null);
      toast.success("Budget saved successfully");
    } catch (error) {
      toast.error("Failed to save budget");
    }
  };

  const editBudget = (budget: any) => {
    setEditingBudget(budget);
    setBudgetForm({
      name: budget.name,
      fiscalYear: budget.fiscalYear,
      type: budget.type,
      status: budget.status,
      description: budget.description,
    });
    setBudgetLines(budget.lines || []);
    setShowBudgetForm(true);
  };

  const deleteBudget = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this budget?")) {
      const db = getDB();
      await db
        .table("budgets")
        .delete(id)
        .catch(() => {
          const arr = JSON.parse(localStorage.getItem("budgets") || "[]");
          const updated = arr.filter((b: any) => b.id !== id);
          localStorage.setItem("budgets", JSON.stringify(updated));
        });
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      toast.success("Budget deleted successfully");
    }
  };

  const approveBudget = async (id: string, status: string) => {
    const db = getDB();
    await db
      .table("budgets")
      .update(id, { status })
      .catch(() => {
        const arr = JSON.parse(localStorage.getItem("budgets") || "[]");
        const idx = arr.findIndex((b: any) => b.id === id);
        if (idx >= 0) arr[idx].status = status;
        localStorage.setItem("budgets", JSON.stringify(arr));
      });

    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    toast.success(`Budget ${status.toLowerCase()} successfully`);
  };

  const applyDistribution = () => {
    if (!selectedBudget) return;

    const updatedBudget = { ...selectedBudget };
    const updatedLines = selectedBudget.lines.map((line: any) => {
      const monthlyAmounts = [];

      if (distributionMethod === "equal") {
        for (let i = 0; i < 12; i++) {
          monthlyAmounts.push(line.annualAmount / 12);
        }
      } else if (distributionMethod === "seasonal") {
        for (let i = 0; i < 12; i++) {
          monthlyAmounts.push((line.annualAmount * seasonalPercentages[i]) / 100);
        }
      } else if (distributionMethod === "last-year-actuals") {
        for (let i = 0; i < 12; i++) {
          monthlyAmounts.push(line.annualAmount / 12);
        }
      }

      return { ...line, monthlyAmounts };
    });

    updatedBudget.lines = updatedLines;

    const db = getDB();
    db.table("budgets")
      .put(updatedBudget)
      .catch(() => {
        const arr = JSON.parse(localStorage.getItem("budgets") || "[]");
        const idx = arr.findIndex((b: any) => b.id === updatedBudget.id);
        if (idx >= 0) arr[idx] = updatedBudget;
        else arr.push(updatedBudget);
        localStorage.setItem("budgets", JSON.stringify(arr));
      });

    setBudgets((prev) => prev.map((b) => (b.id === updatedBudget.id ? updatedBudget : b)));
    toast.success("Distribution applied successfully");
  };

  const budgetVsActualData = useMemo(() => {
    if (!selectedBudget) return [];

    const periodStart = new Date();
    const periodEnd = new Date();

    if (periodType === "this-month") {
      // Current month logic (simplified for mockup)
    } else if (periodType === "qtd") {
      periodStart.setMonth(periodStart.getMonth() - 2);
    } else if (periodType === "ytd") {
      periodStart.setMonth(0);
    } else if (periodType === "custom") {
      if (fromDate) periodStart.setTime(new Date(fromDate).getTime());
      if (toDate) periodEnd.setTime(new Date(toDate).getTime());
    }

    return selectedBudget.lines
      .filter((line) => !showOverBudgetOnly || line.annualAmount > 0)
      .map((line) => {
        const actual = vouchers
          .filter(
            (v) =>
              v.status === "posted" &&
              v.date >= periodStart.toISOString().split("T")[0] &&
              v.date <= periodEnd.toISOString().split("T")[0] &&
              v.lines.some((l) => l.accountId === line.accountId),
          )
          .reduce((sum, v) => {
            const lineAmount = v.lines.find((l) => l.accountId === line.accountId);
            return sum + (lineAmount ? lineAmount.debit || lineAmount.credit || 0 : 0);
          }, 0);

        const budgeted = line.annualAmount;
        const variance = actual - budgeted;
        const variancePct = budgeted !== 0 ? (variance / budgeted) * 100 : 0;

        return {
          ...line,
          actual,
          budgeted,
          variance,
          variancePct,
        };
      });
  }, [selectedBudget, periodType, fromDate, toDate, showOverBudgetOnly, vouchers]);

  const summaryData = useMemo(() => {
    if (!budgetVsActualData.length)
      return {
        income: { budgeted: 0, actual: 0, variance: 0 },
        expenses: { budgeted: 0, actual: 0, variance: 0 },
        net: { budgeted: 0, actual: 0, variance: 0 },
      };

    const income = budgetVsActualData
      .filter((item) => accounts.find((a) => a.id === item.accountId)?.type === "income")
      .reduce(
        (acc, item) => {
          acc.budgeted += item.budgeted;
          acc.actual += item.actual;
          acc.variance += item.variance;
          return acc;
        },
        { budgeted: 0, actual: 0, variance: 0 },
      );

    const expenses = budgetVsActualData
      .filter((item) => accounts.find((a) => a.id === item.accountId)?.type === "expense")
      .reduce(
        (acc, item) => {
          acc.budgeted += item.budgeted;
          acc.actual += item.actual;
          acc.variance += item.variance;
          return acc;
        },
        { budgeted: 0, actual: 0, variance: 0 },
      );

    const net = {
      budgeted: income.budgeted - expenses.budgeted,
      actual: income.actual - expenses.actual,
      variance: income.variance - expenses.variance,
    };

    return { income, expenses, net };
  }, [budgetVsActualData, accounts]);

  const topVarianceData = useMemo(() => {
    return [...budgetVsActualData]
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 10)
      .map((item) => ({
        name: item.accountName.split(" ")[0].substring(0, 15),
        budgeted: item.budgeted,
        actual: item.actual,
      }));
  }, [budgetVsActualData]);

  const departmentBudgetData = useMemo(() => {
    if (!selectedCostCenter) return [];

    const costCenterVouchers = vouchers.filter(
      (v) => v.status === "posted" && v.lines.some((l) => l.costCenterId === selectedCostCenter),
    );

    const costCenterAccounts = accounts.filter(
      (a) => (a.type === "expense" || a.type === "income") && !a.isGroup,
    );

    return costCenterAccounts.map((acc) => {
      const budgeted =
        selectedBudget?.lines?.find((l) => l.accountId === acc.id)?.annualAmount || 0;
      const actual = costCenterVouchers
        .filter((v) =>
          v.lines.some((l) => l.accountId === acc.id && l.costCenterId === selectedCostCenter),
        )
        .reduce((sum, v) => {
          const line = v.lines.find(
            (l) => l.accountId === acc.id && l.costCenterId === selectedCostCenter,
          );
          return sum + (line ? line.debit || line.credit || 0 : 0);
        }, 0);

      return {
        accountId: acc.id,
        accountName: acc.name,
        budgeted,
        actual,
        utilization: budgeted ? (actual / budgeted) * 100 : 0,
      };
    });
  }, [selectedCostCenter, selectedBudget, vouchers, accounts]);

  const departmentSummary = useMemo(() => {
    if (!departmentBudgetData.length)
      return { totalBudgeted: 0, totalActual: 0, utilization: 0, status: "" };

    const totalBudgeted = departmentBudgetData.reduce((sum, item) => sum + item.budgeted, 0);
    const totalActual = departmentBudgetData.reduce((sum, item) => sum + item.actual, 0);
    const utilization = totalBudgeted ? (totalActual / totalBudgeted) * 100 : 0;
    const status =
      utilization < 80 ? "Under Budget" : utilization < 100 ? "On Track" : "Over Budget";

    return { totalBudgeted, totalActual, utilization, status };
  }, [departmentBudgetData]);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Budget Management</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Plan, distribute, and track your financial budgets
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
          {["Budget Master", "Monthly Distribution", "Budget vs Actual", "Department Budget"].map(
            (tab, index) => (
              <button
                key={index}
                className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === index
                    ? "border-[#1557b0] text-[#1557b0]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab(index)}
              >
                {tab}
              </button>
            ),
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4">
            {!showBudgetForm ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[14px] font-bold text-gray-800">Active Budgets</h2>
                  <button
                    className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                    onClick={() => {
                      setEditingBudget(null);
                      setBudgetForm({
                        name: "",
                        fiscalYear: currentFiscalYear?.name || "",
                        type: "Combined Budget",
                        status: "Draft",
                        description: "",
                      });
                      setShowBudgetForm(true);
                    }}
                  >
                    <Plus size={14} />
                    Create Budget
                  </button>
                </div>

                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Budget Name
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Fiscal Year
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Type
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Total Budgeted
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Created Date
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.map((budget) => {
                        const totalBudgeted =
                          budget.lines?.reduce(
                            (sum: number, line: any) => sum + (line.annualAmount || 0),
                            0,
                          ) || 0;
                        return (
                          <tr
                            key={budget.id}
                            className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors"
                          >
                            <td className="px-3 py-2.5 font-medium text-gray-800">{budget.name}</td>
                            <td className="px-3 py-2.5 text-gray-600">{budget.fiscalYear}</td>
                            <td className="px-3 py-2.5 text-gray-600">{budget.type}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                                  budget.status === "Draft"
                                    ? "bg-gray-100 text-gray-700 border border-gray-200"
                                    : budget.status === "Submitted"
                                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                                      : "bg-green-100 text-green-700 border border-green-200"
                                }`}
                              >
                                {budget.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                              {money(totalBudgeted)}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">
                              {new Date(budget.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                  onClick={() => editBudget(budget)}
                                  title="Edit Budget"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  onClick={() => deleteBudget(budget.id)}
                                  title="Delete Budget"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button
                                  className={`text-[11px] font-medium ${
                                    budget.status === "Draft" || budget.status === "Submitted"
                                      ? "text-green-600 hover:text-green-800 hover:underline"
                                      : "text-gray-400 cursor-not-allowed"
                                  }`}
                                  onClick={() => {
                                    if (
                                      budget.status === "Draft" &&
                                      currentUser.role === "accountant"
                                    ) {
                                      approveBudget(budget.id, "Submitted");
                                    } else if (
                                      currentUser.role === "admin" ||
                                      (currentUser.role === "manager" &&
                                        budget.type === "Department Budget")
                                    ) {
                                      approveBudget(budget.id, "Approved");
                                    }
                                  }}
                                  disabled={
                                    !(budget.status === "Draft" || budget.status === "Submitted")
                                  }
                                >
                                  {budget.status === "Draft"
                                    ? "Submit"
                                    : budget.status === "Submitted"
                                      ? "Approve"
                                      : "Approved"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {budgets.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-8 text-center text-[12px] text-gray-500"
                          >
                            No budgets found. Create one to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bg-white">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <h3 className="text-[14px] font-bold text-gray-800">
                    {editingBudget ? "Edit Budget Definition" : "Create New Budget Definition"}
                  </h3>
                  <button
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => {
                      setShowBudgetForm(false);
                      setEditingBudget(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Budget Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={budgetForm.name}
                      onChange={(e) => handleFormChange("name", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                      placeholder="e.g. FY2026 Operations"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Fiscal Year
                    </label>
                    <select
                      value={budgetForm.fiscalYear}
                      onChange={(e) => handleFormChange("fiscalYear", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.name}>
                          {fy.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Budget Type
                    </label>
                    <select
                      value={budgetForm.type}
                      onChange={(e) => handleFormChange("type", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="Income Budget">Income Budget</option>
                      <option value="Expense Budget">Expense Budget</option>
                      <option value="Combined Budget">Combined Budget</option>
                      <option value="Department Budget">Department Budget</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Status
                    </label>
                    <select
                      value={budgetForm.status}
                      onChange={(e) => handleFormChange("status", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 lg:col-span-4">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={budgetForm.description}
                      onChange={(e) => handleFormChange("description", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                      placeholder="Optional notes about this budget..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 border-t border-gray-100 pt-4">
                  <h4 className="text-[13px] font-bold text-gray-800">Budget Lines Allocation</h4>
                  <div className="flex gap-2">
                    <button
                      className="h-7 px-3 bg-white text-[#1557b0] border border-gray-300 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                      onClick={() => {
                        if (budgetForm.type === "Income Budget") {
                          const incomeAccounts = accounts.filter(
                            (a) => a.type === "income" && !a.isGroup,
                          );
                          setBudgetLines(
                            incomeAccounts.map((acc) => ({
                              id: generateId(),
                              accountId: acc.id,
                              accountName: acc.name,
                              annualAmount: 0,
                            })),
                          );
                        } else if (budgetForm.type === "Expense Budget") {
                          const expenseAccounts = accounts.filter(
                            (a) => a.type === "expense" && !a.isGroup,
                          );
                          setBudgetLines(
                            expenseAccounts.map((acc) => ({
                              id: generateId(),
                              accountId: acc.id,
                              accountName: acc.name,
                              annualAmount: 0,
                            })),
                          );
                        } else if (budgetForm.type === "Combined Budget") {
                          const combinedAccounts = accounts.filter(
                            (a) => (a.type === "income" || a.type === "expense") && !a.isGroup,
                          );
                          setBudgetLines(
                            combinedAccounts.map((acc) => ({
                              id: generateId(),
                              accountId: acc.id,
                              accountName: acc.name,
                              annualAmount: 0,
                            })),
                          );
                        }
                      }}
                    >
                      <RefreshCw size={12} />
                      Reload Accounts
                    </button>
                    <button
                      className="h-7 px-3 bg-white text-[#059669] border border-gray-300 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                      onClick={() => {
                        const lastYearStart = new Date();
                        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
                        const lastYearEnd = new Date();
                        lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

                        const updatedLines = budgetLines.map((line) => {
                          const actual = vouchers
                            .filter(
                              (v) =>
                                v.status === "posted" &&
                                v.date >= lastYearStart.toISOString().split("T")[0] &&
                                v.date <= lastYearEnd.toISOString().split("T")[0] &&
                                v.lines.some((l) => l.accountId === line.accountId),
                            )
                            .reduce((sum, v) => {
                              const vLine = v.lines.find((l) => l.accountId === line.accountId);
                              return sum + (vLine ? vLine.debit || vLine.credit || 0 : 0);
                            }, 0);

                          return { ...line, annualAmount: actual };
                        });

                        setBudgetLines(updatedLines);
                        toast.success("Applied historical data.");
                      }}
                    >
                      <TrendingUp size={12} />
                      Fill Last Year Actuals
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-md overflow-hidden max-h-[400px] overflow-y-auto mb-4">
                  <table className="w-full min-w-max border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#f5f6fa]">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Code
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Account Name
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-48">
                          Annual Allocation (NPR)
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Monthly Avg.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {budgetLines.map((line, index) => (
                        <tr
                          key={line.id}
                          className="bg-white hover:bg-gray-50 text-[12px] transition-colors"
                        >
                          <td className="px-3 py-2 text-gray-500">
                            {accounts.find((a) => a.id === line.accountId)?.code || "-"}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {line.accountName}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={line.annualAmount || ""}
                              onChange={(e) =>
                                handleLineChange(index, "annualAmount", e.target.value)
                              }
                              className="h-7 px-2 text-[12px] text-right font-medium border border-gray-300 rounded bg-white focus:outline-none focus:border-[#1557b0] w-full"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500 font-mono">
                            {money((line.annualAmount || 0) / 12)}
                          </td>
                        </tr>
                      ))}
                      {budgetLines.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-[12px] text-gray-400"
                          >
                            No accounts match the selected budget type.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-2.5 text-right font-bold text-[11px] tracking-wide text-gray-600"
                        >
                          Total Budget Allocation:
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-[13px] text-[#1557b0]">
                          NPR{" "}
                          {money(budgetLines.reduce((sum, l) => sum + (l.annualAmount || 0), 0))}
                        </td>
                        <td className="px-3 py-2.5"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    onClick={() => {
                      setShowBudgetForm(false);
                      setEditingBudget(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                    onClick={saveBudget}
                  >
                    <Save size={14} />
                    Save Budget
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5 mb-4 max-w-full overflow-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-800">
                  Monthly Distribution Model
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Allocate annual budgets across fiscal months
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Target Budget:
                </label>
                <select
                  value={selectedBudget?.id || ""}
                  onChange={(e) => {
                    const budget = budgets.find((b) => b.id === e.target.value);
                    setSelectedBudget(budget || null);
                  }}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] min-w-[200px]"
                >
                  <option value="">-- Select Budget Profile --</option>
                  {budgets.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBudget ? (
              <>
                <div className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Distribution Algorithm
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors border ${
                            distributionMethod === "equal"
                              ? "bg-[#1557b0] text-white border-[#1557b0]"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                          onClick={() => setDistributionMethod("equal")}
                        >
                          Equal (1/12th)
                        </button>
                        <button
                          className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors border ${
                            distributionMethod === "seasonal"
                              ? "bg-[#1557b0] text-white border-[#1557b0]"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                          onClick={() => setDistributionMethod("seasonal")}
                        >
                          Seasonal (Custom %)
                        </button>
                        <button
                          className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors border ${
                            distributionMethod === "last-year-actuals"
                              ? "bg-[#1557b0] text-white border-[#1557b0]"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                          onClick={() => setDistributionMethod("last-year-actuals")}
                        >
                          Last Year Actuals Profile
                        </button>
                      </div>
                    </div>

                    <div className="ml-auto">
                      <button
                        className="h-8 px-5 bg-[#059669] text-white text-[12px] font-medium rounded-md hover:bg-[#047857] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                        onClick={applyDistribution}
                        disabled={
                          distributionMethod === "seasonal" &&
                          Math.abs(seasonalPercentages.reduce((sum, pct) => sum + pct, 0) - 100) >
                            0.01
                        }
                      >
                        <Save size={14} />
                        Apply Distribution Logic
                      </button>
                    </div>
                  </div>
                </div>

                {distributionMethod === "seasonal" && (
                  <div className="mb-6 bg-white border border-gray-200 rounded-md p-4 shadow-sm">
                    <h4 className="text-[13px] font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2">
                      Seasonal Allocation Parameters
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 mb-3">
                      {FISCAL_MONTH_LABELS.map((month, idx) => (
                        <div key={idx} className="flex flex-col">
                          <label className="text-[10px] text-gray-500 font-medium mb-1 text-center">
                            {month.substring(0, 3)}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={seasonalPercentages[idx] || ""}
                              onChange={(e) => {
                                const newPcts = [...seasonalPercentages];
                                newPcts[idx] = Number(e.target.value) || 0;
                                setSeasonalPercentages(newPcts);
                              }}
                              className="w-full h-8 px-1 pr-4 text-center text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:border-[#1557b0]"
                            />
                            <span className="absolute right-1 top-1/2 transform -translate-y-1/2 text-[9px] text-gray-400">
                              %
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200 text-[12px] font-medium">
                      <span className="text-gray-600">Total Allocation:</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-bold text-gray-800">
                          {seasonalPercentages.reduce((sum, pct) => sum + pct, 0).toFixed(2)}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                            Math.abs(seasonalPercentages.reduce((sum, pct) => sum + pct, 0) - 100) <
                            0.01
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-red-100 text-red-700 border border-red-200"
                          }`}
                        >
                          {Math.abs(seasonalPercentages.reduce((sum, pct) => sum + pct, 0) - 100) <
                          0.01
                            ? "✓ Valid (100%)"
                            : "✗ Invalid (Must be 100%)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <h4 className="text-[13px] font-semibold text-gray-800 mb-3 mt-2">
                  Preview of Monthly Distribution
                </h4>
                <div className="border border-gray-200 rounded-md overflow-x-auto shadow-sm">
                  <table className="w-full min-w-max border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200 text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2.5 text-left font-semibold">Account Name</th>
                        <th className="px-3 py-2.5 text-right font-semibold bg-gray-100">
                          Annual Budget
                        </th>
                        {FISCAL_MONTH_LABELS.map((month) => (
                          <th key={month} className="px-2 py-2.5 text-right font-semibold">
                            {month.substring(0, 3)}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-right font-semibold bg-gray-100">
                          Check Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedBudget.lines?.map((line: any, idx: number) => {
                        const monthlyAmounts = [];
                        if (distributionMethod === "equal") {
                          for (let i = 0; i < 12; i++) {
                            monthlyAmounts.push(line.annualAmount / 12);
                          }
                        } else if (distributionMethod === "seasonal") {
                          for (let i = 0; i < 12; i++) {
                            monthlyAmounts.push((line.annualAmount * seasonalPercentages[i]) / 100);
                          }
                        } else {
                          for (let i = 0; i < 12; i++) {
                            monthlyAmounts.push(line.annualAmount / 12);
                          }
                        }

                        const rowTotal = monthlyAmounts.reduce((sum, amt) => sum + amt, 0);
                        const isCorrect = Math.abs(rowTotal - line.annualAmount) < 0.01;

                        return (
                          <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                            <td
                              className="px-3 py-2 font-medium text-gray-800 truncate max-w-[150px]"
                              title={line.accountName}
                            >
                              {line.accountName}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-[#1557b0] bg-blue-50/30">
                              {money(line.annualAmount)}
                            </td>
                            {monthlyAmounts.map((amt, i) => (
                              <td key={i} className="px-2 py-2 text-right text-gray-600">
                                {money(amt)}
                              </td>
                            ))}
                            <td
                              className={`px-3 py-2 text-right font-bold bg-gray-50 ${isCorrect ? "text-green-600" : "text-red-600"}`}
                            >
                              {money(rowTotal)}
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedBudget.lines || selectedBudget.lines.length === 0) && (
                        <tr>
                          <td
                            colSpan={15}
                            className="px-3 py-8 text-center text-[12px] text-gray-400"
                          >
                            This budget has no allocation lines.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50/50 rounded-md border border-gray-200 border-dashed">
                <Filter size={48} className="mb-3 opacity-20" />
                <p className="text-[13px] font-medium">
                  Please select a budget from the dropdown above to manage its monthly distribution.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-800">
                  Budget vs Actual Performance
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Real-time variance analysis of financial actuals against targets
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-md border border-gray-200">
                <select
                  value={selectedBudget?.id || ""}
                  onChange={(e) => {
                    const budget = budgets.find((b) => b.id === e.target.value);
                    setSelectedBudget(budget || null);
                  }}
                  className="h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] min-w-[150px]"
                >
                  <option value="">Select Budget</option>
                  {budgets.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.name}
                    </option>
                  ))}
                </select>

                <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>

                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="ytd">Year to Date (YTD)</option>
                  <option value="qtd">Quarter to Date (QTD)</option>
                  <option value="this-month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-md px-2 h-8">
                    <input
                      type="checkbox"
                      id="overBudget"
                      className="rounded border-gray-300 text-[#1557b0]"
                      checked={showOverBudgetOnly}
                      onChange={(e) => setShowOverBudgetOnly(e.target.checked)}
                    />
                    <label
                      htmlFor="overBudget"
                      className="text-[10px] font-medium text-gray-600 cursor-pointer"
                    >
                      Has Budget Only
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {selectedBudget ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-blue-200 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8"></div>
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Total Income
                    </div>
                    <div className="text-2xl font-bold text-gray-800 mb-2">
                      Rs. {money(summaryData.income.actual)}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">
                        Target: Rs. {money(summaryData.income.budgeted)}
                      </span>
                    </div>
                    <div
                      className={`mt-2 text-[12px] font-bold flex items-center gap-1 ${summaryData.income.variance >= 0 ? "text-green-600" : "text-red-500"}`}
                    >
                      {summaryData.income.variance >= 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      Variance: Rs. {money(Math.abs(summaryData.income.variance))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-blue-200 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -mr-8 -mt-8"></div>
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Total Expenses
                    </div>
                    <div className="text-2xl font-bold text-gray-800 mb-2">
                      Rs. {money(summaryData.expenses.actual)}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">
                        Target: Rs. {money(summaryData.expenses.budgeted)}
                      </span>
                    </div>
                    <div
                      className={`mt-2 text-[12px] font-bold flex items-center gap-1 ${summaryData.expenses.variance <= 0 ? "text-green-600" : "text-red-500"}`}
                    >
                      {summaryData.expenses.variance <= 0 ? (
                        <TrendingDown size={14} />
                      ) : (
                        <TrendingUp size={14} />
                      )}
                      Variance: Rs. {money(Math.abs(summaryData.expenses.variance))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-blue-200 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full -mr-8 -mt-8"></div>
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Net Performance
                    </div>
                    <div className="text-2xl font-bold text-[#1557b0] mb-2">
                      Rs. {money(summaryData.net.actual)}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">
                        Target: Rs. {money(summaryData.net.budgeted)}
                      </span>
                    </div>
                    <div
                      className={`mt-2 text-[12px] font-bold flex items-center gap-1 ${summaryData.net.variance >= 0 ? "text-green-600" : "text-red-500"}`}
                    >
                      {summaryData.net.variance >= 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      Variance: Rs. {money(Math.abs(summaryData.net.variance))}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm mb-6">
                  <h3 className="text-[13px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    Top Variances (Budget vs Actual)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topVarianceData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#6B7280" }}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#6B7280" }}
                          axisLine={false}
                          tickLine={false}
                          dx={-10}
                          tickFormatter={(value) =>
                            `₹${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                          }
                        />
                        <Tooltip
                          cursor={{ fill: "#F3F4F6" }}
                          contentStyle={{
                            borderRadius: "6px",
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                          }}
                        />
                        <Bar
                          dataKey="budgeted"
                          name="Budgeted"
                          fill="#1557b0"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="actual"
                          name="Actual"
                          fill="#0ea5e9"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-3">
                  <h3 className="text-[13px] font-semibold text-gray-800">
                    Detailed Variance Analysis
                  </h3>
                  <div className="flex gap-2">
                    <button
                      className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                      onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(
                          budgetVsActualData.map((item) => ({
                            "Account Code":
                              accounts.find((a) => a.id === item.accountId)?.code || "N/A",
                            "Account Name": item.accountName,
                            "Annual Budget": item.budgeted,
                            "Budget (Period)": item.budgeted,
                            "Actual (Period)": item.actual,
                            "Variance NPR": item.variance,
                            "Variance %": item.variancePct,
                          })),
                        );
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Budget vs Actual");
                        XLSX.writeFile(wb, "budget_vs_actual.xlsx");
                        toast.success("Exported to Excel");
                      }}
                    >
                      <Download size={14} />
                      Export
                    </button>
                    <button
                      className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                      onClick={() => window.print()}
                    >
                      <Printer size={14} />
                      Print
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-md overflow-x-auto shadow-sm">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Account
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                          Annual Target
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Period Budget
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Actuals
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Variance
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          % Diff
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {budgetVsActualData.map((item) => {
                        const account = accounts.find((a) => a.id === item.accountId);
                        const isExpense = account?.type === "expense";

                        let isAdverse = false;
                        if (isExpense && item.actual > item.budgeted) isAdverse = true;
                        if (!isExpense && item.actual < item.budgeted) isAdverse = true;

                        return (
                          <tr
                            key={item.id}
                            className="bg-white hover:bg-gray-50 text-[12px] transition-colors"
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-gray-800">{item.accountName}</div>
                              <div className="text-[10px] text-gray-400">
                                {account?.code || "-"}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-600 bg-gray-50">
                              {money(item.budgeted)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-[#1557b0] font-medium">
                              {money(item.budgeted)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-gray-800">
                              {money(item.actual)}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-medium ${isAdverse ? "text-red-600 bg-red-50/50" : "text-green-600 bg-green-50/50"}`}
                            >
                              {money(Math.abs(item.variance))} {isAdverse ? "(Adv)" : "(Fav)"}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-bold ${isAdverse ? "text-red-600" : "text-green-600"}`}
                            >
                              {item.budgeted ? Math.abs(item.variancePct).toFixed(1) + "%" : "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {budgetVsActualData.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-8 text-center text-[12px] text-gray-400"
                          >
                            No variance data to display for the selected parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50/50 rounded-md border border-gray-200 border-dashed">
                <BarChart size={48} className="mb-3 opacity-20" />
                <p className="text-[13px] font-medium">
                  Select a budget to view performance analysis.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-800">
                  Departmental Cost Control
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Track expense utilization across cost centers
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Target Cost Center:
                </label>
                <select
                  value={selectedCostCenter}
                  onChange={(e) => setSelectedCostCenter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] min-w-[200px]"
                >
                  <option value="">Select Cost Center</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {costCenters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50/50 rounded-md border border-gray-200 border-dashed">
                <AlertTriangle size={48} className="mb-3 opacity-20" />
                <div className="text-[14px] font-bold text-gray-600 mb-1">
                  No cost centers configured
                </div>
                <p className="text-[12px]">
                  You need to set up cost centers in the Masters section first.
                </p>
              </div>
            ) : selectedCostCenter ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors">
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Total Allocation
                    </div>
                    <div className="text-xl font-bold text-gray-800">
                      Rs. {money(departmentSummary.totalBudgeted)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors">
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Actual Spent
                    </div>
                    <div className="text-xl font-bold text-gray-800">
                      Rs. {money(departmentSummary.totalActual)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors">
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Utilization Rate
                    </div>
                    <div className="text-xl font-bold text-[#1557b0]">
                      {departmentSummary.utilization.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[#1557b0] transition-colors">
                    <div className="text-[11px] font-semibold text-gray-500 tracking-wide mb-1">
                      Status
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          departmentSummary.utilization < 80
                            ? "bg-green-500"
                            : departmentSummary.utilization < 100
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                      ></div>
                      <div
                        className={`text-lg font-bold ${
                          departmentSummary.utilization < 80
                            ? "text-green-600"
                            : departmentSummary.utilization < 100
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {departmentSummary.status || "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-[13px] font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">
                  Line Item Utilization
                </h3>
                <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm max-h-[500px] overflow-y-auto custom-scrollbar">
                  {departmentBudgetData.map((item) => {
                    const pct = item.budgeted ? (item.actual / item.budgeted) * 100 : 0;
                    return (
                      <div key={item.accountId} className="mb-5 last:mb-0 group">
                        <div className="flex justify-between items-end text-[12px] mb-1.5">
                          <span className="font-medium text-gray-800 group-hover:text-[#1557b0] transition-colors">
                            {item.accountName}
                          </span>
                          <div className="text-right">
                            <span className="font-bold text-gray-800">
                              Rs. {money(item.actual)}
                            </span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-gray-500">Rs. {money(item.budgeted)}</span>
                            <span className="ml-2 font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                          <div
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            className={`h-full transition-all duration-500 ${
                              pct < 80 ? "bg-green-500" : pct < 100 ? "bg-amber-500" : "bg-red-500"
                            }`}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {departmentBudgetData.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-[12px]">
                      No budgeted items found for this cost center.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50/50 rounded-md border border-gray-200 border-dashed">
                <AlertTriangle size={48} className="mb-3 opacity-20" />
                <p className="text-[13px] font-medium">
                  Select a cost center above to view utilization metrics.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Budgets;
