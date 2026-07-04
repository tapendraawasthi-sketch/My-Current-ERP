// src/pages/StockLedgerReport.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Download } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ReportEmptyState } from "../components/ReportEmptyState";

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
    <div className="flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock ledger report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Item-wise movement history with running balance (IN/OUT transactions)
          </p>
        </div>
        <button
          type="button"
          className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="no-print bg-white border border-gray-200 rounded-md p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className={labelCls}>Select item (F4)</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className={`${inputCls} w-full`}
            >
              <option value="">— Select item to view ledger —</option>
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
            <label className={labelCls}>From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>To date</label>
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
              <span className="text-[12px] text-gray-700">Show zero stock</span>
            </label>
          </div>
        </div>
      </div>

      {selectedItem && ledgerData ? (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 bg-[#f5f6fa] flex justify-between items-center">
            <span className="text-[12px] font-semibold text-gray-800">
              {(ledgerData.item as any)?.name} — stock ledger
            </span>
            <span className="text-[11px] text-gray-500">
              {fromDate} to {toDate}
            </span>
          </div>

          <div className="px-3 py-2 border-b border-amber-200 bg-amber-50 flex justify-between text-[12px]">
            <span className="font-medium text-amber-700">Opening balance</span>
            <div className="flex gap-6">
              <span className="text-amber-700">
                Qty:{" "}
                <span className="font-mono font-semibold">
                  {formatNumber(ledgerData.openingQty)}
                </span>
              </span>
              <span className="text-amber-700">
                Value:{" "}
                <span className="font-mono font-semibold">
                  Rs. {formatNumber(ledgerData.openingValue)}
                </span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {ledgerData.rows.length === 0 ? (
              <ReportEmptyState
                message="No movements found for selected period"
                hint="Adjust the date range or check stock journal entries."
              />
            ) : (
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {[
                      "Date",
                      "Particular",
                      "Reference no.",
                      "IN qty",
                      "OUT qty",
                      "Rate",
                      "IN value",
                      "OUT value",
                      "Balance qty",
                      "Balance value",
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
                <tbody>
                  {ledgerData.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.date}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                        {row.particular.replace(/-/g, " ")}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-[#1557b0]">
                        {row.referenceNo}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-green-700">
                        {row.inQty > 0 ? formatNumber(row.inQty) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-red-600">
                        {row.outQty > 0 ? formatNumber(row.outQty) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-700">
                        {row.rate > 0 ? formatNumber(row.rate) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-green-700">
                        {row.inValue > 0 ? `Rs. ${formatNumber(row.inValue)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-red-600">
                        {row.outValue > 0 ? `Rs. ${formatNumber(row.outValue)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right font-semibold text-gray-800">
                        {formatNumber(row.balance)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right font-semibold text-gray-800">
                        Rs. {formatNumber(row.balanceValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {ledgerData.rows.length > 0 && (
            <>
              <div className="px-3 py-2.5 border-t-2 border-[#c7d2fe] bg-[#eef2ff] flex justify-between text-[12px] font-semibold text-gray-800">
                <span>Closing balance</span>
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
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {ledgerData.rows.length} movement{ledgerData.rows.length === 1 ? "" : "s"}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md flex-1">
          <ReportEmptyState
            message="Select an item to view its stock ledger"
            hint="Shows all IN/OUT transactions with running balance."
          />
        </div>
      )}
    </div>
  );
}
