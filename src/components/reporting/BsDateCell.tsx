import React from "react";
import { adToBS, formatBSDate } from "../../lib/nepaliDate";

interface BsDateCellProps {
  adDate: string;
  bsDate?: string;
  className?: string;
}

function safeFormatBS(adDate: string, fallback?: string): string {
  if (fallback) return fallback;

  try {
    const converted = adToBS(new Date(adDate)) as unknown;

    if (typeof converted === "string") {
      return converted;
    }

    return formatBSDate(converted as any);
  } catch {
    return adDate || "—";
  }
}

/**
 * Tally-style dual date cell.
 * BS date is primary; AD date is secondary.
 */
const BsDateCell: React.FC<BsDateCellProps> = ({ adDate, bsDate, className }) => {
  const displayBS = safeFormatBS(adDate, bsDate);

  return (
    <div className={className}>
      <div className="text-[12px] font-semibold text-gray-800 leading-tight">
        {displayBS}
      </div>
      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
        {adDate}
      </div>
    </div>
  );
};

export default BsDateCell;
