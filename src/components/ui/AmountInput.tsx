import React from "react";

interface AmountInputProps {
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  label,
  value,
  onChange,
  className = "",
  disabled,
  placeholder = "0.00",
  hint,
  error,
}) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[11px] font-medium text-gray-600">{label}</label>}
      <input
        type="number"
        step="0.01"
        value={value === 0 ? "" : value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`h-8 px-2.5 text-[12px] text-right border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${error ? "border-red-400" : "border-gray-300"} ${className}`}
      />
      {hint && !error && <span className="text-[10px] text-gray-400">{hint}</span>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
};

export default AmountInput;
