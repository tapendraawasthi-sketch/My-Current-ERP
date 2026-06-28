/**
 * src/pages/OutstandingReceivables.tsx
 *
 * Full bill-wise outstanding receivables page.
 * Uses computeBillWiseOutstanding engine; shows two views:
 *   a) Party-wise summary
 *   b) Bill-wise detail (drill-down per party or all parties)
 */

import React, { useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
} from "lucide-react";
import { db } from "../lib/db";
import { adToBS, formatBS } from "../lib/nepaliDate";
import {
  computeBillWiseOutstanding,
  buildPartySummaries,
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  AgingBucket,
  BillRecord,
  PartySummary,
  emptyAgingBreakdown,
} from "../lib/billWiseEngine";
import { VoucherType, VoucherStatus } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "Rs. " +
  n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function bsStr(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return "—";
  try {
    const bs = adToBS(date);
    return formatBS(bs);
  } catch {
    return "—";
  }
}

const BUCKET_COLORS: Record<AgingBucket, string> = {
  "not-due":   "bg-green-100 text-green-800",
  "0-30":      "bg-yellow-100 text-yellow-800",
  "31-60":     "bg-orange-100 text-orange-800",
  "61-90":     "bg-red-100 text-red-700",
  "91-180":    "bg-red-200 text-red-800",
  "181-365":   "bg-red-300 text-red-900",
  "above-365": "bg-red-500 text-white",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryBar({
  bills,
  pdcMap,
}: {
  bills: BillRecord[];
  pdcMap: Map<string, number>;
}) {
  const totals = useMemo(() => {
    const breakdown = emptyAgingBreakdown();
    let total = 0;
    for (const b of bills) {
      if (b.isAdvanceCredit || b.balanceAmount <= 0) continue;
      const eff = Math.max(0, b.balanceAmount - (pdcMap.get(b.billNo) ?? 0));
      breakdown[b.agingBucket] += eff;
      total += eff;
    }
    return { breakdown, total };
  }, [bills, pdcMap]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-4">
      <div className="col-span-2 md:col-span-1 xl:col-span-1 bg-blue-600 text-white rounded-lg p-3 flex flex-col">
        <span className="text-xs opacity-80 font-medium uppercase tracking-wide">Total Outstanding</span>
        <span className="text-lg font-bold mt-1">{fmt(totals.total)}</span>
      </div>
      {AGING_BUCKETS.map((bucket) => (
        <div
          key={bucket}
          className={`rounded-lg p-3 flex flex-col ${BUCKET_COLORS[bucket]}`}
        >
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
            {AGING_BUCKET_LABELS[bucket]}
          </span>
          <span className="text-sm font-bold mt-1">
            {fmt(totals.breakdown[bucket])}
          </span>
        </div>
      ))}
    </div>
  );
}

function BillWiseTable({
  bills,
  pdcMap,
  partyName,
}: {
  bills: BillRecord[];
  pdcMap: Map<string, number>;
  partyName?: string;
}) {
  const displayBills = bills.filter((b) => !b.isAdvanceCredit && b.balanceAmount > 0);

  if (displayBills.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No outstanding bills{partyName ? ` for ${partyName}` : ""}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
            <th className="text-left px-3 py-2">Bill No.</th>
            {!partyName && <th className="text-left px-3 py-2">Party</th>}
            <th className="text-left px-3 py-2">Invoice Date (BS)</th>
            <th className="text-left px-3 py-2">Due Date (BS)</th>
            <th className="text-right px-3 py-2">Days Overdue</th>
            <th className="text-right px-3 py-2">Original</th>
            <th className="text-right px-3 py-2">Paid</th>
            <th className="text-right px-3 py-2">Outstanding</th>
            <th className="text-right px-3 py-2">PDC Received</th>
            <th className="text-right px-3 py-2">Net Outstanding</th>
            <th className="text-center px-3 py-2">Aging</th>
          </tr>
        </thead>
        <tbody>
          {displayBills.map((b) => {
            const pdc = pdcMap.get(b.billNo) ?? 0;
            const netOutstanding = Math.max(0, b.balanceAmount - pdc);
            return (
              <tr key={b.billNo} className="border-b hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-mono text-xs text-blue-600">{b.billNo}</td>
                {!partyName && (
                  <td className="px-3 py-2 font-medium">{b.partyId}</td>
                )}
                <td className="px-3 py-2">{bsStr(b.invoiceDate)}</td>
                <td className="px-3 py-2">{bsStr(b.dueDate)}</td>
                <td className="px-3 py-2 text-right">
                  {b.daysOverdue > 0 ? (
                    <span className="text-red-600 font-semibold">{b.daysOverdue}</span>
                  ) : (
                    <span className="text-green-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{fmt(b.originalAmount)}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(b.paidAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(b.balanceAmount)}</td>
                <td className="px-3 py-2 text-right text-indigo-600">
                  {pdc > 0 ? fmt(pdc) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-bold text-blue-700">
                  {fmt(netOutstanding)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${BUCKET_COLORS[b.agingBucket]}`}
                  >
                    {AGING_BUCKET_LABELS[b.agingBucket]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PartyRow({
  summary,
  partyName,
  pdcMap,
  expanded,
  onToggle,
}: {
  summary: PartySummary;
  partyName: string;
  pdcMap: Map<string, number>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1 font-medium text-blue-700">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {partyName}
          </span>
        </td>
        <td className="px-3 py-2 text-right text-gray-600">{summary.totalBills}</td>
        <td className="px-3 py-2 text-right font-semibold">{fmt(summary.totalOutstanding)}</td>
        <td className="px-3 py-2 text-center text-sm">{bsStr(summary.oldestBillDate)}</td>
        <td className="px-3 py-2 text-right">
          {summary.overdueAmount > 0 ? (
            <span className="text-red-600 font-semibold">{fmt(summary.overdueAmount)}</span>
          ) : (
            <span className="text-green-600 text-sm">No overdue</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {summary.overdueAmount > 0 ? (
            <AlertTriangle size={14} className="text-red-500 mx-auto" />
          ) : (
            <CheckCircle size={14} className="text-green-500 mx-auto" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-0 py-0 bg-gray-50 border-b">
            <div className="px-6 py-3">
              <BillWiseTable bills={summary.bills} pdcMap={pdcMap} partyName={partyName} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = "party" | "bill";
type SortKey = "aging" | "amount" | "party" | "date";

export default function OutstandingReceivables() {
  const [viewMode, setViewMode] = useState<ViewMode>("party");
  const [searchParty, setSearchParty] = useState("");
  const [filterBucket, setFilterBucket] = useState<AgingBucket | "">("");
  const [filterPartyId, setFilterPartyId] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("aging");
  const [expandedParties, setExpandedParties] = useState<Set<string>>(new Set());

  // ── Live data from Dexie ──────────────────────────────────────────────────
  const parties = useLiveQuery(() => db.parties?.toArray() ?? Promise.resolve([]), []);
  const invoices = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .anyOf([VoucherType.SALES_INVOICE as string])
        .and((v: any) => v.status === VoucherStatus.POSTED)
        .toArray() ?? Promise.resolve([]),
    []
  );
  const receipts = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .anyOf([VoucherType.RECEIPT as string])
        .toArray() ?? Promise.resolve([]),
    []
  );
  const pdCheques = useLiveQuery(
    () => db.pdCheques?.toArray() ?? Promise.resolve([]),
    []
  );

  // ── Build PDC map: billRefNo → pdc amount ────────────────────────────────
  const pdcMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!pdCheques) return m;
    for (const p of pdCheques as any[]) {
      if (p.billRefNo && p.pdcAmount) {
        m.set(p.billRefNo, (m.get(p.billRefNo) ?? 0) + Number(p.pdcAmount));
      }
    }
    return m;
  }, [pdCheques]);

  // ── Build parties map ─────────────────────────────────────────────────────
  const partiesMap = useMemo(() => {
    const m = new Map<string, { name: string; creditDays?: number }>();
    if (!parties) return m;
    for (const p of parties as any[]) {
      m.set(p.id, { name: p.name ?? p.id, creditDays: p.creditDays });
    }
    return m;
  }, [parties]);

  // ── Compute outstanding bills ─────────────────────────────────────────────
  const allBills = useMemo(() => {
    if (!invoices || !receipts) return [];
    return computeBillWiseOutstanding(
      null,
      invoices as any[],
      receipts as any[],
      new Date(),
      "receivable"
    );
  }, [invoices, receipts]);

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filteredBills = useMemo(() => {
    let bills = allBills.filter((b) => !b.isAdvanceCredit && b.balanceAmount > 0);

    if (filterPartyId) {
      bills = bills.filter((b) => b.partyId === filterPartyId);
    } else if (searchParty.trim()) {
      const q = searchParty.toLowerCase();
      bills = bills.filter((b) => {
        const name = partiesMap.get(b.partyId)?.name ?? b.partyId;
        return name.toLowerCase().includes(q);
      });
    }

    if (filterBucket) {
      bills = bills.filter((b) => b.agingBucket === filterBucket);
    }

    const minAmt = parseFloat(amountMin);
    const maxAmt = parseFloat(amountMax);
    if (!isNaN(minAmt)) bills = bills.filter((b) => b.balanceAmount >= minAmt);
    if (!isNaN(maxAmt)) bills = bills.filter((b) => b.balanceAmount <= maxAmt);

    // Sort
    if (sortKey === "aging") {
      bills.sort((a, b) => b.daysOverdue - a.daysOverdue);
    } else if (sortKey === "amount") {
      bills.sort((a, b) => b.balanceAmount - a.balanceAmount);
    } else if (sortKey === "party") {
      bills.sort((a, b) => {
        const na = partiesMap.get(a.partyId)?.name ?? a.partyId;
        const nb = partiesMap.get(b.partyId)?.name ?? b.partyId;
        return na.localeCompare(nb);
      });
    } else if (sortKey === "date") {
      bills.sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime());
    }

    return bills;
  }, [allBills, filterPartyId, searchParty, filterBucket, amountMin, amountMax, sortKey, partiesMap]);

  // ── Party summaries ───────────────────────────────────────────────────────
  const partySummaries = useMemo(
    () => buildPartySummaries(filteredBills, partiesMap),
    [filteredBills, partiesMap]
  );

  const toggleParty = useCallback((pid: string) => {
    setExpandedParties((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  }, []);

  const isLoading = !invoices || !receipts || !parties;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading outstanding receivables…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Outstanding Receivables</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Bill-wise receivable tracking with Tally-style against-ref allocations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            onClick={() => {
              /* Wire to Excel export — see AgingReport */
            }}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* ── Summary Bar ── */}
      <SummaryBar bills={allBills} pdcMap={pdcMap} />

      {/* ── Filters ── */}
      <div className="bg-white border rounded-lg p-3 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-500 mb-1">Search Party</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchParty}
              onChange={(e) => setSearchParty(e.target.value)}
              placeholder="Party name…"
              className="w-full pl-8 pr-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Aging bucket filter */}
        <div className="min-w-40">
          <label className="block text-xs text-gray-500 mb-1">Aging Bucket</label>
          <select
            value={filterBucket}
            onChange={(e) => setFilterBucket(e.target.value as AgingBucket | "")}
            className="w-full px-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Buckets</option>
            {AGING_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {AGING_BUCKET_LABELS[b]}
              </option>
            ))}
          </select>
        </div>

        {/* Amount range */}
        <div className="flex gap-2 items-end">
          <div className="min-w-28">
            <label className="block text-xs text-gray-500 mb-1">Amount ≥</label>
            <input
              type="number"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              placeholder="0"
              className="w-full px-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="min-w-28">
            <label className="block text-xs text-gray-500 mb-1">Amount ≤</label>
            <input
              type="number"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              placeholder="∞"
              className="w-full px-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Sort */}
        <div className="min-w-40">
          <label className="block text-xs text-gray-500 mb-1">Sort By</label>
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full pl-8 pr-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="aging">Aging (Oldest First)</option>
              <option value="amount">Amount (Largest First)</option>
              <option value="party">Party Name</option>
              <option value="date">Invoice Date</option>
            </select>
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => {
            setSearchParty("");
            setFilterBucket("");
            setFilterPartyId("");
            setAmountMin("");
            setAmountMax("");
            setSortKey("aging");
          }}
          className="px-3 py-2 text-sm text-gray-600 border rounded hover:bg-gray-100"
        >
          Reset
        </button>
      </div>

      {/* ── View Toggle ── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["party", "bill"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              viewMode === v
                ? "bg-white shadow text-blue-700"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {v === "party" ? "Party-wise Summary" : "Bill-wise Detail"}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {viewMode === "party" ? (
          // ── Party-wise Summary View ──────────────────────────────────────
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <th className="text-left px-3 py-2">Party Name</th>
                  <th className="text-right px-3 py-2">Bills</th>
                  <th className="text-right px-3 py-2">Outstanding</th>
                  <th className="text-center px-3 py-2">Oldest Bill</th>
                  <th className="text-right px-3 py-2">Overdue Amount</th>
                  <th className="text-center px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {partySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No outstanding receivables found.
                    </td>
                  </tr>
                ) : (
                  partySummaries.map((s) => (
                    <PartyRow
                      key={s.partyId}
                      summary={s}
                      partyName={partiesMap.get(s.partyId)?.name ?? s.partyId}
                      pdcMap={pdcMap}
                      expanded={expandedParties.has(s.partyId)}
                      onToggle={() => toggleParty(s.partyId)}
                    />
                  ))
                )}
              </tbody>
              {partySummaries.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-50 font-bold text-blue-800">
                    <td className="px-3 py-2">Grand Total</td>
                    <td className="px-3 py-2 text-right">
                      {partySummaries.reduce((a, s) => a + s.totalBills, 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmt(partySummaries.reduce((a, s) => a + s.totalOutstanding, 0))}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right">
                      {fmt(partySummaries.reduce((a, s) => a + s.overdueAmount, 0))}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          // ── Bill-wise Detail View ─────────────────────────────────────────
          <BillWiseTable bills={filteredBills} pdcMap={pdcMap} />
        )}
      </div>

      {/* ── Totals footer ── */}
      <div className="text-right text-xs text-gray-500">
        Showing {filteredBills.length} bill
        {filteredBills.length !== 1 ? "s" : ""}
        {" · "}
        Total outstanding: <strong>{fmt(filteredBills.reduce((a, b) => a + b.balanceAmount, 0))}</strong>
      </div>
    </div>
  );
}
