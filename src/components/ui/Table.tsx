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
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
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
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid #a0a0a0" }}>
      {/* Top toolbar strip */}
      <div style={{ background: "#b8862a", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, padding: "2px 6px", borderBottom: "1px solid #8a6000" }}>
        {["Email", "Print", "Refresh - [R]", "Export - [E]", "Search - F3", "Filter - F7"].map(label => (
          <button key={label} className="busy-flat-btn" style={{ fontSize: 11, padding: "1px 7px", height: 20 }}>{label}</button>
        ))}
      </div>
      {/* Grid */}
      <div style={{ overflowY: "auto", maxHeight: maxHeight || "60vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#d0ccc0", position: stickyHeader ? "sticky" : undefined, top: stickyHeader ? 0 : undefined }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ color: "#7a2230", borderBottom: "1px solid #a0a0a0", borderRight: "1px solid #c0c0c0", padding: "3px 6px", textAlign: col.align === "right" ? "right" : "left", fontWeight: "bold", cursor: col.sortable ? "pointer" : "default", whiteSpace: "nowrap" }}
                  onClick={() => { if (col.sortable) { setSortConfig(sc => sc?.key === col.key ? { key: col.key, direction: sc.direction === "asc" ? "desc" : "asc" } : { key: col.key, direction: "asc" }); } }}
                >
                  {col.header}
                  {sortConfig?.key === col.key ? (sortConfig.direction === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: 20, color: "#666" }}>Loading...</td></tr>
            ) : sortedData.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: 20, color: "#666" }}>{emptyMessage}</td></tr>
            ) : (
              sortedData.map((row, ridx) => {
                const key = getRowKey(row);
                const isSelected = selectedRowIdx === ridx;
                return (
                  <tr
                    key={key}
                    onClick={() => { setSelectedRowIdx(ridx); onRowClick?.(row); }}
                    style={{ background: isSelected ? "#3b6fb8" : ridx % 2 === 0 ? "#ffffff" : "#f5f5f5", cursor: onRowClick ? "pointer" : "default" }}
                  >
                    {columns.map(col => {
                      const val = (row as any)[col.key];
                      return (
                        <td
                          key={col.key}
                          style={{ borderBottom: "1px solid #d0d0d0", borderRight: "1px solid #e0e0e0", padding: compact ? "1px 5px" : "3px 6px", color: isSelected ? "#ffffff" : "#1e50a0", textAlign: col.align === "right" ? "right" : "left" }}
                        >
                          {col.render ? col.render(val, row) : val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {footer && (
            <tfoot>
              <tr style={{ background: "#d0ccc0", fontWeight: "bold" }}>
                <td colSpan={columns.length} style={{ padding: "3px 6px" }}>{footer}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* Hint strip */}
      <div style={{ background: "#d8d8d8", borderTop: "1px solid #b0b0b0", padding: "2px 8px", fontSize: 11, color: "#444", display: "flex", gap: 12 }}>
        <span>TimeTaken: 00:00:00</span>
        <span>Rows: {loading ? "..." : sortedData.length}</span>
        <span>[ F9 - Hide ] [ F2 - Refresh ] [ F3 - Search ]</span>
      </div>
    </div>
  );
};

export default React.memo(Table);
