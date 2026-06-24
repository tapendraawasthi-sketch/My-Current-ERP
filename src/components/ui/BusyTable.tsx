import React, { useState } from "react";

export interface BusyTableColumn<T = any> {
  key: string;
  header: string;
  width?: string | number;
  align?: "left" | "right" | "center";
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface BusyTableProps<T = any> {
  columns: BusyTableColumn<T>[];
  data: T[];
  rowKey: string | ((row: T) => string);
  onRowClick?: (row: T) => void;
  selectedId?: string;
  emptyMessage?: string;
  loading?: boolean;
  stickyHeader?: boolean;
  showRowNumbers?: boolean;
  className?: string;
  maxHeight?: string | number;
}

function BusyTable<T = any>({
  columns, data, rowKey, onRowClick, selectedId, emptyMessage = "No records found.",
  loading, stickyHeader, showRowNumbers, className, maxHeight,
}: BusyTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...data].sort((a: any, b: any) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const getKey = (row: T) => typeof rowKey === "function" ? rowKey(row) : (row as any)[rowKey];

  return (
    <div style={{ overflow: "auto", maxHeight: maxHeight || undefined }}>
      <table className={`data-table ${className || ""}`}>
        <thead style={{ position: stickyHeader ? "sticky" : undefined, top: stickyHeader ? 0 : undefined, zIndex: stickyHeader ? 2 : undefined }}>
          <tr>
            {showRowNumbers && <th style={{ width: 32, textAlign: "center" }}>#</th>}
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align || "left", cursor: col.sortable ? "pointer" : undefined }}
                className={col.align === "right" ? "th-right" : col.align === "center" ? "th-center" : ""}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.header}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length + (showRowNumbers ? 1 : 0)} style={{ textAlign: "center", padding: 20, color: "#8a9ab0" }}>Loading...</td></tr>
          ) : sorted.length === 0 ? (
            <tr><td colSpan={columns.length + (showRowNumbers ? 1 : 0)} style={{ textAlign: "center", padding: 20, color: "#8a9ab0" }}>{emptyMessage}</td></tr>
          ) : sorted.map((row, idx) => {
            const key = getKey(row);
            return (
              <tr
                key={key}
                className={selectedId === key ? "selected" : ""}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? "pointer" : undefined }}
              >
                {showRowNumbers && <td style={{ textAlign: "center", color: "#8a9ab0", fontSize: 10 }}>{idx + 1}</td>}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.align === "right" ? "amt" : col.align === "center" ? "" : ""}
                    style={{ textAlign: col.align || "left", width: col.width }}
                  >
                    {col.render ? col.render((row as any)[col.key], row, idx) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default BusyTable;
