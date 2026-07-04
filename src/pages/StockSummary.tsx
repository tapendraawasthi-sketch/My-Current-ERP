import React, { useState, useMemo, useCallback } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import {
  computeStockSummary,
  type ValuationMethod,
  type StockItemSummary,
} from "../lib/stockValuation";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const th =
  "px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border border-gray-200 bg-[#f5f6fa] text-right";
const thL =
  "px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border border-gray-200 bg-[#f5f6fa] text-left";
const td = "px-2 py-2 text-[12px] text-gray-700 border border-gray-200 text-right font-mono";
const tdL = "px-2 py-2 text-[12px] text-gray-700 border border-gray-200 text-left";
const tdBold =
  "px-2 py-2 text-[12px] font-bold text-gray-800 border border-gray-200 text-right font-mono bg-[#f0f4ff]";

export default function StockSummary() {
  const { stockMovements, items, currentFiscalYear } = useStore();

  const [method, setMethod] = useState<ValuationMethod>("weighted_average");
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate ?? "");
  const [toDate, setToDate] = useState(
    currentFiscalYear?.endDate ?? new Date().toISOString().split("T")[0],
  );
  const [search, setSearch] = useState("");
  const [showLedger, setShowLedger] = useState<string | null>(null);

  const summary = useMemo(() => {
    const raw = (stockMovements || []).map((m: any) => ({
      id: m.id,
      date: m.date || "",
      type: m.type || m.movementType || "purchase",
      itemId: m.itemId || "",
      itemName: m.itemName || items.find((i: any) => i.id === m.itemId)?.name || m.itemId,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouseName,
      qty: Number(m.qty || m.quantity || 0),
      rate: Number(m.rate || m.costRate || 0),
      amount: Number(m.amount || 0),
    }));

    return computeStockSummary(raw, method, fromDate || undefined, toDate || undefined);
  }, [stockMovements, items, method, fromDate, toDate]);

  const filtered = useMemo(
    () => summary.filter((s) => !search || s.itemName.toLowerCase().includes(search.toLowerCase())),
    [summary, search],
  );

  const totals = useMemo(
    () => ({
      openingAmount: filtered.reduce((s, r) => s + r.openingAmount, 0),
      purchaseAmount: filtered.reduce((s, r) => s + r.purchaseAmount, 0),
      salesAmount: filtered.reduce((s, r) => s + r.salesAmount, 0),
      closingAmount: filtered.reduce((s, r) => s + r.closingAmount, 0),
    }),
    [filtered],
  );

  const exportExcel = useCallback(() => {
    const headers = [
      "Stock Item",
      "Opening Qty",
      "Opening Rate",
      "Opening Amount",
      "Purchase Qty",
      "Purchase Rate",
      "Purchase Amount",
      "Sales Qty",
      "Sales Rate",
      "Sales Amount",
      "Closing Qty",
      "Closing Rate",
      "Closing Amount",
    ];
    const rows = filtered.map((r) => [
      r.itemName,
      r.openingQty,
      formatNumber(r.openingRate),
      formatNumber(r.openingAmount),
      r.purchaseQty,
      formatNumber(r.purchaseRate),
      formatNumber(r.purchaseAmount),
      r.salesQty,
      formatNumber(r.salesRate),
      formatNumber(r.salesAmount),
      r.closingQty,
      formatNumber(r.closingRate),
      formatNumber(r.closingAmount),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Summary");
    XLSX.writeFile(wb, `StockSummary_${method}_${toDate}.xlsx`);
    toast.success("Exported to Excel");
  }, [filtered, method, toDate]);

  const activeItem = showLedger ? filtered.find((f) => f.itemId === showLedger) : null;

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      {/* Page Header */}
      <div className="erp-report-toolbar flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Summary</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Opening · During Year · Closing — with valuation method
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportExcel}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end">
        {/* Valuation Method */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Valuation Method
          </label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden h-8">
            {(
              [
                ["weighted_average", "Weighted Avg"],
                ["fifo", "FIFO"],
                ["lifo", "LIFO"],
              ] as [ValuationMethod, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMethod(v)}
                className={`px-3 text-[11px] font-semibold transition-colors
                  ${method === v ? "bg-[#1557b0] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]"
          />
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Search Item
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Item name..."
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]"
          />
        </div>

        <div className="text-[11px] text-gray-400 self-end pb-1">
          Method:{" "}
          <strong className="text-gray-700">{method.replace("_", " ").toUpperCase()}</strong>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              {/* Group header */}
              <tr>
                <th className={thL} rowSpan={2} style={{ verticalAlign: "middle" }}>
                  Stock Item
                </th>
                <th
                  className={th}
                  colSpan={3}
                  style={{ textAlign: "center", background: "#e8f0fe", color: "#1557b0" }}
                >
                  Opening Stock
                </th>
                <th
                  className={th}
                  colSpan={3}
                  style={{ textAlign: "center", background: "#e6f4ea", color: "#059669" }}
                >
                  During Year — Purchase
                </th>
                <th
                  className={th}
                  colSpan={3}
                  style={{ textAlign: "center", background: "#fef3c7", color: "#d97706" }}
                >
                  During Year — Sales
                </th>
                <th
                  className={th}
                  colSpan={3}
                  style={{ textAlign: "center", background: "#f3e8ff", color: "#7c3aed" }}
                >
                  Closing Stock
                </th>
              </tr>
              <tr>
                {/* Opening */}
                <th className={th}>Qty</th>
                <th className={th}>Rate</th>
                <th className={th}>Amount</th>
                {/* Purchase */}
                <th className={th} style={{ background: "#e6f4ea" }}>
                  Qty
                </th>
                <th className={th} style={{ background: "#e6f4ea" }}>
                  Rate
                </th>
                <th className={th} style={{ background: "#e6f4ea" }}>
                  Amount
                </th>
                {/* Sales */}
                <th className={th} style={{ background: "#fef3c7" }}>
                  Qty
                </th>
                <th className={th} style={{ background: "#fef3c7" }}>
                  Rate
                </th>
                <th className={th} style={{ background: "#fef3c7" }}>
                  Amount
                </th>
                {/* Closing */}
                <th className={th} style={{ background: "#f3e8ff" }}>
                  Qty
                </th>
                <th className={th} style={{ background: "#f3e8ff" }}>
                  Rate
                </th>
                <th className={th} style={{ background: "#f3e8ff" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-[12px] text-gray-500">
                    No stock movements found for the selected period.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <React.Fragment key={row.itemId}>
                  <tr className="hover:bg-gray-50 border-b border-gray-100">
                    <td className={tdL}>
                      <button
                        className="text-[#1557b0] hover:underline font-semibold text-[12px]"
                        onClick={() => setShowLedger(showLedger === row.itemId ? null : row.itemId)}
                      >
                        {row.itemName}
                      </button>
                    </td>
                    {/* Opening */}
                    <td className={td}>{formatNumber(row.openingQty, 2)}</td>
                    <td className={td}>Rs. {formatNumber(row.openingRate)}</td>
                    <td className={td}>Rs. {formatNumber(row.openingAmount)}</td>
                    {/* Purchase */}
                    <td className={td} style={{ background: "#f6fff8" }}>
                      {formatNumber(row.purchaseQty, 2)}
                    </td>
                    <td className={td} style={{ background: "#f6fff8" }}>
                      Rs. {formatNumber(row.purchaseRate)}
                    </td>
                    <td className={td} style={{ background: "#f6fff8" }}>
                      Rs. {formatNumber(row.purchaseAmount)}
                    </td>
                    {/* Sales */}
                    <td className={td} style={{ background: "#fffef0" }}>
                      {formatNumber(row.salesQty, 2)}
                    </td>
                    <td className={td} style={{ background: "#fffef0" }}>
                      Rs. {formatNumber(row.salesRate)}
                    </td>
                    <td className={td} style={{ background: "#fffef0" }}>
                      Rs. {formatNumber(row.salesAmount)}
                    </td>
                    {/* Closing */}
                    <td className={tdBold} style={{ background: "#f5f0ff" }}>
                      {formatNumber(row.closingQty, 2)}
                    </td>
                    <td className={tdBold} style={{ background: "#f5f0ff" }}>
                      Rs. {formatNumber(row.closingRate)}
                    </td>
                    <td className={tdBold} style={{ background: "#f5f0ff" }}>
                      Rs. {formatNumber(row.closingAmount)}
                    </td>
                  </tr>

                  {/* Ledger Detail Expand */}
                  {showLedger === row.itemId && activeItem && (
                    <tr>
                      <td colSpan={13} className="p-0 border-b border-gray-200">
                        <div className="bg-blue-50 p-4">
                          <div className="text-[11px] font-bold text-[#1557b0] mb-2 uppercase tracking-wide">
                            Stock Ledger — {row.itemName} ({method.replace("_", " ").toUpperCase()})
                          </div>
                          <table className="w-full text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-[#1557b0] text-white">
                                <th className="px-2 py-1.5 text-left">Date</th>
                                <th className="px-2 py-1.5 text-left">Particulars</th>
                                <th className="px-2 py-1.5 text-right">In Qty</th>
                                <th className="px-2 py-1.5 text-right">In Rate</th>
                                <th className="px-2 py-1.5 text-right">In Amount</th>
                                <th className="px-2 py-1.5 text-right">Out Qty</th>
                                <th className="px-2 py-1.5 text-right">Out Rate</th>
                                <th className="px-2 py-1.5 text-right">Out Amount</th>
                                <th className="px-2 py-1.5 text-right">Bal Qty</th>
                                <th className="px-2 py-1.5 text-right">Bal Rate</th>
                                <th className="px-2 py-1.5 text-right">Bal Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Opening row */}
                              <tr className="bg-blue-100">
                                <td className="px-2 py-1">—</td>
                                <td className="px-2 py-1 font-semibold">Opening Balance</td>
                                <td className="px-2 py-1 text-right">—</td>
                                <td className="px-2 py-1 text-right">—</td>
                                <td className="px-2 py-1 text-right">—</td>
                                <td className="px-2 py-1 text-right">—</td>
                                <td className="px-2 py-1 text-right">—</td>
                                <td className="px-2 py-1 text-right">—</td>
                                <td className="px-2 py-1 text-right font-bold">
                                  {formatNumber(row.openingQty, 2)}
                                </td>
                                <td className="px-2 py-1 text-right font-bold">
                                  Rs. {formatNumber(row.openingRate)}
                                </td>
                                <td className="px-2 py-1 text-right font-bold">
                                  Rs. {formatNumber(row.openingAmount)}
                                </td>
                              </tr>
                              {activeItem.ledger.map((e, idx) => (
                                <tr
                                  key={idx}
                                  className={idx % 2 === 0 ? "bg-white" : "bg-blue-50/40"}
                                >
                                  <td className="px-2 py-1 font-mono">{e.date}</td>
                                  <td className="px-2 py-1 capitalize">{e.particulars}</td>
                                  <td className="px-2 py-1 text-right">
                                    {e.inQty > 0 ? formatNumber(e.inQty, 2) : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {e.inQty > 0 ? `Rs. ${formatNumber(e.inRate)}` : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {e.inQty > 0 ? `Rs. ${formatNumber(e.inAmount)}` : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {e.outQty > 0 ? formatNumber(e.outQty, 2) : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {e.outQty > 0 ? `Rs. ${formatNumber(e.outRate)}` : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {e.outQty > 0 ? `Rs. ${formatNumber(e.outAmount)}` : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right font-semibold">
                                    {formatNumber(e.balanceQty, 2)}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    Rs. {formatNumber(e.balanceRate)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-semibold">
                                    Rs. {formatNumber(e.balanceAmount)}
                                  </td>
                                </tr>
                              ))}
                              {/* Closing row */}
                              <tr className="bg-purple-100 font-bold">
                                <td className="px-2 py-1.5">—</td>
                                <td className="px-2 py-1.5">Closing Balance</td>
                                <td colSpan={6} />
                                <td className="px-2 py-1.5 text-right">
                                  {formatNumber(row.closingQty, 2)}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  Rs. {formatNumber(row.closingRate)}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  Rs. {formatNumber(row.closingAmount)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              {/* Totals row */}
              {filtered.length > 0 && (
                <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                  <td className="px-2 py-2.5 text-[12px] font-bold text-gray-800">TOTAL</td>
                  <td colSpan={2} className="border border-gray-200" />
                  <td className="px-2 py-2.5 text-right font-mono text-[12px] border border-gray-200">
                    Rs. {formatNumber(totals.openingAmount)}
                  </td>
                  <td colSpan={2} className="border border-gray-200" />
                  <td
                    className="px-2 py-2.5 text-right font-mono text-[12px] border border-gray-200"
                    style={{ background: "#e6f4ea" }}
                  >
                    Rs. {formatNumber(totals.purchaseAmount)}
                  </td>
                  <td colSpan={2} className="border border-gray-200" />
                  <td
                    className="px-2 py-2.5 text-right font-mono text-[12px] border border-gray-200"
                    style={{ background: "#fef3c7" }}
                  >
                    Rs. {formatNumber(totals.salesAmount)}
                  </td>
                  <td colSpan={2} className="border border-gray-200" />
                  <td
                    className="px-2 py-2.5 text-right font-mono text-[12px] font-bold border border-gray-200"
                    style={{ background: "#f3e8ff" }}
                  >
                    Rs. {formatNumber(totals.closingAmount)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-400 text-right">
        Valuation: {method.replace("_", " ").toUpperCase()} · Period: {fromDate} to {toDate}
      </div>
    </div>
  );
}
