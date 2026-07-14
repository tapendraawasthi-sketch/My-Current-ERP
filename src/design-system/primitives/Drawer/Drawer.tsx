import * as React from "react";
import { Drawer as VaulDrawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "../IconButton/IconButton";

export const Drawer = VaulDrawer.Root;
export const DrawerTrigger = VaulDrawer.Trigger;
export const DrawerClose = VaulDrawer.Close;
export const DrawerPortal = VaulDrawer.Portal;

export function DrawerContent({
  className,
  children,
  side = "right",
  title,
  description,
  footer,
  ...props
}: React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> & {
  side?: "right" | "left" | "bottom";
  title: string;
  description?: string;
  footer?: React.ReactNode;
}) {
  const sideClass =
    side === "bottom"
      ? "inset-x-0 bottom-0 mt-24 max-h-[90vh] rounded-t-[var(--ds-radius-lg)]"
      : side === "left"
        ? "inset-y-0 left-0 h-full w-[min(100%,420px)] rounded-r-[var(--ds-radius-lg)]"
        : "inset-y-0 right-0 h-full w-[min(100%,420px)] rounded-l-[var(--ds-radius-lg)]";

  return (
    <DrawerPortal>
      <VaulDrawer.Overlay className="fixed inset-0 z-[var(--ds-z-drawer)] bg-[color-mix(in_srgb,var(--ds-surface-inverse)_40%,transparent)]" />
      <VaulDrawer.Content
        className={cn(
          "fixed z-[var(--ds-z-drawer)] flex flex-col border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-3)] outline-none",
          "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[min(92vh,100%)] max-md:w-full max-md:rounded-t-[var(--ds-radius-lg)]",
          sideClass,
          className,
        )}
        {...props}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--ds-border-subtle)] px-4 py-3">
          <div>
            <VaulDrawer.Title className="ds-text-card-title">{title}</VaulDrawer.Title>
            {description ? (
              <VaulDrawer.Description className="ds-text-metadata mt-1">{description}</VaulDrawer.Description>
            ) : (
              <VaulDrawer.Description className="sr-only">{title}</VaulDrawer.Description>
            )}
          </div>
          <DrawerClose asChild>
            <IconButton aria-label="Close panel" icon={<X />} size="small" />
          </DrawerClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-[var(--ds-border-subtle)] bg-[var(--ds-surface-subtle)] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </VaulDrawer.Content>
    </DrawerPortal>
  );
}
