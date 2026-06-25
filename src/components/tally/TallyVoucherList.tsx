import React, { useState, useMemo } from 'react';
import { X, Search, Printer, FileEdit, Trash2 } from 'lucide-react';
import { VoucherMeta } from '@/lib/tallyVoucher';
import { formatMoney, formatDate } from '@/lib/tallyFormat';

interface Props {
  isOpen: boolean;
  vouchers: VoucherMeta[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onPrint?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const TallyVoucherList: React.FC<Props> = ({
  isOpen,
  vouchers,
  onClose,
  onSelect,
  onPrint,
  onDelete,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return vouchers;
    const q = query.toLowerCase();
    return vouchers.filter(
      (v) =>
        v.voucherNumber.toLowerCase().includes(q) ||
        v.voucherType.toLowerCase().includes(q) ||
        v.reference?.toLowerCase().includes(q) ||
        formatDate(v.date).includes(q)
    );
  }, [vouchers, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="tally-popup w-[720px] rounded-sm max-h-[80vh] flex flex-col">
        <div className="tally-popup-title flex items-center justify-between">
          <span className="flex items-center gap-1"><Search size={12} /> Voucher List (F10)</span>
          <button onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-3">
          <input
            className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full mb-2"
            placeholder="Search by number, type, reference or date..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="overflow-auto max-h-[55vh]">
            <table className="tally-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher No</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="cursor-pointer hover:bg-tally-100"
                    onClick={() => onSelect(v.id)}
                  >
                    <td>{formatDate(v.date)}</td>
                    <td>{v.voucherNumber}</td>
                    <td>{v.voucherType}</td>
                    <td>{v.reference || '-'}</td>
                    <td className="text-right">{formatMoney(v.totalDebit || v.totalCredit)}</td>
                    <td className="text-center">
                      <button className="text-tally-600 hover:text-tally-800 mx-1" onClick={(e) => { e.stopPropagation(); onSelect(v.id); }}>
                        <FileEdit size={14} />
                      </button>
                      {onPrint && (
                        <button className="text-tally-600 hover:text-tally-800 mx-1" onClick={(e) => { e.stopPropagation(); onPrint(v.id); }}>
                          <Printer size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button className="text-red-600 hover:text-red-800 mx-1" onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-tally-600 py-3">No vouchers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallyVoucherList;
