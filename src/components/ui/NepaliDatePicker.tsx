// src/components/ui/NepaliDatePicker.tsx
// Pure React Nepali (BS) date picker - uses nepali-date-converter (already in package.json)
// No additional npm installs needed. Works on Render deployment.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface NepaliDatePickerProps {
  value: string; // AD date string "YYYY-MM-DD"
  onChange: (adDateString: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  minDate?: string; // AD
  maxDate?: string; // AD
  error?: string;
}

// ── BS calendar data (2000–2090) ───────────────────────────────────────────────
// Days in each month of BS years
const BS_MONTHS_DATA: Record<number, number[]> = {
  2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2008: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2010: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2012: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2014: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2016: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2020: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2023: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2024: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2025: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2026: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2027: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2028: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2029: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2030: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2031: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2032: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2033: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2035: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2039: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2043: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2045: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2047: [31, 31, 31, 32, 31, 31, 30, 29, 29, 30, 30, 30],
  2048: [30, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2049: [31, 31, 32, 31, 31, 31, 30, 30, 29, 29, 30, 30],
  2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2051: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2053: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2055: [31, 31, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
  2056: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2057: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2058: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2059: [31, 31, 31, 32, 31, 31, 29, 29, 30, 29, 30, 30],
  2060: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2061: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2062: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2063: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2064: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2065: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2066: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2067: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2068: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2069: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2070: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2071: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2072: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2074: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2075: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2076: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2077: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2080: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2084: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2086: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2088: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2089: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
};

const BS_MONTH_NAMES = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan",
  "Bhadra", "Ashwin", "Kartik", "Mangsir",
  "Poush", "Magh", "Falgun", "Chaitra",
];

const BS_MONTH_NAMES_NP = [
  "बैशाख", "जेठ", "असार", "श्रावण",
  "भाद्र", "आश्विन", "कार्तिक", "मंसिर",
  "पुष", "माघ", "फाल्गुन", "चैत्र",
];

// AD epoch reference: BS 2000/1/1 = AD 1943/4/14
const BS_EPOCH_YEAR = 2000;
const AD_EPOCH = new Date(1943, 3, 14); // April 14, 1943

// ── Conversion functions ───────────────────────────────────────────────────────
function adToBS(adDate: Date): { year: number; month: number; day: number } | null {
  try {
    if (isNaN(adDate.getTime())) return null;

    const diffMs = adDate.getTime() - AD_EPOCH.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;

    let remaining = diffDays;
    let bsYear = BS_EPOCH_YEAR;
    let bsMonth = 0; // 0-indexed
    let bsDay = 1;

    // Walk through BS years
    while (true) {
      const monthDays = BS_MONTHS_DATA[bsYear];
      if (!monthDays) return null;
      const yearDays = monthDays.reduce((a, b) => a + b, 0);
      if (remaining < yearDays) break;
      remaining -= yearDays;
      bsYear++;
    }

    // Walk through months
    const monthDays = BS_MONTHS_DATA[bsYear];
    for (let m = 0; m < 12; m++) {
      if (remaining < monthDays[m]) {
        bsMonth = m;
        bsDay = remaining + 1;
        break;
      }
      remaining -= monthDays[m];
    }

    return { year: bsYear, month: bsMonth + 1, day: bsDay };
  } catch {
    return null;
  }
}

function bsToAd(bsYear: number, bsMonth: number, bsDay: number): Date | null {
  try {
    if (bsYear < 2000 || bsYear > 2090) return null;
    const monthDays = BS_MONTHS_DATA[bsYear];
    if (!monthDays) return null;

    let totalDays = 0;

    // Sum all years from epoch to bsYear-1
    for (let y = BS_EPOCH_YEAR; y < bsYear; y++) {
      const yd = BS_MONTHS_DATA[y];
      if (!yd) return null;
      totalDays += yd.reduce((a, b) => a + b, 0);
    }

    // Sum months in current year
    for (let m = 0; m < bsMonth - 1; m++) {
      totalDays += monthDays[m];
    }

    // Add days
    totalDays += bsDay - 1;

    const result = new Date(AD_EPOCH.getTime() + totalDays * 24 * 60 * 60 * 1000);
    return result;
  } catch {
    return null;
  }
}

function formatAD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseAD(str: string): Date | null {
  if (!str || str.length < 10) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

function formatBS(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────
const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = "Select BS date",
  disabled = false,
  required = false,
  className = "",
  minDate,
  maxDate,
  error,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Derive BS from AD value
  const selectedBS = value ? adToBS(parseAD(value) ?? new Date()) : null;
  const todayAD = new Date();
  const todayBS = adToBS(todayAD)!;

  const [viewYear, setViewYear] = useState<number>(() => selectedBS?.year ?? todayBS.year);
  const [viewMonth, setViewMonth] = useState<number>(() => (selectedBS?.month ?? todayBS.month) - 1); // 0-indexed
  const [showYearSelect, setShowYearSelect] = useState(false);

  // Sync viewYear/viewMonth when value changes externally
  useEffect(() => {
    if (selectedBS) {
      setViewYear(selectedBS.year);
      setViewMonth(selectedBS.month - 1);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const displayValue = useCallback((): string => {
    if (!selectedBS) return "";
    return `${selectedBS.year}-${String(selectedBS.month).padStart(2, "0")}-${String(selectedBS.day).padStart(2, "0")} (${BS_MONTH_NAMES[selectedBS.month - 1]} ${selectedBS.day}, ${selectedBS.year})`;
  }, [selectedBS]);

  const handleDayClick = useCallback(
    (day: number) => {
      const adDate = bsToAd(viewYear, viewMonth + 1, day);
      if (!adDate) return;

      // Check min/max
      if (minDate && adDate < (parseAD(minDate) ?? new Date(0))) return;
      if (maxDate && adDate > (parseAD(maxDate) ?? new Date(9999, 0))) return;

      onChange(formatAD(adDate));
      setOpen(false);
    },
    [viewYear, viewMonth, onChange, minDate, maxDate],
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const monthData = BS_MONTHS_DATA[viewYear];
  const daysInMonth = monthData ? monthData[viewMonth] : 30;

  // Get day-of-week of first day (0=Sun)
  const firstAdDate = bsToAd(viewYear, viewMonth + 1, 1);
  const firstDow = firstAdDate ? firstAdDate.getDay() : 0;

  const availableYears = Object.keys(BS_MONTHS_DATA)
    .map(Number)
    .filter((y) => y >= 2060 && y <= 2090)
    .sort((a, b) => a - b);

  const inputCls = `w-full h-8 px-2.5 text-[12px] border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] cursor-pointer ${
    error ? "border-red-400" : "border-gray-300"
  } ${disabled ? "bg-gray-50 cursor-not-allowed opacity-70" : ""} ${className}`;

  return (
    <div className="flex flex-col gap-1" ref={containerRef} style={{ position: "relative" }}>
      {label && (
        <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger input */}
      <div className="relative">
        <input
          type="text"
          readOnly
          value={displayValue()}
          placeholder={placeholder}
          disabled={disabled}
          className={inputCls}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) setOpen((v) => !v);
            }
          }}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {value && !disabled && (
            <button
              type="button"
              className="pointer-events-auto p-0.5 text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {/* Calendar Dropdown */}
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ minWidth: 280, maxWidth: 320 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-[#f5f6fa] rounded-t-lg">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-200 text-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              {/* Month selector */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-[12px] font-semibold text-gray-800 border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]"
              >
                {BS_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name} ({BS_MONTH_NAMES_NP[idx]})
                  </option>
                ))}
              </select>

              {/* Year selector */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-[12px] font-semibold text-gray-800 border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-200 text-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* BS/AD labels */}
          <div className="px-3 py-1 text-center text-[10px] text-gray-500 border-b border-gray-100">
            {BS_MONTH_NAMES[viewMonth]} {viewYear} B.S.
            {firstAdDate && (
              <span className="ml-1 text-gray-400">
                ({firstAdDate.toLocaleString("en-US", { month: "short" })} {firstAdDate.getFullYear()} A.D.)
              </span>
            )}
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold text-gray-500 pb-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-0.5">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const adDate = bsToAd(viewYear, viewMonth + 1, day);
              const adStr = adDate ? formatAD(adDate) : "";

              const isSelected = adStr === value;
              const isToday =
                todayBS.year === viewYear &&
                todayBS.month === viewMonth + 1 &&
                todayBS.day === day;

              const isDisabled =
                (minDate && adStr < minDate) ||
                (maxDate && adStr > maxDate) ||
                !adDate;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!!isDisabled}
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-7 w-full text-[12px] rounded text-center transition-colors
                    ${isSelected ? "bg-[#1557b0] text-white font-bold" : ""}
                    ${isToday && !isSelected ? "bg-blue-50 text-[#1557b0] font-semibold border border-[#1557b0]" : ""}
                    ${!isSelected && !isToday ? "hover:bg-gray-100 text-gray-700" : ""}
                    ${isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  title={adStr ? `AD: ${adStr}` : ""}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer: Today button */}
          <div className="border-t border-gray-100 px-3 py-2 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">
              Today: {todayBS.year}-{String(todayBS.month).padStart(2, "0")}-{String(todayBS.day).padStart(2, "0")} B.S.
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(formatAD(todayAD));
                setOpen(false);
              }}
              className="text-[11px] font-medium text-[#1557b0] hover:underline"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NepaliDatePicker;
