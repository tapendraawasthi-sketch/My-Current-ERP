// src/pages/StockLedgerReport.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { formatCurrency, formatNumber } from "../lib/utils";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { useBranchFilter } from "../hooks/useBranchFilter";
import {
  ReportWorkspace,
  useReportQueryParams,
  applyBranchQueryParam,
} from "@/features/reports";

function defaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export default function StockLedgerReport() {
  const { items, stockMovements, initLifecycle, currentFiscalYear } = useStore();
  const storeLoading = initLifecycle === "loading" || initLifecycle === "initializing";
  const { branchFilter, setBranchFilter, branchOptions, matchMovement } = useBranchFilter();
  const { params, writeParams } = useReportQueryParams({
    from: defaultFrom(),
    to: new Date().toISOString().split("T")[0],
  });
  const [selectedItem, setSelectedItem] = useState("");
  const [fromDate, setFromDate] = useState(() => params.from || defaultFrom());
  const [toDate, setToDate] = useState(() => params.to || new Date().toISOString().split("T")[0]);
  const [showZeroStock, setShowZeroStock] = useState(true);

  useEffect(() => {
    if (params.from) setFromDate(params.from);
    if (params.to) setToDate(params.to);
    if (params.branch) applyBranchQueryParam(params.branch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from URL
  }, []);

  const syncQuery = () => {
    writeParams({
      fy: currentFiscalYear?.id || currentFiscalYear?.name,
      from: fromDate,
      to: toDate,
      branch: branchFilter,
    });
  };

  const ledgerData = useMemo(() => {
    if (!selectedItem) return null;
    const item = (items || []).find((i: any) => i.id === selectedItem);
    if (!item) return null;

    const allMovements = (stockMovements || []).filter(
      (m: any) => m.itemId === selectedItem && matchMovement(m),
    );

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
  }, [selectedItem, items, stockMovements, fromDate, toDate, matchMovement, branchFilter]);

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";

  return (
    <ReportWorkspace
      title="Stock ledger report"
      description="Item-wise movement history with running balance (IN/OUT transactions)"
      periodLabel={`${fromDate} to ${toDate}`}
      loading={storeLoading}
      onPrint={() => window.print()}
      onShowReport={syncQuery}
      showReportLabel="Apply filters"
      filterSlot={
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            Select item (F4)
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className={`${inputCls} min-w-[200px]`}
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
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            From date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
            To date
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputCls}
            />
          </label>
          {branchOptions.length > 0 && (
            <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex flex-col gap-1">
              Branch
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={showZeroStock}
              onChange={(e) => setShowZeroStock(e.target.checked)}
              className="rounded"
            />
            <span className="text-[12px] text-gray-700">Show zero stock</span>
          </label>
        </div>
      }
    >
      {selectedItem && ledgerData ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 bg-[var(--ds-canvas)] flex justify-between items-center">
            <span className="text-[12px] font-semibold text-gray-700">
              {(ledgerData.item as any)?.name} — stock ledger
            </span>
            <span className="text-[12px] text-gray-500">
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
                  {formatCurrency(ledgerData.openingValue)}
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
              <table className="w-full min-w-[900px] border-collapse report-table">
                <thead>
                  <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
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
                        className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide"
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
                      className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)] border-b border-gray-100"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.date}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                        {row.particular.replace(/-/g, " ")}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-[var(--ds-action-primary)]">
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
                        {row.inValue > 0 ? formatCurrency(row.inValue) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-red-600">
                        {row.outValue > 0 ? formatCurrency(row.outValue) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right font-semibold text-gray-700">
                        {formatNumber(row.balance)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right font-semibold text-gray-700">
                        {formatCurrency(row.balanceValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {ledgerData.rows.length > 0 && (
            <>
              <div className="px-3 py-2.5 border-t-2 border-[var(--ds-border-strong)] bg-[var(--ds-surface-selected)] flex justify-between text-[12px] font-semibold text-gray-700">
                <span>Closing balance</span>
                <div className="flex gap-8">
                  <span className="font-mono">
                    {formatNumber(ledgerData.rows[ledgerData.rows.length - 1].balance)}{" "}
                    {(ledgerData.item as any)?.unit || "Pcs"}
                  </span>
                  <span className="font-mono">
                    {formatCurrency(ledgerData.rows[ledgerData.rows.length - 1].balanceValue)}
                  </span>
                </div>
              </div>
              <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-canvas)] text-[12px] text-gray-500">
                {ledgerData.rows.length} movement{ledgerData.rows.length === 1 ? "" : "s"}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <ReportEmptyState
            message="Select an item to view its stock ledger"
            hint="Shows all IN/OUT transactions with running balance."
          />
        </div>
      )}
    </ReportWorkspace>
  );
}
