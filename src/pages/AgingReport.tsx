// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "../lib/db";
import { useStore } from "../store/useStore";
import { Download, FileSpreadsheet, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

interface AgingRow {
  partyId: string;
  partyName: string;
  partyPan?: string;
  buckets: AgingBucket;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function daysDiff(dateStr: string, asOf: string): number {
  const d1 = new Date(dateStr);
  const d2 = new Date(asOf);
  const diff = d2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function bucketAmount(days: number, amount: number): Partial<AgingBucket> {
  if (days <= 0) return { current: amount };
  if (days <= 30) return { days1to30: amount };
  if (days <= 60) return { days31to60: amount };
  if (days <= 90) return { days61to90: amount };
  return { over90: amount };
}

function emptyBucket(): AgingBucket {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 };
}

function addBuckets(a: AgingBucket, b: Partial<AgingBucket>): AgingBucket {
  return {
    current: a.current + (b.current ?? 0),
    days1to30: a.days1to30 + (b.days1to30 ?? 0),
    days31to60: a.days31to60 + (b.days31to60 ?? 0),
    days61to90: a.days61to90 + (b.days61to90 ?? 0),
    over90: a.over90 + (b.over90 ?? 0),
    total: a.total,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

const AgingReport: React.FC = () => {
  const { parties, companySettings } = useStore();

  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [searchTerm, setSearchTerm] = useState("");

  // Fix: use getDB() — default import, not named { db }
  const db = getDB();

  const invoiceType = direction === "receivable" ? "sales-invoice" : "purchase-invoice";
  const paymentType = direction === "receivable" ? "receipt" : "payment";

  // Fix: useLiveQuery from "dexie-react-hooks" — correct package
  const invoices = useLiveQuery(
    () => db.invoices.where("type").equals(invoiceType).toArray(),
    [invoiceType],
  );

  const payments = useLiveQuery(
    () => db.vouchers.where("type").equals(paymentType).toArray(),
    [paymentType],
  );

  // ── Build aging rows ──────────────────────────────────────────────────────
  const agingRows = useMemo<AgingRow[]>(() => {
    if (!invoices || !payments) return [];

    const partyMap = new Map<string, AgingRow>();

    for (const inv of invoices as any[]) {
      if (!inv || inv.status === "cancelled" || inv.status === "draft") continue;

      const originalAmount = Number(inv.grandTotal ?? inv.total ?? 0);
      if (originalAmount <= 0) continue;

      // Compute paid amount
      let paidAmount = Number(inv.paidAmount ?? 0);
      for (const pmt of payments as any[]) {
        if (!pmt || pmt.partyId !== inv.partyId) continue;
        for (const line of pmt.lines ?? []) {
          if (line.billRefNo === inv.invoiceNo || line.billRefNo === inv.id) {
            paidAmount += Number(line.amount ?? 0);
          }
        }
      }

      const balance = originalAmount - paidAmount;
      if (balance <= 0.005) continue;

      // Days overdue from dueDate or invoice date
      const refDate = inv.dueDate ?? inv.date;
      const days = refDate ? daysDiff(refDate, asOfDate) : 0;
      const bucket = bucketAmount(days, balance);

      const partyId = inv.partyId ?? "unknown";
      const partyName =
        inv.partyName ?? parties.find((p: any) => p.id === partyId)?.name ?? "Unknown";
      const partyPan = inv.partyPan ?? parties.find((p: any) => p.id === partyId)?.pan;

      const existing = partyMap.get(partyId) ?? {
        partyId,
        partyName,
        partyPan,
        buckets: emptyBucket(),
      };

      existing.buckets = addBuckets(existing.buckets, bucket);
      existing.buckets.total =
        existing.buckets.current +
        existing.buckets.days1to30 +
        existing.buckets.days31to60 +
        existing.buckets.days61to90 +
        existing.buckets.over90;

      partyMap.set(partyId, existing);
    }

    return Array.from(partyMap.values()).sort((a, b) => b.buckets.total - a.buckets.total);
  }, [invoices, payments, asOfDate, parties, direction]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo<AgingRow[]>(() => {
    if (!searchTerm.trim()) return agingRows;
    const q = searchTerm.toLowerCase();
    return agingRows.filter(
      (r) => r.partyName.toLowerCase().includes(q) || (r.partyPan ?? "").toLowerCase().includes(q),
    );
  }, [agingRows, searchTerm]);

  // ── Grand totals ──────────────────────────────────────────────────────────
  const grandTotal = useMemo<AgingBucket>(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        current: acc.current + row.buckets.current,
        days1to30: acc.days1to30 + row.buckets.days1to30,
        days31to60: acc.days31to60 + row.buckets.days31to60,
        days61to90: acc.days61to90 + row.buckets.days61to90,
        over90: acc.over90 + row.buckets.over90,
        total: acc.total + row.buckets.total,
      }),
      emptyBucket(),
    );
  }, [filteredRows]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const companyName = companySettings?.name ?? "Company";
      const headers = [
        "Party Name",
        "PAN",
        "Current",
        "1-30 Days",
        "31-60 Days",
        "61-90 Days",
        "Over 90 Days",
        "Total",
      ];
      const rows = filteredRows.map((r) => [
        r.partyName,
        r.partyPan ?? "",
        r.buckets.current,
        r.buckets.days1to30,
        r.buckets.days31to60,
        r.buckets.days61to90,
        r.buckets.over90,
        r.buckets.total,
      ]);

      const wb = XLSX.utils.book_new();
      const wsData = [
        [companyName],
        [`Aging Report — ${direction === "receivable" ? "Receivables" : "Payables"}`],
        [`As of: ${asOfDate}`],
        [],
        headers,
        ...rows,
        [],
        [
          "TOTAL",
          "",
          grandTotal.current,
          grandTotal.days1to30,
          grandTotal.days31to60,
          grandTotal.days61to90,
          grandTotal.over90,
          grandTotal.total,
        ],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Aging Report");
      XLSX.writeFile(wb, `AgingReport_${asOfDate}.xlsx`);
      toast.success("Aging Report exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const isLoading = !invoices || !payments;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Aging Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Outstanding {direction === "receivable" ? "receivables" : "payables"} by age bucket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setDirection("receivable")}
            className={`h-8 px-3 text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              direction === "receivable"
                ? "bg-[#1557b0] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Receivables
          </button>
          <button
            type="button"
            onClick={() => setDirection("payable")}
            className={`h-8 px-3 text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              direction === "payable"
                ? "bg-[#1557b0] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Payables
          </button>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">
            As of Date
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>

        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party name or PAN…"
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-[12px]">Loading aging data…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Party Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                    PAN
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Current
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    1–30 Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    31–60 Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    61–90 Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Over 90
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-[12px] text-gray-400">
                      No outstanding {direction === "receivable" ? "receivables" : "payables"} as of{" "}
                      {asOfDate}.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row: AgingRow) => (
                    <tr key={row.partyId} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-800">
                        {row.partyName}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-gray-600">
                        {row.partyPan ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-green-700">
                        {row.buckets.current > 0 ? money(row.buckets.current) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-amber-600">
                        {row.buckets.days1to30 > 0 ? money(row.buckets.days1to30) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-orange-600">
                        {row.buckets.days31to60 > 0 ? money(row.buckets.days31to60) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-red-500">
                        {row.buckets.days61to90 > 0 ? money(row.buckets.days61to90) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-red-700">
                        {row.buckets.over90 > 0 ? money(row.buckets.over90) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                        {money(row.buckets.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td colSpan={2} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Grand Total ({filteredRows.length} parties)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-green-700">
                      {money(grandTotal.current)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-amber-600">
                      {money(grandTotal.days1to30)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-orange-600">
                      {money(grandTotal.days31to60)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-red-500">
                      {money(grandTotal.days61to90)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-red-700">
                      {money(grandTotal.over90)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#1557b0]">
                      {money(grandTotal.total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgingReport;
