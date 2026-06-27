/**
 * src/pages/InterestCalculation.tsx
 *
 * Interest on Overdue Bills:
 *  - Reads overdue bills via computeBillWiseOutstanding
 *  - Simple or compound interest (monthly)
 *  - Rate configurable globally or per party
 *  - Table: Bill No | Outstanding | Overdue Days | Rate | Interest | Total
 *  - "Post Interest Entry" → creates Journal Voucher:
 *      Dr: Interest Receivable
 *      Cr: Interest Income
 */

import React, { useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "react-hot-toast";
import {
  Calculator,
  TrendingUp,
  RefreshCw,
  FileText,
  Info,
} from "lucide-react";
import { db } from "../lib/db";
import { adToBS, formatBS, todayBS } from "../utils/nepaliDate";
import {
  computeBillWiseOutstanding,
  computeInterestOnOverdue,
  InterestRecord,
} from "../lib/billWiseEngine";
import { VoucherType, VoucherStatus } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "Rs. " +
  n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function bsStr(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return "—";
  try {
    return formatBS(adToBS(date));
  } catch {
    return "—";
  }
}

// ─── Post Interest Journal ────────────────────────────────────────────────────

async function postInterestJournal(
  records: InterestRecord[],
  interestReceivableAccountId: string,
  interestIncomeAccountId: string,
  fiscalYearBS: string
) {
  const today = new Date();
  const bsDate = todayBS();
  const totalInterest = records.reduce((s, r) => s + r.interestAmount, 0);

  const narration =
    `Interest on overdue receivables for ${records.length} bill(s). ` +
    `Bills: ${records.map((r) => r.bill.billNo).join(", ")}.`;

  const { generateSerialNumber } = await import("../lib/db");

  const voucherNo = await generateSerialNumber(
    VoucherType.JOURNAL,
    undefined,
    fiscalYearBS,
    false
  );

  const entries = records.map((r) => ({
    accountId: interestReceivableAccountId,
    partyId: r.bill.partyId,
    debit: r.interestAmount,
    credit: 0,
    narration: `Interest on bill ${r.bill.billNo} (${r.daysOverdue} days @ ${r.annualRate}%)`,
  }));

  entries.push({
    accountId: interestIncomeAccountId,
    partyId: "",
    debit: 0,
    credit: totalInterest,
    narration: "Interest income on overdue receivables",
  });

  await db.vouchers?.add({
    type: VoucherType.JOURNAL,
    status: VoucherStatus.POSTED,
    voucherNo,
    date: today.toISOString(),
    dateBS: `${bsDate.year}/${String(bsDate.month).padStart(2, "0")}/${String(bsDate.day).padStart(2, "0")}`,
    narration,
    entries,
    totalAmount: totalInterest,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as any);

  return voucherNo;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InterestCalculation() {
  const [defaultRate, setDefaultRate] = useState(18); // 18% p.a.
  const [useCompound, setUseCompound] = useState(false);
  const [filterPartyId, setFilterPartyId] = useState("");
  const [selectedBillNos, setSelectedBillNos] = useState<Set<string>>(new Set());
  const [isPosting, setIsPosting] = useState(false);

  // ── Company settings for accounts ────────────────────────────────────────
  const companySettings = useLiveQuery(
    () => db.companySettings?.toCollection().first() ?? Promise.resolve(null),
    []
  );

  // ── Live data ─────────────────────────────────────────────────────────────
  const parties = useLiveQuery(() => db.parties?.toArray() ?? Promise.resolve([]), []);
  const invoices = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .equals(VoucherType.SALES_INVOICE as string)
        .and((v: any) => v.status === VoucherStatus.POSTED)
        .toArray() ?? Promise.resolve([]),
    []
  );
  const receipts = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .equals(VoucherType.RECEIPT as string)
        .toArray() ?? Promise.resolve([]),
    []
  );
  const currentFiscalYear = useLiveQuery(
    () => db.fiscalYears?.filter((f: any) => f.isActive).first() ?? Promise.resolve(null),
    []
  );

  // ── Party rates map ───────────────────────────────────────────────────────
  const partyRatesMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!parties) return m;
    for (const p of parties as any[]) {
      if (p.interestRate && p.interestRate > 0) {
        m.set(p.id, p.interestRate);
      }
    }
    return m;
  }, [parties]);

  const partiesMap = useMemo(() => {
    const m = new Map<string, { name: string }>();
    if (!parties) return m;
    for (const p of parties as any[]) m.set(p.id, { name: p.name ?? p.id });
    return m;
  }, [parties]);

  // ── Compute overdue bills then interest ───────────────────────────────────
  const interestRecords = useMemo(() => {
    if (!invoices || !receipts) return [];

    const bills = computeBillWiseOutstanding(
      filterPartyId || null,
      invoices as any[],
      receipts as any[],
      new Date(),
      "receivable"
    );

    return computeInterestOnOverdue(bills, defaultRate, partyRatesMap, useCompound);
  }, [invoices, receipts, filterPartyId, defaultRate, partyRatesMap, useCompound]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const { totalPrincipal, totalInterest, totalDue } = useMemo(() => {
    const selected = selectedBillNos.size > 0
      ? interestRecords.filter((r) => selectedBillNos.has(r.bill.billNo))
      : interestRecords;
    return {
      totalPrincipal: selected.reduce((s, r) => s + r.bill.balanceAmount, 0),
      totalInterest: selected.reduce((s, r) => s + r.interestAmount, 0),
      totalDue: selected.reduce((s, r) => s + r.totalDue, 0),
    };
  }, [interestRecords, selectedBillNos]);

  const toggleBill = useCallback((billNo: string) => {
    setSelectedBillNos((prev) => {
      const n = new Set(prev);
      n.has(billNo) ? n.delete(billNo) : n.add(billNo);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedBillNos((prev) =>
      prev.size === interestRecords.length
        ? new Set()
        : new Set(interestRecords.map((r) => r.bill.billNo))
    );
  }, [interestRecords]);

  const handlePostInterest = useCallback(async () => {
    const toPost =
      selectedBillNos.size > 0
        ? interestRecords.filter((r) => selectedBillNos.has(r.bill.billNo))
        : interestRecords;

    if (toPost.length === 0) {
      toast.error("No bills selected to post interest for.");
      return;
    }

    const interestReceivableId =
      (companySettings as any)?.interestReceivableAccountId ?? "";
    const interestIncomeId =
      (companySettings as any)?.interestIncomeAccountId ?? "";

    if (!interestReceivableId || !interestIncomeId) {
      toast.error(
        "Please configure Interest Receivable and Interest Income accounts in Company Settings."
      );
      return;
    }

    setIsPosting(true);
    try {
      const vNo = await postInterestJournal(
        toPost,
        interestReceivableId,
        interestIncomeId,
        (currentFiscalYear as any)?.fiscalYearBS ?? ""
      );
      toast.success(`Interest Journal ${vNo} posted successfully!`);
      setSelectedBillNos(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Failed to post interest entry. Check console for details.");
    } finally {
      setIsPosting(false);
    }
  }, [interestRecords, selectedBillNos, companySettings, currentFiscalYear]);

  const isLoading = !invoices || !receipts || !parties;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Computing interest…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Interest on Overdue Bills</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Computed as at {formatBS(adToBS(new Date()))}
          </p>
        </div>
        <button
          onClick={handlePostInterest}
          disabled={isPosting || interestRecords.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText size={14} />
          {isPosting ? "Posting…" : "Post Interest Entry"}
        </button>
      </div>

      {/* ── Configuration ── */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 items-end">
        {/* Default rate */}
        <div className="min-w-40">
          <label className="block text-xs text-gray-500 mb-1">
            Default Annual Rate (%)
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={defaultRate}
              onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">% p.a.</span>
          </div>
        </div>

        {/* Method toggle */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Method</label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[false, true].map((c) => (
              <button
                key={String(c)}
                onClick={() => setUseCompound(c)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  useCompound === c
                    ? "bg-white shadow text-blue-700"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {c ? "Compound (Monthly)" : "Simple"}
              </button>
            ))}
          </div>
        </div>

        {/* Filter by party */}
        <div className="min-w-48">
          <label className="block text-xs text-gray-500 mb-1">Filter Party</label>
          <select
            value={filterPartyId}
            onChange={(e) => setFilterPartyId(e.target.value)}
            className="w-full px-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Parties</option>
            {(parties as any[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg self-center">
          <Info size={13} />
          Per-party rates from Party master override the default rate.
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Total Principal Overdue</div>
          <div className="text-lg font-bold text-gray-800">{fmt(totalPrincipal)}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-xs text-orange-600 mb-1 flex items-center gap-1">
            <TrendingUp size={12} />
            Total Interest
          </div>
          <div className="text-lg font-bold text-orange-700">{fmt(totalInterest)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs text-blue-600 mb-1 flex items-center gap-1">
            <Calculator size={12} />
            Total Due (Principal + Interest)
          </div>
          <div className="text-lg font-bold text-blue-700">{fmt(totalDue)}</div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={
                    selectedBillNos.size === interestRecords.length &&
                    interestRecords.length > 0
                  }
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="text-left px-3 py-2">Bill No.</th>
              <th className="text-left px-3 py-2">Party</th>
              <th className="text-left px-3 py-2">Invoice Date</th>
              <th className="text-left px-3 py-2">Due Date</th>
              <th className="text-right px-3 py-2">Outstanding</th>
              <th className="text-right px-3 py-2">Overdue Days</th>
              <th className="text-right px-3 py-2">Rate (%)</th>
              <th className="text-right px-3 py-2">Interest</th>
              <th className="text-right px-3 py-2">Total Due</th>
            </tr>
          </thead>
          <tbody>
            {interestRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-500">
                  No overdue bills found.{" "}
                  {filterPartyId && "Try clearing the party filter."}
                </td>
              </tr>
            ) : (
              interestRecords.map((r) => (
                <tr key={r.bill.billNo} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedBillNos.has(r.bill.billNo)}
                      onChange={() => toggleBill(r.bill.billNo)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-600">
                    {r.bill.billNo}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {partiesMap.get(r.bill.partyId)?.name ?? r.bill.partyId}
                  </td>
                  <td className="px-3 py-2">{bsStr(r.bill.invoiceDate)}</td>
                  <td className="px-3 py-2">{bsStr(r.bill.dueDate)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {fmt(r.bill.balanceAmount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-red-600 font-semibold">{r.daysOverdue}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.annualRate}%</td>
                  <td className="px-3 py-2 text-right text-orange-700 font-semibold">
                    {fmt(r.interestAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700">
                    {fmt(r.totalDue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {interestRecords.length > 0 && (
            <tfoot>
              <tr className="bg-blue-50 font-bold text-blue-800 border-t-2">
                <td colSpan={5} className="px-3 py-2">
                  {selectedBillNos.size > 0
                    ? `${selectedBillNos.size} of ${interestRecords.length} selected`
                    : `Total (${interestRecords.length} bills)`}
                </td>
                <td className="px-3 py-2 text-right">{fmt(totalPrincipal)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-orange-700">{fmt(totalInterest)}</td>
                <td className="px-3 py-2 text-right">{fmt(totalDue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Post note ── */}
      <div className="text-xs text-gray-500 bg-gray-50 border rounded p-3 flex gap-2">
        <Info size={13} className="shrink-0 mt-0.5 text-blue-500" />
        <span>
          <strong>"Post Interest Entry"</strong> creates a Journal Voucher:
          Dr. Interest Receivable → Cr. Interest Income, with a narration referencing each bill.
          Configure the accounts in <em>Company Settings → Finance → Interest Accounts</em>.
          {selectedBillNos.size > 0
            ? ` ${selectedBillNos.size} bill(s) selected for posting.`
            : " All listed bills will be posted."}
        </span>
      </div>
    </div>
  );
}
