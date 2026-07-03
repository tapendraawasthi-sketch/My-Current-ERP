import React from "react";
import NepalStatementTable from "./NepalStatementTable";
import type { NepalStatementLine } from "../../lib/nepalFinancialStatements";

interface Props {
  title: string;
  subtitle?: string;
  rows: NepalStatementLine[];
  currentYearLabel: string;
  previousYearLabel: string;
  difference?: number;
}

const NepalFinancialStatementView: React.FC<Props> = ({
  title,
  subtitle,
  rows,
  currentYearLabel,
  previousYearLabel,
  difference,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa]">
        <h3 className="text-[13px] font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      {typeof difference === "number" && Math.abs(difference) > 0.01 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800">
          Tie-out difference: Rs.{" "}
          {Math.abs(difference).toLocaleString("en-NP", { minimumFractionDigits: 2 })}
        </div>
      )}

      <div className="overflow-x-auto">
        <NepalStatementTable
          rows={rows}
          currentYearLabel={currentYearLabel}
          previousYearLabel={previousYearLabel}
        />
      </div>
    </div>
  );
};

export default NepalFinancialStatementView;
