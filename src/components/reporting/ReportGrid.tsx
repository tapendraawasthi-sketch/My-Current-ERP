import React from "react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
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
    <div className="overflow-x-auto w-full border border-black">
      <table className="w-full text-left whitespace-nowrap">
        <thead>
          <tr className="bg-[#C9DEB5] border-b border-black">
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
        <tbody className="divide-y divide-[#000] bg-[#EBF5E2]">
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick?.(row)}
              className={`hover:bg-gray-50/50 transition-colors ${
                onRowClick ? "cursor-pointer" : ""
              } ${getRowClassName?.(row) || ""}`}
            >
              {columns.map((col) => {
                const isAmount = col.align === "right";
                const isSummary =
                  row.section === "Total" ||
                  row.type === "Summary" ||
                  row.label?.includes("Total") ||
                  row.label?.includes("Net");

                return (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 text-[12px] text-[#000] ${
                      isAmount
                        ? "text-right font-mono"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${isSummary ? "font-bold bg-[#D4EABD] border-t-2 border-black" : ""}`}
                  >
                    {row[col.key] || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[#000] text-[12px]"
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
