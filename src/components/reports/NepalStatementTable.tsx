import React, { useState } from "react";
import type { NepalStatementLine } from "../../lib/nepalFinancialStatements";
import { fsClasses as fs } from "./FinancialStatementChrome";

interface Props {
  rows: NepalStatementLine[];
  currentYearLabel: string;
  previousYearLabel: string;
}

function money(value: number): string {
  const abs = Math.abs(Number(value || 0));
  const text = abs.toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return value < 0 ? `(${text})` : text;
}

const NepalStatementTable: React.FC<Props> = ({ rows, currentYearLabel, previousYearLabel }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderRow = (row: NepalStatementLine, child = false) => {
    const hasChildren = !!row.children?.length;

    return (
      <React.Fragment key={row.id}>
        <tr
          className={[
            row.isGrandTotal ? fs.grandTotalRow : "",
            row.isTotal ? fs.subtotalRow : "",
            child ? "bg-gray-50/50" : "",
            hasChildren ? fs.rowHover : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <td className={fs.cellParticulars}>
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: `${(row.indent || 0) * 18}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(row.id)}
                  className="w-5 h-5 flex items-center justify-center text-[11px] border border-gray-300 rounded bg-white no-print"
                >
                  {expanded[row.id] ? "−" : "+"}
                </button>
              ) : (
                <span className="w-5 no-print" />
              )}

              <span className={row.isDeduction ? "text-red-700" : ""}>{row.label}</span>

              {row.labelNepali && (
                <span className="text-[10px] text-gray-500">/ {row.labelNepali}</span>
              )}
            </div>
          </td>

          <td className={`${fs.cellAmount} ${row.isGrandTotal || row.isTotal ? "" : ""}`}>
            {money(row.currentYear)}
          </td>

          <td className={fs.cellAmount}>{money(row.previousYear)}</td>
        </tr>

        {expanded[row.id] && row.children?.map((childRow) => renderRow(childRow, true))}
      </React.Fragment>
    );
  };

  return (
    <table className={fs.table}>
      <thead>
        <tr className={fs.thead}>
          <th className={fs.theadCell}>Particulars</th>
          <th className={`${fs.theadCell} text-right`}>{currentYearLabel} (₹)</th>
          <th className={`${fs.theadCell} text-right`}>{previousYearLabel} (₹)</th>
        </tr>
      </thead>

      <tbody>{rows.map((row) => renderRow(row))}</tbody>
    </table>
  );
};

export default NepalStatementTable;
