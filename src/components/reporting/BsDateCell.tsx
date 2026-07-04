// src/components/reporting/BsDateCell.tsx
import React from "react";
import { formatADToBS } from "../../lib/nepaliDate"; // or whatever the correct import path is

interface BsDateCellProps {
  date: string | Date | null | undefined; // AD date in YYYY-MM-DD format or Date obj
  dateNepali?: string; // BS date string already computed, optional
  compact?: boolean; // if true, show single line
  showAD?: boolean;
}

const BsDateCell: React.FC<BsDateCellProps> = ({ date, dateNepali, compact, showAD = true }) => {
  if (!date) return <span className="text-gray-400">—</span>;

  // Normalize to Date object
  const dateObj: Date =
    typeof date === "string" ? new Date(date.includes("T") ? date : date + "T00:00:00") : date;

  if (isNaN(dateObj.getTime())) return <span className="text-gray-400">—</span>;

  const dateStrForFormat =
    typeof date === "string" ? date.split("T")[0] : dateObj.toISOString().split("T")[0];

  const bsDate =
    dateNepali ||
    (() => {
      try {
        return formatADToBS(dateStrForFormat);
      } catch {
        return dateStrForFormat;
      }
    })();

  // Parse AD date for the secondary display
  const adDisplay = (() => {
    try {
      return dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStrForFormat;
    }
  })();

  if (compact) {
    return <span style={{ fontSize: 12, fontFamily: "inherit" }}>{bsDate}</span>;
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
