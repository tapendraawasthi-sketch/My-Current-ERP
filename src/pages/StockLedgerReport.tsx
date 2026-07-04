// src/pages/StockLedgerReport.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Download, RefreshCw } from "lucide-react";
import { formatNumber } from "../lib/utils";

export default function StockLedgerReport() {
  const { items, stockMovements } = useStore();
  const [selectedItem, setSelectedItem] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [showZeroStock, setShowZeroStock] = useState(true);

  const ledgerData = useMemo(() => {
    if (!selectedItem) return null;
    const item = (items || []).find((i: any) => i.id === selectedItem);
    if (!item) return null;

    const allMovements = (stockMovements || []).filter((m: any) => m.itemId === selectedItem);

    // Opening balance — movements BEFORE fromDate
    const openingMovements = allMovements.filter((m: any) => m.date < fromDate);
    const openingQty = openingMovements.reduce((s: number, m: any) => {
      const qty = Number(m.quantity || m.qty || 0);
      const t = String(m.type || m.movementType || "").toLowerCase();
      return t.includes("in") ||
        t.includes("purchase") ||
        t.includes("opening") ||
        t.includes("received")
        ? s + qty
        : s - qty;
    }, 0);
    const openingValue = openingMovements.reduce((s: number, m: any) => {
      const qty = Number(m.quantity || m.qty || 0);
      const rate = Number(m.rate || m.costRate || 0);
      const t = String(m.type || m.movementType || "").toLowerCase();
      return t.includes("in") ||
        t.includes("purchase") ||
        t.includes("opening") ||
        t.includes("received")
        ? s + qty * rate
        : s - qty * rate;
    }, 0);

    // Movements within date range
    const movements = allMovements
      .filter((m: any) => m.date >= fromDate && m.date <= toDate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    let runningQty = openingQty;
    let runningValue = openingValue;

    const rows = movements.map((m: any) => {
      const qty = Number(m.quantity || m.qty || 0);
      const rate = Number(m.rate || m.costRate || 0);
      const t = String(m.type || m.movementType || "").toLowerCase();
      const isIn =
        t.includes("in") ||
        t.includes("purchase") ||
        t.includes("opening") ||
        t.includes("received");
      const inQty = isIn ? qty : 0;
      const outQty = isIn ? 0 : qty;
      runningQty += isIn ? qty : -qty;
      runningValue += isIn ? qty * rate : -(qty * rate);

      return {
        date: m.date,
        particular: m.type || m.referenceType || "Movement",
        referenceNo: m.referenceNo || m.voucherNo || "—",
        inQty,
        outQty,
        rate,
        inValue: inQty * rate,
        outValue: outQty * rate,
        balance: Math.max(0, runningQty),
        balanceValue: Math.max(0, runningValue),
      };
    });

    return { openingQty, openingValue, rows, item };
  }, [selectedItem, items, stockMovements, fromDate, toDate]);

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Ledger Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Item-wise detailed movement history with running balance (IN/OUT transactions)
          </p>
        </div>
        <button className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50 flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className={labelCls}>Select Item (F4)</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className={`${inputCls} w-full`}
            >
              <option value="">— Select Item to view ledger —</option>
              {(items || [])
                .filter((i: any) => i.isActive !== false)
                .map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showZeroStock}
                onChange={(e) => setShowZeroStock(e.target.checked)}
                className="rounded"
              />
              <span className="text-[12px] text-gray-700">Show Zero Stock</span>
            </label>
          </div>
        </div>
      </div>

      {selectedItem && ledgerData ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Item Info Bar */}
          <div className="px-4 py-2.5 border-b border-gray-200 bg-[#1557b0] text-white flex justify-between items-center">
            <span className="text-[13px] font-semibold">
              {(ledgerData.item as any)?.name} — Stock Ledger
            </span>
            <span className="text-[12px]">
              {fromDate} to {toDate}
            </span>
          </div>

          {/* Opening Balance */}
          <div className="px-4 py-2.5 border-b border-gray-200 bg-amber-50 flex justify-between text-[12px]">
            <span className="font-semibold text-amber-700">Opening Balance</span>
            <div className="flex gap-6">
              <span className="text-amber-700">
                Qty: <strong className="font-mono">{formatNumber(ledgerData.openingQty)}</strong>
              </span>
              <span className="text-amber-700">
                Value:{" "}
                <strong className="font-mono">Rs. {formatNumber(ledgerData.openingValue)}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="report-table w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {[
                    "Date",
                    "Particular",
                    "Reference No.",
                    "IN Qty",
                    "OUT Qty",
                    "Rate",
                    "IN Value",
                    "OUT Value",
                    "Balance Qty",
                    "Balance Value",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-600">{row.date}</td>
                    <td className="px-3 py-2 text-[12px] text-gray-700 capitalize">
                      {row.particular.replace(/-/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-[#1557b0]">
                      {row.referenceNo}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-green-700">
                      {row.inQty > 0 ? formatNumber(row.inQty) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-red-600">
                      {row.outQty > 0 ? formatNumber(row.outQty) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right">
                      {row.rate > 0 ? formatNumber(row.rate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-green-700">
                      {row.inValue > 0 ? `Rs. ${formatNumber(row.inValue)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-red-600">
                      {row.outValue > 0 ? `Rs. ${formatNumber(row.outValue)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right font-bold">
                      {formatNumber(row.balance)}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right font-bold">
                      Rs. {formatNumber(row.balanceValue)}
                    </td>
                  </tr>
                ))}
                {ledgerData.rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[12px] text-gray-500">
                      No movements found for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Closing Balance Footer */}
          {ledgerData.rows.length > 0 && (
            <div className="px-4 py-2.5 border-t-2 border-[#c7d2fe] bg-[#eef2ff] flex justify-between text-[12px] font-bold text-gray-800">
              <span>Closing Balance</span>
              <div className="flex gap-8">
                <span className="font-mono">
                  {formatNumber(ledgerData.rows[ledgerData.rows.length - 1].balance)}{" "}
                  {(ledgerData.item as any)?.unit || "Pcs"}
                </span>
                <span className="font-mono">
                  Rs. {formatNumber(ledgerData.rows[ledgerData.rows.length - 1].balanceValue)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <RefreshCw className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-gray-500">
            Select an item to view its stock ledger
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Shows all IN/OUT transactions with running balance — drill-down to voucher level
          </p>
        </div>
      )}
    </div>
  );
}
