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

  const style = row.indent ? { paddingLeft: `${12 + row.indent * 14}px` } : undefined;

  const displayValue = isAmount
    ? row.amount != null && row.amount !== ""
      ? row.amount
      : "–"
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

const renderColumn = (
  title: string,
  rows: TFormatRow[],
  total?: string,
  showBorderRight = true,
) => (
  <div className={`flex flex-col min-h-full ${showBorderRight ? "border-r border-black" : ""}`}>
    <table className="tformat-table">
      <thead>
        <tr>
          <th colSpan={2}>{title}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={row.id || idx}>
            {renderCell(row)}
            {renderCell(row, true)}
          </tr>
        ))}
      </tbody>
    </table>
    {total && (
      <table className="tformat-table mt-auto shrink-0">
        <tbody>
          <tr>
            {renderCell({ id: "total-label", label: "Total", amount: total, isTotal: true })}
            {renderCell({ id: "total-amount", label: "", amount: total, isTotal: true }, true)}
          </tr>
        </tbody>
      </table>
    )}
  </div>
);

const TFormatReport: React.FC<TFormatReportProps> = ({
  leftTitle,
  rightTitle,
  leftRows,
  rightRows,
  leftTotal,
  rightTotal,
}) => {
  return (
    <div className="tformat-wrapper">
      <div className="grid grid-cols-2 items-stretch min-h-[240px]">
        {renderColumn(leftTitle, leftRows, leftTotal, true)}
        {renderColumn(rightTitle, rightRows, rightTotal, false)}
      </div>
    </div>
  );
};

export default TFormatReport;
