import React from "react";

export interface TFormatRow {
  id: string;
  label: string;
  amount: string;
  level?: string;
  indent?: number;
  isTotal?: boolean;
  onClick?: () => void;
}

interface TFormatReportProps {
  leftTitle: string;
  rightTitle: string;
  leftRows: TFormatRow[];
  rightRows: TFormatRow[];
  leftTotal?: string;
  rightTotal?: string;
}

const renderCell = (row?: TFormatRow, isAmount = false) => {
  if (!row) return <td className="tformat-cell">&nbsp;</td>;

  const className = [
    "tformat-cell",
    row.isTotal ? "tformat-total" : "",
    row.level === "group" ? "tformat-group" : "",
    row.level === "subgroup" ? "tformat-subgroup" : "",
    row.level === "ledger" ? "tformat-ledger" : "",
    isAmount ? "tformat-amount" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = row.indent
    ? { paddingLeft: `${12 + row.indent * 14}px` }
    : undefined;

  const displayValue = isAmount 
    ? (row.amount != null && row.amount !== '' ? row.amount : '–')
    : row.label;

  return (
    <td className={className} style={style}>
      {row.onClick ? (
        <button className="tformat-link" onClick={row.onClick}>
          {displayValue}
        </button>
      ) : (
        <span>{displayValue}</span>
      )}
    </td>
  );
};

const TFormatReport: React.FC<TFormatReportProps> = ({
  leftTitle,
  rightTitle,
  leftRows,
  rightRows,
  leftTotal,
  rightTotal,
}) => {
  const rowCount = Math.max(leftRows.length, rightRows.length);

  return (
    <div className="tformat-wrapper">
      <table className="tformat-table">
        <thead>
          <tr>
            <th colSpan={2}>{leftTitle}</th>
            <th colSpan={2}>{rightTitle}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, idx) => {
            const left = leftRows[idx];
            const right = rightRows[idx];
            return (
              <tr key={idx}>
                {renderCell(left)}
                {renderCell(left, true)}
                {renderCell(right)}
                {renderCell(right, true)}
              </tr>
            );
          })}
          {(leftTotal || rightTotal) && (
            <tr>
              {renderCell(
                leftTotal
                  ? { id: "left-total", label: "Total", amount: leftTotal, isTotal: true }
                  : undefined
              )}
              {renderCell(
                leftTotal
                  ? { id: "left-total-amt", label: "", amount: leftTotal, isTotal: true }
                  : undefined,
                true
              )}
              {renderCell(
                rightTotal
                  ? { id: "right-total", label: "Total", amount: rightTotal, isTotal: true }
                  : undefined
              )}
              {renderCell(
                rightTotal
                  ? { id: "right-total-amt", label: "", amount: rightTotal, isTotal: true }
                  : undefined,
                true
              )}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TFormatReport;
