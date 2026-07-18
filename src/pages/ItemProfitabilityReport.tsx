// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Download, Search } from "lucide-react";
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
import * as XLSX from "xlsx";
import ReportEmptyState from "../components/ReportEmptyState";
import { getDB } from "../lib/db";
import { useStore } from "../store/useStore";
import { useBranchFilter } from "../hooks/useBranchFilter";

const CHART_MARGIN = { top: 12, right: 24, left: 120, bottom: 16 };
const AXIS_TICK = { fill: "#6b7280", fontSize: 11 };

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function getMarginColorClass(marginPct) {
  if (marginPct >= 20) {
    return "text-green-700";
  }

  if (marginPct >= 10) {
    return "text-amber-700";
  }

  return "text-red-700";
}

function getChartBarColor(marginPct) {
  if (marginPct >= 20) {
    return "#059669";
  }

  if (marginPct >= 10) {
    return "#d97706";
  }

  return "#dc2626";
}

function ProfitabilityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload || {};

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px]">
      <p className="font-medium text-gray-700">{label}</p>
      <div className="mt-1 space-y-1 text-gray-600">
        <div className="flex items-center justify-between gap-4">
          <span>Gross Margin</span>
          <span className="font-semibold text-gray-800">
            {Number(payload[0]?.value || 0).toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Revenue</span>
          <span className="font-semibold text-gray-800">{money(point.revenue)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ItemProfitabilityReport() {
  const { invoices, items, itemGroups, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate || "");
  const [groupFilter, setGroupFilter] = useState("");
  const [salespersonFilter, setSalespersonFilter] = useState("");
  const [viewMode, setViewMode] = useState("top20"); // top20, bottom20, all
  const [salespersons, setSalespersons] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Load salespersons
  useEffect(() => {
    const db = getDB();
    db.salespersons
      .toArray()
      .then(setSalespersons)
      .catch(() => setSalespersons([]));
  }, []);

  // Calculate profit data
  const profitData = useMemo(() => {
    if (!items || !invoices) return [];

    // Sales data from invoices
    const salesByItem = new Map(); // itemId -> { qty, revenue }

    (invoices || [])
      .filter((inv) => inv.type === "sales-invoice" || inv.type === "SALES_INVOICE")
      .filter((inv) => inv.status === "posted")
      .filter((inv) => (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate))
      .filter((inv) => !salespersonFilter || inv.salespersonId === salespersonFilter)
      .filter((inv) => matchBranch(inv.branchId))
      .forEach((inv) => {
        (inv.lines || inv.items || []).forEach((line) => {
          if (!line.itemId) return;
          const existing = salesByItem.get(line.itemId) || { qty: 0, revenue: 0, salePrices: [] };
          existing.qty += Number(line.qty || line.quantity || 0);
          existing.revenue += Number(line.amount || line.total || line.qty * line.rate || 0);
          existing.salePrices.push(Number(line.rate || 0));
          salesByItem.set(line.itemId, existing);
        });
      });

    // Purchase data from invoices
    const purchaseByItem = new Map(); // itemId -> { qty, cost }

    (invoices || [])
      .filter((inv) => inv.type === "purchase-invoice" || inv.type === "PURCHASE_INVOICE")
      .filter((inv) => inv.status === "posted")
      .filter((inv) => (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate))
      .filter((inv) => matchBranch(inv.branchId))
      .forEach((inv) => {
        (inv.lines || inv.items || []).forEach((line) => {
          if (!line.itemId) return;
          const existing = purchaseByItem.get(line.itemId) || { qty: 0, cost: 0 };
          existing.qty += Number(line.qty || line.quantity || 0);
          existing.cost += Number(line.amount || line.total || line.qty * line.rate || 0);
          purchaseByItem.set(line.itemId, existing);
        });
      });

    // Combine
    let results = (items || [])
      .filter((item) => salesByItem.has(item.id))
      .filter((item) => !groupFilter || item.groupId === groupFilter)
      .map((item) => {
        const sales = salesByItem.get(item.id) || { qty: 0, revenue: 0 };
        const purch = purchaseByItem.get(item.id) || { qty: 0, cost: 0 };
        const avgPurchRate = purch.qty > 0 ? purch.cost / purch.qty : 0;
        const cogs = sales.qty * avgPurchRate;
        const grossProfit = sales.revenue - cogs;
        const marginPct = sales.revenue > 0 ? (grossProfit / sales.revenue) * 100 : 0;
        const avgSaleRate = sales.qty > 0 ? sales.revenue / sales.qty : 0;
        const group = (itemGroups || []).find((g) => g.id === item.groupId)?.name || "Ungrouped";
        return {
          item,
          group,
          unitsSold: sales.qty,
          avgSaleRate,
          revenue: sales.revenue,
          avgPurchRate,
          cogs,
          grossProfit,
          marginPct,
        };
      });

    // Sort by gross profit
    results.sort((a, b) => b.grossProfit - a.grossProfit);

    // Apply view mode filter
    if (viewMode === "top20") {
      results = results.slice(0, 20);
    } else if (viewMode === "bottom20") {
      results = results.slice(-20).reverse(); // Bottom 20, reverse for ascending order
    }

    return results.filter(
      (item) =>
        !searchTerm ||
        item.item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [
    items,
    invoices,
    fromDate,
    toDate,
    groupFilter,
    salespersonFilter,
    viewMode,
    searchTerm,
    itemGroups,
    matchBranch,
    branchFilter,
  ]);

  // Calculate summary
  const summary = useMemo(() => {
    const totalRevenue = profitData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCOGS = profitData.reduce((sum, item) => sum + item.cogs, 0);
    const totalGP = profitData.reduce((sum, item) => sum + item.grossProfit, 0);
    const overallMargin = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCOGS, totalGP, overallMargin };
  }, [profitData]);

  const lossMakingItems = profitData.filter((item) => item.marginPct < 0);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      profitData.map((item, idx) => ({
        Rank: idx + 1,
        "Item Code": item.item.code,
        "Item Name": item.item.name,
        "Item Group": item.group,
        "Units Sold": item.unitsSold,
        "Avg Selling Rate": item.avgSaleRate,
        "Total Revenue": item.revenue,
        "Avg Purchase Rate": item.avgPurchRate,
        "Total COGS": item.cogs,
        "Gross Profit": item.grossProfit,
        "Margin %": item.marginPct,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Profitability");
    XLSX.writeFile(wb, `Item_Profitability_${fromDate}_to_${toDate}.xlsx`);
  };

  // Prepare chart data
  const chartData = profitData.map((item) => ({
    name: item.item.name.substring(0, 20) + (item.item.name.length > 20 ? "..." : ""),
    margin: item.marginPct,
    revenue: item.revenue,
  }));

  const kpiCards = [
    {
      label: "TOTAL REVENUE",
      value: money(summary.totalRevenue),
      valueClassName: "text-gray-800",
    },
    {
      label: "TOTAL COGS",
      value: money(summary.totalCOGS),
      valueClassName: "text-gray-800",
    },
    {
      label: "TOTAL GROSS PROFIT",
      value: money(summary.totalGP),
      valueClassName: summary.totalGP >= 0 ? "text-green-700" : "text-red-700",
    },
    {
      label: "OVERALL MARGIN %",
      value: `${summary.overallMargin.toFixed(2)}%`,
      valueClassName: getMarginColorClass(summary.overallMargin),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f5f6fa] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Item Profitability Report</h1>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Review item-wise sales performance, gross profit, and margins for the selected period.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <div className="no-print mb-4 rounded-md border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-600">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-600">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            />
          </div>

          {branchOptions.length > 0 && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-600">Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-600">Item Group</label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            >
              <option value="">All Groups</option>
              {itemGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-600">Salesperson</label>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            >
              <option value="">All Salespersons</option>
              {salespersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-600">View</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            >
              <option value="top20">Top 20 Profitable</option>
              <option value="bottom20">Bottom 20 Profitable</option>
              <option value="all">All Items</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {}}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              Run Analysis
            </button>
          </div>

          <div className="md:col-span-2 xl:col-span-6">
            <label className="mb-1 block text-[11px] font-medium text-gray-600">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items by code or name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {card.label}
            </p>
            <p className={`mt-2 text-[14px] font-semibold ${card.valueClassName}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-gray-800">Gross Margin by Item</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Margin percentage across the currently filtered items.
          </p>
        </div>
        <div className="h-[360px] p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="horizontal" data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: "#d1d5db" }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ProfitabilityTooltip />} cursor={false} />
                <Bar dataKey="margin" name="Gross Margin %" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getChartBarColor(entry.margin)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyState
              message="No item profitability data is available."
              hint="Adjust the date range or filters to populate the chart."
            />
          )}
        </div>
      </div>

      <div className="mb-4 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-gray-800">
            {viewMode === "top20"
              ? "Top 20 Profitable Items"
              : viewMode === "bottom20"
                ? "Bottom 20 Profitable Items"
                : "All Items"}
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Ranked item-wise margin analysis for the selected filters.
          </p>
        </div>

        {profitData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f5f6fa]">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Rank
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Item Code
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Item Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Item Group
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Units Sold
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Avg Selling Rate
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Total Revenue
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Avg Purchase Rate
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Total COGS
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Gross Profit
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Margin %
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {profitData.map((item, idx) => {
                  const rowClassName =
                    item.marginPct < 0
                      ? "group border-b border-gray-200 bg-red-50 transition-colors hover:bg-red-100/80"
                      : "group border-b border-gray-200 transition-colors hover:bg-[#f8fafc]";

                  return (
                    <tr key={item.item.id} className={rowClassName}>
                      <td className="border-l-2 border-l-transparent px-3 py-2.5 text-[12px] text-gray-700 group-hover:border-l-[var(--ds-action-primary)]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{item.item.code}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{item.item.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{item.group}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {item.unitsSold}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.avgSaleRate)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.avgPurchRate)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.cogs)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.grossProfit)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono text-[12px] font-semibold ${getMarginColorClass(item.marginPct)}`}
                      >
                        {item.marginPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.marginPct > 0 ? (
                          <TrendingUp className="mx-auto h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="mx-auto h-4 w-4 text-red-600" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#c7d2fe] bg-[#eef2ff] font-bold text-[12px] text-gray-700">
                  <td colSpan="5" className="px-3 py-2.5">
                    Summary
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500">-</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {money(summary.totalRevenue)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500">-</td>
                  <td className="px-3 py-2.5 text-right font-mono">{money(summary.totalCOGS)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{money(summary.totalGP)}</td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono ${getMarginColorClass(summary.overallMargin)}`}
                  >
                    {summary.overallMargin.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-500">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <ReportEmptyState
            message="No item profitability data found for the selected criteria."
            hint="Try widening the date range or clearing one of the applied filters."
          />
        )}
      </div>

      {lossMakingItems.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50">
          <div className="border-b border-red-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-red-700">Items Selling at a Loss</h2>
            <p className="mt-0.5 text-[11px] text-red-600">
              Review items where current revenue is below calculated cost.
            </p>
          </div>

          <div className="p-4">
            <div className="mb-4 rounded-md border border-red-200 bg-red-100 px-3 py-2 text-[11px] font-medium text-red-700">
              These items are being sold below cost. Consider repricing.
            </div>

            <div className="overflow-x-auto rounded-md border border-red-200 bg-white">
              <table className="min-w-[760px] w-full">
                <thead>
                  <tr className="border-b border-red-200 bg-[#f5f6fa]">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Item Code
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Item Name
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Revenue
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      COGS
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Gross Profit
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Margin %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lossMakingItems.map((item) => (
                    <tr
                      key={`loss-${item.item.id}`}
                      className="border-b border-red-100 transition-colors hover:bg-red-50"
                    >
                      <td className="border-l-2 border-l-transparent px-3 py-2.5 text-[12px] text-gray-700 hover:border-l-[var(--ds-action-primary)]">
                        {item.item.code}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{item.item.name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(item.cogs)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-red-700">
                        {money(item.grossProfit)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-red-700">
                        {item.marginPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
