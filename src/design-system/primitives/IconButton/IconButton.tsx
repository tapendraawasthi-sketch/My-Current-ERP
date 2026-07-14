import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** Required accessible name for icon-only control */
  "aria-label": string;
  icon: React.ReactNode;
  size?: "small" | "medium" | "large";
  variant?: "quiet" | "secondary" | "destructive";
  loading?: boolean;
}

const sizeClass = {
  small: "h-9 w-9 min-h-[36px] min-w-[36px]",
  medium: "h-10 w-10 min-h-[var(--ds-hit-target-min)] min-w-[var(--ds-hit-target-min)]",
  large: "h-11 w-11 min-h-[44px] min-w-[44px]",
};

const variantClass = {
  quiet: "bg-transparent text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]",
  secondary:
    "bg-[var(--ds-surface)] text-[var(--ds-text-default)] border border-[var(--ds-border-default)] hover:bg-[var(--ds-surface-hover)]",
  destructive: "bg-transparent text-[var(--ds-action-danger)] hover:bg-[var(--ds-status-danger-surface)]",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      size = "medium",
      variant = "quiet",
      loading,
      className,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "ds-focus-ring ds-transition inline-flex items-center justify-center rounded-[var(--ds-radius-md)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        sizeClass[size],
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden
        />
      ) : (
        <span aria-hidden className="inline-flex [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
      )}
    </button>
  ),
);
IconButton.displayName = "IconButton";
