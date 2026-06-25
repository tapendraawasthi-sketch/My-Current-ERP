// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import Input from "./Input";
import {
  getBSToday,
  ADToBSString,
  BSToADString,
  getBSMonthCalendarGrid,
  type BSDay,
} from "@/lib/nepaliDate";
 
const NEPALI_MONTHS = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
];
const NEPALI_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
 
interface NepaliDatePickerProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
 
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
        console.error("Failed to parse date:", err);
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
 
  // Calculate dropdown position using fixed coordinates to escape overflow:hidden
  const openDropdown = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const calWidth = 290;
    const calHeight = 340;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
 
    let left = rect.right - calWidth;
    if (left < 4) left = 4;
    if (left + calWidth > viewportW - 4) left = viewportW - calWidth - 4;
 
    let top = rect.bottom + 4;
    if (top + calHeight > viewportH - 8) top = rect.top - calHeight - 4;
 
    setDropdownStyle({ position: "fixed", top, left, width: calWidth, zIndex: 9999 });
    setIsOpen(true);
  };
 
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        const popup = document.getElementById("ndp-popup");
        if (popup && !popup.contains(target)) {
          setIsOpen(false);
        }
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
 
  const handleADChange = (adStr: string) => onChange(adStr);
 
  const handleBSChange = (bsStr: string) => {
    setBsValue(bsStr);
    const regex = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
    if (regex.test(bsStr)) {
      try {
        const adFormatted = BSToADString(bsStr);
        if (adFormatted) onChange(adFormatted);
      } catch {}
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
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
 
  const handleNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
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
    try { return getBSMonthCalendarGrid(viewYear, viewMonth); }
    catch { return []; }
  }, [viewYear, viewMonth]);
 
  const todayBSStr = getBSToday().replace(/-/g, "/");
 
  const dropdown = isOpen ? ReactDOM.createPortal(
    <div
      id="ndp-popup"
      style={dropdownStyle}
      className="bg-[#1a2744] text-white border border-[#2d4a8a] rounded-md shadow-2xl p-3 select-none"
    >
      {/* BS / AD Tab */}
      <div className="flex bg-[#243057] p-0.5 rounded mb-3">
        {(["BS", "AD"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
              activeTab === tab ? "bg-[#3b6fd4] text-white shadow-sm" : "text-white/70 hover:text-white"
            }`}
          >
            {tab === "BS" ? "Nepali (B.S.)" : "English (A.D.)"}
          </button>
        ))}
      </div>
 
      {activeTab === "BS" && (
        <div>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={handlePrevMonth} className="p-1.5 hover:bg-[#3b6fd4]/30 rounded transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-[13px] font-bold">{NEPALI_MONTHS[viewMonth - 1]} {viewYear}</div>
            </div>
            <button type="button" onClick={handleNextMonth} className="p-1.5 hover:bg-[#3b6fd4]/30 rounded transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
 
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {NEPALI_DAYS.map((d) => (
              <div key={d} className="text-[9px] text-white/60 font-semibold py-0.5">{d}</div>
            ))}
          </div>
 
          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              const bsDateStr = d.bsDateStr.replace(/-/g, "/");
              const isToday = bsDateStr === todayBSStr;
              const isSelected = bsDateStr === bsValue.replace(/-/g, "/");
              const isCurrent = d.isCurrentMonth;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(d)}
                  className={`
                    h-7 w-full text-[11px] rounded flex items-center justify-center transition-colors cursor-pointer
                    ${isSelected ? "bg-[#3b6fd4] text-white font-bold" : ""}
                    ${isToday && !isSelected ? "border border-[#3b6fd4] text-[#60a5fa] font-bold" : ""}
                    ${!isCurrent && !isSelected ? "text-white/35 hover:bg-[#3b6fd4]/20" : ""}
                    ${isCurrent && !isSelected && !isToday ? "text-white hover:bg-[#3b6fd4]/30" : ""}
                  `}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
 
      {activeTab === "AD" && (
        <div className="py-1">
          <label className="block text-[10px] text-white/70 mb-1">Select AD Date</label>
          <input
            type="date"
            value={value}
            onChange={(e) => { handleADChange(e.target.value); setIsOpen(false); }}
            className="w-full h-8 px-2 text-[12px] bg-[#243057] border border-[#3b6fd4] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#3b6fd4]"
          />
        </div>
      )}
 
      {/* Footer Buttons */}
      <div className="flex gap-1.5 pt-2 mt-2 border-t border-[#2d4a8a]">
        <button
          type="button"
          onClick={setTodayDate}
          className="flex-1 h-7 bg-[#3b6fd4]/20 text-[#60a5fa] hover:bg-[#3b6fd4]/40 border border-[#3b6fd4]/40 text-[11px] font-semibold rounded transition-colors cursor-pointer"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex-1 h-7 bg-transparent text-white/80 hover:bg-[#243057] border border-[#2d4a8a] text-[11px] font-semibold rounded transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  ) : null;
 
  return (
    <div ref={containerRef} className="flex flex-col gap-1 w-full">
      <div className="flex items-end gap-1 w-full">
        <div className="flex-1">
          {activeTab === "BS" ? (
            <Input
              id={id}
              label={label ? `${label} (B.S.)` : undefined}
              placeholder="YYYY/MM/DD"
              value={bsValue}
              onChange={handleBSChange}
              required={required}
              disabled={disabled}
              error={error}
              suffix="B.S."
              hint="e.g. 2083-04-15"
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
            />
          )}
        </div>
        {!disabled && (
          <button
            ref={btnRef}
            type="button"
            onClick={isOpen ? () => setIsOpen(false) : openDropdown}
            className={`flex items-center justify-center border w-8 h-8 rounded-md shrink-0 transition-all focus:outline-none cursor-pointer ${
              isOpen
                ? "bg-[#3D6B25] border-[#1557b0] text-white"
                : "border-[#9DC07A] text-[#000000] hover:text-[#1557b0] hover:border-[#1557b0] hover:bg-[#EBF5E2]"
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
};
 
export default NepaliDatePicker;
