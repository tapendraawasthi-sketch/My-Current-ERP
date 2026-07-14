import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: React.ReactNode;
  }
>(({ className, label, description, error, children, ...rest }, ref) => (
  <div className={className}>
    {label ? <div className="ds-text-label mb-2">{label}</div> : null}
    {description ? <p className="ds-text-metadata mb-2">{description}</p> : null}
    <RadioGroupPrimitive.Root ref={ref} className="flex flex-col gap-2" {...rest}>
      {children}
    </RadioGroupPrimitive.Root>
    {error ? <p className="mt-1 text-[13px] text-[var(--ds-status-danger)]">{error}</p> : null}
  </div>
));
RadioGroup.displayName = "RadioGroup";

export const Radio = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & { label: React.ReactNode }
>(({ className, label, id, disabled, ...rest }, ref) => {
  const rid = id || React.useId();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <RadioGroupPrimitive.Item
        ref={ref}
        id={rid}
        disabled={disabled}
        className={cn(
          "ds-focus-ring ds-hit-target flex h-5 w-5 items-center justify-center rounded-full border border-[var(--ds-border-strong)] bg-[var(--ds-surface)]",
          "data-[state=checked]:border-[var(--ds-action-primary)]",
          "disabled:opacity-50",
        )}
        {...rest}
      >
        <RadioGroupPrimitive.Indicator className="h-2.5 w-2.5 rounded-full bg-[var(--ds-action-primary)]" />
      </RadioGroupPrimitive.Item>
      <label htmlFor={rid} className="ds-text-label cursor-pointer">
        {label}
      </label>
    </div>
  );
});
Radio.displayName = "Radio";
