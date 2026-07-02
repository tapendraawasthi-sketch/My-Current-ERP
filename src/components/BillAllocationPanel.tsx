import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "dexie";
import { Zap, RefreshCw, AlertCircle } from "lucide-react";
import { getDB } from "../lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillRecord {
  billNo: string;
  originalAmount: number;
  balanceAmount: number;
  dueDate?: Date | null;
  daysOverdue: number;
  isAdvanceCredit?: boolean;
  invoiceId?: string;
  date?: string;
}

export interface BillAllocation {
  billRefNo: string;
  billRefType: "against-ref" | "advance" | "on-account";
  amount: number;
  dueDate?: string;
}

interface FifoSuggestion {
  billNo: string;
  suggestedAllocation: number;
}

interface FifoResult {
  allocations: FifoSuggestion[];
  unallocated: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return (
    "Rs. " +
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function computeOutstanding(
  partyId: string,
  invoices: any[],
  payments: any[],
  direction: "receivable" | "payable",
): BillRecord[] {
  const records: BillRecord[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const inv of invoices) {
    if (!inv || inv.partyId !== partyId) continue;
    if (inv.status !== "posted" && inv.status !== "partial") continue;

    const originalAmount = Number(inv.grandTotal ?? inv.total ?? 0);
    if (originalAmount <= 0) continue;

    // Use only the invoice's tracked paidAmount
    const balance = originalAmount - Number(inv.paidAmount ?? 0);
    if (balance <= 0.005) continue;

    const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
    let daysOverdue = 0;
    if (dueDate) {
      const diff = today.getTime() - dueDate.getTime();
      daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }

    records.push({
      billNo: inv.invoiceNo ?? inv.id,
      originalAmount,
      balanceAmount: parseFloat(balance.toFixed(2)),
      dueDate,
      daysOverdue,
      isAdvanceCredit: false,
      invoiceId: inv.id,
      date: inv.date,
    });
  }

  return records.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
}

function suggestFIFO(amount: number, bills: BillRecord[]): FifoResult {
  let remaining = amount;
  const allocations: FifoSuggestion[] = [];

  for (const bill of bills) {
    if (remaining <= 0.005) break;
    const alloc = Math.min(remaining, bill.balanceAmount);
    if (alloc > 0.005) {
      allocations.push({
        billNo: bill.billNo,
        suggestedAllocation: parseFloat(alloc.toFixed(2)),
      });
      remaining -= alloc;
    }
  }

  return {
    allocations,
    unallocated: parseFloat(Math.max(0, remaining).toFixed(2)),
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  partyId: string;
  amountReceived: number;
  direction?: "receivable" | "payable";
  onAllocationsChange: (allocations: BillAllocation[]) => void;
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
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [fifoApplied, setFifoApplied] = useState(false);

  const invoiceType = direction === "receivable" ? "sales-invoice" : "purchase-invoice";
  const paymentType = direction === "receivable" ? "receipt" : "payment";

  // Fix: use getDB() with useLiveQuery inside the callbacks to avoid stale closures
  const invoices = useLiveQuery(
    () =>
      getDB()
        .invoices.where("type")
        .equals(invoiceType)
        .and((v: any) => v.partyId === partyId)
        .toArray(),
    [partyId, direction, invoiceType],
  );

  const paymentVouchers = useLiveQuery(
    () =>
      getDB()
        .vouchers.where("type")
        .equals(paymentType)
        .and((v: any) => v.partyId === partyId)
        .toArray(),
    [partyId, direction, paymentType],
  );

  // ── Compute outstanding ───────────────────────────────────────────────────
  const outstandingBills = useMemo<BillRecord[]>(() => {
    if (!invoices || !paymentVouchers || !partyId) return [];
    return computeOutstanding(
      partyId,
      invoices as any[],
      paymentVouchers as any[],
      direction,
    ).filter((b) => !b.isAdvanceCredit && b.balanceAmount > 0);
  }, [invoices, paymentVouchers, partyId, direction]);

  // ── Restore initial allocations ───────────────────────────────────────────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAllocations]);

  // ── FIFO suggestion ───────────────────────────────────────────────────────
  const fifoSuggestion = useMemo<FifoResult>(() => {
    if (amountReceived <= 0 || outstandingBills.length === 0) {
      return { allocations: [], unallocated: amountReceived };
    }
    return suggestFIFO(amountReceived, outstandingBills);
  }, [amountReceived, outstandingBills]);

  const applyFIFO = useCallback(() => {
    const m = new Map<string, number>();
    for (const s of fifoSuggestion.allocations) {
      m.set(s.billNo, s.suggestedAllocation);
    }
    setOverrides(m);
    setFifoApplied(true);
  }, [fifoSuggestion]);

  // ── Current allocations ───────────────────────────────────────────────────
  const currentAllocations = useMemo(() => {
    return outstandingBills.map((bill) => ({
      billNo: bill.billNo,
      billRecord: bill,
      amount: overrides.get(bill.billNo) ?? 0,
    }));
  }, [outstandingBills, overrides]);

  const totalAllocated = useMemo(
    () => currentAllocations.reduce((s, a) => s + a.amount, 0),
    [currentAllocations],
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
        billRefNo: `ADV-${partyId}-${new Date().toISOString().split("T")[0]}`,
        billRefType: "advance",
        amount: unallocated,
      });
    }

    onAllocationsChange(billAllocs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAllocations, unallocated]);

