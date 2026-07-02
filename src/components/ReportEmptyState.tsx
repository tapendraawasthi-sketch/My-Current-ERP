// src/components/ReportEmptyState.tsx
import React from "react";
import { FileText } from "lucide-react";

interface ReportEmptyStateProps {
  message?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  message = "No transactions found for the selected period.",
  hint = "Adjust the date range or check your filter settings.",
  icon,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: 8,
        textAlign: "center",
      }}
    >
      {/* Icon — small, neutral gray, never colored or cartoon */}
      <div style={{ color: "#d1d5db", marginBottom: 4 }}>
        {icon || <FileText size={28} strokeWidth={1.5} />}
      </div>

      {/* Primary message — professional, direct */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          margin: 0,
          maxWidth: 400,
        }}
      >
        {message}
      </p>

      {/* Hint — smaller, muted */}
      <p
        style={{
          fontSize: 11,
          color: "#9ca3af",
          margin: 0,
          maxWidth: 360,
        }}
      >
        {hint}
      </p>
    </div>
  );
};

export default ReportEmptyState;
