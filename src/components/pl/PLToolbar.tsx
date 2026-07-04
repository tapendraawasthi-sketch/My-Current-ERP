// src/components/pl/PLToolbar.tsx
// @ts-nocheck
import React, { useState } from "react";
import {
  RefreshCw,
  Settings,
  Download,
  Printer,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  BarChart2,
} from "lucide-react";
import type { PLReportOptions, PLComputation, PLDrillState } from "../../lib/plTypes";

interface Props {
  options: PLReportOptions;
  onOpenOptions: () => void;
  onRefresh: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  loading: boolean;
  hasDrill: boolean;
  onBack: () => void;
  drillState: PLDrillState;
  companyName: string;
  plData: PLComputation | null;
  closingStock?: number;
  onClosingStockChange?: (val: number) => void;
}

const VARIANT_LABELS = {
  horizontal: "Horizontal (T-Format)",
  vertical: "Vertical (Waterfall)",
  "monthly-summary": "Monthly Summary",
  "detailed-monthly": "Detailed Monthly",
};

export default function PLToolbar({
  options,
  onOpenOptions,
  onRefresh,
  onExportExcel,
  onExportCSV,
  onExportPDF,
  loading,
  hasDrill,
  onBack,
  drillState,
  companyName,
  plData,
  closingStock,
  onClosingStockChange,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false);

  const btn =
    "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium transition-colors";
  const btnSec = `${btn} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`;
  const btnPri = `${btn} bg-[#1557b0] text-white hover:bg-[#0f4a96]`;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 no-print shrink-0 flex-wrap gap-2">
      {/* Left */}
      <div className="flex items-center gap-2">
        {hasDrill && (
          <button onClick={onBack} className={btnSec} title="Back (Esc)">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[#1557b0]" />
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Profit & Loss Account</p>
            <p className="text-[10px] text-gray-500">
              {VARIANT_LABELS[options.variant]} &nbsp;·&nbsp;
              {options.fromDate} to {options.toDate}
              {options.showSecondLevel && " · Detail"}
              {options.showPercentage && " · %"}
              {options.showPreviousYear && " · PY"}
            </p>
          </div>
        </div>

        {/* Drill path breadcrumb */}
        {drillState.level > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500 ml-2">
            <span className="text-gray-300">›</span>
            {drillState.selectedGroupLabel && (
              <span className="font-medium text-gray-700">{drillState.selectedGroupLabel}</span>
            )}
            {drillState.level >= 2 && drillState.selectedAccountName && (
              <>
                <span className="text-gray-300">›</span>
                <span className="font-medium text-gray-700">{drillState.selectedAccountName}</span>
              </>
            )}
            {drillState.level >= 3 && drillState.selectedVoucherId && (
              <>
                <span className="text-gray-300">›</span>
                <span className="font-medium text-gray-700">Voucher</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {plData && (
          <div
            className={`px-3 py-1 rounded-md text-[11px] font-bold border ${
              plData.netProfit >= 0
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {plData.netProfitLabel}: Rs.{" "}
            {Math.abs(plData.netProfit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
        )}

        {onClosingStockChange && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 8px",
              borderLeft: "1px solid #e5e7eb",
            }}
          >
            <label
              style={{ fontSize: 11, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}
            >
              Closing Stock:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                value={closingStock ?? ""}
                onChange={(e) => onClosingStockChange(Number(e.target.value) || 0)}
                placeholder="0.00"
                style={{
                  width: 120,
                  height: 28,
                  padding: "0 24px 0 8px",
                  fontSize: 12,
                  fontFamily: "'Courier New', monospace",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  textAlign: "right",
                  background: "#fff9f0",
                  borderColor:
                    closingStock !== undefined && closingStock > 0 ? "#d97706" : "#d1d5db",
                  outline: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  color: "#9ca3af",
                  pointerEvents: "none",
                }}
              >
                ✎
              </span>
            </div>
          </div>
        )}

        <button onClick={onRefresh} className={btnSec} disabled={loading} title="Refresh (F5)">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className={btnSec}
            title="Export (Alt+E)"
          >
            <Download className="h-3.5 w-3.5" />
            Export
            <ChevronDown className="h-3 w-3" />
          </button>
          {exportOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
              onBlur={() => setExportOpen(false)}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  onExportExcel();
                  setExportOpen(false);
                }}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                Excel (.xlsx)
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  onExportCSV();
                  setExportOpen(false);
                }}
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                CSV
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  onExportPDF();
                  setExportOpen(false);
                }}
              >
                <FileText className="h-3.5 w-3.5 text-red-600" />
                Print / PDF
              </button>
            </div>
          )}
        </div>

        <button onClick={onExportPDF} className={btnSec} title="Print (Alt+P)">
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>

        <button onClick={onOpenOptions} className={btnPri} title="Report Options">
          <Settings className="h-3.5 w-3.5" />
          Options
        </button>
      </div>
    </div>
  );
}
