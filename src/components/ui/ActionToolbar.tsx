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
  <div className={`flex items-center justify-between mb-4 ${className || ""}`}>
    {(title || subtitle) && (
      <div>
        {title && <h1 className="text-[15px] font-semibold text-[#000000]">{title}</h1>}
        {subtitle && <p className="text-[11px] text-[#000000] mt-0.5">{subtitle}</p>}
      </div>
    )}
    <div className="flex items-center gap-2">
      {secondaryActions?.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 h-8 px-3 bg-white border border-[#9DC07A] text-[#000000] text-[12px] font-medium rounded-md hover:bg-[#EBF5E2] transition-colors"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
      {primaryAction && (
        <button
          onClick={primaryAction.onClick}
          className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md transition-colors"
        >
          {primaryAction.icon}
          {primaryAction.label}
        </button>
      )}
      {children}
    </div>
  </div>
);
