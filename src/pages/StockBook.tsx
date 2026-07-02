// @ts-nocheck
// src/pages/StockBook.tsx
// Stock Ledger — per-item movement history with running valuation (WA or FIFO)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { BarChart2, Download, RefreshCw, TrendingUp, Package, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { adToBS, formatBS, todayBS } from "../lib/nepaliDate";
import {
  computeWeightedAverage,
  computeFIFO,
  type ValuationMethod,
  type ValuationRow,
} from "../lib/inventoryValuation";

// ── BS date helper ────────────────────────────────────────────────────────────
function toBSDisplay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const bs = adToBS(new Date(y, m - 1, d));
    return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}

// ── Amt cell ──────────────────────────────────────────────────────────────────
const Amt = ({ v, cls = "" }: { v: number; cls?: string }) =>
  v !== 0 ? (
    <span className={`font-mono text-right ${cls}`}>{formatNumber(v)}</span>
  ) : (
    <span className="text-gray-300">-</span>
  );

// ─────────────────────────────────────────────────────────────────────────────

const StockBook: React.FC = () => {
  const { items, warehouses, stockMovements, currentFiscalYear, companySettings } = useStore();

  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [method, setMethod] = useState<ValuationMethod>("weighted-average");
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate ?? "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate ?? "");

  // Today in BS for display
  const todayAD = new Date().toISOString().slice(0, 10);

  const selectedItem = useMemo(
    () => (items ?? []).find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  // ── Valuation computation ─────────────────────────────────────────────────
  const result = useMemo(() => {
    if (!selectedItem) return null;
    const warehouseId = selectedWarehouseId || null;
    return method === "fifo"
      ? computeFIFO(stockMovements ?? [], selectedItem, warehouseId, toDate || null)
      : computeWeightedAverage(stockMovements ?? [], selectedItem, warehouseId, toDate || null);
  }, [selectedItem, selectedWarehouseId, method, stockMovements, toDate]);

  // Filter rows by fromDate
  const filteredRows = useMemo(() => {
    if (!result) return [];
    if (!fromDate) return result.movements;
    return result.movements.filter((r) => r.date >= fromDate);
  }, [result, fromDate]);

  // Totals for filtered rows
  const totals = useMemo(() => {
    const t = { inQty: 0, inValue: 0, outQty: 0, outValue: 0 };
    for (const r of filteredRows) {
      t.inQty += r.inQty;
      t.inValue += r.inValue;
      t.outQty += r.outQty;
      t.outValue += r.outValue;
    }
    return t;
  }, [filteredRows]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!selectedItem || !result) {
      toast.error("Select an item first");
      return;
    }
    const rows = filteredRows.map((r) => ({
      "Date (BS)": toBSDisplay(r.date),
      "Date (AD)": r.date,
      "Voucher No": r.voucherNo,
      "Voucher Type": r.voucherType,
      "In Qty": r.inQty || "",
      "In Rate": r.inRate || "",
      "In Value": r.inValue || "",
      "Out Qty": r.outQty || "",
      "Out Rate": r.outRate || "",
      "Out Value": r.outValue || "",
      "Bal Qty": r.balQty,
      "Bal Rate (Avg)": r.balRate,
      "Bal Value": r.balValue,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Ledger");
    XLSX.writeFile(wb, `stock-ledger-${selectedItem.name}-${todayAD}.xlsx`);
    toast.success("Exported");
  };

  const methodLabel = method === "fifo" ? "FIFO" : "Weighted Average";

  return (
    <div className="page-wrapper">
      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <BarChart2 className="h-4 w-4" />
          <span className="page-title">STOCK LEDGER</span>
          <span className="badge badge-info" style={{ fontSize: 10 }}>
            Valuation: {methodLabel}
          </span>
        </div>
        <div className="page-toolbar-right">
          <button
            className={`px-3 py-1 text-[11px] font-bold uppercase border rounded ${
              method === "weighted-average"
                ? "bg-[#C9DEB5] border-black"
                : "bg-[#EBF5E2] border-black hover:bg-[#D4EABD]"
            }`}
            onClick={() => setMethod("weighted-average")}
          >
            Weighted Avg
          </button>
          <button
            className={`px-3 py-1 text-[11px] font-bold uppercase border rounded ${
              method === "fifo"
                ? "bg-[#C9DEB5] border-black"
                : "bg-[#EBF5E2] border-black hover:bg-[#D4EABD]"
            }`}
            onClick={() => setMethod("fifo")}
          >
            FIFO
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-1 text-[11px] border border-black rounded bg-[#EBF5E2] hover:bg-[#D4EABD]"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[#EBF5E2] border-b border-black">
        {/* Item selector */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">
            Stock Item *
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2] min-w-[220px]"
          >
            <option value="">-- Select Item --</option>
            {(items ?? [])
              .filter((i) => i.type !== "service")
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </div>
        {/* Warehouse */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">
            Warehouse
          </label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2] min-w-[160px]"
          >
            <option value="">All Warehouses</option>
            {(warehouses ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        {/* From date */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2]"
          />
        </div>
        {/* To date */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 px-2 text-[12px] border border-black rounded bg-[#EBF5E2]"
          />
        </div>
      </div>

      {/* ── KPI strip ── */}
      {result && (
        <div className="grid grid-cols-5 gap-0 border-b border-black bg-[#D4EABD]">
          {[
            {
              label: "Opening Qty",
              val: result.openingQty,
              rate: result.openingRate,
              value: result.openingValue,
            },
            {
              label: "Total Inward",
              val: result.totalInQty,
              rate: null,
              value: result.totalInValue,
            },
            {
              label: "Total Outward",
              val: result.totalOutQty,
              rate: null,
              value: result.totalOutValue,
            },
            {
              label: "Closing Qty",
              val: result.closingQty,
              rate: result.weightedAvgRate,
              value: result.closingValue,
            },
          ].map((k, i) => (
            <div key={i} className="px-4 py-2 border-r border-black last:border-r-0">
              <div className="text-[9px] font-bold tracking-wide text-gray-600">
                {k.label}
              </div>
              <div className="text-[16px] font-bold font-mono">{formatNumber(k.val)}</div>
              {k.rate !== null && (
                <div className="text-[10px] text-gray-600">
                  @ {formatNumber(k.rate)} = <strong>Rs. {formatNumber(k.value)}</strong>
                </div>
              )}
              {k.rate === null && (
                <div className="text-[10px] text-gray-600">
                  Value: <strong>Rs. {formatNumber(k.value)}</strong>
                </div>
              )}
            </div>
          ))}
          <div className="px-4 py-2">
            <div className="text-[9px] font-bold tracking-wide text-gray-600">Method</div>
            <div className="text-[14px] font-bold">{methodLabel}</div>
            <div className="text-[10px] text-gray-600">{selectedItem?.name}</div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="page-content-area overflow-auto">
        {!selectedItemId ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <Package className="h-12 w-12 text-gray-300" />
            <div className="text-sm font-semibold">Select a stock item to view its ledger</div>
            <div className="text-xs">Choose an item above to see movement-wise valuation</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <RefreshCw className="h-8 w-8 text-gray-300" />
            <div className="text-sm font-semibold">No movements found for the selected period</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap" style={{ width: 100 }}>
                    Date (BS)
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap" style={{ width: 110 }}>
                    Voucher No.
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap" style={{ width: 130 }}>
                    Voucher Type
                  </th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#EBF5E2]">In Qty</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#EBF5E2]">In Rate</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#EBF5E2]">In Value</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#fef3c7]">Out Qty</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#fef3c7]">Out Rate</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#fef3c7]">Out Value</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#D4EABD]">Bal Qty</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#D4EABD]">
                    Bal Rate{method === "fifo" ? " (FIFO)" : " (Avg)"}
                  </th>
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-[#D4EABD]">Bal Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={row.movementId} className={idx % 2 === 0 ? "bg-[#EBF5E2]" : "bg-white"}>
                    <td className="px-3 py-1.5 text-[11px] font-mono whitespace-nowrap">
                      {toBSDisplay(row.date)}
                    </td>
                    <td className="px-3 py-1.5 text-[11px] font-mono">{row.voucherNo}</td>
                    <td className="px-3 py-1.5 text-[11px]">
                      <span
                        className={`badge ${
                          row.type === "opening"
                            ? "badge-info"
                            : row.inQty > 0
                              ? "badge-success"
                              : "badge-warning"
                        }`}
                      >
                        {row.voucherType}
                      </span>
                    </td>
                    {/* Inward */}
                    <td className="px-3 py-1.5 text-right bg-[#EBF5E2]">
                      <Amt v={row.inQty} cls="text-green-700" />
                    </td>
                    <td className="px-3 py-1.5 text-right bg-[#EBF5E2]">
                      <Amt v={row.inRate} />
                    </td>
                    <td className="px-3 py-1.5 text-right bg-[#EBF5E2]">
                      <Amt v={row.inValue} cls="text-green-700 font-semibold" />
                    </td>
                    {/* Outward */}
                    <td className="px-3 py-1.5 text-right bg-[#fef3c7]">
                      <Amt v={row.outQty} cls="text-red-700" />
                    </td>
                    <td className="px-3 py-1.5 text-right bg-[#fef3c7]">
                      <Amt v={row.outRate} />
                    </td>
                    <td className="px-3 py-1.5 text-right bg-[#fef3c7]">
                      <Amt v={row.outValue} cls="text-red-700 font-semibold" />
                    </td>
                    {/* Balance */}
                    <td className="px-3 py-1.5 text-right font-bold bg-[#D4EABD]">
                      <span className={`font-mono ${row.balQty < 0 ? "text-red-700" : ""}`}>
                        {formatNumber(row.balQty)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right bg-[#D4EABD]">
                      <span className="font-mono">{formatNumber(row.balRate)}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold bg-[#D4EABD]">
                      <span className="font-mono">{formatNumber(row.balValue)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* ── Closing summary footer ── */}
              <tfoot>
                <tr className="border-t-2 border-black bg-[#C9DEB5] font-bold">
                  <td colSpan={3} className="px-3 py-2 text-[12px]">
                    Period Totals / Closing Stock
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">
                    {formatNumber(totals.inQty)}
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right font-mono text-green-700">
                    {formatNumber(totals.inValue)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-red-700">
                    {formatNumber(totals.outQty)}
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right font-mono text-red-700">
                    {formatNumber(totals.outValue)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[15px]">
                    {result ? formatNumber(result.closingQty) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {result ? formatNumber(result.weightedAvgRate) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[15px]">
                    {result ? formatNumber(result.closingValue) : "-"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Closing stock summary card ── */}
      {result && (
        <div className="border-t border-black bg-[#EBF5E2] px-4 py-3">
          <div className="flex flex-wrap gap-6 items-center text-[12px]">
            <div>
              <span className="text-gray-600 font-semibold text-[10px] tracking-wide">
                Item:{" "}
              </span>
              <strong>{selectedItem?.name}</strong>
              <span className="ml-2 text-gray-500">({selectedItem?.unit})</span>
            </div>
            <div>
              <span className="text-gray-600 font-semibold text-[10px] tracking-wide">
                Closing Qty:{" "}
              </span>
              <strong className="font-mono">{formatNumber(result.closingQty)}</strong>
            </div>
            <div>
              <span className="text-gray-600 font-semibold text-[10px] tracking-wide">
                {methodLabel} Rate:{" "}
              </span>
              <strong className="font-mono">Rs. {formatNumber(result.weightedAvgRate)}</strong>
            </div>
            <div>
              <span className="text-gray-600 font-semibold text-[10px] tracking-wide">
                Closing Value:{" "}
              </span>
              <strong className="font-mono text-[#1557b0]">
                Rs. {formatNumber(result.closingValue)}
              </strong>
            </div>
            <div className="ml-auto">
              <span className="badge badge-info text-[10px]">
                {filteredRows.length} transactions
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockBook;
