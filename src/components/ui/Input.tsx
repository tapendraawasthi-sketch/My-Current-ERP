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
}) => {
  const inputStyle: React.CSSProperties = {
    background: "#EBF5E2",
    color: "#000000",
    border: "1px solid #000000",
    height: 32,
    padding: "0 8px",
    fontSize: 12,
    borderRadius: 3,
    width: "100%",
    textAlign: align,
    outline: "none",
  };

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 600, color: "#000000", marginBottom: 2 }}>
          {label}
          {required && <span style={{ color: "#000000", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 8,
              fontSize: 11,
              color: "#000000",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
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
          style={{
            ...inputStyle,
            paddingLeft: prefix ? 28 : 8,
            paddingRight: suffix ? 28 : 8,
          }}
          className={inputClassName}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 8,
              fontSize: 11,
              color: "#000000",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && <span style={{ fontSize: 10, color: "#000000", opacity: 0.6 }}>{hint}</span>}
    </div>
  );
};

export default Input;
