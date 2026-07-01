// src/components/ui/ReportDateRangePicker.tsx
// Dual BS+AD date range picker for all report pages
// Drop-in replacement for plain <input type="date"> pairs in every report

import React, { useState, useCallback } from "react";
import NepaliDatePicker from "./NepaliDatePicker";
import { CalendarDays, RefreshCw, ChevronDown } from "lucide-react";

export interface DateRange {
  fromDate: string; // AD "YYYY-MM-DD"
  toDate: string;   // AD "YYYY-MM-DD"
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onGenerate?: () => void;
  generating?: boolean;
  label?: string;
  showPresets?: boolean;
  compact?: boolean; // compact mode for inline use
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

const daysAgo = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

const monthStart = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split("T")[0];
};

const quarterStart = () => {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1).toISOString().split("T")[0];
};

const fyDates = () => {
  // Nepal FY: Baisakh 1 (≈ Apr 14) to Chaitra end (≈ Apr 13 next year)
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const fyStart = (m < 4 || (m === 4 && today.getDate() < 14)) ? y - 1 : y;
  return { start: `${fyStart}-04-14`, end: `${fyStart + 1}-04-13` };
};

const PRESETS = [
  { label: "Today",       from: todayStr,    to: todayStr },
  { label: "Last 7 Days", from: () => daysAgo(6), to: todayStr },
  { label: "Last 30 Days",from: () => daysAgo(29), to: todayStr },
  { label: "This Month",  from: monthStart,  to: todayStr },
  { label: "This Quarter",from: quarterStart, to: todayStr },
  { label: "This FY",     from: () => fyDates().start, to: () => fyDates().end },
  { label: "Last FY",     from: () => { const {start} = fyDates(); const y = Number(start.slice(0,4))-1; return `${y}-04-14`; }, to: () => { const {start} = fyDates(); const y = Number(start.slice(0,4))-1; return `${y+1}-04-13`; } },
];

// ── Component ─────────────────────────────────────────────────────────────────
const ReportDateRangePicker: React.FC<Props> = ({
  value, onChange, onGenerate, generating = false,
  label = "Report Period", showPresets = true, compact = false,
}) => {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = useCallback((p: typeof PRESETS[0]) => {
    setActivePreset(p.label);
    onChange({ fromDate: p.from(), toDate: p.to() });
  }, [onChange]);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${compact ? "p-3" : "p-4"}`}>
      {/* Header */}
      {label && (
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-[#1557b0] shrink-0" />
          <span className="text-[12px] font-semibold text-gray-800">{label}</span>
          <span className="text-[10px] text-gray-400 ml-1">(Bikram Sambat calendar)</span>
        </div>
      )}

      {/* Preset chips */}
      {showPresets && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className={[
                "h-6 px-2.5 text-[10px] font-semibold rounded-full border transition-all",
                activePreset === p.label
                  ? "bg-[#1557b0] text-white border-[#1557b0] shadow-sm"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#1557b0] hover:text-[#1557b0]",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Date pickers — dual BS+AD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NepaliDatePicker
          label="From Date"
          value={value.fromDate}
          onChange={date => { setActivePreset(null); onChange({ ...value, fromDate: date }); }}
          required
        />
        <NepaliDatePicker
          label="To Date"
          value={value.toDate}
          onChange={date => { setActivePreset(null); onChange({ ...value, toDate: date }); }}
          required
        />
      </div>

      {/* Period summary + Generate button */}
      {(value.fromDate || value.toDate) && (
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[10px] text-gray-500">
            {value.fromDate && value.toDate ? (
              <>
                Period: <span className="font-medium text-gray-700">{value.fromDate}</span>
                <span className="mx-1 text-gray-400">→</span>
                <span className="font-medium text-gray-700">{value.toDate}</span>
                <span className="text-gray-400 ml-1">(A.D.)</span>
              </>
            ) : (
              <span className="text-amber-600">Select both dates</span>
            )}
          </div>
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || !value.fromDate || !value.toDate}
              className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px]
                font-medium rounded-md flex items-center gap-1.5
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {generating
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                : <><CalendarDays className="h-3.5 w-3.5" /> Generate Report</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportDateRangePicker;
