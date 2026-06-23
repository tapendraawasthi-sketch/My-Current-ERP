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
}) => {
  const company = useStore((state) => state.companySettings);
  const symbol = company ? company.currencySymbol : "Rs.";

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-0.5"
        >
          {label}
          {required && <span className="text-[var(--color-negative)] font-bold">*</span>}
        </label>
      )}
      <div className="relative flex items-center w-full rounded-[var(--radius-md)] shadow-none">
        <span className="absolute left-2.5 text-[12px] text-[var(--color-text-muted)] font-medium pointer-events-none">
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
            block w-full h-[34px] pl-10 pr-[10px] bg-[var(--color-surface)] border text-[var(--color-text-primary)] transition-all focus:outline-none
            placeholder-[var(--color-text-muted)]
            focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] focus:bg-[var(--color-surface)]
            disabled:bg-[var(--color-canvas)] disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:shadow-none
            rounded-[var(--radius-md)]
            ${error ? "border-[var(--color-negative)] focus:border-[var(--color-negative)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-negative)_20%,transparent)]" : "border-[var(--color-border-input)]"}
          `}
          style={{
            fontFamily: "var(--font-mono)",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em"
          }}
        />
      </div>
      {error && <span className="text-xs text-[var(--color-negative)] font-medium">{error}</span>}
    </div>
  );
};

export default AmountInput;
