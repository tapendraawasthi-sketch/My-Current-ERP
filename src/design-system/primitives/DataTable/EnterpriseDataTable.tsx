import * as React from "react";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Checkbox } from "../Checkbox/Checkbox";
import { IconButton } from "../IconButton/IconButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../Menu/DropdownMenu";
import { EmptyState } from "../Feedback/Patterns";
import { Skeleton } from "../Feedback/Feedback";
import { Button } from "../Button/Button";
import type { Density } from "../../foundations/types";

export type SortDirection = "asc" | "desc" | false;

export type ColumnAlign = "left" | "center" | "right";

export type EnterpriseColumnDef<T> = {
  id: string;
  header: string;
  accessor?: keyof T | ((row: T) => unknown);
  cell?: (row: T) => React.ReactNode;
  align?: ColumnAlign;
  sortable?: boolean;
  required?: boolean;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  financial?: boolean;
  priority?: "high" | "medium" | "low";
};

export type EnterpriseDataTableProps<T> = {
  columns: EnterpriseColumnDef<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  density?: Density;
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  sort?: { id: string; desc: boolean } | null;
  onSortChange?: (sort: { id: string; desc: boolean } | null) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  enableSelection?: boolean;
  expandedIds?: Set<string>;
  onExpandedChange?: (ids: Set<string>) => void;
  renderExpanded?: (row: T) => React.ReactNode;
  rowActions?: (row: T) => Array<{ label: string; onSelect: () => void; destructive?: boolean; hidden?: boolean }>;
  onRowClick?: (row: T) => void;
  columnVisibility?: Record<string, boolean>;
  className?: string;
  caption?: string;
  /** Sticky first identity column + horizontal scroll (STEP 7.3). Default true. */
  stickyFirstColumn?: boolean;
};

function getValue<T>(row: T, col: EnterpriseColumnDef<T>): unknown {
  if (col.cell) return col.cell(row);
  if (!col.accessor) return undefined;
  if (typeof col.accessor === "function") return col.accessor(row);
  return (row as Record<string, unknown>)[col.accessor as string];
}

export function formatAmountCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="ds-financial-value text-[var(--ds-text-subtle)]">—</span>;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  const text = formatNumber(n, { negativeStyle: "parens" });
  if (n < 0) {
    return <span className="ds-financial-value ds-financial-debit">{text}</span>;
  }
  if (n === 0) {
    return <span className="ds-financial-value">0.00</span>;
  }
  return <span className="ds-financial-value">{text}</span>;
}

export function DebitCreditCell({ debit, credit }: { debit?: number | null; credit?: number | null }) {
  const hasD = debit != null && debit !== 0;
  const hasC = credit != null && credit !== 0;
  if (!hasD && !hasC) return <span className="ds-financial-value text-[var(--ds-text-subtle)]">—</span>;
  if (hasD) {
    return (
      <span className="ds-financial-value ds-financial-debit">
        {formatNumber(debit, 2)} Dr
      </span>
    );
  }
  return (
    <span className="ds-financial-value ds-financial-credit">
      {formatNumber(credit, 2)} Cr
    </span>
  );
}

