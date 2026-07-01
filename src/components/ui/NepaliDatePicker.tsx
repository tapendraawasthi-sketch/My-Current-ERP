import React from "react";
import { getBSTodayLong } from "@/lib/nepaliDate";

export interface NepaliDatePickerProps {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  label,
  value,
  onChange,
  className = "",
  disabled,
  required,
}) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[11px] font-medium text-gray-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type="date"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${className}`}
      />
    </div>
  );
};

export default NepaliDatePicker;
