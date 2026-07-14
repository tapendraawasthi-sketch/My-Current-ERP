// src/components/ui/NepaliDatePicker.tsx
// Dual BS + AD calendar — BS day number LARGE, AD date SMALL below each cell
// Zero extra npm dependencies. Uses built-in BS data table.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

// ── Props ─────────────────────────────────────────────────────────────────────
interface NepaliDatePickerProps {
  value: string; // AD "YYYY-MM-DD" — this is what the app stores
  onChange: (adDate: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  minDate?: string; // AD
  maxDate?: string; // AD
  error?: string;
}

// ── BS calendar data 2000–2090 ────────────────────────────────────────────────
const BS_DATA: Record<number, number[]> = {
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

const BS_MONTHS_EN = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];
const BS_MONTHS_NP = [
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भाद्र",
  "आश्विन",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फाल्गुन",
  "चैत्र",
];
const DOW_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// BS 2000/1/1 = AD 1943/04/14
const AD_EPOCH = new Date(1943, 3, 14);
const BS_EPOCH = 2000;

// ── Conversion helpers ────────────────────────────────────────────────────────
function adToBS(adDate: Date): { y: number; m: number; d: number } | null {
  try {
    const diff = Math.floor((adDate.getTime() - AD_EPOCH.getTime()) / 86400000);
    if (diff < 0) return null;
    let rem = diff,
      y = BS_EPOCH;
    while (true) {
      const yd = BS_DATA[y];
      if (!yd) return null;
      const total = yd.reduce((a, b) => a + b, 0);
      if (rem < total) break;
      rem -= total;
      y++;
    }
    const md = BS_DATA[y]!;
    let m = 0,
      d = 1;
    for (let i = 0; i < 12; i++) {
      if (rem < md[i]) {
        m = i;
        d = rem + 1;
        break;
      }
      rem -= md[i];
    }
    return { y, m, d };
  } catch {
    return null;
  }
}

function bsToAd(y: number, m: number, d: number): Date | null {
  try {
    if (y < 2000 || y > 2090) return null;
    let total = 0;
    for (let yr = BS_EPOCH; yr < y; yr++) {
      const yd = BS_DATA[yr];
      if (!yd) return null;
      total += yd.reduce((a, b) => a + b, 0);
    }
    const md = BS_DATA[y]!;
    for (let i = 0; i < m; i++) total += md[i];
    total += d - 1;
    return new Date(AD_EPOCH.getTime() + total * 86400000);
  } catch {
    return null;
  }
}

function fmtAD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseAD(s: string): Date | null {
  if (!s || s.length < 10) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// AD month abbreviations for the small sub-label
const AD_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Component ─────────────────────────────────────────────────────────────────
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
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const todayAD = new Date();
  const todayBS = adToBS(todayAD)!;

  const selBS = value ? adToBS(parseAD(value)!) : null;
  const [vy, setVy] = useState(selBS?.y ?? todayBS.y);
  const [vm, setVm] = useState(selBS?.m ?? todayBS.m); // 0-indexed

  // Sync view when value changes externally
  useEffect(() => {
    if (selBS) {
      setVy(selBS.y);
      setVm(selBS.m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open]);

  // Navigation
  const prevMonth = () => {
    if (vm === 0) {
      setVm(11);
      setVy((y) => y - 1);
    } else setVm((m) => m - 1);
  };
  const nextMonth = () => {
    if (vm === 11) {
      setVm(0);
      setVy((y) => y + 1);
    } else setVm((m) => m + 1);
  };

  // Calendar grid data
  const daysInMonth = BS_DATA[vy]?.[vm] ?? 30;
  const firstAD = bsToAd(vy, vm, 1);
  const firstDow = firstAD ? firstAD.getDay() : 0;

  const selectDay = useCallback(
    (bsDay: number) => {
      const ad = bsToAd(vy, vm, bsDay);
      if (!ad) return;
      const s = fmtAD(ad);
      if (minDate && s < minDate) return;
      if (maxDate && s > maxDate) return;
      onChange(s);
      setOpen(false);
    },
    [vy, vm, onChange, minDate, maxDate],
  );

  // Display value in input trigger
  const displayStr = selBS
    ? `${selBS.y}-${String(selBS.m + 1).padStart(2, "0")}-${String(selBS.d).padStart(2, "0")} B.S.  (${value} A.D.)`
    : "";

  // Years for dropdown
  const years = Object.keys(BS_DATA)
    .map(Number)
    .filter((y) => y >= 2060 && y <= 2090);

  // Input style
  const inputCls = [
    "w-full h-[var(--ds-control-height)] px-2.5 pr-8 text-[13px] border rounded-[var(--ds-radius-md)] bg-[var(--ds-surface)] text-[var(--ds-text-default)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)] focus:border-[var(--ds-border-focus)]",
    "cursor-pointer select-none ds-focus-ring",
    error ? "border-[var(--ds-status-danger)]" : "border-[var(--ds-border-default)] hover:border-[var(--ds-border-strong)]",
    disabled ? "bg-[var(--ds-surface-disabled)] cursor-not-allowed opacity-60" : "",
    className,
  ].join(" ");

  return (
    <div className="flex flex-col gap-1" ref={ref} style={{ position: "relative" }}>
      {label && (
        <label className="text-[12px] font-medium text-[var(--ds-text-muted)] flex items-center gap-0.5">
          {label}
          {required && <span className="text-[var(--ds-status-danger)] ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger */}
      <div className="relative">
        <input
          readOnly
          type="text"
          value={displayStr}
          placeholder={placeholder}
          disabled={disabled}
          className={inputCls}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              e.preventDefault();
              setOpen((v) => !v);
            }
          }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear date"
              className="text-[var(--ds-text-disabled)] hover:text-[var(--ds-text-muted)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Calendar className="h-3.5 w-3.5 text-[var(--ds-text-subtle)] pointer-events-none" />
        </div>
      </div>
      {error && <p className="text-[12px] text-[var(--ds-status-danger)]">{error}</p>}

      {/* ── Calendar Panel ── */}
      {open && !disabled && (
        <div
          className="absolute top-full mt-1 left-0 z-[var(--ds-z-popover)] bg-[var(--ds-surface)] rounded-[var(--ds-radius-md)] shadow-[var(--ds-shadow-3)] border border-[var(--ds-border-default)]"
          style={{ width: 308 }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--ds-action-primary)] rounded-t-[var(--ds-radius-md)]">
            <button
              type="button"
              aria-label="Previous month"
              onClick={prevMonth}
              className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month dropdown */}
              <select
                value={vm}
                onChange={(e) => setVm(Number(e.target.value))}
                aria-label="BS month"
                className="appearance-none text-[12px] font-semibold text-white bg-transparent border border-white/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-white cursor-pointer"
              >
                {BS_MONTHS_EN.map((name, i) => (
                  <option key={i} value={i} className="bg-[var(--ds-surface-inverse)] text-[var(--ds-text-inverse)]">
                    {name} ({BS_MONTHS_NP[i]})
                  </option>
                ))}
              </select>
              {/* Year dropdown */}
              <select
                value={vy}
                onChange={(e) => setVy(Number(e.target.value))}
                aria-label="BS year"
                className="appearance-none text-[12px] font-semibold text-white bg-transparent border border-white/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-white cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-[var(--ds-surface-inverse)] text-[var(--ds-text-inverse)]">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              aria-label="Next month"
              onClick={nextMonth}
              className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Sub-header: BS month label */}
          <div className="text-center py-1 text-[12px] text-[var(--ds-text-muted)] border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-muted)]">
            <span className="font-semibold text-[var(--ds-action-primary)]">
              {BS_MONTHS_NP[vm]} {vy}
            </span>
            <span className="mx-1 text-gray-400">/</span>
            <span>
              {BS_MONTHS_EN[vm]} {vy} B.S.
            </span>
            {firstAD && (
              <span className="text-[var(--ds-text-subtle)] ml-1">
                · {AD_MON[firstAD.getMonth()]} {firstAD.getFullYear()} A.D.
              </span>
            )}
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-1 pt-2 pb-0">
            {DOW_EN.map((d) => (
              <div
                key={d}
                className="text-center text-[12px] font-semibold text-[var(--ds-text-subtle)] uppercase tracking-wide pb-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* ── Day cells — BS large + AD small ── */}
          <div className="grid grid-cols-7 px-1 pb-2 gap-0">
            {/* Empty offset cells */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`off-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const bsDay = i + 1;
              const adDate = bsToAd(vy, vm, bsDay);
              const adStr = adDate ? fmtAD(adDate) : "";
              const adDay = adDate ? adDate.getDate() : 0;
              const adMon = adDate ? AD_MON[adDate.getMonth()] : "";

              const isSelected = adStr === value;
              const isToday = todayBS.y === vy && todayBS.m === vm && todayBS.d === bsDay;
              const isDisabled =
                (minDate && adStr < minDate) || (maxDate && adStr > maxDate) || !adDate;

              // Is last day of AD month? Show month label
              const nextAdDate = adDate ? new Date(adDate.getTime() + 86400000) : null;
              const isMonthBoundary = nextAdDate && nextAdDate.getDate() === 1;

              return (
                <button
                  key={bsDay}
                  type="button"
                  disabled={!!isDisabled}
                  onClick={() => selectDay(bsDay)}
                  title={adStr ? `A.D. ${adStr}` : ""}
                  className={[
                    "flex flex-col items-center justify-center rounded-[var(--ds-radius-sm)] transition-colors",
                    "h-10 w-full px-0 leading-none",
                    isSelected
                      ? "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]"
                      : isToday
                        ? "bg-[var(--ds-surface-selected)] text-[var(--ds-action-primary)] ring-1 ring-[var(--ds-action-primary)] font-semibold"
                        : "hover:bg-[var(--ds-surface-hover)] text-[var(--ds-text-default)]",
                    isDisabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {/* BS day — LARGE */}
                  <span
                    className={[
                      "font-semibold leading-none",
                      isSelected
                        ? "text-[15px] text-[var(--ds-action-primary-text)]"
                        : "text-[14px] text-[var(--ds-text-strong)]",
                      isToday && !isSelected ? "text-[var(--ds-action-primary)]" : "",
                    ].join(" ")}
                  >
                    {bsDay}
                  </span>
                  {/* AD day — SMALL below */}
                  <span
                    className={[
                      "text-[12px] leading-none mt-0.5 font-medium",
                      isSelected ? "text-white/80" : "text-[var(--ds-text-subtle)]",
                      isToday && !isSelected ? "text-[var(--ds-action-primary)]" : "",
                    ].join(" ")}
                  >
                    {adDay}
                    {isMonthBoundary || adDay === 1 ? ` ${adMon}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--ds-border-subtle)] px-3 py-2 flex items-center justify-between bg-[var(--ds-surface-muted)] rounded-b-[var(--ds-radius-md)]">
            <div className="text-[12px] text-[var(--ds-text-muted)]">
              Today:{" "}
              <span className="font-semibold text-[var(--ds-text-default)]">
                {todayBS.y}-{String(todayBS.m + 1).padStart(2, "0")}-
                {String(todayBS.d).padStart(2, "0")} B.S.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="text-[12px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text-default)] px-2 py-0.5 rounded hover:bg-[var(--ds-surface-hover)] transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(fmtAD(todayAD));
                  setOpen(false);
                }}
                className="text-[12px] font-semibold text-[var(--ds-action-primary)] hover:underline px-2 py-0.5 rounded hover:bg-[var(--ds-surface-selected)] transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NepaliDatePicker;
