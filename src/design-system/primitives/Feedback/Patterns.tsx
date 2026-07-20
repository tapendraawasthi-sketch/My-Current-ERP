import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../Button/Button";
import { Spinner } from "../Feedback/Feedback";
import type { StatusTone } from "../../foundations/types";

const toneSurface: Record<StatusTone, string> = {
  neutral: "bg-[var(--ds-status-neutral-surface)] text-[var(--ds-status-neutral)] border-[var(--ds-border-default)]",
  info: "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)] border-[var(--ds-status-info)]/30",
  success: "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)] border-[var(--ds-status-success)]/30",
  warning: "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)] border-[var(--ds-status-warning)]/30",
  danger: "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)] border-[var(--ds-status-danger)]/30",
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: StatusTone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("rounded-[var(--ds-radius-md)] border px-4 py-3", toneSurface[tone], className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {title ? <div className="text-[14px] font-semibold">{title}</div> : null}
          {children ? <div className="mt-1 text-[13px] text-[var(--ds-text-default)]">{children}</div> : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
        {onDismiss ? (
          <Button variant="quiet" size="small" onClick={onDismiss} aria-label="Dismiss">
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function Banner({
  tone = "warning",
  title,
  description,
  action,
  sticky,
  className,
}: {
  tone?: StatusTone;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "border-b px-4 py-3",
        toneSurface[tone],
        sticky && "sticky top-0 z-[var(--ds-z-sticky)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold">{title}</div>
          {description ? <div className="text-[13px] text-[var(--ds-text-default)]">{description}</div> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  tone?: StatusTone;
  content?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastApi = {
  push: (t: Omit<ToastItem, "id"> & { id?: string }) => string;
  dismiss: (id?: string) => void;
};

const ToastContext = React.createContext<ToastApi | null>(null);

/** Imperative bridge for store/slice callers (replaces react-hot-toast). */
let bridge: ToastApi | null = null;

export function getToastBridge(): ToastApi | null {
  return bridge;
}

export function ToastProvider({ children, max = 3 }: { children: React.ReactNode; max?: number }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const dismiss = React.useCallback((id?: string) => {
    setItems((prev) => (id ? prev.filter((x) => x.id !== id) : []));
  }, []);
  const push = React.useCallback(
    (t: Omit<ToastItem, "id"> & { id?: string }) => {
      const id = t.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { ...t, id, title: t.title ?? "" };
      setItems((prev) => [...prev.filter((x) => x.id !== id), item].slice(-max));
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 5000);
      return id;
    },
    [max],
  );
  const api = React.useMemo(() => ({ push, dismiss }), [push, dismiss]);
  React.useEffect(() => {
    bridge = api;
    return () => {
      if (bridge === api) bridge = null;
    };
  }, [api]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed top-4 right-4 z-[var(--ds-z-toast)] flex w-[min(100%-2rem,360px)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) =>
          t.content ? (
            <div key={t.id} className="pointer-events-auto">
              {t.content}
            </div>
          ) : (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto rounded-[var(--ds-radius-md)] border px-3 py-2 shadow-[var(--ds-shadow-2)]",
                toneSurface[t.tone || "neutral"],
                "bg-[var(--ds-surface-raised)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {t.title ? (
                    <div className="text-[13px] font-medium text-[var(--ds-text-strong)]">{t.title}</div>
                  ) : null}
                  {t.description ? (
                    <div className="text-[13px] text-[var(--ds-text-muted)]">{t.description}</div>
                  ) : null}
                </div>
                <Button variant="quiet" size="small" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                  ×
                </Button>
              </div>
              {t.actionLabel && t.onAction ? (
                <Button variant="link" size="small" className="mt-1" onClick={t.onAction}>
                  {t.actionLabel}
                </Button>
              ) : null}
            </div>
          ),
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast requires ToastProvider");
  return ctx;
}

export function ErrorSummary({
  title = "Please fix the following",
  errors,
  className,
}: {
  title?: string;
  errors: Array<{ id: string; message: string; href?: string }>;
  className?: string;
}) {
  if (!errors.length) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--ds-status-danger)]/40 bg-[var(--ds-status-danger-surface)] px-4 py-3 text-[var(--ds-status-danger)]",
        className,
      )}
    >
      <div className="text-[14px] font-semibold">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
        {errors.map((e) => (
          <li key={e.id}>
            {e.href ? (
              <a className="underline underline-offset-2" href={e.href}>
                {e.message}
              </a>
            ) : (
              e.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** Small lucide (or similar) icon — optional, no heavy illustrations. */
  icon?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border-default)] bg-[var(--ds-surface-subtle)] px-6 py-8",
        className,
      )}
      data-testid="empty-state"
    >
      {icon ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] text-[var(--ds-text-subtle)]">
          {icon}
        </span>
      ) : null}
      <h3 className="ds-text-card-title">{title}</h3>
      {description ? (
        <p className="ds-text-body max-w-md text-[var(--ds-text-muted)]">{description}</p>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function LoadingState({
  label = "Loading",
  rows = 4,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label={label}>
      <Spinner label={label} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-[var(--ds-radius-sm)] bg-[var(--ds-surface-muted)] motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function InlineLoading({ label = "Working…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[var(--ds-text-muted)]">
      <Spinner size="small" label={label} />
      {label}
    </span>
  );
}

export function Progress({
  value,
  label,
  indeterminate,
  className,
}: {
  value?: number;
  label: string;
  indeterminate?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex justify-between text-[13px] text-[var(--ds-text-muted)]">
        <span>{label}</span>
        {!indeterminate ? <span>{pct}%</span> : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        className="h-2 overflow-hidden rounded-[var(--ds-radius-full)] bg-[var(--ds-surface-muted)]"
      >
        <div
          className={cn(
            "h-full rounded-[var(--ds-radius-full)] bg-[var(--ds-action-primary)]",
            indeterminate && "w-1/3 animate-pulse motion-reduce:animate-none",
            !indeterminate && pct === 0 && "w-0",
            !indeterminate && pct > 0 && pct <= 10 && "w-[10%]",
            !indeterminate && pct > 10 && pct <= 25 && "w-1/4",
            !indeterminate && pct > 25 && pct <= 50 && "w-1/2",
            !indeterminate && pct > 50 && pct <= 75 && "w-3/4",
            !indeterminate && pct > 75 && pct < 100 && "w-[90%]",
            !indeterminate && pct >= 100 && "w-full",
          )}
        />
      </div>
    </div>
  );
}

export function StepProgress({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap gap-2", className)}>
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li
            key={s}
            aria-current={active ? "step" : undefined}
            className={cn(
              "rounded-[var(--ds-radius-full)] px-3 py-1 text-[13px] font-medium",
              active && "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]",
              done && "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]",
              !active && !done && "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]",
            )}
          >
            {i + 1}. {s}
          </li>
        );
      })}
    </ol>
  );
}

export function RecoveryPanel({
  title,
  whatFailed,
  whatRemains,
  onRetry,
  reference,
  onDismiss,
}: {
  title: string;
  whatFailed: React.ReactNode;
  whatRemains?: React.ReactNode;
  onRetry?: () => void;
  reference?: string;
  onDismiss?: () => void;
}) {
  return (
    <Alert
      tone="danger"
      title={title}
      action={
        <div className="flex gap-2">
          {onRetry ? (
            <Button size="small" variant="primary" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {onDismiss ? (
            <Button size="small" variant="secondary" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      }
    >
      <div>{whatFailed}</div>
      {whatRemains ? <div className="mt-1">{whatRemains}</div> : null}
      {reference ? <div className="mt-1 ds-text-code">{reference}</div> : null}
    </Alert>
  );
}

export type SyncVisualState =
  | "local"
  | "pending"
  | "syncing"
  | "synced"
  | "retry_scheduled"
  | "failed"
  | "conflict"
  | "action_required"
  | "offline"
  | "stale";

const syncTone: Record<SyncVisualState, StatusTone> = {
  local: "neutral",
  pending: "info",
  syncing: "info",
  synced: "success",
  retry_scheduled: "warning",
  failed: "danger",
  conflict: "danger",
  action_required: "warning",
  offline: "neutral",
  stale: "warning",
};

const syncLabel: Record<SyncVisualState, string> = {
  local: "Local",
  pending: "Pending",
  syncing: "Syncing",
  synced: "Synced",
  retry_scheduled: "Retry scheduled",
  failed: "Failed",
  conflict: "Conflict",
  action_required: "Action required",
  offline: "Offline",
  stale: "Stale",
};

/** Visual only — accepts authoritative sync state; does not infer success */
export function SyncStatusChip({ state }: { state: SyncVisualState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--ds-radius-full)] border px-2.5 py-0.5 text-[12px] font-semibold",
        toneSurface[syncTone[state]],
      )}
    >
      {syncLabel[state]}
    </span>
  );
}

export function NotificationItem({
  title,
  body,
  time,
  unread,
}: {
  title: string;
  body?: string;
  time?: string;
  unread?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-b border-[var(--ds-border-subtle)] px-3 py-2",
        unread && "bg-[var(--ds-surface-selected)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px] font-medium text-[var(--ds-text-strong)]">{title}</div>
        {time ? <div className="ds-text-metadata">{time}</div> : null}
      </div>
      {body ? <div className="ds-text-metadata mt-0.5">{body}</div> : null}
    </div>
  );
}
