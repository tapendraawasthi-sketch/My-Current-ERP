import React from "react";

export interface Column<T = any> {
  key: string;
  header: string | React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  rowKey?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

function Table<T = any>({
  columns,
  data,
  rowKey = "id",
  onRowClick,
  emptyMessage = "No data found.",
}: TableProps<T>) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width, textAlign: col.align || "left" }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: "center", padding: "32px 16px", color: "#000000" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row: any, idx) => (
              <tr
                key={row[rowKey] || idx}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? "pointer" : "default" }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align || "left" }}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
