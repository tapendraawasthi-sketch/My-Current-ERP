import React, { useRef, useEffect } from "react";

export interface AmountInputProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;        // ← Fix BUG-021/022
  inputClassName?: string;
  label?: string;
  min?: number;
  max?: number;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
  className = "",
  inputClassName = "",
  label,
  min,
  max,
  decimalPlaces = 2,
  prefix,
  suffix,
  autoFocus = false,
  tabIndex,
  onFocus,
  onBlur,
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, "");
    const num = parseFloat(raw);
    onChange(isNaN(num) ? 0 : num);
  };

  const displayValue =
    value === "" || value === undefined || value === null || value === 0
      ? ""
      : typeof value === "number"
        ? value.toFixed(decimalPlaces)
        : String(value);

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-2 text-[12px] text-gray-500 select-none">{prefix}</span>
        )}
        <input
          ref={ref}
          type="number"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={Math.pow(10, -decimalPlaces)}
          tabIndex={tabIndex}
          onFocus={(e) => { e.target.select(); onFocus?.(); }}
          onBlur={onBlur}
          className={`
            h-8 w-full px-2.5 text-[12px] text-right font-mono
            border border-gray-300 rounded-md bg-white
            focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${prefix ? "pl-7" : ""}
            ${suffix ? "pr-7" : ""}
            ${inputClassName}
          `}
        />
        {suffix && (
          <span className="absolute right-2 text-[12px] text-gray-500 select-none">{suffix}</span>
        )}
      </div>
    </div>
  );
};

export default AmountInput;
