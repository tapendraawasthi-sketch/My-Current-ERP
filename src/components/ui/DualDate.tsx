import React from "react";
import { formatBSDate } from "@/lib/nepaliDate";

interface DualDateProps {
  date: string; // AD date ISO string YYYY-MM-DD
  dateNepali?: string; // Optional BS date string
  className?: string;
}

export const DualDate: React.FC<DualDateProps> = ({ date, dateNepali, className = "" }) => {
  if (!date) return <span className="text-gray-400">—</span>;

  const bsDateStr = dateNepali || formatBSDate(new Date(date));
  
  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className="text-[12px] font-medium text-gray-800">{bsDateStr}</span>
      <span className="text-[10px] text-gray-400">{date}</span>
    </div>
  );
};
