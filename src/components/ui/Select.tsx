import React, { useState, useRef, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  required,
  disabled,
  searchable,
  className = "",
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!searchable) {
    return (
      <div className={`flex flex-col gap-0.5 ${className}`}>
        {label && (
          <label style={{ fontSize: 11, fontWeight: 600, color: "#000000", marginBottom: 2 }}>
            {label}
            {required && <span style={{ marginLeft: 2 }}>*</span>}
          </label>
        )}
        <select
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          required={required}
          disabled={disabled}
          style={{
            height: 32,
            padding: "0 8px",
            fontSize: 12,
            border: "1px solid #000000",
            background: "#EBF5E2",
            color: "#000000",
            borderRadius: 3,
            width: "100%",
            outline: "none",
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`flex flex-col gap-0.5 relative ${className}`}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 600, color: "#000000", marginBottom: 2 }}>
          {label}
          {required && <span style={{ marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div
        onClick={() => !disabled && setOpen(!open)}
        style={{
          height: 32,
          padding: "0 8px",
          fontSize: 12,
          border: "1px solid #000000",
          background: "#EBF5E2",
          color: "#000000",
          borderRadius: 3,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        <span style={{ color: selected ? "#000000" : "rgba(0,0,0,0.4)" }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: 10 }}>▼</span>
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#EBF5E2",
            border: "1px solid #000000",
            borderRadius: 3,
            zIndex: 1000,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              width: "100%",
              height: 30,
              padding: "0 8px",
              fontSize: 11,
              border: "none",
              borderBottom: "1px solid #000000",
              background: "#D4EABD",
              color: "#000000",
              outline: "none",
            }}
            autoFocus
          />
          {filtered.length === 0 ? (
            <div style={{ padding: "8px", fontSize: 11, color: "#000000", opacity: 0.5 }}>
              No results
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                  setSearch("");
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  background: opt.value === value ? "#C9DEB5" : "transparent",
                  color: "#000000",
                  borderBottom: "1px solid rgba(0,0,0,0.1)",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "#D4EABD")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background =
                    opt.value === value ? "#C9DEB5" : "transparent")
                }
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Select;
export type { SelectOption };
