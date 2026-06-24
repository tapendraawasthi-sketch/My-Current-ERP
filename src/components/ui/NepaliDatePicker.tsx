import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import Input from "./Input";
import {
  getBSToday,
  ADToBSString,
  BSToADString,
  getBSMonthCalendarGrid,
  BSDay
} from "@/lib/nepaliDate";

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];
const NEPALI_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface NepaliDatePickerProps {
  label?: string;
  value: string; // Stored as AD format 'YYYY-MM-DD'
  onChange: (val: string) => void; // Emits AD format 'YYYY-MM-DD'
  required?: boolean;
  disabled?: boolean;
  error?: string;
  id?: string;
}

const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  id,
}) => {
  const [bsValue, setBsValue] = useState("");
  const [activeTab, setActiveTab] = useState<"AD" | "BS">("BS");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar State
  const [viewYear, setViewYear] = useState<number>(2080);
  const [viewMonth, setViewMonth] = useState<number>(1);

  useEffect(() => {
    if (value) {
      try {
        const bsStr = ADToBSString(value);
        if (bsStr) {
          setBsValue(bsStr);
          const parts = bsStr.split(/[-/]/);
          if (parts.length === 3) {
            setViewYear(parseInt(parts[0], 10));
            setViewMonth(parseInt(parts[1], 10));
          }
        }
      } catch (err) {
        console.error("Failed to parse AD date formatting:", err);
      }
    } else {
      const todayBS = getBSToday();
      const parts = todayBS.split(/[-/]/);
      if (parts.length === 3) {
        setViewYear(parseInt(parts[0], 10));
        setViewMonth(parseInt(parts[1], 10));
      }
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleADChange = (adStr: string) => {
    onChange(adStr);
  };

  const handleBSChange = (bsStr: string) => {
    setBsValue(bsStr);
    const regex = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
    if (regex.test(bsStr)) {
      try {
        const adFormatted = BSToADString(bsStr);
        if (adFormatted) {
          onChange(adFormatted);
        }
      } catch (err) {
        // silent
      }
    }
  };

  const setTodayDate = () => {
    const todayBS = getBSToday();
    const todayAD = new Date().toISOString().split("T")[0];
    setBsValue(todayBS);
    onChange(todayAD);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleDayClick = (day: BSDay) => {
    const dStr = String(day.day).padStart(2, "0");
    const mStr = String(day.month).padStart(2, "0");
    const bsStr = `${day.year}/${mStr}/${dStr}`;
    setBsValue(bsStr);
    onChange(day.adDateStr);
    setIsOpen(false);
  };

  const days = useMemo(() => {
    try {
      return getBSMonthCalendarGrid(viewYear, viewMonth);
    } catch {
      return [];
    }
  }, [viewYear, viewMonth]);

  const todayBSStr = getBSToday().replace(/-/g, '/');

  return (
    <div ref={containerRef} className="flex flex-col gap-1 w-full relative">
      <div className="flex items-end justify-between gap-1 w-full relative">
        <div className="flex-1">
          {activeTab === "BS" ? (
            <Input
              id={id}
              label={label ? `${label} (B.S.)` : undefined}
              placeholder="YYYY-MM-DD"
              value={bsValue}
              onChange={handleBSChange}
              required={required}
              disabled={disabled}
              error={error}
              suffix="B.S."
              hint="e.g. 2083-04-15"
              className="cursor-pointer"
            />
          ) : (
            <Input
              id={id}
              label={label ? `${label} (A.D.)` : undefined}
              placeholder="YYYY-MM-DD"
              type="date"
              value={value}
              onChange={handleADChange}
              required={required}
              disabled={disabled}
              error={error}
              suffix="A.D."
              className="cursor-pointer"
            />
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-center border border-gray-300 w-8 h-8 text-gray-700 hover:text-[#1557b0] hover:border-[#1557b0] hover:bg-gray-50 rounded-md shrink-0 transition-all focus:outline-none cursor-pointer"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        )}

        {isOpen && (
          <div className="absolute z-50 right-0 top-full mt-1 bg-[#1a2744] text-white border border-[#2d4a8a] rounded-md shadow-lg p-3 w-[280px] animate-fadeIn">
            <div className="flex bg-[#243057] p-0.5 rounded mb-3">
              <button
                type="button"
                onClick={() => setActiveTab("BS")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${activeTab === "BS" ? "bg-[#3b6fd4] text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
              >
                Nepali (B.S.)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("AD")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${activeTab === "AD" ? "bg-[#3b6fd4] text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
              >
                English (A.D.)
              </button>
            </div>

            {activeTab === "BS" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-[#3b6fd4]/20 rounded">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] font-semibold">
                    {NEPALI_MONTHS[viewMonth - 1]} {viewYear}
                  </span>
                  <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-[#3b6fd4]/20 rounded">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {NEPALI_DAYS.map((d) => (
                    <div key={d} className="text-[10px] text-gray-400 font-medium">{d}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d, i) => {
                    const isToday = d.bsDateStr.replace(/-/g, '/') === todayBSStr;
                    const isSelected = d.bsDateStr.replace(/-/g, '/') === bsValue.replace(/-/g, '/');
                    const isCurrentMonth = d.isCurrentMonth;
                    
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleDayClick(d)}
                        className={`h-7 w-7 text-[11px] rounded flex items-center justify-center transition-colors
                          ${!isCurrentMonth ? 'text-gray-500 hover:text-gray-300' : 'hover:bg-[#3b6fd4]/30'}
                          ${isSelected ? 'bg-[#3b6fd4] text-white font-bold' : ''}
                          ${isToday && !isSelected ? 'border border-[#3b6fd4] text-[#3b6fd4] font-bold' : ''}
                        `}
                      >
                        {d.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-1.5 pt-3 mt-2 border-t border-[#2d4a8a]">
              <button
                type="button"
                onClick={setTodayDate}
                className="flex-1 h-7 bg-[#3b6fd4]/10 text-[#3b6fd4] hover:bg-[#3b6fd4]/20 border border-[#3b6fd4]/30 text-[11px] font-semibold rounded transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 h-7 bg-transparent text-gray-300 hover:bg-[#243057] border border-[#2d4a8a] text-[11px] font-semibold rounded transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NepaliDatePicker;
