import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label: React.ReactNode;
  description?: React.ReactNode;
  onLabel?: string;
  offLabel?: string;
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, description, onLabel, offLabel, id, checked, ...rest }, ref) => {
  const sid = id || React.useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <label htmlFor={sid} className="ds-text-label cursor-pointer">
          {label}
        </label>
        {description ? <p className="ds-text-metadata">{description}</p> : null}
        {(onLabel || offLabel) && (
          <p className="ds-text-metadata" aria-live="polite">
            {checked ? onLabel : offLabel}
          </p>
        )}
      </div>
      <SwitchPrimitive.Root
        ref={ref}
        id={sid}
        checked={checked}
        className={cn(
          "ds-focus-ring relative h-6 w-11 shrink-0 rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]",
          "data-[state=checked]:bg-[var(--ds-action-primary)] data-[state=checked]:border-[var(--ds-action-primary)]",
          "disabled:opacity-50",
        )}
        {...rest}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "ds-transition block h-5 w-5 translate-x-0.5 rounded-full bg-[var(--ds-surface)] shadow-[var(--ds-shadow-1)]",
            "data-[state=checked]:translate-x-[22px]",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
});
Switch.displayName = "Switch";
