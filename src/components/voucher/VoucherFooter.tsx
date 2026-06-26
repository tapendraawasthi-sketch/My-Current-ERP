import React, { useState } from "react";
import { Button, Input } from "../ui";
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
  voucherType
}) => {
  const [showNarrationInput, setShowNarrationInput] = useState(true);
  
  const canSave = isBalanced || totalDebit === 0;
  const effectiveDisabled = disabled || !canSave || saving;

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      {/* Narration Section */}
      {showNarration && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Narration:</label>
          <div className="flex">
            <textarea
              value={narration}
              onChange={(e) => onNarrationChange(e.target.value)}
              rows={3}
              className="flex-1 mr-4 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              placeholder="Enter narration..."
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">Ctrl+R: Retrieve last narration</div>
        </div>
      )}

      {/* Warning Banner if not balanced */}
      {!isBalanced && totalDebit > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-2 rounded-md mb-4 flex items-center">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
          <span className="text-sm text-yellow-700">
            ⚠ Voucher cannot be saved — Debit and Credit totals do not match.
          </span>
        </div>
      )}

      {/* Totals Bar */}
      <div className="flex flex-wrap items-center justify-between mb-4">
        {/* Balance Status Indicator */}
        <div className="flex items-center mb-2 sm:mb-0">
          {isBalanced ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">Balanced</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <AlertTriangle className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">
                Difference: {currencySymbol}{formatNumber(difference || 0)}
              </span>
            </div>
          )}
        </div>

        {/* Totals Grid */}
        <div className="grid grid-cols-3 gap-6 mb-2 sm:mb-0">
          <div className="text-center">
            <div className="text-xs text-gray-500">Dr Total</div>
            <div className="font-bold text-green-600">{currencySymbol}{formatNumber(totalDebit)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Cr Total</div>
            <div className="font-bold text-green-600">{currencySymbol}{formatNumber(totalCredit)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Amount</div>
            <div className="font-bold text-lg text-green-600">{currencySymbol}{formatNumber(totalAmount)}</div>
          </div>
        </div>

        {/* Additional Amounts */}
        <div className="text-right">
          {taxAmount && taxAmount > 0 && (
            <div className="text-sm text-gray-600">
              + Tax: {currencySymbol}{formatNumber(taxAmount)}
            </div>
          )}
          {roundOffAmount && roundOffAmount !== 0 && (
            <div className="text-sm text-gray-600">
              Round Off: {currencySymbol}{formatNumber(roundOffAmount)}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        {onPrint && (
          <Button
            variant="outline"
            onClick={onPrint}
            className="flex items-center gap-1"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        )}

        {onDuplicate && (
          <Button
            variant="outline"
            onClick={onDuplicate}
            className="flex items-center gap-1"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onCancel}
          className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>

        <Button
          variant="primary"
          onClick={onSave}
          disabled={effectiveDisabled}
          className="flex items-center gap-1"
        >
          {saving && (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          <Save className="w-4 h-4" />
          Save (Ctrl+A)
        </Button>
      </div>
    </div>
  );
};

export default VoucherFooter;
