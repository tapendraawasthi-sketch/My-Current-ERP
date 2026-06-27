import React, { useState } from "react";
import type { NepalStatementLine } from "../../lib/nepalFinancialStatements";

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

const NepalStatementTable: React.FC<Props> = ({
  rows,
  currentYearLabel,
  previousYearLabel,
}) => {
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
            row.isGrandTotal ? "bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]" : "",
            row.isTotal ? "bg-gray-50 font-semibold border-t border-gray-200" : "",
            child ? "bg-gray-50/50" : "",
          ].join(" ")}
        >
          <td className="px-3 py-2.5 text-[12px] text-gray-700">
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

              <span className={row.isDeduction ? "text-red-700" : ""}>
                {row.label}
              </span>

              {row.labelNepali && (
                <span className="text-[10px] text-gray-500">
                  / {row.labelNepali}
                </span>
              )}
            </div>
          </td>

          <td className="px-3 py-2.5 text-[12px] text-right font-mono">
            {money(row.currentYear)}
          </td>

          <td className="px-3 py-2.5 text-[12px] text-right font-mono">
            {money(row.previousYear)}
          </td>
        </tr>

        {expanded[row.id] &&
          row.children?.map((childRow) => renderRow(childRow, true))}
      </React.Fragment>
    );
  };

  return (
    <table className="w-full border-collapse bg-white">
      <thead>
        <tr className="bg-[#f5f6fa] border-b border-gray-200">
          <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Particulars
          </th>
          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            {currentYearLabel}
          </th>
          <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            {previousYearLabel}
          </th>
        </tr>
      </thead>

      <tbody>{rows.map((row) => renderRow(row))}</tbody>
    </table>
  );
};

export default NepalStatementTable;
