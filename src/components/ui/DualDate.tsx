// @ts-nocheck
import React from "react";
import { formatBSDate } from "@/lib/nepaliDate";

interface DualDateProps {
  date: string; // AD date ISO string YYYY-MM-DD
  dateNepali?: string; // Optional BS date string
  className?: string;
}

export const DualDate: React.FC<DualDateProps> = ({ date, dateNepali, className = "" }) => {
  if (!date) return <span className="text-[#000000]">—</span>;

  const bsDateStr = dateNepali || formatBSDate(date);
  
  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className="text-[12px] font-medium text-[#000000]">{bsDateStr}</span>
      <span className="text-[10px] text-[#000000]">{date}</span>
    </div>
  );
};

