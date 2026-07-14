import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Select portals to document body; z-index uses --ds-z-dropdown */

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { invalid?: boolean }
>(({ className, children, invalid, ...rest }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "ds-focus-ring ds-transition flex h-[var(--ds-control-height)] w-full items-center justify-between gap-2 rounded-[var(--ds-radius-md)] border bg-[var(--ds-surface)] px-[var(--ds-control-inset-x)] text-[14px] text-[var(--ds-text-default)]",
      "border-[var(--ds-border-default)] data-[placeholder]:text-[var(--ds-text-subtle)]",
      "disabled:opacity-50",
      invalid && "border-[var(--ds-status-danger)]",
      className,
    )}
    {...rest}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...rest }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-[var(--ds-z-dropdown)] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-1 shadow-[var(--ds-shadow-2)]",
        className,
      )}
      {...rest}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...rest }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "ds-focus-ring relative flex cursor-pointer select-none items-center rounded-[var(--ds-radius-sm)] py-2 pl-8 pr-3 text-[14px] text-[var(--ds-text-default)] outline-none",
      "data-[highlighted]:bg-[var(--ds-surface-hover)] data-[disabled]:opacity-50",
      className,
    )}
    {...rest}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
