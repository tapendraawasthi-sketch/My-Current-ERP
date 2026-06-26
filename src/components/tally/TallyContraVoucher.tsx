import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import TallyVoucherShell from './TallyVoucherShell';
import TallyAccountSelect from './TallyAccountSelect';
import TallyBankAllocation from './TallyBankAllocation';
import TallyCashDenomination from './TallyCashDenomination';
import TallyVoucherPrint from './TallyVoucherPrint';
import TallyVoucherList from './TallyVoucherList';
import { Voucher, VoucherLine, blankVoucher, blankLine, recalcTotals, isBalanced } from '@/lib/tallyVoucher';
import { formatMoney, parseMoney } from '@/lib/tallyFormat';
import { useStore } from '@/store/useStore';

export const TallyContraVoucher: React.FC = () => {
  const [voucher, setVoucher] = useState<Voucher>(() => blankVoucher('Contra'));
  const [selectedRow, setSelectedRow] = useState(0);
  const [showBank, setShowBank] = useState(false);
  const [showCash, setShowCash] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showList, setShowList] = useState(false);
  const [bankLineIdx, setBankLineIdx] = useState<number | null>(null);
  const [cashLineIdx, setCashLineIdx] = useState<number | null>(null);

  const { addVoucher, updateVoucher, vouchers, cancelVoucher } = useStore();

  const isBankAccount = (name: string) => name.toLowerCase().includes('bank');
  const isCashAccount = (name: string) => name.toLowerCase().includes('cash');

  const updateLine = useCallback((idx: number, patch: Partial<VoucherLine>) => {
    setVoucher((prev) => {
      const lines = prev.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
      const totals = recalcTotals(lines);
      return { ...prev, lines, totalDebit: totals.totalDebit, totalCredit: totals.totalCredit };
    });
  }, []);

  const addRow = useCallback(() => {
    setVoucher((prev) => ({ ...prev, lines: [...prev.lines, blankLine()] }));
    setSelectedRow((prev) => voucher.lines.length);
  }, [voucher.lines.length]);

  const duplicateRow = useCallback(() => {
    const line = voucher.lines[selectedRow];
    if (!line) return;
    setVoucher((prev) => {
      const lines = [...prev.lines];
      lines.splice(selectedRow + 1, 0, { ...line, id: crypto.randomUUID() });
      return { ...prev, lines };
    });
    setSelectedRow((r) => r + 1);
  }, [selectedRow, voucher.lines]);

  const handleAccept = useCallback(async () => {
    if (!isBalanced(voucher.lines)) {
      toast.error('Debit and Credit totals must be equal.');
      return;
    }
    if (voucher.id) {
      await updateVoucher(voucher.id, voucher);
    } else {
      await addVoucher(voucher);
    }
    toast.success('Contra voucher saved.');
    setVoucher(blankVoucher('Contra'));
    setSelectedRow(0);
  }, [voucher, updateVoucher, addVoucher]);

  const handleCancel = useCallback(() => {
    setVoucher(blankVoucher('Contra'));
    setSelectedRow(0);
  }, []);

  const handleSelect = useCallback((id: string) => {
    const loaded = vouchers.find(v => v.id === id);
    if (loaded) { setVoucher(loaded); setShowList(false); setSelectedRow(0); }
  }, [vouchers]);

  return (
    <TallyVoucherShell
      title="Accounting Voucher"
      voucherType={voucher.voucherType}
      voucherNumber={voucher.voucherNumber}
      date={voucher.date}
      reference={voucher.reference}
      narration={voucher.narration}
      totalDebit={voucher.totalDebit}
      totalCredit={voucher.totalCredit}
      onVoucherNumberChange={(v) => setVoucher((p) => ({ ...p, voucherNumber: v }))}
      onDateChange={(v) => setVoucher((p) => ({ ...p, date: v }))}
      onReferenceChange={(v) => setVoucher((p) => ({ ...p, reference: v }))}
      onNarrationChange={(v) => setVoucher((p) => ({ ...p, narration: v }))}
      onAccept={handleAccept}
      onCancel={handleCancel}
      onF10={() => setShowList(true)}
      onF12={() => toast('F12: Configuration panel not implemented yet.')}
      onDuplicate={duplicateRow}
      onToggleMode={() => toast('Contra voucher always uses double-entry mode.')}
      modeLabel="Double Entry"
    >
      <div className="overflow-auto">
        <table className="tally-grid min-w-[700px]">
          <thead>
            <tr>
              <th className="w-10">S.N.</th>
              <th>Account (Cash / Bank)</th>
              <th className="w-36">Debit</th>
              <th className="w-36">Credit</th>
              <th className="w-32">Allocation</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line, idx) => (
              <tr key={line.id} className={selectedRow === idx ? 'selected' : ''} onClick={() => setSelectedRow(idx)}>
                <td>{idx + 1}</td>
                <td>
                  <TallyAccountSelect
                    value={line.accountId}
                    onChange={(id, name) => updateLine(idx, { accountId: id, accountName: name, isBank: isBankAccount(name), isCash: isCashAccount(name) })}
                  />
                </td>
                <td>
                  <input
                    className="tally-input text-right"
                    placeholder="0.00"
                    value={line.debit ? formatMoney(line.debit) : ''}
                    onChange={(e) => updateLine(idx, { debit: parseMoney(e.target.value), credit: 0 })}
                  />
                </td>
                <td>
                  <input
                    className="tally-input text-right"
                    placeholder="0.00"
                    value={line.credit ? formatMoney(line.credit) : ''}
                    onChange={(e) => updateLine(idx, { credit: parseMoney(e.target.value), debit: 0 })}
                  />
                </td>
                <td className="text-center">
                  {line.isBank && (
                    <button
                      className="tally-btn text-xs py-0.5 px-2"
                      onClick={() => { setBankLineIdx(idx); setShowBank(true); }}
                    >
                      Bank
                    </button>
                  )}
                  {line.isCash && (
                    <button
                      className="tally-btn text-xs py-0.5 px-2"
                      onClick={() => { setCashLineIdx(idx); setShowCash(true); }}
                    >
                      Cash
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <button className="tally-btn text-xs" onClick={addRow}>+ Add Row</button>
      </div>

      {showBank && bankLineIdx !== null && (
        <TallyBankAllocation
          isOpen={showBank}
          amount={Math.max(voucher.lines[bankLineIdx].debit, voucher.lines[bankLineIdx].credit)}
          existing={voucher.lines[bankLineIdx].bankAllocation}
          onClose={() => setShowBank(false)}
          onSave={(alloc) => { updateLine(bankLineIdx, { bankAllocation: alloc }); setShowBank(false); }}
        />
      )}

      {showCash && cashLineIdx !== null && (
        <TallyCashDenomination
          isOpen={showCash}
          targetAmount={Math.max(voucher.lines[cashLineIdx].debit, voucher.lines[cashLineIdx].credit)}
          existing={voucher.lines[cashLineIdx].cashDenominations}
          onClose={() => setShowCash(false)}
          onSave={(denoms) => { updateLine(cashLineIdx, { cashDenominations: denoms }); setShowCash(false); }}
        />
      )}

      {showPrint && <TallyVoucherPrint voucher={voucher} onClose={() => setShowPrint(false)} />}
      <TallyVoucherList
        isOpen={showList}
        vouchers={vouchers || []}
        onClose={() => setShowList(false)}
        onSelect={handleSelect}
        onPrint={(id) => { const v = vouchers.find(v => v.id === id); if (v) { setVoucher(v); setShowPrint(true); } }}
        onDelete={(id) => cancelVoucher(id, 'Deleted from UI')}
      />
    </TallyVoucherShell>
  );
};

export default TallyContraVoucher;
