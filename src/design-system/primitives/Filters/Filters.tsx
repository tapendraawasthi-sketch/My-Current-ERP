import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import type { Density } from "../../foundations/types";

export function SearchField({
  id,
  label,
  value,
  onChange,
  onClear,
  placeholder,
  shortcutHint,
  loading,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  shortcutHint?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[200px] flex-1", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-subtle)]" aria-hidden />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ds-focus-ring h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] pl-9 pr-16 text-[14px] text-[var(--ds-text-default)] placeholder:text-[var(--ds-text-subtle)]"
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading ? <span className="ds-text-metadata px-1">…</span> : null}
        {shortcutHint && !value ? <span className="ds-text-metadata hidden px-1 sm:inline">{shortcutHint}</span> : null}
        {value ? (
          <IconButton aria-label="Clear search" size="small" icon={<X />} onClick={() => (onClear ? onClear() : onChange(""))} />
        ) : null}
      </div>
    </div>
  );
}

export function FilterChip({
  label,
  value,
  onRemove,
  className,
}: {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
}) {
  const full = `${label}: ${value}`;
  return (
    <span
      title={full}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-[var(--ds-radius-full)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] py-1 pl-2.5 pr-1 text-[13px] text-[var(--ds-text-default)]",
        className,
      )}
    >
      <span className="truncate">
        <span className="text-[var(--ds-text-muted)]">{label}:</span> {value}
      </span>
      <IconButton aria-label={`Remove filter ${full}`} size="small" icon={<X />} onClick={onRemove} />
    </span>
  );
}

export type DateRangeValue = { start?: string; end?: string };

export function DateRangeFilter({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-wrap items-end gap-2", className)}>
      <legend className="sr-only">{label}</legend>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="ds-text-label">From</span>
        <input
          id={`${id}-start`}
          type="date"
          value={value.start || ""}
          onChange={(e) => onChange({ ...value, start: e.target.value || undefined })}
          className="h-[var(--ds-control-height)] rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-2 text-[14px]"
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="ds-text-label">To</span>
        <input
          id={`${id}-end`}
          type="date"
          value={value.end || ""}
          onChange={(e) => onChange({ ...value, end: e.target.value || undefined })}
          className="h-[var(--ds-control-height)] rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-2 text-[14px]"
        />
      </label>
    </fieldset>
  );
}

export type SavedViewOwner = "user" | "company" | "system";

export type SavedView = {
  id: string;
  name: string;
  owner: SavedViewOwner;
  filters: unknown;
  sort: unknown;
  columns: unknown;
  density?: Density;
  isDefault?: boolean;
};

export function FilterBar({
  search,
  filters,
  chips,
  onClearAll,
  savedViews,
  activeViewId,
  onSelectView,
  className,
}: {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  chips?: React.ReactNode;
  onClearAll?: () => void;
  savedViews?: SavedView[];
  activeViewId?: string;
  onSelectView?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {filters}
        {onClearAll ? (
          <Button variant="quiet" size="small" onClick={onClearAll}>
            Clear all
          </Button>
        ) : null}
      </div>
      {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
      {savedViews?.length ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Saved views">
          {savedViews.map((v) => (
            <Button
              key={v.id}
              size="small"
              variant={activeViewId === v.id ? "primary" : "secondary"}
              onClick={() => onSelectView?.(v.id)}
            >
              {v.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  unknownTotal,
  loading,
  className,
}: {
  page: number;
  pageSize: number;
  total?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  unknownTotal?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const totalPages = unknownTotal || total == null ? undefined : Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : true;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 py-2 text-[13px]", className)}>
      <div className="text-[var(--ds-text-muted)]" aria-live="polite">
        {loading
          ? "Loading…"
          : unknownTotal || total == null
            ? `Page ${page}`
            : `Showing page ${page} of ${totalPages} · ${total} results`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1">
            <span className="sr-only">Rows per page</span>
            <select
              className="h-[var(--ds-control-height-sm)] rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-2"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button variant="secondary" size="small" disabled={!canPrev} onClick={() => onPageChange(1)} aria-label="First page">
          First
        </Button>
        <Button variant="secondary" size="small" disabled={!canPrev} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          Previous
        </Button>
        <Button variant="secondary" size="small" disabled={!canNext} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          Next
        </Button>
        {totalPages ? (
          <Button
            variant="secondary"
            size="small"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            Last
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SelectionSummary({
  selectedCount,
  pageCount,
  scope = "page",
  onClear,
  onSelectPage,
  bulkActions,
  className,
}: {
  selectedCount: number;
  pageCount: number;
  /** Never claim "all matching" unless backend-authoritative */
  scope?: "page" | "matching";
  onClear: () => void;
  onSelectPage?: () => void;
  bulkActions?: React.ReactNode;
  className?: string;
}) {
  if (selectedCount === 0 && !onSelectPage) return null;
  return (
    <div
      className={cn(
        "mb-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-selected)] px-3 py-2 text-[13px]",
        className,
      )}
      role="status"
    >
      <div>
        {selectedCount > 0
          ? `${selectedCount} selected (${scope === "matching" ? "all matching" : `of ${pageCount} on this page`})`
          : `None selected · ${pageCount} on this page`}
        {onSelectPage ? (
          <Button variant="link" size="small" className="ml-2" onClick={onSelectPage}>
            Select page
          </Button>
        ) : null}
        {selectedCount > 0 ? (
          <Button variant="link" size="small" className="ml-2" onClick={onClear}>
            Clear selection
          </Button>
        ) : null}
      </div>
      {bulkActions ? <div className="flex flex-wrap gap-2">{bulkActions}</div> : null}
    </div>
  );
}
