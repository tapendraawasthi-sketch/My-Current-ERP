// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import * as XLSX from "xlsx";
import {
  BarChart2,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCcw,
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
import { ReportEmptyState } from "../components/ReportEmptyState";
import { matchesBranchFilter } from "../lib/activeBranch";

const inputCls =
  "h-8 w-full px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "mb-1 block text-[11px] font-medium text-gray-600";
const primaryButtonCls =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)]";
const outlineButtonCls =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50";
const sectionCls = "overflow-hidden rounded-md border border-gray-200 bg-white";
const amountCellCls = "px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right";
const tabs = [
  { id: "sales", label: "Sales Summary" },
  { id: "pl", label: "P&L by Branch" },
  { id: "stock", label: "Stock by Branch" },
  { id: "consolidated", label: "Consolidated View" },
];

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function tabCls(active) {
  return [
    "inline-flex items-center border-b-2 px-1 py-2 text-[12px] font-medium transition-colors",
    active
      ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]"
      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-700",
  ].join(" ");
}

export default function BranchReports() {
  const { invoices, vouchers, stockMovements, accounts, fiscalYears, items } = useStore();
  const [branches, setBranches] = useState([]);
  const [activeTab, setActiveTab] = useState("sales");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    const db = getDB();
    db.branches
      .toArray()
      .catch(() => [])
      .then(setBranches);
  }, []);

  useEffect(() => {
    if (fiscalYears.length > 0 && !selectedFiscalYear) {
      const currentFY =
        fiscalYears.find((fy) => fy.status === "open") || fiscalYears[fiscalYears.length - 1];
      setSelectedFiscalYear(currentFY.id);
      setFromDate(currentFY.startDate);
      setToDate(currentFY.endDate);
    }
  }, [fiscalYears, selectedFiscalYear]);

  const currentFiscalYear = useMemo(() => {
    return fiscalYears.find((fy) => fy.id === selectedFiscalYear);
  }, [fiscalYears, selectedFiscalYear]);

  const allBranches = useMemo(
    () => [...branches, { id: "unallocated", name: "Unallocated", code: "UNALLOC" }],
    [branches],
  );

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const inDateRange = (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate);
      const filterId = branchFilter === "ALL" ? "all" : branchFilter;
      const matchesBranch = matchesBranchFilter(inv.branchId, filterId);
      return inDateRange && matchesBranch;
    });
  }, [invoices, fromDate, toDate, branchFilter]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const inDateRange = (!fromDate || v.date >= fromDate) && (!toDate || v.date <= toDate);
      const filterId = branchFilter === "ALL" ? "all" : branchFilter;
      const matchesBranch = matchesBranchFilter(v.branchId, filterId);
      return inDateRange && matchesBranch;
    });
  }, [vouchers, fromDate, toDate, branchFilter]);

  const salesSummary = useMemo(() => {
    const summary = {};

    allBranches.forEach((branch) => {
      const branchInvoices = filteredInvoices.filter((inv) => inv.branchId === branch.id);
      const sales = branchInvoices
        .filter((inv) => inv.type.includes("sales"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const purchases = branchInvoices
        .filter((inv) => inv.type.includes("purchase"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const collections = filteredVouchers
        .filter((v) => v.branchId === branch.id && v.type.includes("receipt"))
        .reduce((sum, v) => sum + (v.grandTotal || 0), 0);

      summary[branch.id] = {
        branch,
        sales,
        purchases,
        collection: collections,
        outstanding: sales - collections,
      };
    });

    return summary;
  }, [allBranches, filteredInvoices, filteredVouchers]);

  const plByBranch = useMemo(() => {
    const plData = {};

    allBranches.forEach((branch) => {
      const branchInvoices = filteredInvoices.filter((inv) => inv.branchId === branch.id);
      const branchVouchers = filteredVouchers.filter((v) => v.branchId === branch.id);

      const salesRevenue = branchInvoices
        .filter((inv) => inv.type.includes("sales"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const salesReturns = branchInvoices
        .filter((inv) => inv.type.includes("credit-note"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const netSales = salesRevenue - salesReturns;

      const cogs = branchInvoices
        .filter((inv) => inv.type.includes("purchase"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      const directExpenses = branchVouchers
        .filter((v) => {
          const account = accounts.find((acc) => acc.id === v.lines?.[0]?.accountId);
          return account?.type === "expense";
        })
        .reduce((sum, v) => sum + (v.grandTotal || 0), 0);

      const grossProfit = netSales - cogs;
      const netProfit = grossProfit - directExpenses;

      plData[branch.id] = {
        branch,
        salesRevenue,
        salesReturns,
        netSales,
        cogs,
        directExpenses,
        grossProfit,
        netProfit,
      };
    });

    return plData;
  }, [accounts, allBranches, filteredInvoices, filteredVouchers]);

  const stockByBranch = useMemo(() => {
    const stockData = {};

    branches.forEach((branch) => {
      if (!branch.warehouseId) return;

      const branchStock = stockMovements
        .filter((sm) => sm.warehouseId === branch.warehouseId)
        .reduce((acc, movement) => {
          const existing = acc[movement.itemId] || { qty: 0, totalValue: 0 };
          existing.qty += movement.type === "in" ? movement.quantity : -movement.quantity;
          existing.totalValue += movement.amount;
          acc[movement.itemId] = existing;
          return acc;
        }, {});

      const detailedStock = Object.entries(branchStock)
        .map(([itemId, data]) => {
          const item = (items || []).find((entry) => entry.id === itemId);
          return {
            item: item || { id: itemId, name: "Unknown Item", code: "N/A" },
            qty: data.qty,
            avgRate: data.qty > 0 ? data.totalValue / data.qty : 0,
            totalValue: data.totalValue,
          };
        })
        .filter((entry) => entry.qty !== 0);

      stockData[branch.id] = detailedStock;
    });

    return stockData;
  }, [branches, items, stockMovements]);

  const consolidatedData = useMemo(() => {
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    allBranches.forEach((branch) => {
      const branchInvoices = filteredInvoices.filter((inv) => inv.branchId === branch.id);
      const branchVouchers = filteredVouchers.filter((v) => v.branchId === branch.id);

      totalRevenue += branchInvoices
        .filter((inv) => inv.type.includes("sales"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      totalCogs += branchInvoices
        .filter((inv) => inv.type.includes("purchase"))
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

      totalExpenses += branchVouchers
        .filter((v) => {
          const account = accounts.find((acc) => acc.id === v.lines?.[0]?.accountId);
          return account?.type === "expense";
        })
        .reduce((sum, v) => sum + (v.grandTotal || 0), 0);
    });

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    return { totalRevenue, totalCogs, totalExpenses, grossProfit, netProfit };
  }, [accounts, allBranches, filteredInvoices, filteredVouchers]);

  const salesRows = useMemo(() => Object.values(salesSummary), [salesSummary]);
  const plRows = useMemo(() => Object.values(plByBranch), [plByBranch]);

  const salesTotals = useMemo(() => {
    return salesRows.reduce(
      (totals, row) => ({
        sales: totals.sales + row.sales,
        purchases: totals.purchases + row.purchases,
        grossProfit: totals.grossProfit + (row.sales - row.purchases),
        collection: totals.collection + row.collection,
        outstanding: totals.outstanding + row.outstanding,
      }),
      { sales: 0, purchases: 0, grossProfit: 0, collection: 0, outstanding: 0 },
    );
  }, [salesRows]);

  const plTotals = useMemo(() => {
    return plRows.reduce(
      (totals, row) => ({
        salesRevenue: totals.salesRevenue + row.salesRevenue,
        salesReturns: totals.salesReturns + row.salesReturns,
        netSales: totals.netSales + row.netSales,
        cogs: totals.cogs + row.cogs,
        directExpenses: totals.directExpenses + row.directExpenses,
        grossProfit: totals.grossProfit + row.grossProfit,
        netProfit: totals.netProfit + row.netProfit,
      }),
      {
        salesRevenue: 0,
        salesReturns: 0,
        netSales: 0,
        cogs: 0,
        directExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
      },
    );
  }, [plRows]);

  const stockSections = useMemo(() => {
    return branches
      .map((branch) => ({
        branch,
        rows: stockByBranch[branch.id] || [],
      }))
      .filter((section) => section.rows.length > 0);
  }, [branches, stockByBranch]);

  const hasBranchActivity = filteredInvoices.length > 0 || filteredVouchers.length > 0;
  const branchScopeCount = branchFilter === "ALL" ? allBranches.length : 1;

  const chartData = useMemo(
    () =>
      salesRows.map((row) => ({
        name: row.branch.code || row.branch.name,
        sales: row.sales,
      })),
    [salesRows],
  );

  const toggleExpand = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      salesRows.map((row) => ({
        Branch: row.branch.name,
        Sales: row.sales,
        Purchases: row.purchases,
        Collection: row.collection,
        Outstanding: row.outstanding,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branch Sales Summary");
    XLSX.writeFile(wb, `Branch_Sales_Summary_${fromDate}_to_${toDate}.xlsx`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-gray-50 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Branch-wise reports</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Sales, profitability, stock position, and consolidated branch performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportExcel} className={outlineButtonCls}>
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="no-print mb-4 rounded-lg border border-gray-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className={labelCls}>Fiscal year</label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => {
                setSelectedFiscalYear(e.target.value);
                const fy = fiscalYears.find((entry) => entry.id === e.target.value);
                if (fy) {
                  setFromDate(fy.startDate);
                  setToDate(fy.endDate);
                }
              }}
              className={inputCls}
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.yearBs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={inputCls}
            >
              <option value="ALL">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => {}} className={primaryButtonCls}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Run Report
            </button>
            <button type="button" onClick={exportExcel} className={outlineButtonCls}>
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          {currentFiscalYear?.yearBs || "Selected period"} · {filteredInvoices.length} invoices ·{" "}
          {filteredVouchers.length} vouchers in scope
        </p>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Branches in scope
              </p>
              <p className="mt-2 text-[18px] font-semibold text-gray-700">{branchScopeCount}</p>
              <p className="mt-1 text-[11px] text-gray-500">Includes unallocated totals</p>
            </div>
            <Building2 className="h-4 w-4 text-[var(--ds-action-primary)]" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Total sales
              </p>
              <p className="mt-2 text-[18px] font-semibold text-gray-700">
                {money(salesTotals.sales)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">Revenue in the selected period</p>
            </div>
            <BarChart2 className="h-4 w-4 text-[var(--ds-action-primary)]" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Collections
          </p>
          <p className="mt-2 text-[18px] font-semibold text-gray-700">
            {money(salesTotals.collection)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">Receipts tagged to branch activity</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Net profit
          </p>
          <p
            className={`mt-2 text-[18px] font-semibold ${
              consolidatedData.netProfit >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {money(consolidatedData.netProfit)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">Consolidated after direct expenses</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={tabCls(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sales" && (
        <div className={sectionCls}>
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-gray-700">Sales summary by branch</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Compare sales, purchases, collections, and outstanding balances per branch.
            </p>
          </div>

          {!hasBranchActivity ? (
            <ReportEmptyState
              message="No branch activity found for this period"
              hint="Adjust the fiscal year, date range, or branch filter to load sales data."
            />
          ) : (
            <>
              <div className="p-4">
                <div className="h-72 rounded-lg border border-gray-200 bg-[#fcfcfd] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip formatter={(value) => [money(value), "Sales"]} />
                      <Bar dataKey="sales" name="Sales">
                        {chartData.map((_, index) => (
                          <Cell key={`sales-bar-${index}`} fill="var(--ds-action-primary)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto border-t border-gray-200">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Branch
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Total Sales
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Total Purchase
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Gross Profit
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Collection
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Outstanding
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRows.map((row) => (
                      <tr
                        key={row.branch.id}
                        className="border-b border-gray-100 hover:border-l-[var(--ds-action-primary)] hover:bg-gray-50"
                      >
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="font-medium text-gray-700">{row.branch.name}</div>
                          <div className="text-[11px] text-gray-500">{row.branch.code || "—"}</div>
                        </td>
                        <td className={amountCellCls}>{money(row.sales)}</td>
                        <td className={amountCellCls}>{money(row.purchases)}</td>
                        <td
                          className={`${amountCellCls} ${
                            row.sales - row.purchases >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {money(row.sales - row.purchases)}
                        </td>
                        <td className={amountCellCls}>{money(row.collection)}</td>
                        <td className={amountCellCls}>{money(row.outstanding)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                      <td className="px-3 py-2.5 text-gray-700">TOTAL</td>
                      <td className={`${amountCellCls} font-bold`}>{money(salesTotals.sales)}</td>
                      <td className={`${amountCellCls} font-bold`}>
                        {money(salesTotals.purchases)}
                      </td>
                      <td
                        className={`${amountCellCls} font-bold ${
                          salesTotals.grossProfit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {money(salesTotals.grossProfit)}
                      </td>
                      <td className={`${amountCellCls} font-bold`}>
                        {money(salesTotals.collection)}
                      </td>
                      <td className={`${amountCellCls} font-bold`}>
                        {money(salesTotals.outstanding)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "pl" && (
        <div className={sectionCls}>
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-gray-700">P&amp;L by branch</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Review revenue, cost, expenses, and net contribution for each branch.
            </p>
          </div>

          {!hasBranchActivity ? (
            <ReportEmptyState
              message="No P&L rows available for the current filters"
              hint="Widen the date range or choose a branch with posted invoices and vouchers."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Branch
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Sales Revenue
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Sales Returns
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Net Sales
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      COGS
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Direct Expenses
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Gross Profit
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Net Profit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plRows.map((row) => (
                    <tr key={row.branch.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="font-medium text-gray-700">{row.branch.name}</div>
                        <div className="text-[11px] text-gray-500">{row.branch.code || "—"}</div>
                      </td>
                      <td className={amountCellCls}>{money(row.salesRevenue)}</td>
                      <td className={amountCellCls}>{money(row.salesReturns)}</td>
                      <td className={amountCellCls}>{money(row.netSales)}</td>
                      <td className={amountCellCls}>{money(row.cogs)}</td>
                      <td className={amountCellCls}>{money(row.directExpenses)}</td>
                      <td
                        className={`${amountCellCls} ${
                          row.grossProfit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {money(row.grossProfit)}
                      </td>
                      <td
                        className={`${amountCellCls} ${
                          row.netProfit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {money(row.netProfit)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                    <td className="px-3 py-2.5 text-gray-700">TOTAL</td>
                    <td className={`${amountCellCls} font-bold`}>{money(plTotals.salesRevenue)}</td>
                    <td className={`${amountCellCls} font-bold`}>{money(plTotals.salesReturns)}</td>
                    <td className={`${amountCellCls} font-bold`}>{money(plTotals.netSales)}</td>
                    <td className={`${amountCellCls} font-bold`}>{money(plTotals.cogs)}</td>
                    <td className={`${amountCellCls} font-bold`}>
                      {money(plTotals.directExpenses)}
                    </td>
                    <td
                      className={`${amountCellCls} font-bold ${
                        plTotals.grossProfit >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {money(plTotals.grossProfit)}
                    </td>
                    <td
                      className={`${amountCellCls} font-bold ${
                        plTotals.netProfit >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {money(plTotals.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "stock" && (
        <div className={sectionCls}>
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-gray-700">Stock by branch</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Expand a branch to inspect current quantity, average rate, and total stock value.
            </p>
          </div>

          {stockSections.length === 0 ? (
            <ReportEmptyState
              message="No branch stock records are available"
              hint="Stock appears only for branches linked to a warehouse with movement history."
            />
          ) : (
            <div className="divide-y divide-gray-200">
              {stockSections.map(({ branch, rows }) => {
                const sectionKey = `stock-${branch.id}`;
                const totalValue = rows.reduce((sum, row) => sum + row.totalValue, 0);
                return (
                  <div key={branch.id}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(sectionKey)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div>
                        <div className="text-[12px] font-medium text-gray-700">{branch.name}</div>
                        <div className="text-[11px] text-gray-500">
                          {rows.length} item{rows.length === 1 ? "" : "s"} · Value{" "}
                          {money(totalValue)}
                        </div>
                      </div>
                      {expandedSections[sectionKey] ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>

                    {expandedSections[sectionKey] && (
                      <div className="overflow-x-auto border-t border-gray-200">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                Item Name
                              </th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                Code
                              </th>
                              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                Qty
                              </th>
                              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                Avg Rate
                              </th>
                              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                Total Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr
                                key={`${branch.id}-${row.item.id}`}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="px-3 py-2.5 text-[12px] text-gray-700">
                                  {row.item.name}
                                </td>
                                <td className="px-3 py-2.5 text-[12px] text-gray-500">
                                  {row.item.code || "—"}
                                </td>
                                <td className={amountCellCls}>{row.qty}</td>
                                <td className={amountCellCls}>{money(row.avgRate)}</td>
                                <td className={amountCellCls}>{money(row.totalValue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "consolidated" && (
        <div className={sectionCls}>
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-gray-700">Consolidated view</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              A branch-neutral snapshot of total revenue, costs, and profitability.
            </p>
          </div>

          {!hasBranchActivity ? (
            <ReportEmptyState
              message="No consolidated figures available for this period"
              hint="Choose a date range with branch invoices or vouchers to generate totals."
            />
          ) : (
            <div className="p-4">
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Inter-branch transfers are eliminated in consolidated figures.
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-[#fcfcfd] p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Total Revenue
                  </p>
                  <p className="mt-2 text-[18px] font-semibold text-gray-700">
                    {money(consolidatedData.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-[#fcfcfd] p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Total COGS
                  </p>
                  <p className="mt-2 text-[18px] font-semibold text-gray-700">
                    {money(consolidatedData.totalCogs)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-[#fcfcfd] p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Gross Profit
                  </p>
                  <p
                    className={`mt-2 text-[18px] font-semibold ${
                      consolidatedData.grossProfit >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {money(consolidatedData.grossProfit)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-[#fcfcfd] p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Net Profit
                  </p>
                  <p
                    className={`mt-2 text-[18px] font-semibold ${
                      consolidatedData.netProfit >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {money(consolidatedData.netProfit)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Metric
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Total Revenue", value: consolidatedData.totalRevenue },
                      { label: "Total COGS", value: consolidatedData.totalCogs },
                      { label: "Direct Expenses", value: consolidatedData.totalExpenses },
                      { label: "Gross Profit", value: consolidatedData.grossProfit },
                      { label: "Net Profit", value: consolidatedData.netProfit },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-gray-100 last:border-b-0">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.label}</td>
                        <td
                          className={`${amountCellCls} ${
                            row.label.includes("Profit") && row.value < 0
                              ? "text-red-700"
                              : row.label.includes("Profit")
                                ? "text-green-700"
                                : ""
                          }`}
                        >
                          {money(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
