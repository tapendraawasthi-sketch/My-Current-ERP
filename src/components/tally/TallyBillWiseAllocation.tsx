import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { BillWiseAllocation } from '@/lib/tallyVoucher';
import { formatMoney, parseMoney } from '@/lib/tallyFormat';

interface Props {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  amountToAllocate: number;
  existing?: BillWiseAllocation[];
  onClose: () => void;
  onSave: (allocations: BillWiseAllocation[]) => void;
}

export const TallyBillWiseAllocation: React.FC<Props> = ({
  isOpen,
  accountId,
  accountName,
  amountToAllocate,
  existing,
  onClose,
  onSave,
}) => {
  // Mock pending invoices; replace with real data from store/DB.
  const mockInvoices: BillWiseAllocation[] = useMemo(() => {
    const base = [
      { id: '1', invoiceId: 'inv-001', invoiceNumber: 'INV-001', invoiceDate: '2024-07-01', dueDate: '2024-07-31', amount: 50000, pending: 25000, allocated: 0 },
      { id: '2', invoiceId: 'inv-002', invoiceNumber: 'INV-002', invoiceDate: '2024-07-10', dueDate: '2024-08-10', amount: 30000, pending: 30000, allocated: 0 },
      { id: '3', invoiceId: 'inv-003', invoiceNumber: 'INV-003', invoiceDate: '2024-06-15', dueDate: '2024-07-15', amount: 120000, pending: 95000, allocated: 0 },
    ];
    return base.map((b) => {
      const existingItem = existing?.find((e) => e.invoiceId === b.invoiceId);
      return { ...b, allocated: existingItem?.allocated || 0 };
    });
  }, [existing]);

  const [rows, setRows] = useState<BillWiseAllocation[]>(mockInvoices);

  const totalAllocated = useMemo(() => rows.reduce((sum, r) => sum + r.allocated, 0), [rows]);

  if (!isOpen) return null;

  const updateAllocated = (invoiceId: string, allocated: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.invoiceId === invoiceId
          ? { ...r, allocated: Math.max(0, Math.min(r.pending, allocated || 0)) }
          : r
      )
    );
  };

  const autoAllocate = () => {
    let remaining = amountToAllocate;
    setRows((prev) =>
      prev.map((r) => {
        const alloc = Math.min(r.pending, remaining);
        remaining -= alloc;
        return { ...r, allocated: alloc };
      })
    );
  };

  const handleSave = () => {
    onSave(rows.filter((r) => r.allocated > 0));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="tally-popup w-[640px] rounded-sm">
        <div className="tally-popup-title flex items-center justify-between">
          <span>Bill-wise Allocation: {accountName}</span>
          <button onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-3">
          <div className="flex justify-between text-xs text-tally-700 mb-2">
            <span>Amount to Allocate: <strong>{formatMoney(amountToAllocate)}</strong></span>
            <span>Allocated: <strong className={totalAllocated === amountToAllocate ? 'text-green-700' : 'text-red-700'}>{formatMoney(totalAllocated)}</strong></span>
          </div>
          <table className="tally-grid">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Pending</th>
                <th>Allocate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoiceId}>
                  <td>{r.invoiceNumber}</td>
                  <td>{r.invoiceDate}</td>
                  <td>{r.dueDate}</td>
                  <td className="text-right">{formatMoney(r.amount)}</td>
                  <td className="text-right">{formatMoney(r.pending)}</td>
                  <td>
                    <input
                      className="tally-input text-right"
                      value={r.allocated ? formatMoney(r.allocated) : ''}
                      onChange={(e) => updateAllocated(r.invoiceId, parseMoney(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between pt-3">
            <button className="tally-btn" onClick={autoAllocate}>Auto Allocate</button>
            <div className="flex gap-2">
              <button className="tally-btn" onClick={onClose}>Cancel</button>
              <button className="tally-btn tally-btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallyBillWiseAllocation;
