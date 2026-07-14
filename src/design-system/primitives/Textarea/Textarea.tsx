import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  resize?: "none" | "vertical" | "both";
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, disabled, readOnly, resize = "vertical", ...rest }, ref) => (
    <textarea
      ref={ref}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      className={cn(
        "ds-focus-ring ds-transition w-full min-h-[88px] rounded-[var(--ds-radius-md)] border bg-[var(--ds-surface)]",
        "px-[var(--ds-control-inset-x)] py-2 text-[14px] leading-[21px] text-[var(--ds-text-default)]",
        "border-[var(--ds-border-default)] placeholder:text-[var(--ds-text-subtle)]",
        "disabled:bg-[var(--ds-surface-disabled)] disabled:text-[var(--ds-text-disabled)]",
        invalid && "border-[var(--ds-status-danger)]",
        resize === "none" && "resize-none",
        resize === "vertical" && "resize-y",
        resize === "both" && "resize",
        className,
      )}
      {...rest}
    />
  ),
);
Textarea.displayName = "Textarea";
