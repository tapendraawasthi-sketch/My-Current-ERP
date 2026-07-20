import * as React from "react";
import { cn } from "@/lib/utils";

export type ScrollableTableProps = {
  children: React.ReactNode;
  className?: string;
  /** Min width of the inner table so narrow viewports scroll horizontally. */
  minWidth?: number | string;
  /** Sticky first column for identity cells marked with data-sticky-col. Default true. */
  stickyFirstColumn?: boolean;
};

/**
 * Horizontal scroll wrapper for raw HTML tables (STEP 7.3).
 * Prefer EnterpriseDataTable when possible; use this for legacy page tables.
 *
 * Mark the first identity th/td with `data-sticky-col` when stickyFirstColumn is on.
 */
export function ScrollableTable({
  children,
  className,
  minWidth = 640,
  stickyFirstColumn = true,
}: ScrollableTableProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)]",
        stickyFirstColumn && "scrollable-table-sticky",
        className,
      )}
      data-table-scroll="x"
    >
      <div style={{ minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth }}>
        {children}
      </div>
    </div>
  );
}
