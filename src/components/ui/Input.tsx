/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { KeyboardEvent, RefObject } from "react";

interface InputProps {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  type?: string;
  value: string | number;
  onChange: (val: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  inputRef?: RefObject<HTMLInputElement>;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  name?: string;
  id?: string;
  tabIndex?: number;
  readOnly?: boolean;
  align?: "left" | "right" | "center";
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  prefix,
  suffix,
  type = "text",
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  disabled = false,
  required = false,
  autoFocus = false,
  className = "",
  inputClassName = "",
  inputRef,
  min,
  max,
  step,
  maxLength,
  name,
  id,
  tabIndex,
  readOnly = false,
  align = "left",
}) => {
  const alignClass =
    align === "right" || type === "number"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
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
        {prefix && (
          <span className="flex items-center justify-center px-3 h-[34px] text-[12px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border border-r-0 border-[var(--color-border-input)] rounded-l-[var(--radius-md)] whitespace-nowrap">
            {prefix}
          </span>
        )}

        <input
          id={id}
          name={name}
          ref={inputRef}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => onKeyDown && onKeyDown(e as any as KeyboardEvent)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
          tabIndex={tabIndex}
          readOnly={readOnly}
          className={`
            block w-full h-[34px] px-[10px] bg-[var(--color-surface)] border text-[var(--color-text-primary)] transition-all focus:outline-none
            font-[var(--font-sans)] text-[var(--font-size-base)]
            placeholder-[var(--color-text-muted)]
            focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] focus:bg-[var(--color-surface)]
            disabled:bg-[var(--color-canvas)] disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:shadow-none
            ${error ? "border-[var(--color-negative)] focus:border-[var(--color-negative)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-negative)_20%,transparent)]" : "border-[var(--color-border-input)]"}
            ${prefix ? "rounded-r-[var(--radius-md)]" : suffix ? "rounded-l-[var(--radius-md)]" : "rounded-[var(--radius-md)]"}
            ${prefix && suffix ? "rounded-none" : ""}
            ${alignClass}
            ${inputClassName}
          `}
          style={{ fontFamily: "var(--font-sans)" }}
        />

        {suffix && (
          <span className="flex items-center justify-center px-3 h-[34px] text-[12px] text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border border-l-0 border-[var(--color-border-input)] rounded-r-[var(--radius-md)] whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <span className="text-xs text-[var(--color-negative)] font-medium">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[var(--color-text-muted)]">{hint}</span>
      ) : null}
    </div>
  );
};

export default Input;
