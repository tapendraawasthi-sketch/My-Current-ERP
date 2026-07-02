// src/components/ui/ReportConfigPills.tsx
import React from "react";

interface Pill { key: string; label: string; value: string; }

interface ReportConfigPillsProps {
  pills: Pill[];
  onClickPill?: (key: string) => void;
}

/**
 * ReportConfigPills
 *
 * Renders the active configuration as small clickable pills in the
 * report toolbar. Clicking any pill calls onClickPill (typically
 * re-opens the options modal).
 *
 * Example: "FY 2081-82 · Horizontal · All Groups"
 */
export const ReportConfigPills: React.FC<ReportConfigPillsProps> = ({
  pills,
  onClickPill,
}) => {
  if (!pills.length) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {pills.map((pill, i) => (
        <React.Fragment key={pill.key}>
          {i > 0 && (
            <span style={{ color: "#d1d5db", fontSize: 10, userSelect: "none" }}>·</span>
          )}
          <button
            type="button"
            onClick={() => onClickPill?.(pill.key)}
            title={`${pill.label}: ${pill.value} — click to change`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 7px",
              background: "#f4f5f7",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 500,
              color: "#374151",
              cursor: onClickPill ? "pointer" : "default",
              transition: "border-color 100ms ease, background 100ms ease",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              if (onClickPill) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#1557b0";
                (e.currentTarget as HTMLButtonElement).style.color = "#1557b0";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
              (e.currentTarget as HTMLButtonElement).style.color = "#374151";
            }}
          >
            <span style={{ color: "#9ca3af", fontSize: 9 }}>{pill.label}</span>
            {" "}
            {pill.value}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default ReportConfigPills;
