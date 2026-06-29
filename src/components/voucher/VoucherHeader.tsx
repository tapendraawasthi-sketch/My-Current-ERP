import React from "react";
import { useStore } from "../../store/useStore";
import { Badge } from "../ui";
import NepaliDatePicker from "../ui/NepaliDatePicker";

// ─── Badge Variant type safe values ──────────────────────────────────────────
// BadgeVariant accepts: "success" | "warning" | "danger" | "info" | "default"
// "outline" is NOT valid — replaced with "default" throughout

interface VoucherHeaderProps {
  voucherNo?: string;
  date: string;
  dateNepali?: string;
  onDateChange: (date: string) => void;
  onDateNepaliChange?: (date: string) => void;
  status?: string;
  type?: string;
  narration?: string;
  onNarrationChange?: (narration: string) => void;
  referenceNo?: string;
  onReferenceNoChange?: (ref: string) => void;
  showNarration?: boolean;
  showReference?: boolean;
  showDateNepali?: boolean;
  readOnly?: boolean;
}

function getStatusVariant(status?: string): "success" | "warning" | "danger" | "info" | "default" {
  if (!status) return "default";
  switch (status.toLowerCase()) {
    case "posted":
      return "success";
    case "draft":
      return "warning";
    case "cancelled":
    case "void":
    case "rejected":
      return "danger";
    case "submitted":
    case "under_review":
    case "approved":
      return "info";
    default:
      return "default";
  }
}

function getTypeVariant(type?: string): "success" | "warning" | "danger" | "info" | "default" {
  if (!type) return "default";
  switch (type.toLowerCase()) {
    case "sales-invoice":
    case "sales_invoice":
      return "success";
    case "purchase-invoice":
    case "purchase_invoice":
      return "warning";
    case "sales-return":
    case "sales_return":
    case "purchase-return":
    case "purchase_return":
      return "danger";
    case "payment":
    case "receipt":
      return "info";
    default:
      return "default";
  }
}

function formatTypeLabel(type?: string): string {
  if (!type) return "";
  return type
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatusLabel(status?: string): string {
  if (!status) return "";
  return status
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const VoucherHeader: React.FC<VoucherHeaderProps> = ({
  voucherNo,
  date,
  dateNepali,
  onDateChange,
  onDateNepaliChange,
  status,
  type,
  narration,
  onNarrationChange,
  referenceNo,
  onReferenceNoChange,
  showNarration = true,
  showReference = false,
  showDateNepali = true,
  readOnly = false,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      {/* Top row: voucher number, type badge, status badge */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {voucherNo && (
            <span className="text-[12px] font-mono font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
              {voucherNo}
            </span>
          )}

          {type && (
            <Badge variant={getTypeVariant(type)}>
              {formatTypeLabel(type)}
            </Badge>
          )}

          {status && (
            <Badge variant={getStatusVariant(status)}>
              {formatStatusLabel(status)}
            </Badge>
          )}
        </div>

        {readOnly && (
          <Badge variant="default">
            Read Only
          </Badge>
        )}
      </div>

      {/* Date fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* AD Date */}
        <div>
          <label className="text-[11px] font-medium text-gray-600 mb-1 block">
            Date (AD)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              // e is a React.ChangeEvent<HTMLInputElement>, use e.target.value
              onDateChange(e.target.value);
            }}
            disabled={readOnly}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {/* BS Date */}
        {showDateNepali && (
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">
              Date (BS)
            </label>
            {/* Wrap NepaliDatePicker in a div — className prop is NOT supported on NepaliDatePicker directly */}
            <div className="w-full">
              <NepaliDatePicker
                value={dateNepali ?? ""}
                onChange={(val: string) => {
                  // val is a string — NOT an event object, use directly
                  if (onDateNepaliChange) {
                    onDateNepaliChange(val);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Reference No */}
        {showReference && (
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">
              Reference No.
            </label>
            <input
              type="text"
              value={referenceNo ?? ""}
              onChange={(e) => {
                if (onReferenceNoChange) {
                  onReferenceNoChange(e.target.value);
                }
              }}
              disabled={readOnly}
              placeholder="e.g. REF-001"
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        )}
      </div>

      {/* Narration */}
      {showNarration && (
        <div className="mt-3">
          <label className="text-[11px] font-medium text-gray-600 mb-1 block">
            Narration
          </label>
          <textarea
            value={narration ?? ""}
            onChange={(e) => {
              if (onNarrationChange) {
                onNarrationChange(e.target.value);
              }
            }}
            disabled={readOnly}
            rows={2}
            placeholder="Enter narration or description…"
            className="w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
      )}
    </div>
  );
};

export default VoucherHeader;
