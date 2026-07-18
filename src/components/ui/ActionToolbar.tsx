import React from "react";

interface ActionToolbarProps {
  title?: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    variant?: string;
  }>;
  className?: string;
  children?: React.ReactNode;
}

/** Legacy toolbar — tokens aligned to `--ds-*` until pages migrate to PageHeader. */
export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  className,
  children,
}) => (
  <div className={`mb-4 flex items-center justify-between ${className || ""}`}>
    {(title || subtitle) && (
      <div>
        {title && (
          <h1 className="text-[15px] font-semibold text-[var(--ds-text-strong)]">{title}</h1>
        )}
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">{subtitle}</p>
        )}
      </div>
    )}
    <div className="flex flex-wrap items-center gap-2">
      {secondaryActions?.map((action, i) => {
        const isPrimary = action.variant === "primary";
        return (
          <button
            key={i}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={
              isPrimary
                ? "inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-40"
                : "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 text-[12px] font-medium text-[var(--ds-text-default)] transition-colors hover:bg-[var(--ds-surface-muted)] disabled:opacity-40"
            }
          >
            {action.icon}
            {action.label}
          </button>
        );
      })}
      {primaryAction && (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[var(--ds-action-primary-hover)]"
        >
          {primaryAction.icon}
          {primaryAction.label}
        </button>
      )}
      {children}
    </div>
  </div>
);
