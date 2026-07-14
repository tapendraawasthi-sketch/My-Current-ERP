import * as React from "react";
import { cn } from "@/lib/utils";

export function Divider({
  orientation = "horizontal",
  decorative = true,
  className,
}: {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  className?: string;
}) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "bg-[var(--ds-border-default)]",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px self-stretch",
        className,
      )}
    />
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-surface-muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--ds-text-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-[var(--ds-status-neutral-surface)] text-[var(--ds-status-neutral)]",
    info: "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]",
    success: "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]",
    warning: "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)]",
    danger: "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--ds-radius-full)] px-2.5 py-0.5 text-[12px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({
  size = "medium",
  label = "Loading",
  className,
}: {
  size?: "small" | "medium" | "large";
  label?: string;
  className?: string;
}) {
  const dim = size === "small" ? "h-4 w-4" : size === "large" ? "h-8 w-8" : "h-5 w-5";
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-block animate-spin rounded-full border-2 border-[var(--ds-border-strong)] border-t-[var(--ds-action-primary)] motion-reduce:animate-none",
          dim,
        )}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--ds-radius-sm)] bg-[var(--ds-surface-muted)] motion-reduce:animate-none",
        className,
      )}
      aria-hidden
      {...rest}
    />
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
