import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { BankAllocation, BankMode } from '@/lib/tallyVoucher';
import { formatMoney, parseMoney } from '@/lib/tallyFormat';

const modes: BankMode[] = ['Cheque/DD', 'EFT', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Others'];

interface Props {
  isOpen: boolean;
  amount: number;
  existing?: BankAllocation;
  onClose: () => void;
  onSave: (allocation: BankAllocation) => void;
}

export const TallyBankAllocation: React.FC<Props> = ({
  isOpen,
  amount,
  existing,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<BankAllocation>({
    id: existing?.id || '',
    transactionType: existing?.transactionType || 'Cheque/DD',
    instrumentNumber: existing?.instrumentNumber || '',
    instrumentDate: existing?.instrumentDate || '',
    bankName: existing?.bankName || '',
    branchName: existing?.branchName || '',
    ifscCode: existing?.ifscCode || '',
    amount: existing?.amount || amount,
    bankStatus: existing?.bankStatus || 'Not Reconciled',
  });

  useEffect(() => {
    if (!existing && isOpen) {
      setForm((f) => ({ ...f, amount }));
    }
  }, [isOpen, amount, existing]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ ...form, id: form.id || crypto.randomUUID() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="tally-popup w-[480px] rounded-sm">
        <div className="tally-popup-title flex items-center justify-between">
          <span>Bank Allocation</span>
          <button onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Transaction Type</label>
              <select
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                value={form.transactionType}
                onChange={(e) => setForm({ ...form, transactionType: e.target.value as BankMode })}
              >
                {modes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Amount</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full text-right"
                value={formatMoney(form.amount)}
                onChange={(e) => setForm({ ...form, amount: parseMoney(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Instrument No</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                value={form.instrumentNumber}
                onChange={(e) => setForm({ ...form, instrumentNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Instrument Date</label>
              <input
                type="date"
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                value={form.instrumentDate}
                onChange={(e) => setForm({ ...form, instrumentDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Bank Name</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Branch Name</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-tally-700 font-semibold uppercase">IFSC Code</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="tally-btn" onClick={onClose}>Cancel</button>
            <button className="tally-btn tally-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallyBankAllocation;
