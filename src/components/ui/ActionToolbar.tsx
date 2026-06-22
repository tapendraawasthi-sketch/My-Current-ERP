import React from "react";
interface ActionToolbarProps {
  title?: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode };
  secondaryActions?: Array<{ label: string; onClick: () => void; icon?: React.ReactNode }>;
}
export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
}) => (
  <div className="flex items-center justify-between mb-4">
    {(title || subtitle) && (
      <div>
        {title && <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>}
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    )}
    <div className="flex items-center gap-2">
      {secondaryActions?.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
      {primaryAction && (
        <button
          onClick={primaryAction.onClick}
          className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors"
        >
          {primaryAction.icon}
          {primaryAction.label}
        </button>
      )}
    </div>
  </div>
);
