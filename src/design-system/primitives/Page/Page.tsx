import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { Button } from "../Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../Menu/DropdownMenu";
import { MoreHorizontal } from "lucide-react";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  status,
  primaryAction,
  secondaryActions,
  overflowActions,
  meta,
  tabs,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  status?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode[];
  overflowActions?: Array<{ label: string; onSelect: () => void; destructive?: boolean }>;
  meta?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 border-b border-[var(--ds-border-subtle)] pb-3", className)}>
      {breadcrumbs ? <div className="mb-2">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="ds-text-page-title">{title}</h1>
            {status}
          </div>
          {description ? <p className="ds-text-metadata mt-1 max-w-3xl">{description}</p> : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions}
          {primaryAction}
          {overflowActions?.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="quiet" size="small" aria-label="More actions" startIcon={<MoreHorizontal className="h-4 w-4" />}>
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflowActions.map((a) => (
                  <DropdownMenuItem key={a.label} destructive={a.destructive} onSelect={a.onSelect}>
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      {tabs ? <div className="mt-3">{tabs}</div> : null}
    </header>
  );
}

export function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn("ds-text-page-title", className)}>{children}</h1>;
}

export function PageDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("ds-text-metadata", className)}>{children}</p>;
}

export function PageActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function PageMeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-3 text-[13px] text-[var(--ds-text-muted)]", className)}>{children}</div>;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
}) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("text-[13px] text-[var(--ds-text-muted)]", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "text-[var(--ds-text-default)]" : undefined}>
                  {item.label}
                </span>
              ) : (
                <a className="hover:text-[var(--ds-text-link)]" href={item.href}>
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex gap-1 border-b border-[var(--ds-border-subtle)]", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "ds-focus-ring -mb-px border-b-2 border-transparent px-3 py-2 text-[14px] font-medium text-[var(--ds-text-muted)] data-[state=active]:border-[var(--ds-action-primary)] data-[state=active]:text-[var(--ds-text-strong)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("pt-4 outline-none", className)} {...props} />
));
TabsContent.displayName = "TabsContent";

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-[var(--ds-toolbar-gap)] rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subtle)] bg-[var(--ds-surface)] px-3 py-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StickyActionBar({
  primary,
  secondary,
  unsaved,
  className,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  unsaved?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ds-no-print sticky bottom-0 z-[var(--ds-z-sticky)] border-t border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-[var(--ds-text-muted)]">
          {unsaved ? "You have unsaved changes" : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  );
}

export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("mb-[var(--ds-section-gap)]", className)}>{children}</section>;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-2", className)}>
      <div>
        <h2 className="ds-text-section-title">{title}</h2>
        {description ? <p className="ds-text-metadata mt-0.5">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function ContentWell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subtle)] bg-[var(--ds-surface)] p-[var(--ds-card-padding)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DetailsPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-subtle)] p-4",
        className,
      )}
    >
      <h3 className="ds-text-card-title mb-3">{title}</h3>
      {children}
    </aside>
  );
}
