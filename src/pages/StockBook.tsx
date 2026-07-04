// @ts-nocheck
// src/pages/StockBook.tsx
// Stock Ledger — per-item movement history with running valuation (WA or FIFO)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Download, Package } from "lucide-react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { adToBS } from "../lib/nepaliDate";
import { ReportEmptyState } from "../components/ReportEmptyState";
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

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const thR = `${th} text-right`;
const td = "px-3 py-2.5 text-[12px] text-gray-700";
const tdR = `${td} number-cell`;
const tdRB = `${td} number-cell-bold`;
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50";
const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600";

function typeBadge(movementType: string, voucherType: string, inQty: number) {
  if (movementType === "opening") {
    return <span className="status-pill status-pill-active">{voucherType}</span>;
  }
  if (inQty > 0) {
    return <span className="status-pill status-pill-posted">{voucherType}</span>;
  }
  return <span className="status-pill status-pill-pending">{voucherType}</span>;
}

const Amt = ({ v, cls = "" }: { v: number; cls?: string }) =>
  v !== 0 ? <span className={`number-cell ${cls}`}>{formatNumber(v)}</span> : <span className="text-gray-300">-</span>;

// ─────────────────────────────────────────────────────────────────────────────

const StockBook: React.FC = () => {
  const { items, warehouses, stockMovements, currentFiscalYear } = useStore();

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
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Ledger</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Item-wise movement history with {methodLabel.toLowerCase()} valuation
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            className={method === "weighted-average" ? btnPrimary : btnOutline}
            onClick={() => setMethod("weighted-average")}
          >
            Weighted avg
          </button>
          <button
            type="button"
            className={method === "fifo" ? btnPrimary : btnOutline}
            onClick={() => setMethod("fifo")}
          >
            FIFO
          </button>
          <button type="button" className={btnOutline} onClick={handleExport}>
            <Download className="h-3.5 w-3.5 inline mr-1" />
            Export
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3 mb-4 bg-white border border-gray-200 rounded-md p-3">
        <div>
          <label className={labelCls}>Stock item</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className={`${inputCls} min-w-[220px]`}
          >
            <option value="">Select item</option>
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
        <div>
          <label className={labelCls}>Warehouse</label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className={`${inputCls} min-w-[160px]`}
          >
            <option value="">All warehouses</option>
            {(warehouses ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
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
      </div>

      {result && (
        <div className="flex flex-col sm:flex-row border border-gray-200 rounded-md bg-white overflow-hidden mb-4">
          {[
            { label: "Opening qty", val: result.openingQty },
            { label: "Total inward", val: result.totalInQty },
            { label: "Total outward", val: result.totalOutQty },
            { label: "Closing qty", val: result.closingQty },
          ].map((cell, idx, arr) => (
            <div
              key={cell.label}
              className={`flex-1 px-4 py-3 ${idx < arr.length - 1 ? "border-r border-gray-200" : ""}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {cell.label}
              </div>
              <div className="text-[12px] number-cell-bold text-gray-800 mt-1">
                {formatNumber(cell.val)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        {!selectedItemId ? (
          <ReportEmptyState
            icon={<Package size={28} strokeWidth={1.5} />}
            message="Select a stock item to view its ledger"
            hint="Choose an item from the filter bar above."
          />
        ) : filteredRows.length === 0 ? (
          <ReportEmptyState
            message="No movements found for the selected period"
            hint="Adjust the date range or check stock transactions for this item."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th>Date (BS)</th>
                  <th>Voucher no.</th>
                  <th>Voucher type</th>
                  <th className="th-right">In qty</th>
                  <th className="th-right">In rate</th>
                  <th className="th-right">In value</th>
                  <th className="th-right">Out qty</th>
                  <th className="th-right">Out rate</th>
                  <th className="th-right">Out value</th>
                  <th className="th-right">Bal qty</th>
                  <th className="th-right">Bal rate</th>
                  <th className="th-right">Bal value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.movementId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className={`${td} whitespace-nowrap`}>{toBSDisplay(row.date)}</td>
                    <td className={td}>{row.voucherNo}</td>
                    <td className={td}>{typeBadge(row.type, row.voucherType, row.inQty)}</td>
                    <td className={tdR}>
                      <Amt v={row.inQty} />
                    </td>
                    <td className={tdR}>
                      <Amt v={row.inRate} />
                    </td>
                    <td className={tdR}>
                      <Amt v={row.inValue} />
                    </td>
                    <td className={tdR}>
                      <Amt v={row.outQty} />
                    </td>
                    <td className={tdR}>
                      <Amt v={row.outRate} />
                    </td>
                    <td className={tdR}>
                      <Amt v={row.outValue} />
                    </td>
                    <td className={tdRB}>
                      <Amt v={row.balQty} cls={row.balQty < 0 ? "number-cell-neg" : ""} />
                    </td>
                    <td className={tdR}>
                      <Amt v={row.balRate} />
                    </td>
                    <td className={tdRB}>
                      <Amt v={row.balValue} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                  <td colSpan={3} className={`${td} font-semibold text-gray-800`}>
                    Period totals / closing stock
                  </td>
                  <td className={`${td} number-cell-bold`}>{formatNumber(totals.inQty)}</td>
                  <td className={tdR} />
                  <td className={`${td} number-cell-bold`}>{formatNumber(totals.inValue)}</td>
                  <td className={`${td} number-cell-bold`}>{formatNumber(totals.outQty)}</td>
                  <td className={tdR} />
                  <td className={`${td} number-cell-bold`}>{formatNumber(totals.outValue)}</td>
                  <td className={`${td} number-cell-bold`}>{result ? formatNumber(result.closingQty) : "-"}</td>
                  <td className={`${td} number-cell-bold`}>{result ? formatNumber(result.weightedAvgRate) : "-"}</td>
                  <td className={`${td} number-cell-bold`}>{result ? formatNumber(result.closingValue) : "-"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockBook;
