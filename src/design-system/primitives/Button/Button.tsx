import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet" | "destructive" | "link";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)] border-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] active:bg-[var(--ds-action-primary-pressed)]",
  secondary:
    "bg-[var(--ds-action-secondary)] text-[var(--ds-text-default)] border-[var(--ds-border-default)] hover:bg-[var(--ds-action-secondary-hover)] active:bg-[var(--ds-surface-pressed)]",
  quiet:
    "bg-transparent text-[var(--ds-text-default)] border-transparent hover:bg-[var(--ds-surface-hover)] active:bg-[var(--ds-surface-pressed)]",
  destructive:
    "bg-[var(--ds-action-danger)] text-[var(--ds-action-primary-text)] border-[var(--ds-action-danger)] hover:bg-[var(--ds-action-danger-hover)] active:bg-[var(--ds-action-danger-hover)]",
  link: "bg-transparent text-[var(--ds-text-link)] border-transparent underline-offset-2 hover:underline px-0",
};

const sizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  small: "h-[var(--ds-control-height-sm)] px-3 text-[13px]",
  medium: "h-[var(--ds-control-height)] px-3.5 text-[14px]",
  large: "h-[var(--ds-control-height-lg)] px-4 text-[14px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "medium",
      loading = false,
      fullWidth,
      startIcon,
      endIcon,
      className,
      disabled,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "ds-focus-ring ds-transition inline-flex items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border font-medium",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantClass[variant],
          sizeClass[size],
          fullWidth && "w-full",
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
          startIcon
        )}
        <span className={cn(loading && "opacity-90")}>{children}</span>
        {!loading && endIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
