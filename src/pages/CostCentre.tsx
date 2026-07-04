// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store";
import {
  LayoutGrid,
  Plus,
  Edit2,
  Trash2,
  Download,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Target,
  ChevronRight,
  X,
  Building2,
} from "lucide-react";
import * as XLSX from "xlsx";

type Tab = "master" | "summary" | "ledger" | "matrix";
type CCType = "cost" | "profit" | "investment";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

const TYPE_COLORS: Record<CCType, string> = {
  cost: "orange",
  profit: "green",
  investment: "blue",
};

export default function CostCentre() {
  const {
    costCentres = [],
    costCentreAllocations = [],
    accounts = [],
    vouchers = [],
    currentFiscalYear,
    loadCostCentreData,
    addCostCentre,
    updateCostCentre,
    deleteCostCentre,
    addCostCentreAllocation,
    deleteCostCentreAllocation,
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>("master");
  const [showModal, setShowModal] = useState(false);
  const [editCC, setEditCC] = useState<any>(null);
  const [selectedCC, setSelectedCC] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState(
    currentFiscalYear?.startDate || new Date().getFullYear() + "-04-01",
  );
  const [toDate, setToDate] = useState(
    currentFiscalYear?.endDate || new Date().getFullYear() + "-03-31",
  );
  const [filterType, setFilterType] = useState<"all" | CCType>("all");

  const [form, setForm] = useState<any>({
    code: "",
    name: "",
    type: "cost",
    parentId: undefined,
    description: "",
    managerId: "",
    budgetAmount: 0,
    isActive: true,
  });

  useEffect(() => {
    loadCostCentreData?.();
  }, []);

  // ── Filtered centres ──────────────────────────────────────────────────────
  const filteredCCs = useMemo(
    () =>
      costCentres.filter((cc) => cc.isActive && (filterType === "all" || cc.type === filterType)),
    [costCentres, filterType],
  );

  // ── Build allocation summary per cost centre ───────────────────────────────
  const ccSummary = useMemo(() => {
    const rangeAllocs = costCentreAllocations.filter(
      (a) => a.voucherDate >= fromDate && a.voucherDate <= toDate,
    );
    const map: Record<number, { income: number; expense: number; count: number }> = {};
    rangeAllocs.forEach((a) => {
      if (!map[a.costCentreId]) map[a.costCentreId] = { income: 0, expense: 0, count: 0 };
      const acc = accounts.find((ac: any) => String(ac.id) === String(a.accountId));
      const grp = (acc?.group || acc?.accountGroup || "").toLowerCase();
      const name = (acc?.name || "").toLowerCase();
      const isIncome = ["sales", "revenue", "income", "interest received"].some(
        (k) => name.includes(k) || grp.includes(k),
      );
      if (isIncome) map[a.costCentreId].income += a.amount;
      else map[a.costCentreId].expense += a.amount;
      map[a.costCentreId].count++;
    });
    return map;
  }, [costCentreAllocations, fromDate, toDate, accounts]);

  // ── Ledger entries for selected CC ───────────────────────────────────────
  const ccLedger = useMemo(
    () =>
      selectedCC
        ? costCentreAllocations
            .filter(
              (a) =>
                a.costCentreId === selectedCC &&
                a.voucherDate >= fromDate &&
                a.voucherDate <= toDate,
            )
            .sort((a, b) => b.voucherDate.localeCompare(a.voucherDate))
        : [],
    [costCentreAllocations, selectedCC, fromDate, toDate],
  );

  // ── Matrix: CC × Account ──────────────────────────────────────────────────
  const matrixData = useMemo(() => {
    const rangeAllocs = costCentreAllocations.filter(
      (a) => a.voucherDate >= fromDate && a.voucherDate <= toDate,
    );
    const accountIds = [...new Set(rangeAllocs.map((a) => a.accountId))];
    const ccIds = [...new Set(rangeAllocs.map((a) => a.costCentreId))];
    const matrix: Record<string, Record<number, number>> = {};
    rangeAllocs.forEach((a) => {
      if (!matrix[a.accountId]) matrix[a.accountId] = {};
      matrix[a.accountId][a.costCentreId] = (matrix[a.accountId][a.costCentreId] || 0) + a.amount;
    });
    return { accountIds, ccIds, matrix };
  }, [costCentreAllocations, fromDate, toDate]);

  // ── Save CC ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const now = new Date().toISOString();
    if (editCC?.id) {
      await updateCostCentre(editCC.id, { ...form, updatedAt: now });
    } else {
      await addCostCentre({ ...form, createdAt: now, updatedAt: now });
    }
    setShowModal(false);
    setEditCC(null);
    setForm({
      code: "",
      name: "",
      type: "cost",
      parentId: undefined,
      description: "",
      managerId: "",
      budgetAmount: 0,
      isActive: true,
    });
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportSummary = () => {
    const data = filteredCCs.map((cc) => {
      const s = ccSummary[cc.id!] || { income: 0, expense: 0, count: 0 };
      return {
        Code: cc.code,
        Name: cc.name,
        Type: cc.type,
        Budget: cc.budgetAmount,
        Income: s.income,
        Expense: s.expense,
        "Net P&L": s.income - s.expense,
        "Budget Util %": pct(s.expense, cc.budgetAmount),
        Entries: s.count,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost Centre Summary");
    XLSX.writeFile(wb, `CostCentre_${fromDate}_to_${toDate}.xlsx`);
  };

  const tabs = [
    { id: "master", label: "Centre Master", icon: Building2 },
    { id: "summary", label: "Summary", icon: BarChart2 },
    { id: "ledger", label: "Centre Ledger", icon: LayoutGrid },
    { id: "matrix", label: "Matrix Report", icon: Target },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cost / Profit Centre Accounting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Multi-dimensional cost allocation, profitability by department, and budget tracking
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "summary" && (
            <button
              onClick={exportSummary}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          {activeTab === "master" && (
            <button
              onClick={() => {
                setEditCC(null);
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Centre
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Cost Centres",
            value: costCentres.filter((c) => c.type === "cost").length,
            color: "orange",
          },
          {
            label: "Profit Centres",
            value: costCentres.filter((c) => c.type === "profit").length,
            color: "green",
          },
          {
            label: "Investment Centres",
            value: costCentres.filter((c) => c.type === "investment").length,
            color: "blue",
          },
          {
            label: "Total Allocations",
            value: costCentreAllocations.filter(
              (a) => a.voucherDate >= fromDate && a.voucherDate <= toDate,
            ).length,
            color: "purple",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}
          >
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className={`text-2xl font-bold text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Types</option>
          <option value="cost">Cost Centres</option>
          <option value="profit">Profit Centres</option>
          <option value="investment">Investment Centres</option>
        </select>
      </div>

      {/* ── MASTER TAB ────────────────────────────────────────────────────── */}
      {activeTab === "master" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCCs.map((cc) => {
            const parent = costCentres.find((p) => p.id === cc.parentId);
            const color = TYPE_COLORS[cc.type as CCType] || "gray";
            const s = ccSummary[cc.id!] || { income: 0, expense: 0, count: 0 };
            const netPL = s.income - s.expense;
            const utilPct = pct(s.expense, cc.budgetAmount);
            return (
              <div
                key={cc.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs bg-${color}-100 text-${color}-700 font-medium`}
                      >
                        {cc.type}
                      </span>
                      <span className="font-mono text-xs text-gray-400">{cc.code}</span>
                    </div>
                    <div className="font-semibold text-gray-800 mt-1">{cc.name}</div>
                    {parent && <div className="text-xs text-gray-400">{parent.name}</div>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditCC(cc);
                        setForm({ ...cc });
                        setShowModal(true);
                      }}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCostCentre(cc.id!)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mini P&L */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-gray-400">Income</div>
                    <div className="font-semibold text-green-700">{fmt(s.income)}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-gray-400">Expense</div>
                    <div className="font-semibold text-red-700">{fmt(s.expense)}</div>
                  </div>
                </div>

                {/* Net P&L */}
                <div
                  className={`text-sm font-semibold mb-2 ${netPL >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  Net: {netPL >= 0 ? "+" : ""}
                  {fmt(netPL)}
                </div>

                {/* Budget utilization */}
                {cc.budgetAmount > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Budget: {fmt(cc.budgetAmount)}</span>
                      <span>{utilPct}% used</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${utilPct >= 100 ? "bg-red-500" : utilPct >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(utilPct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setSelectedCC(cc.id!);
                    setActiveTab("ledger");
                  }}
                  className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  View Ledger <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {filteredCCs.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              No cost/profit centres found. Create one using the "Add Centre" button.
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY TAB ───────────────────────────────────────────────────── */}
      {activeTab === "summary" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  "Code",
                  "Centre Name",
                  "Type",
                  "Budget",
                  "Income",
                  "Expense",
                  "Net P&L",
                  "Budget Util",
                  "Entries",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCCs.map((cc) => {
                const s = ccSummary[cc.id!] || { income: 0, expense: 0, count: 0 };
                const netPL = s.income - s.expense;
                const utilPct = pct(s.expense, cc.budgetAmount);
                const color = TYPE_COLORS[cc.type as CCType] || "gray";
                return (
                  <tr key={cc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{cc.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{cc.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs bg-${color}-100 text-${color}-700`}
                      >
                        {cc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(cc.budgetAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(s.income)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmt(s.expense)}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${netPL >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      {netPL >= 0 ? "+" : ""}
                      {fmt(netPL)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-12">
                          <div
                            className={`h-2 rounded-full ${utilPct >= 100 ? "bg-red-500" : utilPct >= 80 ? "bg-yellow-400" : "bg-green-500"}`}
                            style={{ width: `${Math.min(utilPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-600">{utilPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{s.count}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${cc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {cc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Totals */}
              {filteredCCs.length > 0 &&
                (() => {
                  const totIncome = filteredCCs.reduce(
                    (s, cc) => s + (ccSummary[cc.id!]?.income || 0),
                    0,
                  );
                  const totExpense = filteredCCs.reduce(
                    (s, cc) => s + (ccSummary[cc.id!]?.expense || 0),
                    0,
                  );
                  return (
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        TOTALS
                      </td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt(totIncome)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmt(totExpense)}</td>
                      <td
                        className={`px-4 py-3 text-right ${totIncome - totExpense >= 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        {totIncome - totExpense >= 0 ? "+" : ""}
                        {fmt(totIncome - totExpense)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  );
                })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ── LEDGER TAB ────────────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={selectedCC || ""}
              onChange={(e) => setSelectedCC(+e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select Cost Centre</option>
              {filteredCCs.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.code} – {cc.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCC &&
            (() => {
              const cc = costCentres.find((c) => c.id === selectedCC);
              const s = ccSummary[selectedCC] || { income: 0, expense: 0, count: 0 };
              return (
                <div className="space-y-4">
                  {/* CC header */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="font-semibold text-blue-800">{cc?.name}</div>
                    <div className="flex gap-6 mt-2 text-sm">
                      <span className="text-green-700">Income: {fmt(s.income)}</span>
                      <span className="text-red-700">Expense: {fmt(s.expense)}</span>
                      <span
                        className={`font-semibold ${s.income - s.expense >= 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        Net: {s.income - s.expense >= 0 ? "+" : ""}
                        {fmt(s.income - s.expense)}
                      </span>
                      {cc?.budgetAmount ? (
                        <span className="text-gray-600">Budget: {fmt(cc.budgetAmount)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {[
                            "Date",
                            "Voucher Type",
                            "Account",
                            "Amount",
                            "Alloc %",
                            "Narration",
                            "Action",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ccLedger.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-xs">{a.voucherDate}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                {a.voucherType}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-700">{a.accountName}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(a.amount)}</td>
                            <td className="px-4 py-2 text-right text-gray-500">
                              {a.allocationPercent}%
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500 max-w-48 truncate">
                              {a.narration}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => deleteCostCentreAllocation(a.id!)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {ccLedger.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                              No allocations found for this centre in the selected period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* ── MATRIX TAB ────────────────────────────────────────────────────── */}
      {activeTab === "matrix" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <div className="p-4 border-b text-sm text-gray-600">
            Cost/Profit Centre × Account cross-tabulation for {fromDate} to {toDate}
          </div>
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50">
                  Account
                </th>
                {matrixData.ccIds.map((ccId) => {
                  const cc = costCentres.find((c) => c.id === ccId);
                  return (
                    <th
                      key={ccId}
                      className="px-3 py-3 text-center font-semibold text-gray-500 min-w-28"
                    >
                      {cc?.code || ccId}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {matrixData.accountIds.map((accId) => {
                const acc = accounts.find((a: any) => String(a.id) === String(accId));
                const rowTotal = matrixData.ccIds.reduce(
                  (s, ccId) => s + (matrixData.matrix[accId]?.[ccId] || 0),
                  0,
                );
                return (
                  <tr key={accId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-white">
                      {acc?.name || accId}
                    </td>
                    {matrixData.ccIds.map((ccId) => {
                      const val = matrixData.matrix[accId]?.[ccId] || 0;
                      return (
                        <td key={ccId} className="px-3 py-2 text-right text-gray-700">
                          {val > 0 ? fmt(val) : <span className="text-gray-200">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">
                      {fmt(rowTotal)}
                    </td>
                  </tr>
                );
              })}
              {/* Column totals */}
              {matrixData.accountIds.length > 0 && (
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                  <td className="px-4 py-2 sticky left-0 bg-gray-100">TOTAL</td>
                  {matrixData.ccIds.map((ccId) => {
                    const colTotal = matrixData.accountIds.reduce(
                      (s, accId) => s + (matrixData.matrix[accId]?.[ccId] || 0),
                      0,
                    );
                    return (
                      <td key={ccId} className="px-3 py-2 text-right">
                        {fmt(colTotal)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right">
                    {fmt(
                      matrixData.accountIds.reduce(
                        (s, accId) =>
                          s +
                          matrixData.ccIds.reduce(
                            (ss, ccId) => ss + (matrixData.matrix[accId]?.[ccId] || 0),
                            0,
                          ),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              )}
              {matrixData.accountIds.length === 0 && (
                <tr>
                  <td
                    colSpan={matrixData.ccIds.length + 2}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No allocation data for the selected period. Allocate transactions to cost
                    centres while entering vouchers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── COST CENTRE MODAL ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editCC ? "Edit Centre" : "Add Cost / Profit Centre"}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. CC-SALES"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centre Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Sales Department"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="cost">Cost Centre</option>
                    <option value="profit">Profit Centre</option>
                    <option value="investment">Investment Centre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Centre (optional)
                  </label>
                  <select
                    value={form.parentId || ""}
                    onChange={(e) => setForm({ ...form, parentId: +e.target.value || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">None (Top Level)</option>
                    {costCentres
                      .filter((c) => c.id !== editCC?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Purpose of this centre…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Annual Budget (NPR)
                  </label>
                  <input
                    type="number"
                    value={form.budgetAmount}
                    onChange={(e) => setForm({ ...form, budgetAmount: +e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                  <input
                    value={form.managerId || ""}
                    onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                    placeholder="Manager name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Active
              </label>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Save Centre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
