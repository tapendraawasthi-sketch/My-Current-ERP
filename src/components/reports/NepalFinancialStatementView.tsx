import React from "react";
import NepalStatementTable from "./NepalStatementTable";
import type { NepalStatementLine } from "../../lib/nepalFinancialStatements";
import { FinancialStatementShell } from "./FinancialStatementChrome";

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
    <FinancialStatementShell>
      {subtitle && (
        <div className="px-4 py-2 border-b border-[#cbd5e1] bg-[#e8eef4] text-[11px] font-semibold text-[#002d56] uppercase tracking-wide">
          {title}
          {subtitle ? ` · ${subtitle}` : ""}
        </div>
      )}

      {typeof difference === "number" && Math.abs(difference) > 0.01 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 no-print">
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
    </FinancialStatementShell>
  );
};

export default NepalFinancialStatementView;
