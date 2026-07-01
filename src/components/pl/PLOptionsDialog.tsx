// src/components/pl/PLOptionsDialog.tsx
// @ts-nocheck
import React, { useState } from "react";
import type { PLReportOptions, PLReportVariant } from "../../lib/plTypes";
import { BarChart2, TrendingUp, Calendar, Table } from "lucide-react";
import ReportDateRangePicker from "../ui/ReportDateRangePicker";

interface Props {
  defaultOptions: PLReportOptions;
  onConfirm: (opts: PLReportOptions) => void;
  onCancel: () => void;
  companyName: string;
  fiscalYear?: any;
}

const VARIANTS: Array<{ id: PLReportVariant; label: string; desc: string; icon: any }> = [
  {
    id: "horizontal",
    label: "Horizontal (T-Format)",
    desc: "Classic two-column Trading & P&L — Debit left, Credit right",
    icon: BarChart2,
  },
  {
    id: "vertical",
    label: "Vertical (Waterfall)",
    desc: "Single-column Schedule III / IFRS-style statement",
    icon: TrendingUp,
  },
  {
    id: "monthly-summary",
    label: "P&L Summary (Monthly)",
    desc: "Month-by-month summary of income, expenses and net profit",
    icon: Calendar,
  },
  {
    id: "detailed-monthly",
    label: "Detailed Monthly P&L",
    desc: "Every account × every month — full cross-tab pivot",
    icon: Table,
  },
];

const tog = "inline-flex h-8 items-center rounded-md overflow-hidden border border-gray-300 text-[12px] font-medium";
const togBtn = (active: boolean) =>
  `h-full px-3 transition-colors ${active ? "bg-[#1557b0] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`;

export default function PLOptionsDialog({ defaultOptions, onConfirm, onCancel, companyName, fiscalYear }: Props) {
  const [opts, setOpts] = useState<PLReportOptions>({ ...defaultOptions });

  const set = (key: keyof PLReportOptions, val: any) =>
    setOpts((prev) => ({ ...prev, [key]: val }));

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(opts);
  };

  const labelCls = "block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1";
  const inputCls = "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e2433] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-white">Profit & Loss Account — Report Options</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{companyName}</p>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-5">
          {/* Variant Selection */}
          <div>
            <label className={labelCls}>Report Type</label>
            <div className="grid grid-cols-2 gap-2">
              {VARIANTS.map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("variant", id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    opts.variant === id
                      ? "border-[#1557b0] bg-blue-50 ring-2 ring-[#1557b0]/20"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${opts.variant === id ? "text-[#1557b0]" : "text-gray-400"}`} />
                  <div>
                    <p className={`text-[12px] font-semibold ${opts.variant === id ? "text-[#1557b0]" : "text-gray-700"}`}>{label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <ReportDateRangePicker
              value={{ fromDate: opts.fromDate, toDate: opts.toDate }}
              onChange={(r) => {
                set("fromDate", r.fromDate);
                set("toDate", r.toDate);
              }}
              label="Report Period"
            />
          </div>

          {/* Fiscal year quick presets */}
          {fiscalYear && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpts((p) => ({ ...p, fromDate: fiscalYear.startDate || p.fromDate, toDate: fiscalYear.endDate || p.toDate }))}
                className="text-[11px] text-[#1557b0] hover:underline"
              >
                Full Fiscal Year ({fiscalYear.name})
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setOpts((p) => ({ ...p, toDate: new Date().toISOString().split("T")[0] }))}
                className="text-[11px] text-[#1557b0] hover:underline"
              >
                Up to Today
              </button>
            </div>
          )}

          {/* Toggle Options */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "showSecondLevel", label: "Show Account-Level Detail", desc: "Expand each group to show individual ledgers" },
              { key: "updateClosingStock", label: "Auto-Calculate Closing Stock", desc: "Compute closing stock from stock movements" },
              { key: "showPercentage", label: "Show % of Revenue", desc: "Add percentage column (base = net revenue)" },
              { key: "showPreviousYear", label: "Show Previous Year", desc: "Add previous year comparison column" },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={() => set(key as any, !opts[key as keyof PLReportOptions])}
              >
                <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  opts[key as keyof PLReportOptions]
                    ? "border-[#1557b0] bg-[#1557b0]"
                    : "border-gray-300"
                }`}>
                  {opts[key as keyof PLReportOptions] && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-gray-700">{label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly variant extra option */}
          {opts.variant === "monthly-summary" && (
            <div
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => set("showDetailedSummary", !opts.showDetailedSummary)}
            >
              <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                opts.showDetailedSummary ? "border-[#1557b0] bg-[#1557b0]" : "border-gray-300"
              }`}>
                {opts.showDetailedSummary && (
                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-700">Show Detailed Monthly Summary</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Expand to show Gross Profit, Indirect Income/Expenses per month</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 px-4 text-[12px] font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-4 text-[12px] font-medium rounded-md bg-[#1557b0] text-white hover:bg-[#0f4a96]"
            >
              Generate Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
