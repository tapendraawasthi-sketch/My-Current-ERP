import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  mono?: boolean;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: T) => void;
  density?: "compact" | "comfortable";
  /** Hide built-in search when parent provides filters */
  showSearch?: boolean;
  toolbarExtra?: React.ReactNode;
}

function getCellValue<T extends Record<string, unknown>>(row: T, key: string): unknown {
  return row[key];
}

/**
 * Shared enterprise table primitive — start migration with list screens.
 * Uses design tokens; keeps horizontal scroll inside the table only.
 */
function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = "Search…",
  emptyTitle = "No matching records",
  emptyDescription = "Try adjusting filters or search terms.",
  loading = false,
  error = null,
  onRowClick,
  density = "compact",
  showSearch = true,
  toolbarExtra,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (showSearch && q) {
      list = rows.filter((row) =>
        columns.some((col) => {
          const v = getCellValue(row, String(col.key));
          return String(v ?? "").toLowerCase().includes(q);
        }),
      );
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = getCellValue(a, sortKey);
        const bv = getCellValue(b, sortKey);
        const as = av == null ? "" : String(av);
        const bs = bv == null ? "" : String(bv);
        const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [columns, query, rows, sortDir, sortKey, showSearch]);

  const cellPad = density === "compact" ? "px-3 py-2" : "px-3 py-2.5";

  return (
    <div
      className="overflow-hidden rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)]"
      data-component="data-table"
    >
      {(showSearch || toolbarExtra) && (
        <div className="flex items-center gap-2 border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3 py-2">
          {showSearch && (
            <>
              <Search className="h-3.5 w-3.5 text-[var(--ox-text-subtle)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full border-0 bg-transparent text-[13px] text-[var(--ox-text)] outline-none placeholder:text-[var(--ox-text-subtle)]"
                aria-label="Search table"
              />
            </>
          )}
          {toolbarExtra}
          <span className="ml-auto whitespace-nowrap text-[11px] text-[var(--ox-text-subtle)]">
            {filtered.length} row{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {error && (
        <div className="border-b border-[var(--ox-border)] bg-[var(--ox-danger-soft)] px-3 py-2 text-[12px] text-[var(--ox-danger)]">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)]">
              {columns.map((col) => {
                const key = String(col.key);
                const active = sortKey === key;
                return (
                  <th
                    key={key}
                    scope="col"
                    style={{ width: col.width }}
                    className={`${cellPad} text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)] ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => {
                          if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setSortKey(key);
                            setSortDir("asc");
                          }
                        }}
                      >
                        {col.header}
                        {active ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-[13px] text-[var(--ox-text-muted)]">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center">
                  <p className="text-[13px] font-medium text-[var(--ox-text)]">{emptyTitle}</p>
                  <p className="mt-1 text-[12px] text-[var(--ox-text-muted)]">{emptyDescription}</p>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-[var(--ox-border)] hover:bg-[var(--ox-primary-soft)]/50 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => {
                    const key = String(col.key);
                    const raw = getCellValue(row, key);
                    const content = col.render ? col.render(row) : raw == null || raw === "" ? "—" : String(raw);
                    return (
                      <td
                        key={key}
                        className={`${cellPad} text-[var(--ox-text)] ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left"
                        } ${col.mono || col.align === "right" ? "font-mono tabular-nums" : ""}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
