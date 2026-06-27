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

const ReportGrid: React.FC<ReportGridProps> = ({
  columns,
  data,
  onRowClick,
  getRowClassName,
}) => {
  return (
    <div className="overflow-x-auto w-full border border-gray-200 rounded-md bg-white">
      <table className="w-full text-left whitespace-nowrap">
        <thead>
          <tr className="bg-[#f5f6fa] border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide ${
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
        <tbody className="divide-y divide-gray-200">
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
                className={`hover:bg-gray-50 transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                } ${isSummary ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""} ${getRowClassName?.(row) || ""}`}
              >
                {columns.map((col) => {
                  const isAmount = col.align === "right";

                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 text-[12px] text-gray-700 ${
                        isAmount
                          ? "text-right font-mono"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      } ${isSummary ? "font-bold text-gray-800" : ""}`}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] !== undefined && row[col.key] !== "" ? row[col.key] : "—")}
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
