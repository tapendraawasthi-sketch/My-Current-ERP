import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  invalid?: boolean;
  inputSize?: "small" | "medium" | "large";
  /** Leading adornment (not the HTML prefix attribute) */
  startAddon?: React.ReactNode;
  endAddon?: React.ReactNode;
  amount?: boolean;
}

const sizeClass = {
  small: "h-[var(--ds-control-height-sm)] text-[13px]",
  medium: "h-[var(--ds-control-height)] text-[14px]",
  large: "h-[var(--ds-control-height-lg)] text-[14px]",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      invalid,
      disabled,
      readOnly,
      inputSize = "medium",
      startAddon,
      endAddon,
      amount,
      id,
      ...rest
    },
    ref,
  ) => {
    const input = (
      <input
        ref={ref}
        id={id}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        className={cn(
          "ds-focus-ring ds-transition w-full rounded-[var(--ds-radius-md)] border bg-[var(--ds-surface)] text-[var(--ds-text-default)]",
          "px-[var(--ds-control-inset-x)] placeholder:text-[var(--ds-text-subtle)]",
          "border-[var(--ds-border-default)] focus:border-[var(--ds-border-focus)]",
          "disabled:bg-[var(--ds-surface-disabled)] disabled:text-[var(--ds-text-disabled)] disabled:cursor-not-allowed",
          "read-only:bg-[var(--ds-surface-subtle)]",
          invalid && "border-[var(--ds-status-danger)]",
          amount && "text-right font-variant-numeric tabular-nums",
          sizeClass[inputSize],
          (startAddon || endAddon) && "border-0 focus:ring-0 shadow-none rounded-none h-full",
          !(startAddon || endAddon) && className,
        )}
        {...rest}
      />
    );

    if (!startAddon && !endAddon) return input;

    return (
      <div
        className={cn(
          "ds-focus-ring flex items-center overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]",
          invalid && "border-[var(--ds-status-danger)]",
          sizeClass[inputSize],
          className,
        )}
      >
        {startAddon ? (
          <span className="px-2 text-[var(--ds-text-muted)] text-[13px]" aria-hidden>
            {startAddon}
          </span>
        ) : null}
        {input}
        {endAddon ? (
          <span className="px-2 text-[var(--ds-text-muted)] text-[13px]" aria-hidden>
            {endAddon}
          </span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
