import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { Budget, BudgetLine, BudgetPeriod, AccountType } from "../lib/types";
import { DollarSign, Plus, Upload, Copy, Save, Edit, Trash2 } from "lucide-react";
import { Card, Button, Input, Select, Badge, ConfirmDialog } from "../components/ui";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const BudgetMaster: React.FC = () => {
  const { accounts, fiscalYears, companySettings, currentUser } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [budgetName, setBudgetName] = useState("");
  const [selectedFY, setSelectedFY] = useState("");
  const [periodType, setPeriodType] = useState<BudgetPeriod>(BudgetPeriod.MONTHLY);
  const [accountTypeFilter, setAccountTypeFilter] = useState<"all" | "income" | "expense">("all");

  // Budget grid data
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);

  // Months for fiscal year
  const fiscalMonths = [
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

  const fiscalYearOptions = fiscalYears.map((fy) => ({
    value: fy.id,
    label: `${fy.name} (${fy.startDate} to ${fy.endDate})`,
  }));

  // Filter accounts for budget
  const budgetableAccounts = useMemo(() => {
    let filtered = accounts.filter((a) => !a.isGroup && a.isActive);

    if (accountTypeFilter === "income") {
      filtered = filtered.filter((a) => a.type === AccountType.INCOME);
    } else if (accountTypeFilter === "expense") {
      filtered = filtered.filter((a) => a.type === AccountType.EXPENSE);
    } else {
      // All P&L accounts
      filtered = filtered.filter(
        (a) => a.type === AccountType.INCOME || a.type === AccountType.EXPENSE,
      );
    }

    return filtered.sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, accountTypeFilter]);

  const resetForm = () => {
    setBudgetName("");
    setSelectedFY("");
    setPeriodType(BudgetPeriod.MONTHLY);
    setAccountTypeFilter("all");
    setBudgetLines([]);
    setEditingId(null);
  };

  const initializeBudgetLines = () => {
    const lines: BudgetLine[] = budgetableAccounts.map((acc) => ({
      accountId: acc.id,
      accountName: `${acc.code} - ${acc.name}`,
      annualAmount: 0,
      monthlyBreakdown: {},
    }));
    setBudgetLines(lines);
  };

  const handleCreate = () => {
    resetForm();
    setShowModal(true);
    setTimeout(() => initializeBudgetLines(), 100);
  };

  const handleEdit = (budget: Budget) => {
    setBudgetName(budget.name);
    setSelectedFY(budget.fiscalYearId);
    setPeriodType(budget.period);
    setBudgetLines(budget.lines);
    setEditingId(budget.id);
    setShowModal(true);
  };

  const updateLineAmount = (lineIndex: number, monthKey: string, value: number) => {
    setBudgetLines((prev) => {
      const newLines = [...prev];
      const line = { ...newLines[lineIndex] };
      line.monthlyBreakdown = { ...line.monthlyBreakdown, [monthKey]: value };
      line.annualAmount = Object.values(line.monthlyBreakdown).reduce((sum, val) => sum + val, 0);
      newLines[lineIndex] = line;
      return newLines;
    });
  };

  const getMonthKey = (fyStartYear: number, monthIndex: number): string => {
    const year = monthIndex < 9 ? fyStartYear : fyStartYear + 1;
    const month = (monthIndex + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  };

  const getColumnTotal = (monthKey: string): number => {
    return budgetLines.reduce((sum, line) => sum + (line.monthlyBreakdown[monthKey] || 0), 0);
  };

  const getTotalBudget = (): number => {
    return budgetLines.reduce((sum, line) => sum + line.annualAmount, 0);
  };

  const handleCopyPreviousYear = () => {
    // TODO: Implement copy from previous year's actuals
    toast("Copy from previous year - Feature coming soon");
  };

  const handleImportExcel = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet);

          // Process imported data
          toast.success(`Imported ${json.length} rows from Excel`);
          // TODO: Map Excel rows to budget lines
        } catch (error) {
          toast.error("Failed to import Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const handleExportTemplate = () => {
    const fy = fiscalYears.find((f) => f.id === selectedFY);
    if (!fy) return;

    const fyStartYear = parseInt(fy.name.split("/")[0]);
    const headers = ["Account Code", "Account Name", ...fiscalMonths, "Annual Total"];

    const rows = budgetableAccounts.map((acc) => {
      const row: any = {
        "Account Code": acc.code,
        "Account Name": acc.name,
      };

      fiscalMonths.forEach((month, idx) => {
        row[month] = 0;
      });

      row["Annual Total"] = 0;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget Template");
    XLSX.writeFile(wb, `Budget_Template_FY_${fy.name}.xlsx`);
    toast.success("Template exported");
  };

  const handleSave = async () => {
    if (!budgetName.trim()) {
      toast.error("Budget name is required");
      return;
    }
    if (!selectedFY) {
      toast.error("Fiscal year is required");
      return;
    }

    const filteredLines = budgetLines.filter((line) => line.annualAmount > 0);

    if (filteredLines.length === 0) {
      toast.error("Add at least one budget line with amount");
      return;
    }

    const budget: Budget = {
      id: editingId || `bdg-${Date.now()}`,
      name: budgetName,
      fiscalYearId: selectedFY,
      period: periodType,
      lines: filteredLines,
      createdBy: currentUser?.id,
      createdAt: editingId ? undefined : new Date().toISOString(),
    };

    if (editingId) {
      setBudgets((prev) => prev.map((b) => (b.id === editingId ? budget : b)));
      toast.success("Budget updated successfully");
    } else {
      setBudgets((prev) => [...prev, budget]);
      toast.success("Budget created successfully");
    }

    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    toast.success("Budget deleted");
    setDeleteConfirm(null);
  };

  const selectedFYData = fiscalYears.find((fy) => fy.id === selectedFY);
  const fyStartYear = selectedFYData ? parseInt(selectedFYData.name.split("/")[0]) : 2081;

  return (
    <div className="flex flex-col gap-5 p-6">
      <ActionToolbar
        title="Budget Master"
        subtitle="Define budgets for accounts and cost centers"
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Budget Master
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage annual budgets for financial planning
          </p>
        </div>
        <Button variant="primary" onClick={handleCreate} icon={<Plus className="h-4 w-4" />}>
          Create Budget
        </Button>
      </div>

      {/* Budget List */}
      {budgets.length === 0 ? (
        <Card border padding="lg">
          <div className="text-center py-12">
            <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No budgets created yet</p>
            <Button variant="primary" onClick={handleCreate} className="mt-4">
              Create Your First Budget
            </Button>
          </div>
        </Card>
      ) : (
        <Card border padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Budget Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Fiscal Year
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Period
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                    Total Amount
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">
                    Lines
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                {budgets.map((budget) => {
                  const fy = fiscalYears.find((f) => f.id === budget.fiscalYearId);
                  const total = budget.lines.reduce((sum, line) => sum + line.annualAmount, 0);

                  return (
                    <tr key={budget.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {budget.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {fy?.name || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">{budget.period}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-600">
                        {symbol} {formatNumber(total)}
                      </td>
                      <td className="px-4 py-3 text-center">{budget.lines.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(budget)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(budget.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Budget" : "Create Budget"}
              </h2>
            </div>

            <div className="p-6 space-y-4 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label="Budget Name"
                  value={budgetName}
                  onChange={setBudgetName}
                  placeholder="e.g., FY 2081-82 Operating Budget"
                  required
                />

                <Select
                  label="Fiscal Year"
                  options={[{ value: "", label: "Select Fiscal Year" }, ...fiscalYearOptions]}
                  value={selectedFY}
                  onChange={(v) => {
                    setSelectedFY(v);
                    if (!editingId) initializeBudgetLines();
                  }}
                  required
                />

                <Select
                  label="Period Type"
                  options={[
                    { value: BudgetPeriod.MONTHLY, label: "Monthly" },
                    { value: BudgetPeriod.QUARTERLY, label: "Quarterly" },
                    { value: BudgetPeriod.YEARLY, label: "Yearly" },
                  ]}
                  value={periodType}
                  onChange={(v) => setPeriodType(v as BudgetPeriod)}
                />

                <Select
                  label="Account Filter"
                  options={[
                    { value: "all", label: "All P&L Accounts" },
                    { value: "income", label: "Income Only" },
                    { value: "expense", label: "Expense Only" },
                  ]}
                  value={accountTypeFilter}
                  onChange={(v) => {
                    setAccountTypeFilter(v as any);
                    if (!editingId) initializeBudgetLines();
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCopyPreviousYear}
                  icon={<Copy className="h-4 w-4" />}
                >
                  Copy Previous Year
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImportExcel}
                  icon={<Upload className="h-4 w-4" />}
                >
                  Import from Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportTemplate}
                  icon={<Upload className="h-4 w-4" />}
                >
                  Export Template
                </Button>
              </div>
            </div>

            {/* Budget Grid */}
            <div className="flex-1 overflow-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-left font-semibold min-w-[250px]">
                        Account
                      </th>
                      {fiscalMonths.map((month, idx) => (
                        <th
                          key={month}
                          className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-center font-semibold min-w-[100px]"
                        >
                          {month}
                        </th>
                      ))}
                      <th className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-right font-semibold min-w-[120px] bg-blue-50 dark:bg-blue-900/20">
                        Annual Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetLines.map((line, lineIdx) => (
                      <tr key={line.accountId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-2 py-2 border border-gray-300 dark:border-gray-600 font-medium">
                          {line.accountName}
                        </td>
                        {fiscalMonths.map((month, monthIdx) => {
                          const monthKey = getMonthKey(fyStartYear, monthIdx);
                          const value = line.monthlyBreakdown[monthKey] || 0;

                          return (
                            <td
                              key={month}
                              className="px-2 py-2 border border-gray-300 dark:border-gray-600"
                            >
                              <input
                                type="number"
                                value={value === 0 ? "" : value}
                                onChange={(e) =>
                                  updateLineAmount(
                                    lineIdx,
                                    monthKey,
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-2 py-1 text-right border-0 bg-transparent focus:bg-yellow-50 dark:focus:bg-yellow-900/20 focus:outline-none"
                                placeholder="0"
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-right font-bold bg-blue-50 dark:bg-blue-900/20">
                          {formatNumber(line.annualAmount)}
                        </td>
                      </tr>
                    ))}

                    {/* Column Totals */}
                    <tr className="bg-green-50 dark:bg-green-900/20 font-bold">
                      <td className="px-2 py-2 border border-gray-300 dark:border-gray-600">
                        TOTAL
                      </td>
                      {fiscalMonths.map((month, monthIdx) => {
                        const monthKey = getMonthKey(fyStartYear, monthIdx);
                        const total = getColumnTotal(monthKey);

                        return (
                          <td
                            key={month}
                            className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-right"
                          >
                            {formatNumber(total)}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 border border-gray-300 dark:border-gray-600 text-right text-lg">
                        {symbol} {formatNumber(getTotalBudget())}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} icon={<Save className="h-4 w-4" />}>
                {editingId ? "Update Budget" : "Create Budget"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Budget?"
        message="This will permanently delete the budget. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger
      />
    </div>
  );
};

export default BudgetMaster;
