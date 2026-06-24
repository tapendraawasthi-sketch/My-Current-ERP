import React from "react";

interface BusyFormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  labelWidth?: number;
  horizontal?: boolean;
}

export const BusyFormField: React.FC<BusyFormFieldProps> = ({
  label, required, error, hint, children, labelWidth = 130, horizontal = false,
}) => {
  if (horizontal) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 5, gap: 4 }}>
        <label style={{ minWidth: labelWidth, textAlign: "right", paddingRight: 8, paddingTop: 4, fontSize: 11, fontWeight: 600, color: "#2a3a5a", flexShrink: 0, lineHeight: 1.4 }}>
          {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}:
        </label>
        <div style={{ flex: 1 }}>
          {children}
          {hint && !error && <div style={{ fontSize: 10, color: "#8a9ab0", marginTop: 2 }}>{hint}</div>}
          {error && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>⚠ {error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label className="busy-label">
        {label}{required && <span className="required">*</span>}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 10, color: "#8a9ab0" }}>{hint}</div>}
      {error && <div style={{ fontSize: 10, color: "#dc2626" }}>⚠ {error}</div>}
    </div>
  );
};

export default BusyFormField;
