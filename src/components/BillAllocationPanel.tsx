/**
 * src/components/BillAllocationPanel.tsx
 *
 * Reusable "Bill Allocation" panel for Receipt / Payment vouchers.
 *
 * Usage inside ReceiptVoucherForm:
 *   <BillAllocationPanel
 *     partyId={partyId}
 *     amountReceived={totalAmount}
 *     onAllocationsChange={(allocs) => setAllocations(allocs)}
 *   />
 *
 * The panel:
 *  - Loads all outstanding bills for the party via computeBillWiseOutstanding
 *  - Shows FIFO suggestion on amount change
 *  - Lets user override individual amounts
 *  - Shows: Amount Received | Allocated | Unallocated (→ posted as advance)
 *  - Returns BillAllocation[] to parent for saving in the voucher
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Zap, RefreshCw, AlertCircle } from "lucide-react";
import { db } from "../lib/db";
import { adToBS, formatBS } from "../lib/nepaliDate";
import {
  computeBillWiseOutstanding,
  suggestFIFOAllocation,
  BillRecord,
  BillAllocation,
} from "../lib/billWiseEngine";
import { VoucherType, VoucherStatus } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "Rs. " + n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function bsStr(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return "—";
  try { return formatBS(adToBS(date)); } catch { return "—"; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManualAllocation {
  billNo: string;
  billRecord: BillRecord;
  amount: number; // how much to allocate NOW
}

interface Props {
  partyId: string;
  amountReceived: number;
  direction?: "receivable" | "payable"; // default: receivable
  onAllocationsChange: (allocations: BillAllocation[]) => void;
  /** Optional: pass already-saved allocations to restore state when editing */
  initialAllocations?: BillAllocation[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BillAllocationPanel({
  partyId,
  amountReceived,
  direction = "receivable",
  onAllocationsChange,
  initialAllocations,
}: Props) {
  // Map: billNo → user-edited allocation amount
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [fifoApplied, setFifoApplied] = useState(false);

  // ── Live data ─────────────────────────────────────────────────────────────
  const invoiceType =
    direction === "receivable"
      ? VoucherType.SALES_INVOICE
      : VoucherType.PURCHASE_INVOICE;

  const paymentType =
    direction === "receivable" ? VoucherType.RECEIPT : VoucherType.PAYMENT;

  const invoices = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .equals(invoiceType as string)
        .and((v: any) => v.status === VoucherStatus.POSTED && v.partyId === partyId)
        .toArray() ?? Promise.resolve([]),
    [partyId, direction]
  );

  const paymentVouchers = useLiveQuery(
    () =>
      db.vouchers
        ?.where("type")
        .equals(paymentType as string)
        .and((v: any) => v.partyId === partyId)
        .toArray() ?? Promise.resolve([]),
    [partyId, direction]
  );

  // ── Compute outstanding bills ─────────────────────────────────────────────
  const outstandingBills = useMemo(() => {
    if (!invoices || !paymentVouchers || !partyId) return [];
    return computeBillWiseOutstanding(
      partyId,
      invoices as any[],
      paymentVouchers as any[],
      new Date(),
      direction
    ).filter((b) => !b.isAdvanceCredit && b.balanceAmount > 0);
  }, [invoices, paymentVouchers, partyId, direction]);

  // ── Restore initial allocations (edit mode) ───────────────────────────────
  useEffect(() => {
    if (initialAllocations && initialAllocations.length > 0 && !fifoApplied) {
      const m = new Map<string, number>();
      for (const a of initialAllocations) {
        if (a.billRefType === "against-ref") {
          m.set(a.billRefNo, a.amount);
        }
      }
      setOverrides(m);
    }
  }, [initialAllocations]); // eslint-disable-line

  // ── FIFO suggestion ───────────────────────────────────────────────────────
  const fifoSuggestion = useMemo(() => {
    if (amountReceived <= 0 || outstandingBills.length === 0)
      return { allocations: [], unallocated: amountReceived };
    return suggestFIFOAllocation(amountReceived, outstandingBills);
  }, [amountReceived, outstandingBills]);

  const applyFIFO = useCallback(() => {
    const m = new Map<string, number>();
    for (const s of fifoSuggestion.allocations) {
      m.set(s.billNo, s.suggestedAllocation);
    }
    setOverrides(m);
    setFifoApplied(true);
  }, [fifoSuggestion]);

  // ── Build current allocations ─────────────────────────────────────────────
  const currentAllocations = useMemo(() => {
    const allocs: ManualAllocation[] = outstandingBills.map((bill) => ({
      billNo: bill.billNo,
      billRecord: bill,
      amount: overrides.get(bill.billNo) ?? 0,
    }));
    return allocs;
  }, [outstandingBills, overrides]);

  const totalAllocated = useMemo(
    () => currentAllocations.reduce((s, a) => s + a.amount, 0),
    [currentAllocations]
  );
  const unallocated = Math.max(0, amountReceived - totalAllocated);
  const overAllocated = totalAllocated > amountReceived + 0.005;

  // ── Emit to parent ────────────────────────────────────────────────────────
  useEffect(() => {
    const billAllocs: BillAllocation[] = [];

    for (const alloc of currentAllocations) {
      if (alloc.amount > 0) {
        billAllocs.push({
          billRefNo: alloc.billNo,
          billRefType: "against-ref",
          amount: alloc.amount,
          dueDate: alloc.billRecord.dueDate?.toISOString(),
        });
      }
    }

    if (unallocated > 0.005) {
      billAllocs.push({
        billRefNo: `ADV-${Date.now()}`,
        billRefType: "advance",
        amount: unallocated,
      });
    }

    onAllocationsChange(billAllocs);
  }, [currentAllocations, unallocated]); // eslint-disable-line

  const updateOverride = useCallback(
    (billNo: string, value: string) => {
      const num = parseFloat(value) || 0;
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(billNo, Math.max(0, num));
        return next;
      });
    },
    []
  );

  const isLoading = !invoices || !paymentVouchers;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
        <RefreshCw size={14} className="animate-spin" />
        Loading outstanding bills for {direction}…
      </div>
    );
  }

  if (!partyId) {
    return (
      <div className="text-sm text-gray-400 py-2 italic">
        Select a party to see outstanding bills.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-indigo-50 border-b px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-indigo-800">
          Bill Allocation
        </div>
        <button
          type="button"
          onClick={applyFIFO}
          disabled={outstandingBills.length === 0 || amountReceived <= 0}
          className="flex items-center gap-1.5 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          <Zap size={12} />
          Auto-fill (FIFO)
        </button>
      </div>

      {/* ── Status bar ── */}
      <div className="bg-gray-50 px-4 py-2 flex flex-wrap gap-4 text-sm border-b">
        <span>
          Received:{" "}
          <strong className="text-green-700">{fmt(amountReceived)}</strong>
        </span>
        <span>
          Allocated:{" "}
          <strong
            className={overAllocated ? "text-red-600" : "text-blue-700"}
          >
            {fmt(totalAllocated)}
          </strong>
        </span>
        <span>
          Unallocated (→ Advance):{" "}
          <strong
            className={unallocated > 0 ? "text-orange-600" : "text-gray-400"}
          >
            {fmt(unallocated)}
          </strong>
        </span>
        {overAllocated && (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <AlertCircle size={13} />
            Over-allocated by {fmt(totalAllocated - amountReceived)}
          </span>
        )}
      </div>

      {/* ── Table ── */}
      {outstandingBills.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          No outstanding bills for this party. Amount will be posted as{" "}
          <strong>advance</strong>.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                <th className="text-left px-3 py-2">Bill No.</th>
                <th className="text-left px-3 py-2">Due Date (BS)</th>
                <th className="text-right px-3 py-2">Days Overdue</th>
                <th className="text-right px-3 py-2">Original</th>
                <th className="text-right px-3 py-2">Outstanding</th>
                <th className="text-right px-3 py-2 w-40">Allocate Now</th>
              </tr>
            </thead>
            <tbody>
              {currentAllocations.map((alloc) => {
                const bill = alloc.billRecord;
                const isOverAlloc = alloc.amount > bill.balanceAmount + 0.005;
                return (
                  <tr key={bill.billNo} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-blue-600">
                      {bill.billNo}
                    </td>
                    <td className="px-3 py-2">{bsStr(bill.dueDate)}</td>
                    <td className="px-3 py-2 text-right">
                      {bill.daysOverdue > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {bill.daysOverdue}
                        </span>
                      ) : (
                        <span className="text-green-500">Not due</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmt(bill.originalAmount)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {fmt(bill.balanceAmount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={bill.balanceAmount}
                        step={0.01}
                        value={alloc.amount || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateOverride(bill.billNo, e.target.value)
                        }
                        className={`w-36 text-right px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 ${
                          isOverAlloc
                            ? "border-red-400 focus:ring-red-300 bg-red-50"
                            : alloc.amount > 0
                            ? "border-green-400 focus:ring-green-300 bg-green-50"
                            : "focus:ring-blue-300"
                        }`}
                      />
                      {isOverAlloc && (
                        <div className="text-xs text-red-500 mt-0.5 text-right">
                          Exceeds outstanding
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer note ── */}
      {unallocated > 0.005 && (
        <div className="px-4 py-2 bg-orange-50 border-t text-xs text-orange-700 flex items-center gap-1.5">
          <AlertCircle size={12} />
          Rs. {unallocated.toFixed(2)} will be posted as <strong>advance</strong> for future
          bill adjustment.
        </div>
      )}
    </div>
  );
}

export default BillAllocationPanel;
