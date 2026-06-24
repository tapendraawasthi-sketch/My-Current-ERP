/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  searchable?: boolean;
  tabIndex?: number;
  id?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  className = "",
  searchable = false,
  tabIndex,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const groupedOptions: Record<string, SelectOption[]> = {};
  const ungroupedOptions: SelectOption[] = [];

  filteredOptions.forEach((opt) => {
    if (opt.group) {
      if (!groupedOptions[opt.group]) {
        groupedOptions[opt.group] = [];
      }
      groupedOptions[opt.group].push(opt);
    } else {
      ungroupedOptions.push(opt);
    }
  });

  if (!searchable) {
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
        <div className="relative">
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            tabIndex={tabIndex}
            className={`
              block w-full h-8 px-2.5 pr-8 text-[12px] bg-white border border-[#9DC07A] text-[#000000] rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] appearance-none
              ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""}
              ${disabled ? "bg-[#EBF5E2] text-[#000000] cursor-not-allowed" : ""}
            `}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {Object.keys(groupedOptions).map((groupName) => (
              <optgroup key={groupName} label={groupName}>
                {groupedOptions[groupName].map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
            {ungroupedOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#000000]">
            <svg
              className="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
        {error && <span className="text-xs text-red-650 font-medium">{error}</span>}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`flex flex-col gap-1 w-full relative ${className}`}>
      {label && (
        <label className="text-[11px] font-semibold text-[#000000] flex items-center gap-0.5">
          {label}
          {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center justify-between w-full h-8 px-2.5 text-left text-[12px] bg-white border border-[#9DC07A] rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]
            ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""}
            ${disabled ? "bg-[#EBF5E2] cursor-not-allowed text-[#000000]" : "cursor-pointer"}
          `}
        >
          <span className={selectedOption ? "text-[#000000]" : "text-[#000000]"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className="fill-current h-4 w-4 text-[#000000] ml-2 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-[#9DC07A] rounded-md shadow-lg max-h-52 overflow-y-auto py-1 flex flex-col">
            <div className="p-1 px-2 border-b border-[#9DC07A] sticky top-0 bg-white z-10">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-[12px] h-7 px-2.5 border border-[#9DC07A] rounded focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#000000] text-center">
                  No results found
                </div>
              ) : (
                <>
                  {Object.keys(groupedOptions).map((groupName) => (
                    <div key={groupName}>
                      <div className="px-3 py-1 text-[10px] font-bold text-[#000000] uppercase tracking-wider bg-[#EBF5E2]">
                        {groupName}
                      </div>
                      {groupedOptions[groupName].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            onChange(opt.value);
                            setIsOpen(false);
                            setSearchTerm("");
                          }}
                          className={`
                            w-full text-left px-3 py-1.5 text-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                            ${opt.value === value ? "bg-[#D4EABD] text-[#000000] font-semibold" : "text-[#000000] hover:bg-[#D5E9C0]"}
                          `}
                        >
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  {ungroupedOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className={`
                        w-full text-left px-3 py-1.5 text-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${opt.value === value ? "bg-[#D4EABD] text-[#000000] font-semibold" : "text-[#000000] hover:bg-[#D5E9C0]"}
                      `}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-red-650 font-medium">{error}</span>}
    </div>
  );
};

export default Select;
