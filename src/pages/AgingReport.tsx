/**
 * src/pages/AgingReport.tsx
 *
 * Aging Analysis Report:
 *  - Table: Party | Not Due | 0-30 | 31-60 | 61-90 | 91-180 | 181-365 | Above 365 | Total
 *  - Bar chart via recharts (one bar per aging bucket)
 *  - Export to Excel (xlsx already in project)
 */

import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Download, BarChart2, Table2, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { db } from "../lib/db";
import { adToBS, formatBS } from "../lib/nepaliDate";
import {
  computeBillWiseOutstanding,
  buildAgingReport,
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  AgingBucket,
  AgingReportRow,
} from "../lib/billWiseEngine";
import { VoucherType, VoucherStatus } from "../lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_BAR_COLORS: Record<AgingBucket, string> = {
  "not-due":   "#22c55e",
  "0-30":      "#eab308",
  "31-60":     "#f97316",
  "61-90":     "#ef4444",
  "91-180":    "#dc2626",
  "181-365":   "#b91c1c",
  "above-365": "#7f1d1d",
};

const fmt = (n: number) =>
  n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Excel Export ─────────────────────────────────────────────────────────────

function exportToExcel(
  rows: AgingReportRow[],
  totals: Record<AgingBucket, number>,
  grandTotal: number,
  direction: string
) {
  const headers = [
    "Party Name",
    ...AGING_BUCKETS.map((b) => AGING_BUCKET_LABELS[b]),
    "Total",
  ];

  const data = rows.map((r) => [
    r.partyName,
    ...AGING_BUCKETS.map((b) => r.buckets[b]),
    r.total,
  ]);

  const totalsRow = [
    "Grand Total",
    ...AGING_BUCKETS.map((b) => totals[b]),
    grandTotal,
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data, totalsRow]);

  // Column widths
  ws["!cols"] = [
    { wch: 30 },
    ...AGING_BUCKETS.map(() => ({ wch: 16 })),
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Aging ${direction}`);
  XLSX.writeFile(wb, `AgingReport_${direction}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function AgingBarChart({
  totals,
}: {
  totals: Record<AgingBucket, number>;
}) {
  const data = AGING_BUCKETS.map((b) => ({
    label: AGING_BUCKET_LABELS[b],
    amount: totals[b],
    bucket: b,
  })).filter((d) => d.amount > 0);

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        No data to display.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(0)}K`
              : String(v)
          }
        />
        <Tooltip
          formatter={(value: number) => [`Rs. ${fmt(value)}`, "Outstanding"]}
          labelStyle={{ fontWeight: "bold" }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.bucket} fill={BUCKET_BAR_COLORS[d.bucket]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Direction = "receivable" | "payable";
type Display = "table" | "chart";

export default function AgingReport() {
  const [direction, setDirection] = useState<Direction>("receivable");
  const [display, setDisplay] = useState<Display>("table");
  const [searchParty, setSearchParty] = useState("");

  // ── Live data ─────────────────────────────────────────────────────────────
  const parties = useLiveQuery(() => db.parties?.toArray() ?? Promise.resolve([]), []);

  const invoiceType =
    direction === "receivable" ? VoucherType.SALES_INVOICE : VoucherType.PURCHASE_INVOICE;
  const paymentType =
    direction === "receivable" ? VoucherType.RECEIPT : VoucherType.PAYMENT;

  const invoices = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .equals(invoiceType as string)
        .and((v: any) => v.status === VoucherStatus.POSTED)
        .toArray() ?? Promise.resolve([]),
    [direction]
  );

  const paymentVouchers = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .equals(paymentType as string)
        .toArray() ?? Promise.resolve([]),
    [direction]
  );

  // ── Compute aging ─────────────────────────────────────────────────────────
  const partiesMap = useMemo(() => {
    const m = new Map<string, { name: string }>();
    if (!parties) return m;
    for (const p of parties as any[]) {
      m.set(p.id, { name: p.name ?? p.id });
    }
    return m;
  }, [parties]);

  const { rows, totals, grandTotal } = useMemo(() => {
    if (!invoices || !paymentVouchers)
      return {
        rows: [] as AgingReportRow[],
        totals: {} as Record<AgingBucket, number>,
        grandTotal: 0,
      };
    const bills = computeBillWiseOutstanding(
      null,
      invoices as any[],
      paymentVouchers as any[],
      new Date(),
      direction
    );
    return buildAgingReport(bills, partiesMap);
  }, [invoices, paymentVouchers, partiesMap, direction]);

  const filteredRows = useMemo(() => {
    if (!searchParty.trim()) return rows;
    const q = searchParty.toLowerCase();
    return rows.filter((r) => r.partyName.toLowerCase().includes(q));
  }, [rows, searchParty]);

  const isLoading = !invoices || !paymentVouchers || !parties;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Computing aging report…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Aging Analysis Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Nepal-standard aging buckets · As at {formatBS(adToBS(new Date()))}
          </p>
        </div>
        <button
          onClick={() =>
            exportToExcel(
              filteredRows,
              totals,
              grandTotal,
              direction === "receivable" ? "Receivables" : "Payables"
            )
          }
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Direction */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["receivable", "payable"] as Direction[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                direction === d
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {d === "receivable" ? "Receivables" : "Payables"}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setDisplay("table")}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 ${
              display === "table"
                ? "bg-white shadow text-blue-700"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Table2 size={14} />
            Table
          </button>
          <button
            onClick={() => setDisplay("chart")}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 ${
              display === "chart"
                ? "bg-white shadow text-blue-700"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <BarChart2 size={14} />
            Chart
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchParty}
          onChange={(e) => setSearchParty(e.target.value)}
          placeholder="Search party…"
          className="px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-48"
        />
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        {AGING_BUCKETS.map((b) => (
          <div
            key={b}
            className="bg-white border rounded-lg p-3 flex flex-col gap-0.5"
          >
            <span className="text-xs text-gray-500 font-medium">
              {AGING_BUCKET_LABELS[b]}
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: BUCKET_BAR_COLORS[b] }}
            >
              Rs. {fmt(totals[b] ?? 0)}
            </span>
          </div>
        ))}
      </div>

      {display === "chart" ? (
        // ── Chart View ──────────────────────────────────────────────────────
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Outstanding by Aging Bucket
          </h2>
          <AgingBarChart totals={totals} />

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-2">
            {AGING_BUCKETS.filter((b) => (totals[b] ?? 0) > 0).map((b) => (
              <span key={b} className="flex items-center gap-1 text-xs text-gray-600">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: BUCKET_BAR_COLORS[b] }}
                />
                {AGING_BUCKET_LABELS[b]}
              </span>
            ))}
          </div>
        </div>
      ) : (
        // ── Table View ──────────────────────────────────────────────────────
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                <th className="text-left px-3 py-2 sticky left-0 bg-gray-100">Party Name</th>
                {AGING_BUCKETS.map((b) => (
                  <th
                    key={b}
                    className="text-right px-3 py-2 whitespace-nowrap"
                    style={{ color: BUCKET_BAR_COLORS[b] }}
                  >
                    {AGING_BUCKET_LABELS[b]}
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={AGING_BUCKETS.length + 2} className="text-center py-10 text-gray-500">
                    No aging data found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.partyId} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white">
                      {row.partyName}
                    </td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b} className="px-3 py-2 text-right text-sm">
                        {row.buckets[b] > 0 ? (
                          <span style={{ color: BUCKET_BAR_COLORS[b] }}>
                            {fmt(row.buckets[b])}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-bold">{fmt(row.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-blue-50 font-bold text-blue-800 border-t-2 border-blue-200">
                  <td className="px-3 py-2 sticky left-0 bg-blue-50">Grand Total</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b} className="px-3 py-2 text-right">
                      {fmt(totals[b] ?? 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
