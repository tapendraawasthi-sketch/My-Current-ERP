// @ts-nocheck
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
          className="text-[11px] font-semibold text-[#000000] flex items-center gap-0.5"
        >
          {label}
          {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full rounded-md shadow-sm">
        {prefix && (
          <span className="flex items-center justify-center px-3 h-8 text-[12px] font-medium text-[#000000] bg-[#EBF5E2] border border-r-0 border-[#9DC07A] rounded-l-md whitespace-nowrap">
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
            block w-full h-8 px-2.5 text-[12px] bg-white border text-[#000000] transition-all focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]
            ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-[#9DC07A]"}
            ${prefix ? "rounded-r-md" : suffix ? "rounded-l-md" : "rounded-md"}
            ${prefix && suffix ? "rounded-none" : ""}
            ${disabled ? "bg-[#EBF5E2] text-[#000000] cursor-not-allowed" : ""}
            ${alignClass}
            ${inputClassName}
          `}
        />

        {suffix && (
          <span className="flex items-center justify-center px-3 h-8 text-[12px] text-[#000000] bg-[#EBF5E2] border border-l-0 border-[#9DC07A] rounded-r-md whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <span className="text-xs text-red-600 font-medium">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[#000000]">{hint}</span>
      ) : null}
    </div>
  );
};

export default Input;

