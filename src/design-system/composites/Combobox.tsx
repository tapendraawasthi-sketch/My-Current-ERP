import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "../primitives/Input/Input";
import { FormField } from "../primitives/FormField/FormField";
import { InlineLoading } from "../primitives/Feedback/Patterns";
import { Spinner } from "../primitives/Feedback/Feedback";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  emptyText?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
  /** When provided, shows a clear (X) affordance while a value is selected. */
  onClear?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  className?: string;
  renderOption?: (opt: ComboboxOption, active: boolean) => React.ReactNode;
}

/** Searchable single-select list (IMPLEMENT_NOW §3.1). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  loading,
  emptyText = "No matches",
  onCreateNew,
  createNewLabel = "Create new",
  onClear,
  disabled,
  invalid,
  "aria-label": ariaLabel,
  className,
  renderOption,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q),
    );
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const pick = (v: string) => {
    onChange?.(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
        disabled={disabled}
        invalid={invalid}
        placeholder={selected && !open ? selected.label : placeholder}
        value={open ? query : selected?.label || ""}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          }
          if (e.key === "Enter" && open && filtered[activeIndex]) {
            e.preventDefault();
            pick(filtered[activeIndex].value);
          }
        }}
      />
      {open && !disabled && (
        <div
          role="listbox"
          className="absolute z-[var(--ds-z-dropdown)] mt-1 max-h-[280px] w-full overflow-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-2)]"
        >
          {loading ? (
            <div className="px-3 py-3">
              <InlineLoading label="Loading…" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-[13px] text-[var(--ds-text-muted)]">{emptyText}</div>
          ) : (
            filtered.map((opt, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  disabled={opt.disabled}
                  className={cn(
                    "flex h-9 w-full items-center px-3 text-left text-[13px] ds-transition",
                    active || opt.value === value
                      ? "bg-[var(--ds-surface-selected)] text-[var(--ds-text-strong)]"
                      : "text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]",
                    opt.disabled && "opacity-50",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(opt.value)}
                >
                  {renderOption ? (
                    renderOption(opt, active)
                  ) : (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{opt.label}</span>
                      {opt.description ? (
                        <span className="truncate text-[12px] text-[var(--ds-text-muted)]">
                          {opt.description}
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })
          )}
          {onCreateNew ? (
            <button
              type="button"
              className="w-full border-t border-[var(--ds-border-subtle)] px-3 py-2 text-left text-[13px] text-[var(--ds-text-link)] hover:bg-[var(--ds-surface-hover)]"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
            >
              {createNewLabel}
            </button>
          ) : null}
        </div>
      )}
      {loading && !open ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          <Spinner size="small" label="Loading" />
        </span>
      ) : null}
      {!loading && !open && !disabled && onClear && selected ? (
        <button
          type="button"
          aria-label="Clear selection"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)] hover:text-[var(--ds-text-default)]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

export function AmountField({
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  disabled,
  className,
}: {
  label?: string;
  value?: string | number;
  onChange?: (raw: string) => void;
  onBlur?: (formatted: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [local, setLocal] = React.useState(String(value ?? ""));
  React.useEffect(() => {
    setLocal(String(value ?? ""));
  }, [value]);

  const format = (raw: string) => {
    const n = Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(n) || raw.trim() === "") return "";
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <FormField id="amount-field" label={label} required={required} error={error} className={className}>
      <Input
        id="amount-field"
        amount
        startAddon={<span className="text-[12px] text-[var(--ds-text-muted)]">Rs.</span>}
        value={local}
        disabled={disabled}
        invalid={Boolean(error)}
        className="min-w-[120px] font-mono tabular-nums"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange?.(e.target.value);
        }}
        onBlur={() => {
          const f = format(local);
          setLocal(f);
          onBlur?.(f);
        }}
      />
    </FormField>
  );
}

export function BalanceStrip({
  balanced,
  message,
  className,
}: {
  balanced: boolean;
  message: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "w-full rounded-[var(--ds-radius-md)] border px-3 py-2 text-[13px] font-medium",
        balanced
          ? "border-[var(--ds-status-success)]/30 bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
          : "border-[var(--ds-status-danger)]/30 bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)]",
        className,
      )}
    >
      {message}
    </div>
  );
}

export function Dropzone({
  title = "Drop file or browse",
  help = "Supported files only",
  onBrowse,
  error,
  className,
}: {
  title?: string;
  help?: string;
  onBrowse?: () => void;
  error?: string;
  className?: string;
}) {
  const [over, setOver] = React.useState(false);
  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onBrowse?.();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
        }}
        onClick={() => onBrowse?.()}
        className={cn(
          "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--ds-radius-md)] border border-dashed px-4 py-6 text-center ds-transition",
          over
            ? "border-[var(--ds-border-focus)] bg-[var(--ds-surface-selected)]"
            : "border-[var(--ds-border-default)] bg-[var(--ds-surface)] hover:border-[var(--ds-border-focus)]",
        )}
      >
        <div className="text-[13px] font-medium text-[var(--ds-text-default)]">{title}</div>
        <div className="text-[12px] text-[var(--ds-text-muted)]">{help}</div>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] text-[var(--ds-status-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function HubCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HubCard({
  title,
  help,
  shortcut,
  onClick,
}: {
  title: string;
  help?: string;
  shortcut?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4 text-left ds-transition hover:bg-[var(--ds-surface-hover)]"
    >
      <div className="text-[14px] font-semibold text-[var(--ds-text-strong)]">{title}</div>
      {help ? <div className="mt-1 text-[12px] text-[var(--ds-text-muted)]">{help}</div> : null}
      {shortcut ? (
        <div className="mt-2 text-[12px] text-[var(--ds-text-subtle)]">{shortcut}</div>
      ) : null}
    </button>
  );
}
