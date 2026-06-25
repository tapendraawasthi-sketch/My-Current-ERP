import React from 'react';
import { useTallyKeyboard } from '@/hooks/useTallyKeyboard';
import { VoucherType, voucherTypeLabel } from '@/lib/tallyVoucher';
import { formatDate, formatDateBS } from '@/lib/tallyFormat';

interface Props {
  title: string;
  voucherType: VoucherType;
  voucherNumber: string;
  date: string;
  reference?: string;
  onVoucherNumberChange?: (v: string) => void;
  onDateChange?: (v: string) => void;
  onReferenceChange?: (v: string) => void;
  onNarrationChange?: (v: string) => void;
  narration?: string;
  onAccept: () => void;
  onCancel: () => void;
  onF2?: () => void;
  onF3?: () => void;
  onF10?: () => void;
  onF12?: () => void;
  onAltC?: () => void;
  onToggleMode?: () => void;
  onDuplicate?: () => void;
  isSingleEntry?: boolean;
  modeLabel?: string;
  totalDebit?: number;
  totalCredit?: number;
  children: React.ReactNode;
  rightBar?: React.ReactNode;
  bottomBar?: React.ReactNode;
}

export const TallyVoucherShell: React.FC<Props> = ({
  title,
  voucherType,
  voucherNumber,
  date,
  reference,
  onVoucherNumberChange,
  onDateChange,
  onReferenceChange,
  onNarrationChange,
  narration,
  onAccept,
  onCancel,
  onF2,
  onF3,
  onF10,
  onF12,
  onAltC,
  onToggleMode,
  onDuplicate,
  isSingleEntry,
  modeLabel,
  totalDebit,
  totalCredit,
  children,
  rightBar,
  bottomBar,
}) => {
  useTallyKeyboard({
    onF2,
    onF3,
    onF10,
    onF12,
    onAltC,
    onEscape: onCancel,
    onCtrlA: onAccept,
    onCtrlH: onToggleMode,
    onCtrlD: onDuplicate,
  });

  const showTotals = totalDebit !== undefined || totalCredit !== undefined;

  return (
    <div className="tally-shell flex flex-col h-screen w-full overflow-hidden">
      {/* Header */}
      <header className="tally-header flex items-center justify-between px-3 py-1 shrink-0">
        <div className="flex items-center gap-3">
          <span className="tally-title-bar px-3 py-1 text-sm font-semibold rounded-sm">{title}</span>
          <span className="text-xs text-tally-700 font-medium">{voucherTypeLabel[voucherType]}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-tally-700">
          <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">F2: Date</span>
          <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">F3: Company</span>
          <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">F12: Configure</span>
          {modeLabel && (
            <span className="bg-tally-600 text-white px-2 py-0.5 rounded-sm">{modeLabel}</span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Meta fields */}
          <section className="bg-white border-b border-tally-300 p-2 grid grid-cols-4 gap-3 shrink-0">
            <div className="flex flex-col">
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Voucher No</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1"
                value={voucherNumber}
                onChange={(e) => onVoucherNumberChange?.(e.target.value)}
                placeholder="Auto"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Date (AD)</label>
              <input
                type="date"
                className="tally-input border border-tally-300 rounded-sm px-2 py-1"
                value={date}
                onChange={(e) => onDateChange?.(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Date (BS)</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1 bg-tally-50"
                value={formatDateBS(date)}
                readOnly
                tabIndex={-1}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] text-tally-700 font-semibold uppercase">Reference</label>
              <input
                className="tally-input border border-tally-300 rounded-sm px-2 py-1"
                value={reference || ''}
                onChange={(e) => onReferenceChange?.(e.target.value)}
                placeholder="Ref / Cheque No"
              />
            </div>
          </section>

          {/* Grid area */}
          <section className="flex-1 overflow-auto p-2 bg-white">
            {children}
          </section>

          {/* Narration + totals */}
          <section className="border-t border-tally-300 bg-tally-50 p-2 shrink-0">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[11px] text-tally-700 font-semibold uppercase">Narration</label>
                <input
                  className="tally-input border border-tally-300 rounded-sm px-2 py-1 w-full"
                  value={narration || ''}
                  onChange={(e) => onNarrationChange?.(e.target.value)}
                  placeholder="Enter narration..."
                />
              </div>
              {showTotals && (
                <div className="flex gap-4 text-sm font-semibold text-tally-800">
                  <div className="bg-white border border-tally-300 px-3 py-1 rounded-sm">
                    Dr: {totalDebit?.toFixed(2) || '0.00'}
                  </div>
                  <div className="bg-white border border-tally-300 px-3 py-1 rounded-sm">
                    Cr: {totalCredit?.toFixed(2) || '0.00'}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Bottom action bar */}
          <div className="tally-bottom-bar flex items-center justify-between px-3 py-1 shrink-0 no-print">
            <div className="flex items-center gap-2 text-xs text-tally-700">
              <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">Ctrl+A: Accept</span>
              <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">Esc: Cancel</span>
              <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">Ctrl+D: Duplicate</span>
              <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">Ctrl+H: Toggle Mode</span>
              <span className="bg-white px-2 py-0.5 border border-tally-400 rounded-sm">Alt+C: Create Ledger</span>
            </div>
            <div className="flex items-center gap-2">
              {bottomBar}
              <button className="tally-btn tally-btn-primary" onClick={onAccept}>Accept (Ctrl+A)</button>
              <button className="tally-btn" onClick={onCancel}>Cancel (Esc)</button>
            </div>
          </div>
        </main>

        {/* Right button bar */}
        <aside className="tally-right-bar w-48 flex flex-col gap-2 p-2 shrink-0 no-print overflow-auto">
          <button className="tally-btn text-left w-full" onClick={onF2}>F2: Date</button>
          <button className="tally-btn text-left w-full" onClick={onF3}>F3: Company</button>
          <button className="tally-btn text-left w-full" onClick={onF10}>F10: List</button>
          <button className="tally-btn text-left w-full" onClick={onF12}>F12: Configure</button>
          <button className="tally-btn text-left w-full" onClick={onAltC}>Alt+C: New Ledger</button>
          <button className="tally-btn text-left w-full" onClick={onToggleMode}>
            Ctrl+H: {isSingleEntry ? 'Double' : 'Single'} Entry
          </button>
          <button className="tally-btn text-left w-full" onClick={onDuplicate}>Ctrl+D: Duplicate Row</button>
          {rightBar}
        </aside>
      </div>
    </div>
  );
};

export default TallyVoucherShell;
