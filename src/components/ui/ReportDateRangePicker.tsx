// src/components/ui/ReportDateRangePicker.tsx
// Used in all report pages to provide BS date range selection
import React, { useState } from "react";
import NepaliDatePicker from "./NepaliDatePicker";
import { CalendarDays, RefreshCw } from "lucide-react";

export interface DateRange {
  fromDate: string; // AD "YYYY-MM-DD"
  toDate: string;   // AD "YYYY-MM-DD"
}

interface ReportDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onGenerate?: () => void;
  generating?: boolean;
  label?: string;
  showPresets?: boolean;
}

function getNepaliFiscalYearDates(): { start: string; end: string } {
  // Nepal FY: Baisakh 1 (mid-April) to Chaitra end (mid-April next year)
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-indexed

  // Before mid-April = previous FY start year
  const fyStartYear = month < 4 || (month === 4 && today.getDate() < 14) ? year - 1 : year;
  return {
    start: `${fyStartYear}-04-14`,
    end: `${fyStartYear + 1}-04-13`,
  };
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function quarterStart(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3, 1);
  return start.toISOString().split("T")[0];
}

const PRESETS = [
  { label: "Today", from: () => todayStr(), to: () => todayStr() },
  { label: "Last 7 Days", from: () => daysAgo(6), to: () => todayStr() },
  { label: "Last 30 Days", from: () => daysAgo(29), to: () => todayStr() },
  { label: "This Month", from: () => monthStart(), to: () => todayStr() },
  { label: "This Quarter", from: () => quarterStart(), to: () => todayStr() },
  {
    label: "This FY",
    from: () => getNepaliFiscalYearDates().start,
    to: () => getNepaliFiscalYearDates().end,
  },
];

const ReportDateRangePicker: React.FC<ReportDateRangePickerProps> = ({
  value,
  onChange,
  onGenerate,
  generating = false,
  label = "Report Period",
  showPresets = true,
}) => {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setActivePreset(preset.label);
    onChange({ fromDate: preset.from(), toDate: preset.to() });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {label && (
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-[#1557b0]" />
          <span className="text-[12px] font-semibold text-gray-800">{label}</span>
        </div>
      )}

      {/* Preset buttons */}
      {showPresets && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`h-7 px-3 text-[11px] font-medium rounded-md border transition-colors ${
                activePreset === preset.label
                  ? "bg-[#1557b0] text-white border-[#1557b0]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#1557b0]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Date pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <NepaliDatePicker
          label="From Date (B.S.)"
          value={value.fromDate}
          onChange={(date) => {
            setActivePreset(null);
            onChange({ ...value, fromDate: date });
          }}
          maxDate={value.toDate || undefined}
          placeholder="Select start date"
        />
        <NepaliDatePicker
          label="To Date (B.S.)"
          value={value.toDate}
          onChange={(date) => {
            setActivePreset(null);
            onChange({ ...value, toDate: date });
          }}
          minDate={value.fromDate || undefined}
          placeholder="Select end date"
        />
      </div>

      {/* Selected range display */}
      {value.fromDate && value.toDate && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-500">
            Period: <span className="font-medium text-gray-700">{value.fromDate}</span>
            {" → "}
            <span className="font-medium text-gray-700">{value.toDate}</span>
            {" (A.D.)"}
          </span>
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={generating || !value.fromDate || !value.toDate}
              className="flex items-center gap-1.5 h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Loading..." : "Generate"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportDateRangePicker;