export function EnterpriseDataTable<T>({
  columns,
  rows,
  getRowId,
  density = "productive",
  loading,
  error,
  onRetry,
  emptyTitle = "No data",
  emptyDescription,
  emptyIcon,
  emptyAction,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  enableSelection,
  expandedIds,
  onExpandedChange,
  renderExpanded,
  rowActions,
  onRowClick,
  columnVisibility,
  className,
  caption,
  stickyFirstColumn = true,
}: EnterpriseDataTableProps<T>) {
  const visibleCols = columns.filter((c) => columnVisibility?.[c.id] !== false);
  const allSelected = enableSelection && rows.length > 0 && rows.every((r) => selectedIds?.has(getRowId(r)));
  const someSelected = enableSelection && rows.some((r) => selectedIds?.has(getRowId(r))) && !allSelected;
  const stickyBase =
    "sticky z-[1] bg-[var(--ds-surface-muted)] shadow-[1px_0_0_0_var(--ds-border-default)]";
  const stickyBody =
    "sticky z-[1] bg-[var(--ds-surface)] shadow-[1px_0_0_0_var(--ds-border-default)] group-hover:bg-[var(--ds-surface-hover)]";
  const firstDataStickyLeft = enableSelection || renderExpanded ? "left-10" : "left-0";

  const toggleSort = (id: string) => {
    if (!onSortChange) return;
    if (!sort || sort.id !== id) onSortChange({ id, desc: false });
    else if (!sort.desc) onSortChange({ id, desc: true });
    else onSortChange(null);
  };

  const toggleAll = () => {
    if (!onSelectionChange || !selectedIds) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.delete(getRowId(r)));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.add(getRowId(r)));
      onSelectionChange(next);
    }
  };

  const rowPad =
    density === "comfortable" ? "py-3" : density === "compact" ? "py-1.5" : "py-2";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)]",
        className,
      )}
      data-table-scroll="x"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-[var(--ds-z-sticky)] bg-[var(--ds-surface-muted)]">
            <tr className="border-b border-[var(--ds-border-default)]">
              {enableSelection ? (
                <th
                  className={cn(
                    "w-10 px-3",
                    rowPad,
                    stickyFirstColumn && cn(stickyBase, "left-0"),
                  )}
                >
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows on this page"
                  />
                </th>
              ) : null}
              {renderExpanded ? (
                <th
                  className={cn(
                    "w-10",
                    stickyFirstColumn && enableSelection && cn(stickyBase, "left-10"),
                  )}
                />
              ) : null}
              {visibleCols.map((col, colIdx) => {
                const sorted = sort?.id === col.id;
                const ariaSort = sorted ? (sort?.desc ? "descending" : "ascending") : "none";
                const isStickyIdentity = stickyFirstColumn && colIdx === 0;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={col.sortable ? (ariaSort as "ascending" | "descending" | "none") : undefined}
                    className={cn(
                      "px-3 text-[13px] font-semibold text-[var(--ds-text-muted)]",
                      rowPad,
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.priority === "low" && "max-md:hidden",
                      isStickyIdentity && cn(stickyBase, firstDataStickyLeft),
                    )}
                    style={col.width ? { width: col.width, minWidth: col.minWidth, maxWidth: col.maxWidth } : undefined}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="ds-focus-ring inline-flex items-center gap-1"
                        onClick={() => toggleSort(col.id)}
                      >
                        {col.header}
                        <span aria-hidden>{sorted ? (sort?.desc ? "↓" : "↑") : "↕"}</span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {rowActions ? <th className={cn("w-12 px-2", rowPad)}><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-[var(--ds-border-subtle)]" data-testid="table-skeleton-row">
                    {visibleCols.map((col) => (
                      <td key={col.id} className="px-3 py-2.5">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                    {enableSelection ? (
                      <td className="px-3 py-2.5">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    ) : null}
                    {rowActions ? (
                      <td className="px-3 py-2.5">
                        <Skeleton className="h-4 w-6 ml-auto" />
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
            {!loading && error ? (
              <tr>
                <td colSpan={99} className="p-4">
                  <EmptyState
                    title="Could not load rows"
                    description={error}
                    primaryAction={
                      onRetry ? (
                        <Button size="small" onClick={onRetry}>
                          Retry
                        </Button>
                      ) : null
                    }
                  />
                </td>
              </tr>
            ) : null}
            {!loading && !error && rows.length === 0 ? (
              <tr>
                <td colSpan={99} className="p-4">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={emptyIcon}
                    primaryAction={emptyAction}
                  />
                </td>
              </tr>
            ) : null}
            {!loading &&
              !error &&
              rows.map((row) => {
                const id = getRowId(row);
                const selected = selectedIds?.has(id);
                const expanded = expandedIds?.has(id);
                const actions = rowActions?.(row).filter((a) => !a.hidden) ?? [];
                return (
                  <React.Fragment key={id}>
                    <tr
                      className={cn(
                        "group border-b border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-hover)]",
                        selected && "bg-[var(--ds-surface-selected)]",
                        onRowClick && "cursor-pointer",
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {enableSelection ? (
                        <td
                          className={cn(
                            "px-3",
                            rowPad,
                            stickyFirstColumn && cn(stickyBody, "left-0"),
                            selected && stickyFirstColumn && "bg-[var(--ds-surface-selected)]",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={Boolean(selected)}
                            onCheckedChange={(c) => {
                              if (!onSelectionChange || !selectedIds) return;
                              const next = new Set(selectedIds);
                              if (c) next.add(id);
                              else next.delete(id);
                              onSelectionChange(next);
                            }}
                            aria-label={`Select row ${id}`}
                          />
                        </td>
                      ) : null}
                      {renderExpanded ? (
                        <td
                          className={cn(
                            "px-2",
                            rowPad,
                            stickyFirstColumn && enableSelection && cn(stickyBody, "left-10"),
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconButton
                            aria-label={expanded ? "Collapse row" : "Expand row"}
                            aria-expanded={expanded}
                            size="small"
                            icon={expanded ? <ChevronDown /> : <ChevronRight />}
                            onClick={() => {
                              if (!onExpandedChange || !expandedIds) return;
                              const next = new Set(expandedIds);
                              if (expanded) next.delete(id);
                              else next.add(id);
                              onExpandedChange(next);
                            }}
                          />
                        </td>
                      ) : null}
                      {visibleCols.map((col, colIdx) => {
                        const raw = getValue(row, col);
                        const content = col.financial && !col.cell ? formatAmountCell(raw) : (raw as React.ReactNode);
                        const isStickyIdentity = stickyFirstColumn && colIdx === 0;
                        return (
                          <td
                            key={col.id}
                            className={cn(
                              "px-3 text-[var(--ds-text-table-size)] leading-[var(--ds-text-table-line)] text-[var(--ds-text-default)]",
                              rowPad,
                              col.align === "right" && "text-right",
                              col.align === "center" && "text-center",
                              isStickyIdentity && cn(stickyBody, firstDataStickyLeft),
                              isStickyIdentity && selected && "bg-[var(--ds-surface-selected)]",
                              col.priority === "low" && "max-md:hidden",
                            )}
                          >
                            {content}
                          </td>
                        );
                      })}
                      {rowActions ? (
                        <td className={cn("px-2", rowPad)} onClick={(e) => e.stopPropagation()}>
                          {actions.length ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <IconButton aria-label={`Actions for ${id}`} icon={<MoreHorizontal />} size="small" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {actions.map((a) => (
                                  <DropdownMenuItem key={a.label} destructive={a.destructive} onSelect={a.onSelect}>
                                    {a.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                    {expanded && renderExpanded ? (
                      <tr className="border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-subtle)]">
                        <td colSpan={99} className="px-4 py-3">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Virtualization architecture note:
 * Default is full DOM for accessibility and printing.
 * Enable virtualization only for large static-height datasets via a future
 * `virtualized` prop once row height is fixed and a11y is validated.
 * Threshold guidance: prefer virtualization above ~500 visible rows.
 */
export const DATA_TABLE_VIRTUALIZATION_THRESHOLD = 500;
