import React, { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BillWiseEntry, BillAllocation } from "../../lib/types";
import { formatAmount } from "../../lib/utils";
import { Button } from "./Button";
import { Input } from "./Input";

interface BillByBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (allocations: Partial<BillAllocation>[], onAccountAmount: number) => void;
  partyId: string;
  partyName: string;
  amount: number;
  side: "Dr" | "Cr";
}

export const BillByBillModal: React.FC<BillByBillModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  partyId,
  partyName,
  amount,
  side,
}) => {
  const getOpenBillsByParty = useStore((s) => s.getOpenBillsByParty);
  const [openBills, setOpenBills] = useState<BillWiseEntry[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [onAccount, setOnAccount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && partyId) {
      const bills = getOpenBillsByParty(partyId);
      // Sort by dueDate ASC, fallback to date
      const sorted = bills.sort((a, b) => {
        const dateA = a.dueDate || a.date;
        const dateB = b.dueDate || b.date;
        return dateA.localeCompare(dateB);
      });
      setOpenBills(sorted);
      setAllocations({});
      setOnAccount(0);
      setError(null);
    }
  }, [isOpen, partyId, getOpenBillsByParty]);

  const allocatedTotal = useMemo(() => {
    return Object.values(allocations).reduce((acc, val) => acc + val, 0);
  }, [allocations]);

  const remaining = amount - allocatedTotal - onAccount;

  const handleAllocationChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setAllocations((prev) => ({ ...prev, [id]: num }));
    setError(null);
  };

  const handleQuickFill = () => {
    let amtLeft = amount;
    const newAllocations: Record<string, number> = {};

    for (const bill of openBills) {
      if (amtLeft <= 0) break;
      const alloc = Math.min(bill.balanceAmount, amtLeft);
      newAllocations[bill.id] = alloc;
      amtLeft -= alloc;
    }

    setAllocations(newAllocations);
    setOnAccount(amtLeft > 0 ? amtLeft : 0);
    setError(null);
  };

  const handleClearAll = () => {
    setAllocations({});
    setOnAccount(0);
    setError(null);
  };

  const handleConfirm = () => {
    const totalAllocated = allocatedTotal + onAccount;
    // Use an epsilon for floating point comparison
    if (Math.abs(totalAllocated - amount) > 0.01) {
      setError(`Total allocated (रू ${formatAmount(totalAllocated)}) must exactly equal the amount to allocate (रू ${formatAmount(amount)}).`);
      return;
    }

    const allocationResults: Partial<BillAllocation>[] = [];
    
    Object.entries(allocations).forEach(([id, allocAmt]) => {
      if (allocAmt > 0) {
        const bill = openBills.find((b) => b.id === id);
        if (bill) {
          allocationResults.push({
            invoiceId: bill.id,
            invoiceNo: bill.voucherNo || bill.referenceNo || "",
            invoiceDate: bill.date,
            partyId: bill.partyId,
            originalAmount: bill.originalAmount,
            allocatedAmount: allocAmt,
            balanceLeft: bill.balanceAmount - allocAmt,
          });
        }
      }
    });

    onConfirm(allocationResults, onAccount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#f5f6fa] rounded-t-lg">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">
              Bill-by-Bill Adjustment — {partyName}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Amount to allocate: <span className="font-semibold text-gray-700">रू {formatAmount(amount)}</span> ({side})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button onClick={handleQuickFill} variant="primary" className="h-7 text-[11px]">Quick Fill</Button>
              <Button onClick={handleClearAll} variant="outline" className="h-7 text-[11px]">Clear All</Button>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-medium border border-gray-200 bg-gray-50 px-3 py-1.5 rounded-md">
              <div className="text-gray-600">
                Allocated: रू <span className="font-semibold text-gray-800">{formatAmount(allocatedTotal + onAccount)}</span>
              </div>
              <div className="text-gray-300">|</div>
              <div className={`text-gray-600 ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                Remaining: रू <span className="font-semibold">{formatAmount(remaining)}</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-32">Ref No</th>
                  <th className="w-24">Date (BS)</th>
                  <th className="w-24">Due Date (BS)</th>
                  <th className="w-24 text-right">Original Amt</th>
                  <th className="w-24 text-right">Balance</th>
                  <th className="w-20 text-center">Overdue</th>
                  <th className="w-32 text-right">Allocate</th>
                </tr>
              </thead>
              <tbody>
                {openBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 text-[12px]">
                      No open bills found for this party.
                    </td>
                  </tr>
                ) : (
                  openBills.map((bill) => {
                    const asOn = new Date();
                    const due = new Date(bill.dueDate || bill.date);
                    let daysOverdue = 0;
                    if (asOn > due) {
                      daysOverdue = Math.ceil((asOn.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                    }

                    return (
                      <tr key={bill.id}>
                        <td>{bill.referenceNo || bill.voucherNo}</td>
                        <td>{bill.dateNepali}</td>
                        <td>{bill.dueDate || "-"}</td>
                        <td className="text-right amt">{formatAmount(bill.originalAmount)}</td>
                        <td className="text-right amt">{formatAmount(bill.balanceAmount)}</td>
                        <td className="text-center">
                          {daysOverdue > 0 ? (
                            <span className="text-red-600 font-semibold">{daysOverdue} d</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            value={allocations[bill.id] || ""}
                            onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                            className="h-7 text-right w-full"
                            placeholder="0.00"
                            min="0"
                            max={bill.balanceAmount}
                            step="0.01"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="text-right py-2 px-3 font-semibold text-[12px] text-gray-700">
                    On Account (Unallocated)
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={onAccount || ""}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value) || 0;
                        setOnAccount(num);
                        setError(null);
                      }}
                      className="h-7 text-right w-full"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {error && (
            <div className="mt-3 text-[12px] text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm Allocations
          </Button>
        </div>
      </div>
    </div>
  );
};
