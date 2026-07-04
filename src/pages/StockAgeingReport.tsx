// @ts-nocheck
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Download,
  Filter,
  Package,
  RefreshCw,
  Search,
  TrendingDown,
} from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { useStore } from "../store/useStore";

const inputCls =
  "h-8 w-full px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "mb-1 block text-[11px] font-medium text-gray-600";
const tableHeaderCls =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const sortableHeaderButtonCls =
  "flex w-full items-center justify-between gap-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500";
const bucketColumns = [
  { key: "b0_30", label: "0-30 Days", headerClass: "bg-green-50 text-green-700" },
  { key: "b31_60", label: "31-60 Days", headerClass: "bg-amber-50 text-amber-700" },
  { key: "b61_90", label: "61-90 Days", headerClass: "bg-orange-50 text-orange-700" },
  { key: "b91_180", label: "91-180 Days", headerClass: "bg-red-50 text-red-700" },
  { key: "b180plus", label: "180+ Days", headerClass: "bg-red-100 text-red-800" },
];

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export default function StockAgeingReport() {
  const { items, stockMovements, itemGroups, warehouses } = useStore();
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split("T")[0]);
  const [groupFilter, setGroupFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("totalValue");
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");

  // Calculate ageing data
  const ageingData = useMemo(() => {
    if (!items?.length || !stockMovements?.length) return [];

    const refDate = new Date(referenceDate || new Date().toISOString().split("T")[0]);

    return items
      .filter((item) => item.type !== "service")
      .filter((item) => !groupFilter || item.groupId === groupFilter)
      .map((item) => {
        // Get IN movements for this item, sorted oldest first
        const inMovements = stockMovements
          .filter(
            (m) =>
              m.itemId === item.id &&
              (m.type === "in" || m.type === "purchase" || m.movementType === "IN"),
          )
          .filter((m) => !warehouseFilter || m.warehouseId === warehouseFilter)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((m) => ({
            date: m.date,
            qty: Number(m.quantity || m.qty || 0),
            rate: Number(m.rate || m.costRate || 0),
            remainingQty: Number(m.quantity || m.qty || 0),
          }));

        // Get OUT movements sorted oldest first
        const outMovements = stockMovements
          .filter(
            (m) =>
              m.itemId === item.id &&
              (m.type === "out" || m.type === "sales" || m.movementType === "OUT"),
          )
          .filter((m) => !warehouseFilter || m.warehouseId === warehouseFilter)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // FIFO consumption
        let outQtyRemaining = outMovements.reduce(
          (s, m) => s + Number(m.quantity || m.qty || 0),
          0,
        );
        for (const inLot of inMovements) {
          if (outQtyRemaining <= 0) break;
          const consume = Math.min(inLot.remainingQty, outQtyRemaining);
          inLot.remainingQty -= consume;
          outQtyRemaining -= consume;
        }

        // Bucket the remaining stock
        const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b180plus: 0 };
        const bucketValues = { b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b180plus: 0 };

        for (const inLot of inMovements) {
          if (inLot.remainingQty <= 0) continue;
          const days = Math.floor(
            (refDate.getTime() - new Date(inLot.date).getTime()) / (1000 * 60 * 60 * 24),
          );
          const val = inLot.remainingQty * inLot.rate;
          if (days <= 30) {
            buckets.b0_30 += inLot.remainingQty;
            bucketValues.b0_30 += val;
          } else if (days <= 60) {
            buckets.b31_60 += inLot.remainingQty;
            bucketValues.b31_60 += val;
          } else if (days <= 90) {
            buckets.b61_90 += inLot.remainingQty;
            bucketValues.b61_90 += val;
          } else if (days <= 180) {
            buckets.b91_180 += inLot.remainingQty;
            bucketValues.b91_180 += val;
          } else {
            buckets.b180plus += inLot.remainingQty;
            bucketValues.b180plus += val;
          }
        }

        const totalQty = Object.values(buckets).reduce((s, v) => s + v, 0);
        const totalValue = Object.values(bucketValues).reduce((s, v) => s + v, 0);
        const avgRate = totalQty > 0 ? totalValue / totalQty : 0;
        const isDeadStock = buckets.b180plus > 0 && buckets.b180plus / Math.max(totalQty, 1) > 0.5;

        return { item, buckets, bucketValues, totalQty, totalValue, avgRate, isDeadStock };
      })
      .filter((row) => {
        if (categoryFilter === "DEAD") return row.isDeadStock;
        if (categoryFilter === "NEAR-DEAD")
          return row.buckets.b180plus / Math.max(row.totalQty, 1) > 0.5;
        return row.totalQty > 0;
      })
      .filter(
        (row) =>
          !searchTerm ||
          row.item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.item.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue > bValue ? -1 : 1;
        }
      });
  }, [
    items,
    stockMovements,
    referenceDate,
    groupFilter,
    warehouseFilter,
    categoryFilter,
    searchTerm,
    sortBy,
    sortDirection,
  ]);

  // Calculate summary values
  const summary = useMemo(() => {
    const totalValue = ageingData.reduce((sum, row) => sum + row.totalValue, 0);
    const value0_30 = ageingData.reduce((sum, row) => sum + row.bucketValues.b0_30, 0);
    const value91_180plus = ageingData.reduce(
      (sum, row) => sum + row.bucketValues.b91_180 + row.bucketValues.b180plus,
      0,
    );
    const deadStockValue = ageingData.reduce((sum, row) => sum + row.bucketValues.b180plus, 0);

    return { totalValue, value0_30, value91_180plus, deadStockValue };
  }, [ageingData]);

  const handleRunReport = () => {
    // Report is recalculated via useMemo when filters change
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      ageingData.map((row) => ({
        "Item Code": row.item.code,
        "Item Name": row.item.name,
        "Item Group": row.item.groupId,
        Unit: row.item.unit,
        "Total Stock Qty": row.totalQty,
        "Avg Cost Rate": row.avgRate,
        "Total Stock Value": row.totalValue,
        "0-30 Days Qty": row.buckets.b0_30,
        "0-30 Days Value": row.bucketValues.b0_30,
        "31-60 Days Qty": row.buckets.b31_60,
        "31-60 Days Value": row.bucketValues.b31_60,
        "61-90 Days Qty": row.buckets.b61_90,
        "61-90 Days Value": row.bucketValues.b61_90,
        "91-180 Days Qty": row.buckets.b91_180,
        "91-180 Days Value": row.bucketValues.b91_180,
        "180+ Days Qty": row.buckets.b180plus,
        "180+ Days Value": row.bucketValues.b180plus,
        "Is Dead Stock": row.isDeadStock ? "YES" : "NO",
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Ageing Report");
    XLSX.writeFile(wb, `Stock_Ageing_Report_${referenceDate}.xlsx`);
    toast.success("Exported to Excel successfully");
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  const deadStockItems = ageingData.filter((row) => row.isDeadStock);
  const deadStockTotalValue = deadStockItems.reduce(
    (sum, row) => sum + row.bucketValues.b180plus,
    0,
  );

  const renderSortIndicator = (column) =>
    sortBy === column ? (
      <span className="text-[11px] text-[#1557b0]">{sortDirection === "asc" ? "↑" : "↓"}</span>
    ) : null;

  const summaryCards = [
    {
      title: "Total Stock Value",
      value: money(summary.totalValue),
      icon: Package,
      accent: "text-[#1557b0]",
      border: "border-[#1557b0]/20",
      bg: "bg-white",
    },
    {
      title: "0-30 Days Value",
      value: money(summary.value0_30),
      icon: Package,
      accent: "text-green-700",
      border: "border-green-200",
      bg: "bg-green-50/60",
    },
    {
      title: "Slow Moving (91+ Days)",
      value: money(summary.value91_180plus),
      icon: TrendingDown,
      accent: "text-amber-700",
      border: "border-amber-200",
      bg: "bg-amber-50/60",
    },
    {
      title: "Dead Stock Value",
      value: money(summary.deadStockValue),
      icon: AlertTriangle,
      accent: "text-red-700",
      border: "border-red-200",
      bg: "bg-red-50/70",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f5f6fa] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Ageing Report</h1>
          <p className="mt-0.5 text-[11px] text-gray-500">
            FIFO-based bucket ageing analysis for current stock holdings by date, group, and
            warehouse
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunReport}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#1557b0] px-3 text-[12px] font-medium text-white hover:bg-[#0f4a96]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run Report
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="no-print mb-4 rounded-md border border-gray-200 bg-white p-3">
        <div className="mb-3 flex items-start gap-2">
          <div className="rounded-md border border-gray-200 bg-[#f5f6fa] p-1.5">
            <Filter className="h-3.5 w-3.5 text-[#1557b0]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Report filters
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Refine ageing results by item group, warehouse, reference date, and stock category.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className={labelCls}>Item Group</label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className={inputCls}
            >
              <option value="">All Groups</option>
              {(itemGroups || []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Warehouse</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className={inputCls}
            >
              <option value="">All Warehouses</option>
              {(warehouses || []).map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Reference Date</label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={inputCls}
            >
              <option value="ALL">All</option>
              <option value="NEAR-DEAD">Near-Dead (90+ days &gt;50%)</option>
              <option value="DEAD">Dead (180+ days)</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Search Items</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Code or name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`rounded-md border ${card.border} ${card.bg} p-3`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {card.title}
                  </p>
                  <p className="mt-1 font-mono text-[18px] font-semibold text-gray-800">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-md bg-white/80 p-2 ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-[11px] text-gray-500">As of {referenceDate}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-[#f5f6fa] px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Stock ageing analysis
            </p>
            <p className="mt-0.5 text-[12px] font-semibold text-gray-800">
              FIFO bucket view as of {referenceDate}
            </p>
          </div>
          <div className="text-[11px] text-gray-500">
            {ageingData.length} item{ageingData.length === 1 ? "" : "s"}
          </div>
        </div>

        {ageingData.length === 0 ? (
          <ReportEmptyState
            message="No stock ageing data found for the selected filters."
            hint="Adjust the group, warehouse, category, or search criteria and run the report again."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-[#f5f6fa]">
                    <th className={tableHeaderCls}>
                      <button
                        type="button"
                        className={sortableHeaderButtonCls}
                        onClick={() => handleSort("item.code")}
                      >
                        <span>Item Code</span>
                        {renderSortIndicator("item.code")}
                      </button>
                    </th>
                    <th className={tableHeaderCls}>
                      <button
                        type="button"
                        className={sortableHeaderButtonCls}
                        onClick={() => handleSort("item.name")}
                      >
                        <span>Item Name</span>
                        {renderSortIndicator("item.name")}
                      </button>
                    </th>
                    <th className={tableHeaderCls}>Item Group</th>
                    <th className={tableHeaderCls}>Unit</th>
                    <th className={`${tableHeaderCls} text-right`}>
                      <button
                        type="button"
                        className={`${sortableHeaderButtonCls} justify-end`}
                        onClick={() => handleSort("totalQty")}
                      >
                        <span>Total Qty</span>
                        {renderSortIndicator("totalQty")}
                      </button>
                    </th>
                    <th className={`${tableHeaderCls} text-right`}>
                      <button
                        type="button"
                        className={`${sortableHeaderButtonCls} justify-end`}
                        onClick={() => handleSort("avgRate")}
                      >
                        <span>Avg Cost Rate</span>
                        {renderSortIndicator("avgRate")}
                      </button>
                    </th>
                    <th className={`${tableHeaderCls} text-right`}>
                      <button
                        type="button"
                        className={`${sortableHeaderButtonCls} justify-end`}
                        onClick={() => handleSort("totalValue")}
                      >
                        <span>Total Value</span>
                        {renderSortIndicator("totalValue")}
                      </button>
                    </th>
                    {bucketColumns.map((bucket) => (
                      <th
                        key={bucket.key}
                        className={`${tableHeaderCls} text-center ${bucket.headerClass}`}
                      >
                        {bucket.label}
                      </th>
                    ))}
                    <th className={`${tableHeaderCls} text-center`}>Dead Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {ageingData.map((row) => (
                    <tr
                      key={row.item.id}
                      className="group border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2.5 text-[12px] font-medium text-[#1557b0]">
                        {row.item.code}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.item.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.item.groupId}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.item.unit}</td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-800">
                        {row.totalQty}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-700">
                        {money(row.avgRate)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right font-semibold text-gray-800">
                        {money(row.totalValue)}
                      </td>
                      {bucketColumns.map((bucket) => (
                        <td
                          key={`${row.item.id}-${bucket.key}`}
                          className="px-3 py-2.5 text-[12px] text-right"
                        >
                          <div className="font-mono text-[12px] text-gray-700">
                            {row.buckets[bucket.key]}
                          </div>
                          <div className="font-mono text-[11px] text-gray-500">
                            {money(row.bucketValues[bucket.key])}
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center text-[12px]">
                        <span
                          className={
                            row.isDeadStock
                              ? "inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-700"
                              : "inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-green-100 text-green-700"
                          }
                        >
                          {row.isDeadStock ? "YES" : "NO"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 bg-[#f5f6fa] px-3 py-2 text-[11px] text-gray-500">
              {ageingData.length} stock item{ageingData.length === 1 ? "" : "s"} in report
            </div>
          </>
        )}
      </div>

      {deadStockItems.length > 0 && (
        <div className="overflow-hidden rounded-md border border-red-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
                Dead stock summary
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-gray-800">
                Items concentrated in the 180+ day bucket
              </p>
            </div>
            <div className="text-right text-[11px] text-red-700">
              <span className="font-medium">Total dead stock value</span>
              <div className="font-mono text-[12px] font-semibold">
                {money(deadStockTotalValue)}
              </div>
            </div>
          </div>

          <div className="mx-3 my-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span className="text-[12px] font-medium text-amber-800">
              Recommended action: Markdown or write-off
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-red-200 bg-red-50">
                  <th className={tableHeaderCls}>Item Code</th>
                  <th className={tableHeaderCls}>Item Name</th>
                  <th className={`${tableHeaderCls} text-right`}>Dead Qty</th>
                  <th className={`${tableHeaderCls} text-right`}>Dead Value</th>
                  <th className={`${tableHeaderCls} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {deadStockItems.map((row) => (
                  <tr
                    key={`dead-${row.item.id}`}
                    className="border-b border-red-100 hover:bg-red-50/40"
                  >
                    <td className="px-3 py-2.5 text-[12px] font-medium text-[#1557b0]">
                      {row.item.code}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.item.name}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-800">
                      {row.buckets.b180plus}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right font-semibold text-red-700">
                      {money(row.bucketValues.b180plus)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {}}
                        className="inline-flex h-7 items-center rounded-md border border-red-300 bg-white px-3 text-[12px] font-medium text-red-700 hover:bg-red-50"
                      >
                        Write Off
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-red-200 bg-red-50/70 px-3 py-2 text-[11px] text-red-700">
            {deadStockItems.length} dead stock item{deadStockItems.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}
