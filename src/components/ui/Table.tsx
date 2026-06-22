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
      className={`w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white ${className}`}
    >
      <div className="w-full overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table role="table" className="w-full border-collapse text-sm">
          <thead
            className={`${stickyHeader ? "sticky top-0 z-10" : ""} bg-[#f5f6fa] border-b border-gray-200`}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={{ width: col.width }}
                  className={`
                    px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide select-none
                    ${col.sortable ? "cursor-pointer hover:bg-gray-100/50" : ""}
                    ${col.className || ""}
                  `}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div
                    className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"}`}
                  >
                    <span>{col.header}</span>
                    {col.sortable &&
                      sortConfig?.key === col.key &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp className="h-3 w-3 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse bg-white">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5">
                      <div className="h-4 bg-gray-200 rounded w-4/5 mx-auto"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-gray-400 font-medium text-[12px]"
                >
                  {emptyMessage}
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
                      border-b border-gray-100 transition-colors
                      ${onRowClick ? "cursor-pointer hover:bg-[#f0f4ff]" : ""}
                      ${striped && idx % 2 === 1 ? "bg-gray-50/50" : "bg-white"}
                    `}
                  >
                    {columns.map((col) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`
                            px-3 py-2.5 text-[12px] text-gray-700
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
            <tfoot className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe] text-gray-800">
              {footer}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default React.memo(Table);
