/**
 * Floorplan loading skeletons (STEP 3.2) — calm pulse, no bounce.
 */
import React from "react";
import { Skeleton } from "../primitives/Feedback/Feedback";
import { cn } from "@/lib/utils";

export type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

export function TableSkeleton({ rows = 6, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]",
        className,
      )}
      role="status"
      aria-label="Loading table"
      data-testid="table-skeleton"
    >
      <div className="flex gap-3 border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-muted)] px-3 py-2.5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 flex-1 max-w-[120px]" />
        ))}
      </div>
      <div className="divide-y divide-[var(--ds-border-subtle)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`r-${r}`} className="flex gap-3 px-3 py-2.5">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`c-${r}-${c}`}
                className={cn("h-4 flex-1", c === columns - 1 && "max-w-[80px]")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export type FormSkeletonProps = {
  fields?: number;
  className?: string;
};

export function FormSkeleton({ fields = 8, className }: FormSkeletonProps) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4",
        className,
      )}
      role="status"
      aria-label="Loading form"
      data-testid="form-skeleton"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--ds-border-subtle)] pt-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export type KpiSkeletonProps = {
  count?: number;
  className?: string;
};

export function KpiSkeleton({ count = 4, className }: KpiSkeletonProps) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}
      role="status"
      aria-label="Loading summary"
      data-testid="kpi-skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-3"
        >
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
      ))}
    </div>
  );
}
