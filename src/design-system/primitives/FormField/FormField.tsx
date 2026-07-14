import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...rest }, ref) => (
    <label
      ref={ref}
      className={cn("ds-text-label inline-flex items-center gap-1", className)}
      {...rest}
    >
      {children}
      {required ? (
        <span className="text-[var(--ds-status-danger)]" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  ),
);
Label.displayName = "Label";

export function FieldDescription({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p id={id} className={cn("ds-text-metadata mt-1", className)}>
      {children}
    </p>
  );
}

export function FieldError({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn("mt-1 text-[13px] text-[var(--ds-status-danger)]", className)}>
      {children}
    </p>
  );
}

export interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  description?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  horizontal?: boolean;
}

export function FormField({
  id,
  label,
  required,
  description,
  error,
  warning,
  children,
  className,
  horizontal,
}: FormFieldProps) {
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const warnId = warning ? `${id}-warn` : undefined;
  const describedBy = [descId, errId, warnId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={cn(
        horizontal ? "grid grid-cols-[160px_1fr] items-start gap-3" : "flex flex-col gap-1.5",
        className,
      )}
    >
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div>
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ id?: string; "aria-describedby"?: string; invalid?: boolean }>, {
              id,
              "aria-describedby": describedBy,
              invalid: Boolean(error),
            })
          : children}
        {description ? <FieldDescription id={descId}>{description}</FieldDescription> : null}
        {warning ? (
          <p id={warnId} className="mt-1 text-[13px] text-[var(--ds-status-warning)]">
            {warning}
          </p>
        ) : null}
        <FieldError id={errId}>{error}</FieldError>
      </div>
    </div>
  );
}
