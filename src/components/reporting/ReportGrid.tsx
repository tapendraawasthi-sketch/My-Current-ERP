import React from "react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  render?: (value: any, row: any) => React.ReactNode;
}

interface ReportGridProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  getRowClassName?: (row: any) => string;
}

const ReportGrid: React.FC<ReportGridProps> = ({ columns, data, onRowClick, getRowClassName }) => {
  return (
    <div className="overflow-x-auto w-full">
      <table className="erp-bs-table report-table w-full text-left whitespace-nowrap">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-[10px] font-semibold text-gray-600 uppercase tracking-wide ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => {
            const isSummary =
              row.section === "Total" ||
              row.type === "Summary" ||
              row.label?.includes("Total") ||
              row.label?.includes("Net") ||
              row.isBold;

            return (
              <tr
                key={rowIdx}
                onClick={() => onRowClick?.(row)}
                className={`erp-bs-clickable ${
                  onRowClick ? "cursor-pointer" : ""
                } ${isSummary ? "erp-bs-subtotal-row" : ""} ${getRowClassName?.(row) || ""}`}
              >
                {columns.map((col) => {
                  const isAmount = col.align === "right";

                  return (
                    <td
                      key={col.key}
                      className={`text-[12px] text-gray-800 ${
                        isAmount ? "erp-bs-amount" : col.align === "center" ? "text-center" : "text-left"
                      } ${isSummary ? "font-bold" : ""}`}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] !== undefined && row[col.key] !== ""
                          ? row[col.key]
                          : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500 text-[12px]"
              >
                No records found for the selected period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReportGrid;
