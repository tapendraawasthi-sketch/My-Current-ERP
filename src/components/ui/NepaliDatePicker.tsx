import React, { useState, useEffect, useRef } from "react";
import Input from "./Input";
import {
  getBSToday,
  ADToBSString,
  BSToADString,
} from "../../lib/nepaliDate";
import { Calendar } from "lucide-react";

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

  useEffect(() => {
    if (value) {
      try {
        const bsStr = ADToBSString(value);
        if (bsStr) {
          setBsValue(bsStr);
        }
      } catch (err) {
        console.error("Failed to parse AD date formatting:", err);
      }
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleADChange = (adStr: string) => {
    onChange(adStr);
  };

  const handleBSChange = (bsStr: string) => {
    setBsValue(bsStr);

    // Regexp format check YYYY-MM-DD or YYYY/MM/DD
    const regex = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
    if (regex.test(bsStr)) {
      try {
        const adFormatted = BSToADString(bsStr);
        if (adFormatted) {
          onChange(adFormatted);
        }
      } catch (err) {
        // Silent validation failure of wrong Nepali dates (e.g. leap year check)
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
            <Calendar className="h-4 w-4" />
          </button>
        )}

        {isOpen && (
          <div className="absolute z-50 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3 min-w-[240px] flex flex-col gap-2.5 animate-fadeIn">
            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Select Date Type
            </h5>
            <div className="flex bg-gray-100 p-0.5 rounded">
              <button
                type="button"
                onClick={() => setActiveTab("BS")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${activeTab === "BS" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
              >
                Nepali (B.S.)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("AD")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${activeTab === "AD" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
              >
                English (A.D.)
              </button>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-gray-600 border border-gray-150 p-2 rounded bg-gray-50/50">
              <div className="flex justify-between">
                <span className="text-gray-400">Nepali (B.S.):</span>
                <span className="font-semibold text-gray-850 font-mono">
                  {bsValue || "Not Set"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">English (A.D.):</span>
                <span className="font-semibold text-gray-855 font-mono">{value || "Not Set"}</span>
              </div>
            </div>

            <div className="flex gap-1.5 pt-1.5 border-t border-gray-100">
              <button
                type="button"
                onClick={setTodayDate}
                className="flex-1 h-7 bg-blue-50 text-[#1557b0] hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold rounded transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 h-7 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 text-[11px] font-semibold rounded transition-colors cursor-pointer"
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

