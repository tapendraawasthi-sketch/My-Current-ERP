import React from "react";
import { ADToBSLong, ADToBSString } from "../../lib/nepaliDate";

interface BsDateCellProps {
  /** AD date string in ISO format YYYY-MM-DD or full ISO */
  adDate: string | null | undefined;
  /** Show only BS date without AD */
  bsOnly?: boolean;
  /** Show short format (YYYY-MM-DD BS) instead of long */
  short?: boolean;
  /** Show Nepali month names */
  nepali?: boolean;
  className?: string;
}

/**
 * Renders a date cell showing Nepali BS date.
 * Accepts AD ISO strings and converts safely.
 * Fixes BUG-004: was passing string where Date was expected.
 */
const BsDateCell: React.FC<BsDateCellProps> = ({
  adDate,
  bsOnly = false,
  short = false,
  nepali = false,
  className = "",
}) => {
  if (!adDate) {
    return <span className={`text-gray-400 ${className}`}>-</span>;
  }

  const cleanAD = adDate.split("T")[0];
  const bsDisplay = short ? ADToBSString(cleanAD) : ADToBSLong(cleanAD, nepali);

  if (!bsDisplay) {
    return <span className={`text-gray-700 ${className}`}>{cleanAD}</span>;
  }

  if (bsOnly) {
    return <span className={`text-gray-700 ${className}`}>{bsDisplay}</span>;
  }

  return (
    <span className={`${className}`}>
      <span className="text-gray-700">{bsDisplay}</span>
      {!short && (
        <span className="block text-[10px] text-gray-400">{cleanAD}</span>
      )}
    </span>
  );
};

export default BsDateCell;
