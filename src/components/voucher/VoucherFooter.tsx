import React, { useState } from "react";
import { Button } from "../ui";
import { Save, X, Copy, Printer, AlertTriangle, CheckCircle } from "lucide-react";
import { formatNumber } from "../../lib/utils";

interface VoucherFooterProps {
  totalDebit: number;
  totalCredit: number;
  totalAmount: number;
  taxAmount?: number;
  roundOffAmount?: number;
  isBalanced: boolean;
  difference?: number;
  narration: string;
  onNarrationChange: (val: string) => void;
  showNarration?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDuplicate?: () => void;
  onPrint?: () => void;
  saving?: boolean;
  disabled?: boolean;
  currencySymbol?: string;
  voucherType?: string;
}

const VoucherFooter: React.FC<VoucherFooterProps> = ({
  totalDebit,
  totalCredit,
  totalAmount,
  taxAmount,
  roundOffAmount,
  isBalanced,
  difference,
  narration,
  onNarrationChange,
  showNarration = true,
  onSave,
  onCancel,
  onDuplicate,
  onPrint,
  saving,
  disabled,
  currencySymbol = "Rs.",
  voucherType,
}) => {
  const [showNarrationInput] = useState(true);

  const canSave = isBalanced || totalDebit === 0;
  const effectiveDisabled = disabled || !canSave || saving;

  return (
    <div className="border-t border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] p-4">
      {showNarration && showNarrationInput && (
        <div className="mb-4">
          <label className="mb-1 block text-[11px] font-medium text-[var(--ds-text-muted)]">
            Narration
          </label>
          <textarea
            value={narration}
            onChange={(e) => onNarrationChange(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 py-1.5 text-[12px] text-[var(--ds-text-default)] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            placeholder="Enter narration…"
          />
          <p className="mt-1 text-[11px] text-[var(--ds-text-subtle)]">
            Ctrl+R: Retrieve last narration
          </p>
        </div>
      )}

      {!isBalanced && totalDebit > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Cannot save — Debit and Credit totals do not match.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium ${
            isBalanced
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {isBalanced ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" /> Balanced
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              Difference: {currencySymbol}
              {formatNumber(difference || 0)}
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-[11px] font-medium text-[var(--ds-text-muted)]">
              Dr Total
            </div>
            <div className="font-mono text-[12px] font-semibold text-[var(--ds-text-default)]">
              {currencySymbol}
              {formatNumber(totalDebit)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-medium text-[var(--ds-text-muted)]">
              Cr Total
            </div>
            <div className="font-mono text-[12px] font-semibold text-[var(--ds-text-default)]">
              {currencySymbol}
              {formatNumber(totalCredit)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-medium text-[var(--ds-text-muted)]">
              Amount
            </div>
            <div className="font-mono text-[13px] font-semibold text-[var(--ds-text-default)]">
              {currencySymbol}
              {formatNumber(totalAmount)}
            </div>
          </div>
        </div>

        <div className="text-right text-[12px] text-[var(--ds-text-muted)]">
          {taxAmount && taxAmount > 0 && (
            <div>
              + Tax: {currencySymbol}
              {formatNumber(taxAmount)}
            </div>
          )}
          {roundOffAmount && roundOffAmount !== 0 && (
            <div>
              Round Off: {currencySymbol}
              {formatNumber(roundOffAmount)}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onPrint && (
          <Button variant="outline" onClick={onPrint} className="inline-flex h-8 items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        )}

        {onDuplicate && (
          <Button
            variant="outline"
            onClick={onDuplicate}
            className="inline-flex h-8 items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1.5 text-[var(--ds-status-danger)] border-[var(--ds-status-danger)]/40 hover:bg-[var(--ds-status-danger-surface)]"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>

        <Button
          variant="primary"
          onClick={onSave}
          disabled={effectiveDisabled}
          className="inline-flex h-8 items-center gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : voucherType ? `Save ${voucherType}` : "Save"}
        </Button>
      </div>
    </div>
  );
};

export default VoucherFooter;
