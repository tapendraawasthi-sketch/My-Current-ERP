import React from "react";
import { formatBSDate } from "../../lib/nepaliDate";

interface DualDateProps {
  date: string; // AD date ISO string YYYY-MM-DD
  dateNepali?: string; // Optional BS date string
  className?: string;
}

/** BS primary (13px) + AD secondary (12px muted) — IMPLEMENT_NOW DualDateField display. */
export const DualDate: React.FC<DualDateProps> = ({ date, dateNepali, className = "" }) => {
  if (!date) {
    return (
      <span className="text-[13px] text-[var(--ds-text-muted)]" aria-hidden={false}>
        —
      </span>
    );
  }

  const bsDateStr = dateNepali || formatBSDate(date);

  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className="text-[13px] font-medium text-[var(--ds-text-strong)]">{bsDateStr}</span>
      <span className="text-[12px] text-[var(--ds-text-muted)]">{date}</span>
    </div>
  );
};