  const updateOverride = useCallback((billNo: string, value: string) => {
    const num = parseFloat(value) || 0;
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(billNo, Math.max(0, num));
      return next;
    });
  }, []);

  const isLoading = !invoices || !paymentVouchers;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-[12px]">
        <RefreshCw size={14} className="animate-spin" />
        Loading outstanding bills…
      </div>
    );
  }

  if (!partyId) {
    return (
      <div className="text-[12px] text-gray-400 py-2 italic">
        Select a party to see outstanding bills.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[12px] font-semibold text-indigo-800">Bill Allocation</div>
        <button
          type="button"
          onClick={applyFIFO}
          disabled={outstandingBills.length === 0 || amountReceived <= 0}
          className="flex items-center gap-1.5 h-7 px-3 text-[11px] bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Zap size={12} />
          Auto-fill (FIFO)
        </button>
      </div>

      {/* Status bar */}
      <div className="bg-gray-50 px-4 py-2 flex flex-wrap gap-4 text-[12px] border-b border-gray-200">
        <span>
          Received: <strong className="text-green-700">{fmt(amountReceived)}</strong>
        </span>
        <span>
          Allocated:{" "}
          <strong className={overAllocated ? "text-red-600" : "text-blue-700"}>
            {fmt(totalAllocated)}
          </strong>
        </span>
        <span>
          Unallocated (→ Advance):{" "}
          <strong className={unallocated > 0 ? "text-orange-600" : "text-gray-400"}>
            {fmt(unallocated)}
          </strong>
        </span>
        {overAllocated && (
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <AlertCircle size={13} />
            Over-allocated by {fmt(totalAllocated - amountReceived)}
          </span>
        )}
      </div>

      {/* Table */}
      {outstandingBills.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-gray-500">
          No outstanding bills for this party. Amount will be posted as <strong>advance</strong>.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Bill No.
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Due Date
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Days Overdue
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Original
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Outstanding
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-40">
                  Allocate Now
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentAllocations.map((alloc) => {
                const bill = alloc.billRecord;
                const isOverAlloc = alloc.amount > bill.balanceAmount + 0.005;
                const dueDateStr = bill.dueDate ? bill.dueDate.toLocaleDateString("en-NP") : "—";
                return (
                  <tr key={bill.billNo} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-blue-600">
                      {bill.billNo}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{dueDateStr}</td>
                    <td className="px-3 py-2.5 text-right">
                      {bill.daysOverdue > 0 ? (
                        <span className="text-red-600 font-semibold">{bill.daysOverdue}</span>
                      ) : (
                        <span className="text-green-500">Not due</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                      {fmt(bill.originalAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">
                      {fmt(bill.balanceAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        max={bill.balanceAmount}
                        step={0.01}
                        value={alloc.amount || ""}
                        placeholder="0.00"
                        onChange={(e) => updateOverride(bill.billNo, e.target.value)}
                        className={`w-36 text-right px-2 py-1 border rounded text-[12px] focus:outline-none focus:ring-2 ${
                          isOverAlloc
                            ? "border-red-400 focus:ring-red-300 bg-red-50"
                            : alloc.amount > 0
                              ? "border-green-400 focus:ring-green-300 bg-green-50"
                              : "border-gray-300 focus:ring-[#1557b0]/20 bg-white"
                        }`}
                      />
                      {isOverAlloc && (
                        <div className="text-[10px] text-red-500 mt-0.5">Exceeds outstanding</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer note */}
      {unallocated > 0.005 && (
        <div className="px-4 py-2 bg-orange-50 border-t border-orange-100 text-[11px] text-orange-700 flex items-center gap-1.5">
          <AlertCircle size={12} />
          Rs. {unallocated.toFixed(2)} will be posted as <strong>advance</strong> for future bill
          adjustment.
        </div>
      )}
    </div>
  );
}

export default BillAllocationPanel;
