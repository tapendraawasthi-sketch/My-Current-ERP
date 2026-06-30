import React, { useState, useRef, useEffect } from "react";
import NepaliDate from "nepali-date-converter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BS_MONTHS = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
];
const AD_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Days in each BS month per year (2070–2090 range)
const BS_DAYS_IN_MONTH: Record<number, number[]> = {
  2078:[31,31,32,32,31,30,30,29,30,29,30,30],
  2079:[31,32,31,32,31,30,30,30,29,29,30,30],
  2080:[31,32,31,32,31,30,30,30,29,30,29,31],
  2081:[31,31,32,31,31,31,30,29,30,29,30,30],
  2082:[31,31,32,32,31,30,30,29,30,29,30,30],
  2083:[31,32,31,32,31,30,30,30,29,29,30,30],
  2084:[31,32,31,32,31,30,30,30,29,30,29,31],
  2085:[31,31,32,31,31,31,30,29,30,29,30,30],
  2086:[31,31,32,32,31,30,30,29,30,29,30,30],
  2087:[31,32,31,32,31,30,30,30,29,29,30,30],
  2088:[31,32,31,32,31,30,30,30,29,30,29,31],
};

function daysInBSMonth(year: number, month: number): number {
  return BS_DAYS_IN_MONTH[year]?.[month - 1] ?? 30;
}

/** Convert AD string "YYYY-MM-DD" → BS object {year,month,day} */
function adToBS(adStr: string): { year: number; month: number; day: number } | null {
  try {
    const d = new NepaliDate(new Date(adStr));
    return { year: d.getYear(), month: d.getMonth() + 1, day: d.getDate() };
  } catch {
    return null;
  }
}

/** Convert BS {year,month,day} → AD string "YYYY-MM-DD" */
function bsToAD(year: number, month: number, day: number): string {
  try {
    const nd = new NepaliDate(year, month - 1, day);
    const ad = nd.toJsDate();
    const y = ad.getFullYear();
    const m = String(ad.getMonth() + 1).padStart(2, "0");
    const d = String(ad.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
}

/** Format AD "YYYY-MM-DD" → "DD Mon YYYY" */
function fmtAD(adStr: string): string {
  if (!adStr) return "";
  const [y, m, d] = adStr.split("-");
  return `${d} ${AD_MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** Format BS {y,m,d} → "DD Mon YYYY" */
function fmtBS(y: number, m: number, d: number): string {
  return `${String(d).padStart(2, "0")} ${BS_MONTHS[m - 1]} ${y}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NepaliDatePickerProps {
  value: string;          // AD "YYYY-MM-DD"
  onChange: (adDate: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  value,
  onChange,
  label,
  required,
  disabled,
  placeholder = "Select date",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"bs" | "ad">("bs");
  const ref = useRef<HTMLDivElement>(null);

  // BS calendar state
  const bsNow = adToBS(value) ?? adToBS(new Date().toISOString().split("T")[0])!;
  const [bsView, setBsView] = useState({ year: bsNow.year, month: bsNow.month });

  // AD calendar state
  const adNow = value ? new Date(value) : new Date();
  const [adView, setAdView] = useState({ year: adNow.getFullYear(), month: adNow.getMonth() });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Display label ──────────────────────────────────────────────────────────
  const bs = value ? adToBS(value) : null;
  const displayBS = bs ? fmtBS(bs.year, bs.month, bs.day) : "";
  const displayAD = value ? fmtAD(value) : "";
  const displayLabel = value ? `${displayBS}  /  ${displayAD}` : placeholder;

  // ── BS Grid ────────────────────────────────────────────────────────────────
  const renderBSCalendar = () => {
    const { year, month } = bsView;
    const days = daysInBSMonth(year, month);
    // Find weekday of 1st (approx via AD conversion)
    const firstAD = bsToAD(year, month, 1);
    const startWd = firstAD ? new Date(firstAD).getDay() : 0;
    const cells: (number | null)[] = Array(startWd).fill(null);
    for (let d = 1; d <= days; d++) cells.push(d);

    const selectedBS = value ? adToBS(value) : null;

    return (
      <div className="p-3 select-none">
        {/* Month / Year nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => {
              if (month === 1) setBsView({ year: year - 1, month: 12 });
              else setBsView({ year, month: month - 1 });
            }}
            className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
          >‹</button>
          <span className="text-[12px] font-semibold text-gray-800">
            {BS_MONTHS[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={() => {
              if (month === 12) setBsView({ year: year + 1, month: 1 });
              else setBsView({ year, month: month + 1 });
            }}
            className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
          >›</button>
        </div>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const isSelected =
              selectedBS?.year === year &&
              selectedBS?.month === month &&
              selectedBS?.day === d;
            const isToday = (() => {
              const todayBS = adToBS(new Date().toISOString().split("T")[0]);
              return todayBS?.year === year && todayBS?.month === month && todayBS?.day === d;
            })();
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const ad = bsToAD(year, month, d);
                  if (ad) { onChange(ad); setOpen(false); }
                }}
                className={`w-full h-7 rounded text-[11px] font-medium transition-colors
                  ${isSelected ? "bg-[#1557b0] text-white" :
                    isToday ? "bg-blue-50 text-[#1557b0] font-bold" :
                    "hover:bg-gray-100 text-gray-700"}`}
              >{d}</button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── AD Grid ────────────────────────────────────────────────────────────────
  const renderADCalendar = () => {
    const { year, month } = adView;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const selAD = value ? new Date(value) : null;

    return (
      <div className="p-3 select-none">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => {
              if (month === 0) setAdView({ year: year - 1, month: 11 });
              else setAdView({ year, month: month - 1 });
            }}
            className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
          >‹</button>
          <span className="text-[12px] font-semibold text-gray-800">
            {AD_MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => {
              if (month === 11) setAdView({ year: year + 1, month: 0 });
              else setAdView({ year, month: month + 1 });
            }}
            className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600"
          >›</button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const adStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const isSelected = selAD && adStr === value;
            const todayStr = new Date().toISOString().split("T")[0];
            const isToday = adStr === todayStr;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { onChange(adStr); setOpen(false); }}
                className={`w-full h-7 rounded text-[11px] font-medium transition-colors
                  ${isSelected ? "bg-[#1557b0] text-white" :
                    isToday ? "bg-blue-50 text-[#1557b0] font-bold" :
                    "hover:bg-gray-100 text-gray-700"}`}
              >{d}</button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`} ref={ref}>
      {label && (
        <label className="text-[11px] font-medium text-gray-600">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`h-8 px-2.5 text-[12px] border rounded-md bg-white text-left flex items-center justify-between transition-colors
          ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200" :
            "border-gray-300 hover:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"}
          ${value ? "text-gray-800" : "text-gray-400"}`}
      >
        <span className="truncate">{displayLabel}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-[200] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl w-[320px]">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-200">
            {(["bs","ad"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors
                  ${tab === t ? "text-[#1557b0] border-b-2 border-[#1557b0]" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t === "bs" ? "BS (Bikram Sambat)" : "AD (Gregorian)"}
              </button>
            ))}
          </div>
          {/* Calendar body */}
          {tab === "bs" ? renderBSCalendar() : renderADCalendar()}
          {/* Footer showing both dates */}
          {value && (
            <div className="border-t border-gray-100 px-3 py-2 flex justify-between text-[10px] text-gray-500 bg-gray-50 rounded-b-lg">
              <span>BS: {displayBS}</span>
              <span>AD: {displayAD}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NepaliDatePicker;
