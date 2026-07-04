// src/pages/SalesAnalysisReport.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { BarChart2, TrendingUp, Download } from "lucide-react";

type GroupBy = "party" | "item" | "month";

export default function SalesAnalysisReport() {
  const { invoices, parties, items } = useStore();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(0);
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [groupBy, setGroupBy] = useState<GroupBy>("party");
  const [voucherType, setVoucherType] = useState<"sales" | "purchase" | "both">("sales");

  const salesInvoices = useMemo(
    () =>
      (invoices || []).filter((inv: any) => {
        const inRange = inv.date >= fromDate && inv.date <= toDate;
        const matchType =
          voucherType === "both"
            ? true
            : voucherType === "sales"
              ? inv.type === "sales-invoice" ||
                inv.type === "SALES_INVOICE" ||
                inv.voucherType === "Sales"
              : inv.type === "purchase-invoice" ||
                inv.type === "PURCHASE_INVOICE" ||
                inv.voucherType === "Purchase";
        return inRange && matchType && inv.status !== "cancelled";
      }),
    [invoices, fromDate, toDate, voucherType],
  );

  const analysisData = useMemo(() => {
    const grouped: Record<
      string,
      { key: string; label: string; totalSales: number; totalQty: number; invoiceCount: number }
    > = {};

    salesInvoices.forEach((inv: any) => {
      if (groupBy === "item") {
        const lineItems: any[] = inv.lines || inv.items || [];
        lineItems.forEach((line) => {
          const iKey = line.itemId || line.id || "unknown";
          const iLabel = line.itemName || line.name || "Unknown Item";
          if (!grouped[iKey])
            grouped[iKey] = {
              key: iKey,
              label: iLabel,
              totalSales: 0,
              totalQty: 0,
              invoiceCount: 0,
            };
          grouped[iKey].totalSales += Number(
            line.lineTotal || line.totalAmount || line.amount || 0,
          );
          grouped[iKey].totalQty += Number(line.qty || line.quantity || 0);
          grouped[iKey].invoiceCount += 1;
        });
        return;
      }

      let key = "";
      let label = "";

      if (groupBy === "party") {
        key = inv.partyId || inv.customerId || "unknown";
        label = inv.partyName || inv.customerName || "Unknown Party";
      } else if (groupBy === "month") {
        const d = new Date(inv.date);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      }

      if (!key) return;
      if (!grouped[key]) grouped[key] = { key, label, totalSales: 0, totalQty: 0, invoiceCount: 0 };
      grouped[key].totalSales += Number(inv.grandTotal || inv.totalAmount || 0);
      grouped[key].totalQty += (inv.lines || inv.items || []).reduce(
        (s: number, l: any) => s + Number(l.qty || l.quantity || 0),
        0,
      );
      grouped[key].invoiceCount += 1;
    });

    return Object.values(grouped)
      .map((g) => ({ ...g, avgPerInvoice: g.invoiceCount > 0 ? g.totalSales / g.invoiceCount : 0 }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [salesInvoices, groupBy]);

  const totals = useMemo(
    () => ({
      totalSales: analysisData.reduce((s, r) => s + r.totalSales, 0),
      totalQty: analysisData.reduce((s, r) => s + r.totalQty, 0),
      totalInvoices: salesInvoices.length,
    }),
    [analysisData, salesInvoices],
  );

  const maxSales = analysisData.length > 0 ? Math.max(...analysisData.map((r) => r.totalSales)) : 1;

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Sales Analysis Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Party turnover, item-wise sales, month-wise trends and purchase analysis
          </p>
        </div>
        <button className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50 flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <div>
            <label className={labelCls}>Voucher Type</label>
            <select
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value as any)}
              className={`${inputCls} w-full`}
            >
              <option value="sales">Sales</option>
              <option value="purchase">Purchase</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className={`${inputCls} w-full`}
            >
              <option value="party">Party / Account</option>
              <option value="item">Item</option>
              <option value="month">Month-wise</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
            Total {voucherType === "purchase" ? "Purchases" : "Sales"}
          </div>
          <div className="text-[18px] font-bold text-gray-800 mt-1 font-mono">
            Rs. {formatNumber(totals.totalSales)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
            Total Invoices
          </div>
          <div className="text-[18px] font-bold text-gray-800 mt-1">{totals.totalInvoices}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
            Avg per Invoice
          </div>
          <div className="text-[18px] font-bold text-gray-800 mt-1 font-mono">
            Rs.{" "}
            {formatNumber(totals.totalInvoices > 0 ? totals.totalSales / totals.totalInvoices : 0)}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-200 bg-[#f5f6fa] flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
            Analysis by{" "}
            {groupBy === "party" ? "Party/Account" : groupBy === "item" ? "Item" : "Month"} —{" "}
            {analysisData.length} records
          </span>
          <TrendingUp className="h-4 w-4 text-gray-400" />
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {groupBy === "party"
                  ? "Party / Account"
                  : groupBy === "item"
                    ? "Item Name"
                    : "Month"}
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Invoices
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Total Qty
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Avg/Invoice
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Total Amount
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-36">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {analysisData.map((row, idx) => {
              const share = totals.totalSales > 0 ? (row.totalSales / totals.totalSales) * 100 : 0;
              const barWidth = maxSales > 0 ? (row.totalSales / maxSales) * 100 : 0;
              return (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{row.label}</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-600">
                    {row.invoiceCount}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-600">
                    {formatNumber(row.totalQty)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-600">
                    Rs. {formatNumber(row.avgPerInvoice)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-right font-bold text-gray-800">
                    Rs. {formatNumber(row.totalSales)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#1557b0] h-full rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 w-10 text-right">
                        {share.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {analysisData.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <BarChart2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-500">
                    No data found for selected period and filters
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Grand Total */}
        {analysisData.length > 0 && (
          <div className="px-4 py-2.5 border-t-2 border-[#c7d2fe] bg-[#eef2ff] flex justify-between text-[12px] font-bold text-gray-800">
            <span>
              GRAND TOTAL — {analysisData.length}{" "}
              {groupBy === "party" ? "parties" : groupBy === "item" ? "items" : "months"}
            </span>
            <div className="flex gap-8">
              <span className="font-mono">{totals.totalInvoices} invoices</span>
              <span className="font-mono">Rs. {formatNumber(totals.totalSales)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
