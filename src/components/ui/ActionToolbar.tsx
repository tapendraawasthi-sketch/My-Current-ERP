import React from "react";

interface ActionToolbarProps {
  title?: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode };
  secondaryActions?: Array<{ label: string; onClick: () => void; icon?: React.ReactNode }>;
  className?: string;
  children?: React.ReactNode;
}

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
        {title && <h1 className="text-[15px] font-semibold text-[var(--ox-text)]">{title}</h1>}
        {subtitle && <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">{subtitle}</p>}
      </div>
    )}
    <div className="flex items-center gap-2">
      {secondaryActions?.map((action, i) => (
        <button
          key={i}
          type="button"
          onClick={action.onClick}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3 text-[12px] font-medium text-[var(--ox-text)] transition-colors hover:bg-[var(--ox-surface-muted)]"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
      {primaryAction && (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--ox-primary)] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[var(--ox-primary-hover)]"
        >
          {primaryAction.icon}
          {primaryAction.label}
        </button>
      )}
      {children}
    </div>
  </div>
);
