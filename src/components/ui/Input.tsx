import React from "react";

interface InputProps {
  label?: string;
  value?: string | number;
  onChange?: (val: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  prefix?: string;
  suffix?: string;
  hint?: string;
  align?: "left" | "center" | "right";
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  autoFocus?: boolean;
  inputClassName?: string;
  className?: string;
  id?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  disabled,
  readOnly,
  prefix,
  suffix,
  hint,
  align = "left",
  min,
  max,
  step,
  maxLength,
  autoFocus,
  inputClassName = "",
  className = "",
  id,
  error,
}) => {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-0.5 text-[11px] font-medium text-[var(--ox-text-muted)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--ox-danger)]">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 select-none text-[11px] text-[var(--ox-text-subtle)]">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          className={`h-8 w-full rounded-[var(--ox-radius-md)] border border-[var(--ox-border-strong)] bg-[var(--ox-surface)] px-2.5 text-[12px] text-[var(--ox-text)] outline-none focus:border-[var(--ox-primary)] focus:ring-2 focus:ring-[var(--ox-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--ox-surface-muted)] disabled:text-[var(--ox-text-subtle)] ${inputClassName}`}
          style={{
            textAlign: align,
            paddingLeft: prefix ? 28 : undefined,
            paddingRight: suffix ? 28 : undefined,
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 select-none text-[11px] text-[var(--ox-text-subtle)]">
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="text-[11px] text-[var(--ox-danger)]">{error}</span>}
      {hint && !error && <span className="text-[10px] text-[var(--ox-text-subtle)]">{hint}</span>}
    </div>
  );
};

export default Input;
