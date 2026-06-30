import React, { useState, useRef, useEffect, useCallback } from "react";
import { adToBS, bsToAD, formatBSDate, BS_MONTHS, BS_MONTH_DATA } from "../../lib/nepaliDate";
import { Calendar } from "lucide-react";

export interface NepaliDatePickerProps {
  value: string; // AD date in YYYY-MM-DD format
  onChange: (adDate: string) => void; // Returns AD date string
  placeholder?: string;
  disabled?: boolean;
  className?: string;      // ← Fix BUG-008: className now accepted
  inputClassName?: string;
  label?: string;
  minDate?: string;
  maxDate?: string;
  showADDate?: boolean;
}

const BS_START_YEAR = 2000;
const MIN_BS_YEAR = 2070;
const MAX_BS_YEAR = 2090;

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  value,
  onChange,
  placeholder = "Select BS Date",
  disabled = false,
  className = "",
  inputClassName = "",
  label,
  showADDate = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Derive current BS date from AD value
  const currentBS = React.useMemo(() => {
    if (!value) return null;
    try {
      const parts = value.split("-");
      if (parts.length < 3) return null;
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (isNaN(d.getTime())) return null;
      return adToBS(d);
    } catch {
      return null;
    }
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(currentBS?.year ?? 2081);
  const [viewMonth, setViewMonth] = useState<number>(currentBS?.month ?? 1);

  useEffect(() => {
    if (currentBS) {
      setViewYear(currentBS.year);
      setViewMonth(currentBS.month);
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

  const handleDayClick = useCallback((day: number) => {
    const adDate = bsToAD(viewYear, viewMonth, day);
    const adIso = adDate.toISOString().split("T")[0];
    // Fix BUG-009: onChange passes string value, not event
    onChange(adIso);
    setOpen(false);
  }, [viewYear, viewMonth, onChange]);

  const daysInMonth = (): number => {
    const yearIdx = viewYear - BS_START_YEAR;
    if (yearIdx < 0 || yearIdx >= BS_MONTH_DATA.length) return 30;
    return BS_MONTH_DATA[yearIdx][viewMonth - 1];
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  const displayValue = currentBS
    ? `${currentBS.day} ${BS_MONTHS[currentBS.month - 1]} ${currentBS.year} B.S.`
    : "";

  const days = daysInMonth();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      )}
      <div
        className={`
          flex items-center gap-2 h-8 px-2.5 border border-gray-300 rounded-md bg-white
          cursor-pointer select-none transition-colors
          ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "hover:border-[#1557b0]"}
          ${open ? "border-[#1557b0] ring-2 ring-[#1557b0]/20" : ""}
          ${inputClassName}
        `}
        onClick={() => !disabled && setOpen(!open)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); !disabled && setOpen(!open); }
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className={`flex-1 text-[12px] ${displayValue ? "text-gray-800" : "text-gray-400"}`}>
          {displayValue || placeholder}
        </span>
        {showADDate && value && (
          <span className="text-[10px] text-gray-400 shrink-0">{value}</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px]">
          {/* Month/Year nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 text-[12px]"
            >‹</button>
            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value))}
                className="text-[12px] border-none bg-transparent font-medium text-gray-800 cursor-pointer"
              >
                {BS_MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value))}
                className="text-[12px] border-none bg-transparent font-medium text-gray-800 cursor-pointer"
              >
                {Array.from({ length: MAX_BS_YEAR - MIN_BS_YEAR + 1 }, (_, i) => MIN_BS_YEAR + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500">B.S.</span>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 text-[12px]"
            >›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: days }, (_, i) => i + 1).map(day => {
              const isSelected = currentBS?.year === viewYear && currentBS?.month === viewMonth && currentBS?.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    text-center text-[12px] py-1 rounded transition-colors
                    ${isSelected
                      ? "bg-[#1557b0] text-white font-bold"
                      : "text-gray-700 hover:bg-[#e8f0fe] hover:text-[#1557b0]"
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer: Today */}
          <div className="mt-2 pt-2 border-t border-gray-100 text-center">
            <button
              type="button"
              className="text-[11px] text-[#1557b0] hover:underline"
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
                onChange(today);
                setOpen(false);
              }}
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
