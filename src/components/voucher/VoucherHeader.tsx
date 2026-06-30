import React, { useRef, useCallback } from "react";
import { NepaliDatePicker } from "../ui/NepaliDatePicker";
import Badge from "../ui/Badge";
import type { BadgeVariant } from "../../lib/types";
import { ADToBSString, ADToBSLong } from "../../lib/nepaliDate";

export type VoucherStatusType = "draft" | "pending" | "approved" | "posted" | "cancelled" | "rejected";

function statusVariant(status: VoucherStatusType): BadgeVariant {
  switch (status) {
    case "posted":    return "success";
    case "approved":  return "info";
    case "pending":   return "warning";
    case "cancelled": return "danger";
    case "rejected":  return "danger";
    default:          return "outline"; // ← BUG-007 fixed: "outline" now valid in BadgeVariant
  }
}

export interface VoucherHeaderProps {
  voucherNo: string;
  date: string;               // AD date YYYY-MM-DD
  narration: string;
  status: VoucherStatusType;
  onDateChange: (adDate: string) => void;  // Fix BUG-009: receives string not Event
  onNarrationChange: (value: string) => void;
  onVoucherNoChange?: (value: string) => void;
  referenceNo?: string;
  onReferenceNoChange?: (value: string) => void;
  costCenter?: string;
  onCostCenterChange?: (value: string) => void;
  readOnly?: boolean;
  showCostCenter?: boolean;
  showReference?: boolean;
  voucherType?: string;
  className?: string;
}

const VoucherHeader: React.FC<VoucherHeaderProps> = ({
  voucherNo,
  date,
  narration,
  status,
  onDateChange,
  onNarrationChange,
  onVoucherNoChange,
  referenceNo = "",
  onReferenceNoChange,
  costCenter = "",
  onCostCenterChange,
  readOnly = false,
  showCostCenter = false,
  showReference = false,
  voucherType = "",
  className = "",
}) => {
  const narrationRef = useRef<HTMLTextAreaElement>(null);

  // F4 = focus narration (Fix BUG-042)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "F4") {
      e.preventDefault();
      narrationRef.current?.focus();
    }
  }, []);

  const bsDate = ADToBSLong(date);

  const inputCls = `
    h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white
    focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]
    disabled:bg-gray-50 disabled:text-gray-400
  `;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {voucherType && (
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              {voucherType}
            </span>
          )}
          {/* Fix BUG-007: "outline" is valid variant, "destructive" removed */}
          <Badge variant={statusVariant(status)}>
            {status}
          </Badge>
        </div>
        {bsDate && (
          <span className="text-[11px] text-gray-400">{bsDate}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Voucher No */}
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Voucher No.</label>
          <input
            type="text"
            value={voucherNo}
            onChange={(e) => onVoucherNoChange?.(e.target.value)}
            disabled={readOnly || !onVoucherNoChange}
            className={inputCls}
          />
        </div>

        {/* Date — Fix BUG-008: className and Fix BUG-009: onChange passes string */}
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Date (B.S.)</label>
          <NepaliDatePicker
            value={date}
            onChange={onDateChange}   // ← Fix BUG-009: NepaliDatePicker passes string directly
            disabled={readOnly}
            className="w-full"       // ← Fix BUG-008: className now accepted by NepaliDatePicker
            showADDate={true}
          />
        </div>

        {/* Reference No */}
        {showReference && (
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Reference No.</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => onReferenceNoChange?.(e.target.value)}
              disabled={readOnly}
              className={inputCls}
            />
          </div>
        )}

        {/* Cost Center */}
        {showCostCenter && (
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Cost Center</label>
            <input
              type="text"
              value={costCenter}
              onChange={(e) => onCostCenterChange?.(e.target.value)}
              disabled={readOnly}
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Narration — Fix BUG-042: ref for F4 focus */}
      <div className="mt-3">
        <label className="block text-[11px] font-medium text-gray-600 mb-1">
          Narration <span className="text-[10px] text-gray-400">(F4)</span>
        </label>
        <textarea
          ref={narrationRef}
          value={narration}
          onChange={(e) => onNarrationChange(e.target.value)}
          disabled={readOnly}
          rows={2}
          placeholder="Enter narration…"
          className={`
            w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-md bg-white
            focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]
            disabled:bg-gray-50 disabled:text-gray-400 resize-none
          `}
        />
      </div>
    </div>
  );
};

export default VoucherHeader;
