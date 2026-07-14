import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { Button } from "../Button/Button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-[var(--ds-z-modal)] bg-[color-mix(in_srgb,var(--ds-surface-inverse)_50%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[var(--ds-z-modal)] w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-5 shadow-[var(--ds-shadow-3)]",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn("ds-text-card-title", className)} {...props} />;
}

export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description className={cn("ds-text-body mt-2", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex flex-wrap justify-end gap-2", className)} {...props} />;
}

export function AlertDialogCancel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button variant="secondary" className={className} {...props} />
    </AlertDialogPrimitive.Cancel>
  );
}

export function AlertDialogAction({
  className,
  variant = "primary",
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
  variant?: "primary" | "destructive";
}) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button variant={variant === "destructive" ? "destructive" : "primary"} className={className} {...props} />
    </AlertDialogPrimitive.Action>
  );
}

/** Financial / destructive confirmation layout — no accounting calculations */
export function ConfirmDialogFoundation({
  open,
  onOpenChange,
  title,
  consequence,
  documentLabel,
  amount,
  company,
  fiscalPeriod,
  warning,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  requireTypedPhrase,
  typedValue,
  onTypedValueChange,
  reason,
  onReasonChange,
  requireReason,
  auditReference,
  idempotencyReference,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: React.ReactNode;
  documentLabel?: string;
  amount?: string;
  company?: string;
  fiscalPeriod?: string;
  warning?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireTypedPhrase?: string;
  typedValue?: string;
  onTypedValueChange?: (v: string) => void;
  reason?: string;
  onReasonChange?: (v: string) => void;
  requireReason?: boolean;
  auditReference?: string;
  idempotencyReference?: string;
  onConfirm: () => void;
}) {
  const typedOk = !requireTypedPhrase || typedValue === requireTypedPhrase;
  const reasonOk = !requireReason || Boolean(reason?.trim());
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div>
            <p className="ds-text-body">{consequence}</p>
            <dl className="mt-3 space-y-1 text-[13px] text-[var(--ds-text-muted)]">
              {documentLabel ? (
                <div className="flex justify-between gap-4">
                  <dt>Document</dt>
                  <dd className="text-[var(--ds-text-default)]">{documentLabel}</dd>
                </div>
              ) : null}
              {amount ? (
                <div className="flex justify-between gap-4">
                  <dt>Amount</dt>
                  <dd className="ds-financial-value">{amount}</dd>
                </div>
              ) : null}
              {company ? (
                <div className="flex justify-between gap-4">
                  <dt>Company</dt>
                  <dd>{company}</dd>
                </div>
              ) : null}
              {fiscalPeriod ? (
                <div className="flex justify-between gap-4">
                  <dt>Period</dt>
                  <dd>{fiscalPeriod}</dd>
                </div>
              ) : null}
              {auditReference ? (
                <div className="flex justify-between gap-4">
                  <dt>Audit ref</dt>
                  <dd className="ds-text-code">{auditReference}</dd>
                </div>
              ) : null}
              {idempotencyReference ? (
                <div className="flex justify-between gap-4">
                  <dt>Idempotency</dt>
                  <dd className="ds-text-code">{idempotencyReference}</dd>
                </div>
              ) : null}
            </dl>
            {warning ? (
              <p className="mt-3 rounded-[var(--ds-radius-md)] bg-[var(--ds-status-warning-surface)] px-3 py-2 text-[13px] text-[var(--ds-status-warning)]">
                {warning}
              </p>
            ) : null}
            {requireReason ? (
              <label className="mt-3 block">
                <span className="ds-text-label">Reason</span>
                <textarea
                  className="mt-1 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2 text-[14px]"
                  value={reason}
                  onChange={(e) => onReasonChange?.(e.target.value)}
                  rows={2}
                />
              </label>
            ) : null}
            {requireTypedPhrase ? (
              <label className="mt-3 block">
                <span className="ds-text-label">Type {requireTypedPhrase} to confirm</span>
                <input
                  className="mt-1 h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-3 text-[14px]"
                  value={typedValue}
                  onChange={(e) => onTypedValueChange?.(e.target.value)}
                />
              </label>
            ) : null}
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "primary"}
            disabled={!typedOk || !reasonOk}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
