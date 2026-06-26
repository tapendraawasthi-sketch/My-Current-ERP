// @ts-nocheck
// src/components/tally/TallyVoucherConfig.tsx
/**
 * F12 Configuration panel — per Tally Prime PDF §8.
 * Shows a list of toggle switches for each configurable field.
 * Settings are saved per voucher type via the consumer's callback.
 */
import React from 'react';
import { X, Settings } from 'lucide-react';
import type { F12VoucherConfig, TallyType } from '@/lib/tallyVoucher';
import { DEFAULT_F12_CONFIG } from '@/lib/tallyVoucher';

interface Props {
  voucherType: TallyType;
  config: F12VoucherConfig;
  onChange: (config: F12VoucherConfig) => void;
  onClose: () => void;
}

interface ConfigRow {
  key: keyof F12VoucherConfig;
  label: string;
  hint: string;
  types?: TallyType[]; // only show for these types (undefined = all)
  isBool?: boolean;
}

const ROWS: ConfigRow[] = [
  { key: 'showReference',          label: 'Reference Number',       hint: 'Show Ref / Cheque No field',             isBool: true },
  { key: 'showNarrationPerEntry',  label: 'Narration per Entry',    hint: 'Allow narration on each ledger line',     isBool: true },
  { key: 'showBillWise',           label: 'Bill-wise Details',      hint: 'Allocate against outstanding invoices',   isBool: true, types: ['payment', 'receipt', 'journal'] },
  { key: 'showBankAllocation',     label: 'Bank Allocation',        hint: 'Cheque / NEFT / UPI details popup',       isBool: true, types: ['payment', 'receipt', 'contra'] },
  { key: 'showCashDenomination',   label: 'Cash Denominations',     hint: 'Note-wise breakdown for cash entries',    isBool: true, types: ['contra', 'payment', 'receipt'] },
  { key: 'showCostCenter',         label: 'Cost Centre',            hint: 'Enable cost-centre allocation per line',  isBool: true },
  { key: 'showGST',                label: 'GST / Tax Details',      hint: 'Show Place of Supply, HSN/SAC fields',    isBool: true, types: ['sales', 'purchase'] },
  { key: 'showDispatchDetails',    label: 'Dispatch Details',       hint: 'Transporter, vehicle, LR number',         isBool: true, types: ['sales'] },
  { key: 'showOrderDetails',       label: 'Order Details',          hint: 'Link sales/purchase to order reference',  isBool: true, types: ['sales', 'purchase'] },
];

const Toggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
  <button
    type="button"
    className={`tally-f12-toggle ${on ? 'on' : 'off'}`}
    onClick={onToggle}
    title={on ? 'Enabled — click to disable' : 'Disabled — click to enable'}
  />
);

export const TallyVoucherConfig: React.FC<Props> = ({
  voucherType,
  config,
  onChange,
  onClose,
}) => {
  const set = (key: keyof F12VoucherConfig, value: any) =>
    onChange({ ...config, [key]: value });

  const toggle = (key: keyof F12VoucherConfig) =>
    set(key, !config[key]);

  const visibleRows = ROWS.filter(
    (r) => !r.types || r.types.includes(voucherType),
  );

  return (
    <div className="tally-f12-panel" onClick={onClose}>
      <div className="tally-f12-inner" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tally-f12-head">
          <span className="flex items-center gap-2">
            <Settings size={15} />
            F12: Configure — {voucherType.charAt(0).toUpperCase() + voucherType.slice(1)} Voucher
          </span>
          <button onClick={onClose} className="hover:opacity-75">
            <X size={16} />
          </button>
        </div>

        <div className="tally-f12-body">
          {/* Entry Mode */}
          {['payment', 'receipt', 'contra', 'journal'].includes(voucherType) && (
            <div className="tally-f12-row">
              <div>
                <div className="font-semibold text-[13px]">Entry Mode</div>
                <div className="text-[11px] text-gray-600">Single Entry (one primary + many) or Double Entry (Dr/Cr grid)</div>
              </div>
              <select
                className="tally-input"
                style={{ width: 140 }}
                value={config.entryMode}
                onChange={(e) => set('entryMode', e.target.value)}
              >
                <option value="single">Single Entry</option>
                <option value="double">Double Entry</option>
              </select>
            </div>
          )}

          {/* Invoice Mode (Sales / Purchase only) */}
          {['sales', 'purchase'].includes(voucherType) && (
            <div className="tally-f12-row">
              <div>
                <div className="font-semibold text-[13px]">Invoice Mode</div>
                <div className="text-[11px] text-gray-600">Item Invoice (stock tracking) or Accounting Invoice (services)</div>
              </div>
              <select
                className="tally-input"
                style={{ width: 160 }}
                value={config.invoiceMode}
                onChange={(e) => set('invoiceMode', e.target.value)}
              >
                <option value="item">Item Invoice</option>
                <option value="accounting">Accounting Invoice</option>
              </select>
            </div>
          )}

          {/* Dr/Cr notation (Journal only) */}
          {voucherType === 'journal' && (
            <div className="tally-f12-row">
              <div>
                <div className="font-semibold text-[13px]">Notation</div>
                <div className="text-[11px] text-gray-600">Show By/To (traditional) or Dr/Cr (accounting) labels</div>
              </div>
              <select
                className="tally-input"
                style={{ width: 120 }}
                value={config.notation}
                onChange={(e) => set('notation', e.target.value)}
              >
                <option value="ByTo">By / To</option>
                <option value="DrCr">Dr / Cr</option>
              </select>
            </div>
          )}

          {/* Boolean toggles */}
          {visibleRows.filter((r) => r.isBool).map((r) => (
            <div key={r.key} className="tally-f12-row">
              <div>
                <div className="font-semibold text-[13px]">{r.label}</div>
                <div className="text-[11px] text-gray-600">{r.hint}</div>
              </div>
              <Toggle
                on={!!config[r.key]}
                onToggle={() => toggle(r.key)}
              />
            </div>
          ))}

          {/* Reset to defaults */}
          <div className="flex justify-between items-center border-t border-[#9DC07A] pt-3 mt-1">
            <button
              type="button"
              className="tally-btn text-[11px] py-1 px-3"
              onClick={() => onChange({ ...DEFAULT_F12_CONFIG })}
            >
              Reset Defaults
            </button>
            <button
              type="button"
              className="tally-btn tally-btn-primary text-[11px] py-1 px-4"
              onClick={onClose}
            >
              Accept (F12)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallyVoucherConfig;
