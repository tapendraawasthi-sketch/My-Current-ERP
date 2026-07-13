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
          className="flex items-center gap-0.5 text-[11px] font-medium text-[var(--ox-text-muted)]"
        >
          {label}
          {required && <span className="font-bold text-[var(--ox-danger)]">*</span>}
        </label>
      )}
      <div className="relative flex w-full items-center">
        <span className="pointer-events-none absolute left-2.5 text-[12px] font-medium text-[var(--ox-text-muted)]">
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
            block h-8 w-full rounded-[var(--ox-radius-md)] border bg-[var(--ox-surface)] pl-10 pr-2.5 text-right text-[12px] font-medium tabular-nums text-[var(--ox-text)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--ox-focus-ring)] focus:border-[var(--ox-primary)]
            ${error ? "border-[var(--ox-danger)]" : "border-[var(--ox-border-strong)]"}
            ${disabled ? "cursor-not-allowed bg-[var(--ox-surface-muted)] text-[var(--ox-text-subtle)]" : ""}
          `}
        />
      </div>
      {error && <span className="text-[11px] font-medium text-[var(--ox-danger)]">{error}</span>}
    </div>
  );
};

export default AmountInput;
