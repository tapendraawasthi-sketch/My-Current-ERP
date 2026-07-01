import React from "react";
import { useStore } from "../../store/useStore";

interface AmountInputProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  id?: string;
  className?: string;
}

const AmountInput: React.FC<AmountInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
  required = false,
  error,
  id,
  className = "",
}) => {
  const company = useStore((state) => state.companySettings);
  const symbol = company ? company.currencySymbol : "Rs.";

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-medium text-[#000000] flex items-center gap-0.5"
        >
          {label}
          {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      <div className="relative flex items-center w-full rounded-md shadow-sm">
        <span className="absolute left-2.5 text-[12px] text-[#000000] font-medium pointer-events-none">
          {symbol}
        </span>
        <input
          id={id}
          type="number"
          value={value === 0 ? "" : value}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(isNaN(parsed) ? 0 : parsed);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            block w-full h-8 pl-10 pr-2.5 text-[12px] bg-white border text-[#000000] font-medium text-right transition-all focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] rounded-md
            ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-[#9DC07A]"}
            ${disabled ? "bg-[#EBF5E2] text-[#000000] cursor-not-allowed" : ""}
          `}
        />
      </div>
      {error && <span className="text-xs text-red-650 font-medium">{error}</span>}
    </div>
  );
};

export default AmountInput;
