import React, { ReactNode, useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (val: any, row: T) => ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  className?: string;
}

interface TableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  striped?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
  rowKey: string | ((row: T) => string);
  className?: string;
  footer?: ReactNode;
  maxHeight?: string;
}

const Table: React.FC<TableProps> = ({
  columns,
  data,
  loading = false,
  emptyMessage = "No data available",
  striped = true,
  compact = false,
  stickyHeader = false,
  onRowClick,
  rowKey,
  className = "",
  footer,
  maxHeight,
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(
    null,
  );

  const getRowKey = (row: any): string => {
    if (typeof rowKey === "function") {
      return rowKey(row);
    }
    return String(row[rowKey]);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") {
          return { key, direction: "desc" };
        }
        return null;
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [data, sortConfig]);

  return (
    <div
      className={`w-full overflow-x-auto rounded-xl overflow-hidden border border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.04)] bg-white ${className}`}
    >
      <div className="w-full overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table role="table" className="data-table w-full border-collapse text-sm" style={{ borderCollapse: "collapse" }}>
          <thead
            className={`${stickyHeader ? "sticky top-0 z-10" : ""} bg-slate-50 border-b-2 border-slate-200`}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={{ width: col.width }}
                  className={`
                    px-3 py-2.5 text-left text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.07em] select-none bg-slate-50 border-b-2 border-slate-200
                    ${col.sortable ? "cursor-pointer hover:bg-slate-100/50" : ""}
                    ${col.className || ""}
                  `}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div
                    className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"}`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      sortConfig?.key === col.key ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-indigo-400" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-indigo-400" />
                        )
                      ) : (
                        <ChevronDown className="h-3 w-3 text-slate-300" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {loading ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <span className="text-[13px] font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const key = getRowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`
                      border-b border-slate-100 transition-colors duration-100 hover:bg-indigo-50/40 cursor-pointer
                      ${striped && idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}
                    `}
                  >
                    {columns.map((col) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`
                            px-3 py-2 text-[12.5px] text-slate-700
                            ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                            ${col.className || ""}
                          `}
                        >
                          {col.render
                            ? col.render(val, row)
                            : val !== null && val !== undefined
                              ? String(val)
                              : "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {footer && (
            <tfoot className="bg-indigo-50 font-bold border-t-2 border-indigo-200 text-slate-800 [&_td]:bg-indigo-50 [&_td]:border-t-2 [&_td]:border-indigo-200 [&_td]:font-bold [&_td]:text-slate-800">
              {footer}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default React.memo(Table);
