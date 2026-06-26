import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CashDenomination } from '@/lib/tallyVoucher';
import { formatMoney } from '@/lib/tallyFormat';

const standardDenominations = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000];

interface Props {
  isOpen: boolean;
  targetAmount: number;
  existing?: CashDenomination[];
  onClose: () => void;
  onSave: (denoms: CashDenomination[]) => void;
}

export const TallyCashDenomination: React.FC<Props> = ({
  isOpen,
  targetAmount,
  existing,
  onClose,
  onSave,
}) => {
  const [rows, setRows] = useState<CashDenomination[]>(
    existing?.length ? existing : standardDenominations.map((d) => ({ denom: d, count: 0 }))
  );

  if (!isOpen) return null;

  const total = rows.reduce((sum, r) => sum + r.denom * r.count, 0);

  const updateCount = (denomination: number, count: number) => {
    setRows((prev) =>
      prev.map((r) => (r.denom === denomination ? { ...r, count: Math.max(0, count || 0) } : r))
    );
  };

  const handleSave = () => {
    onSave(rows.filter((r) => r.count > 0));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="tally-popup w-[420px] rounded-sm">
        <div className="tally-popup-title flex items-center justify-between">
          <span>Cash Denomination</span>
          <button onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-3">
          <div className="flex justify-between text-xs text-tally-700 mb-2">
            <span>Target Amount: <strong>{formatMoney(targetAmount)}</strong></span>
            <span>Total: <strong className={total === targetAmount ? 'text-green-700' : 'text-red-700'}>{formatMoney(total)}</strong></span>
          </div>
          <table className="tally-grid">
            <thead>
              <tr>
                <th>Denomination</th>
                <th>Count</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.denom}>
                  <td className="text-right">{formatMoney(r.denom)}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="tally-input text-right"
                      value={r.count || ''}
                      onChange={(e) => updateCount(r.denom, parseInt(e.target.value || '0', 10))}
                    />
                  </td>
                  <td className="text-right">{formatMoney(r.denom * r.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-2 pt-3">
            <button className="tally-btn" onClick={onClose}>Cancel</button>
            <button className="tally-btn tally-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallyCashDenomination;
