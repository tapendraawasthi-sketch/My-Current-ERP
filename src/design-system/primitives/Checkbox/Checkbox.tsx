import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, id, disabled, ...rest }, ref) => {
  const cid = id || React.useId();
  return (
    <div className={cn("flex gap-3", className)}>
      <CheckboxPrimitive.Root
        ref={ref}
        id={cid}
        disabled={disabled}
        className={cn(
          "ds-focus-ring ds-hit-target group mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--ds-radius-xs)] border border-[var(--ds-border-strong)] bg-[var(--ds-surface)]",
          "data-[state=checked]:bg-[var(--ds-action-primary)] data-[state=checked]:border-[var(--ds-action-primary)] data-[state=checked]:text-[var(--ds-action-primary-text)]",
          "data-[state=indeterminate]:bg-[var(--ds-action-primary)] data-[state=indeterminate]:border-[var(--ds-action-primary)] data-[state=indeterminate]:text-[var(--ds-action-primary-text)]",
          "disabled:opacity-50",
          error && "border-[var(--ds-status-danger)]",
        )}
        {...rest}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
          <Check className="h-3.5 w-3.5 group-data-[state=indeterminate]:hidden" aria-hidden />
          <Minus className="h-3.5 w-3.5 hidden group-data-[state=indeterminate]:block" aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {(label || description || error) && (
        <div className="min-w-0">
          {label ? (
            <label htmlFor={cid} className="ds-text-label cursor-pointer">
              {label}
            </label>
          ) : null}
          {description ? <p className="ds-text-metadata">{description}</p> : null}
          {error ? <p className="text-[13px] text-[var(--ds-status-danger)]">{error}</p> : null}
        </div>
      )}
    </div>
  );
});
Checkbox.displayName = "Checkbox";
