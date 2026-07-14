import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "../IconButton/IconButton";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-[var(--ds-z-modal)] bg-[color-mix(in_srgb,var(--ds-surface-inverse)_45%,transparent)] ds-transition data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

const sizeClass = {
  small: "max-w-[400px]",
  medium: "max-w-[560px]",
  large: "max-w-[760px]",
  "extra-large": "max-w-[1040px]",
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: keyof typeof sizeClass;
    showClose?: boolean;
  }
>(({ className, children, size = "medium", showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[var(--ds-z-modal)] flex max-h-[min(90vh,900px)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-3)]",
        "max-md:inset-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none",
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close asChild>
          <IconButton
            aria-label="Close dialog"
            icon={<X />}
            size="small"
            className="absolute right-3 top-3"
          />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 border-b border-[var(--ds-border-subtle)] px-5 py-4 pr-12", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("ds-text-card-title", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("ds-text-metadata mt-1", className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--ds-border-subtle)] bg-[var(--ds-surface-subtle)] px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}
