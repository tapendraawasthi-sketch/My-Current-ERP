// src/components/reporting/BsDateCell.tsx
import React from "react";
import { formatADToBS } from "../../lib/nepaliDate"; // or whatever the correct import path is

interface BsDateCellProps {
  date: string; // AD date in YYYY-MM-DD format
  dateNepali?: string; // BS date string already computed, optional
  compact?: boolean; // if true, show single line
}

const BsDateCell: React.FC<BsDateCellProps> = ({ date, dateNepali, compact }) => {
  const bsDate = dateNepali || (() => {
    try { return formatADToBS(date); } catch { return date; }
  })();

  // Parse AD date for the secondary display
  const adDisplay = (() => {
    if (!date || date === "—") return "";
    try {
      const d = new Date(date);
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return date; }
  })();

  if (compact) {
    return (
      <span style={{ fontSize: 12, fontFamily: "inherit" }}>{bsDate}</span>
    );
  }

  return (
    <div style={{ minWidth: 90, lineHeight: 1.3 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#111827",
          whiteSpace: "nowrap",
        }}
      >
        {bsDate}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#9ca3af",
          whiteSpace: "nowrap",
          marginTop: 1,
        }}
      >
        {adDisplay}
      </div>
    </div>
  );
};

export default BsDateCell;
