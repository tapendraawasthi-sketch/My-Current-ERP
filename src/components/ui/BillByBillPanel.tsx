// src/components/ui/BillByBillPanel.tsx
// BUSY-style Bill-by-Bill allocation panel
// Shown during Payment/Receipt voucher entry for party accounts with bill-by-bill enabled

import React, { useState, useMemo, useEffect } from "react";
import { AlertCircle, Zap, Check } from "lucide-react";

export interface PendingBill {
  billRefNo: string;
  voucherNo: string;
  billDate: string;
  dueDate?: string;
  originalAmount: number;
  pendingAmount: number;
  daysOverdue: number;
  invoiceId?: string;
}

export interface BillAllocation {
  billRefNo: string;
  allocatedAmount: number;
  type: "against-ref" | "advance" | "on-account";
}

interface Props {
  partyId: string;
  partyName: string;
  totalAmount: number;
  pendingBills: PendingBill[];
  onAllocationsChange: (allocations: BillAllocation[]) => void;
  initialAllocations?: BillAllocation[];
}

function fmt(n: number): string {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const BillByBillPanel: React.FC<Props> = ({
  partyId, partyName, totalAmount, pendingBills, onAllocationsChange, initialAllocations
}) => {
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [showPanel, setShowPanel] = useState(true);

  // Initialize from existing allocations
  useEffect(() => {
    if (initialAllocations?.length) {
      const m: Record<string, number> = {};
      initialAllocations.forEach(a => { m[a.billRefNo] = a.amount || (a as any).allocatedAmount || 0; });
      setAllocations(m);
    }
  }, []);

  // Auto-FIFO suggestion
  function applyFIFO() {
    let remaining = totalAmount;
    const m: Record<string, number> = {};
    const sorted = [...pendingBills].sort((a, b) => {
      if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return new Date(a.billDate).getTime() - new Date(b.billDate).getTime();
    });
    for (const bill of sorted) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, bill.pendingAmount);
      if (alloc > 0) { m[bill.billRefNo] = alloc; remaining -= alloc; }
    }
    setAllocations(m);
  }

  const totalAllocated = useMemo(() => Object.values(allocations).reduce((s, v) => s + v, 0), [allocations]);
  const unallocated = Math.max(0, totalAmount - totalAllocated);
  const overAllocated = totalAllocated > totalAmount + 0.005;

  // Emit to parent
  useEffect(() => {
    const result: BillAllocation[] = [];
    Object.entries(allocations).forEach(([ref, amt]) => {
      if (amt > 0) result.push({ billRefNo: ref, allocatedAmount: amt, type: "against-ref" });
    });
    if (unallocated > 0.005) {
      result.push({ billRefNo: `ADV-${partyId}`, allocatedAmount: unallocated, type: "advance" });
    }
    onAllocationsChange(result);
  }, [allocations, unallocated]);

  if (!showPanel) {
    return (
      <button onClick={() => setShowPanel(true)}
        className="text-[11px] text-[#1557b0] hover:underline">
        Show Bill-by-Bill Allocation ({pendingBills.length} pending bills)
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#eef2ff] border-b border-indigo-100">
        <div className="text-[12px] font-semibold text-indigo-800">
          Bill-by-Bill Allocation — {partyName}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={applyFIFO}
            className="h-6 px-2 bg-indigo-600 text-white text-[10px] font-semibold rounded flex items-center gap-1 hover:bg-indigo-700">
            <Zap className="h-3 w-3" /> Auto FIFO
          </button>
          <button onClick={() => setShowPanel(false)} className="text-[10px] text-gray-500 hover:text-gray-800">
            Hide ↑
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap gap-4 px-4 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px]">
        <span>Amount to Allocate: <strong className="text-[#1557b0]">{fmt(totalAmount)}</strong></span>
        <span>Allocated: <strong className={overAllocated ? "text-red-600" : "text-green-700"}>{fmt(totalAllocated)}</strong></span>
        <span>
          {unallocated > 0.005
            ? <span>Unallocated (→ Advance): <strong className="text-amber-600">{fmt(unallocated)}</strong></span>
            : <span className="flex items-center gap-1 text-green-700 font-semibold"><Check className="h-3 w-3" /> Fully Allocated</span>
          }
        </span>
        {overAllocated && (
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <AlertCircle className="h-3 w-3" /> Over-allocated by {fmt(totalAllocated - totalAmount)}
          </span>
        )}
      </div>

      {/* Bills table */}
      {pendingBills.length === 0 ? (
        <div className="px-4 py-4 text-center text-[12px] text-gray-500">
          No pending bills for this party. Amount will be posted as <strong>Advance</strong>.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Ref. No.</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Bill Date</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Overdue</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Original</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Pending</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase w-36">Allocate Now</th>
              </tr>
            </thead>
            <tbody>
              {pendingBills.map(bill => {
                const alloc = allocations[bill.billRefNo] || 0;
                const isOverBill = alloc > bill.pendingAmount + 0.005;
                return (
                  <tr key={bill.billRefNo} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-blue-600">{bill.billRefNo}</td>
                    <td className="px-3 py-1.5 text-gray-600">{bill.billDate}</td>
                    <td className="px-3 py-1.5 text-gray-600">{bill.dueDate || "—"}</td>
                    <td className="px-3 py-1.5 text-right">
                      {bill.daysOverdue > 0
                        ? <span className="text-red-600 font-semibold">{bill.daysOverdue} days</span>
                        : <span className="text-green-600">Not due</span>
                      }
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-700">{fmt(bill.originalAmount)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-800">{fmt(bill.pendingAmount)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number" min={0} max={bill.pendingAmount} step={0.01}
                        value={alloc || ""}
                        placeholder="0.00"
                        onChange={e => {
                          const val = Number(e.target.value) || 0;
                          setAllocations(prev => ({ ...prev, [bill.billRefNo]: Math.max(0, val) }));
                        }}
                        className={`w-32 text-right h-7 px-2 border rounded text-[11px] focus:outline-none focus:ring-1 ${
                          isOverBill ? "border-red-400 bg-red-50 focus:ring-red-300"
                          : alloc > 0 ? "border-green-400 bg-green-50 focus:ring-green-300"
                          : "border-gray-300 bg-white focus:ring-[#1557b0]"
                        }`}
                      />
                      {isOverBill && <div className="text-[9px] text-red-500">Exceeds pending</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {unallocated > 0.005 && (
        <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-700 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Rs. {unallocated.toFixed(2)} will be posted as Advance against future bills.
        </div>
      )}
    </div>
  );
};

export default BillByBillPanel;
